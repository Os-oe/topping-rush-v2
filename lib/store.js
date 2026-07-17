// Leaderboard-Store: Upstash Redis (KV_REST_API_URL/TOKEN) ODER In-Memory-
// Fallback mit identischer Schnittstelle. Client wird EXPLIZIT konstruiert —
// fromEnv() erwartet UPSTASH_-Namen, Vercel-Marketplace liefert KV_-Namen.
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const CFG_DEFAULTS = { banner: '', duration: 60, eventName: 'Kermes • Fatih Camii Fellbach' };

// v2.5: Board-Modus „Jede Runde zählt" — jeder Submit wird eigener Sorted-Set-
// Member `name#<runId>`. Nur die Top 100 bleiben liegen (Speicher-Hygiene).
const LB_KEEP = 100;

// runId serverseitig: kompakter Zeitstempel base36 + 2 Zufallszeichen.
export function makeRunId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
}

// Anzeige-Name = Teil vor dem LETZTEN '#'. Bestands-Member ohne '#'
// (Selcuk, Osman) bleiben dadurch gültig — sie sind einfach Runden.
export function memberName(member) {
  const m = String(member);
  const i = m.lastIndexOf('#');
  return i < 0 ? m : m.slice(0, i);
}

// v2.4: Presence-TTL „spielt gerade" — 100 s deckt eine 60–90-s-Runde + Puffer.
// Lokal via ENV verkürzbar (Playwright testet den Ablauf mit PLAYING_TTL_S=2).
const PLAYING_TTL_S = Number(process.env.PLAYING_TTL_S || 100);
const PLAYING_MAX = 6;

// ---------- In-Memory (lokal / Fallback, eine warme Function reicht für Demo) ----------
export class MemoryStore {
  constructor() {
    this.mode = 'memory';
    this.lb = []; // v2.5: Runden-Einträge {member, score} — Member `name#runId`
    this.meta = new Map(); // name → {best, ts, tries} (namensbasiert, GT-Bestmarke)
    this.cfg = { ...CFG_DEFAULTS };
    this.rl = new Map(); // ip → [timestamps]
    this.rlPlaying = new Map(); // v2.4: eigener Bucket für /api/playing
    this.rounds = 0; // v2.4: Gesamtzähler gespielter Runden
    this.playing = new Map(); // v2.4: name → ts (Presence „spielt gerade")
  }

  async setPlaying(name) {
    this.playing.set(name, Date.now());
  }

  async clearPlaying(name) {
    this.playing.delete(name);
  }

  async playingList() {
    const now = Date.now();
    const out = [];
    for (const [name, ts] of this.playing) {
      if (now - ts < PLAYING_TTL_S * 1000) out.push(name);
      else this.playing.delete(name); // abgelaufen → aufräumen
    }
    return out.sort((a, b) => a.localeCompare(b)).slice(0, PLAYING_MAX);
  }

  async incrRounds() {
    this.rounds += 1;
    return this.rounds;
  }

  async getRounds() {
    return this.rounds;
  }

  // v2.5: plain Insert (kein Best-of mehr), danach Trim auf Top 100 —
  // analog ZADD + ZREMRANGEBYRANK lb 0 -101. rank = Position DIESER Runde
  // (null, wenn sie es nicht in die Top 100 schafft und sofort getrimmt wird).
  async submit(name, score) {
    const runId = makeRunId();
    const member = `${name}#${runId}`;
    this.lb.push({ member, score });
    this.lb = this._sorted().slice(0, LB_KEEP);

    const m = this.meta.get(name) || { best: null, ts: 0, tries: 0 };
    if (m.best === null) {
      // Alt-Bestand: Member ohne '#' trägt die bisherige Bestmarke des Namens
      const legacy = this.lb.find((e) => e.member === name);
      if (legacy) m.best = legacy.score;
    }
    m.tries += 1;
    const isNewBest = m.best === null || score > m.best; // GT-Vergleich
    if (isNewBest) {
      m.best = score;
      m.ts = Date.now();
    }
    this.meta.set(name, m);

    const idx = this.lb.findIndex((e) => e.member === member);
    return { runId, rank: idx < 0 ? null : idx + 1, best: m.best, isNewBest, tries: m.tries };
  }

  _sorted() {
    // Score absteigend; Gleichstand: Member absteigend (ZREVRANGE-Ordnung)
    return [...this.lb].sort((a, b) => b.score - a.score || b.member.localeCompare(a.member));
  }

  _entry(e) {
    return e ? { name: memberName(e.member), score: e.score, id: e.member } : null;
  }

  async top(n = 10) {
    return this._sorted().slice(0, n).map((e) => this._entry(e));
  }

  async entryAt(rank1) {
    return this._entry(this._sorted()[rank1 - 1]);
  }

  async reset() {
    this.lb = [];
    this.meta.clear();
    this.rounds = 0; // v2.4: Admin-Reset nullt auch den Runden-Zähler
  }

  async getConfig() {
    return { ...this.cfg };
  }

  async setConfig(key, value) {
    this.cfg[key] = value;
  }

  _hit(map, ip) {
    const now = Date.now();
    const arr = (map.get(ip) || []).filter((t) => now - t < 60_000);
    if (arr.length >= 10) {
      map.set(ip, arr);
      return false;
    }
    arr.push(now);
    map.set(ip, arr);
    return true;
  }

  async ratelimit(ip) {
    return this._hit(this.rl, ip);
  }

  // v2.4: gleiche Policy wie Score (10/60 s), aber EIGENER Bucket — jede Runde
  // feuert playing + score; ein gemeinsamer Bucket halbierte das Runden-Budget
  async ratelimitPlaying(ip) {
    return this._hit(this.rlPlaying, ip);
  }
}

// ---------- Upstash Redis ----------
class RedisStore {
  constructor(url, token) {
    this.mode = 'redis';
    this.redis = new Redis({ url, token }); // explizit, NICHT fromEnv()
    this.limiter = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'tr-rl',
    });
    // v2.4: gleiche Policy, eigener Bucket für /api/playing (s. MemoryStore)
    this.playingLimiter = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'tr-rl-p',
    });
  }

  async setPlaying(name) {
    await this.redis.setex(`playing:${name}`, PLAYING_TTL_S, 1);
  }

  async clearPlaying(name) {
    await this.redis.del(`playing:${name}`);
  }

  async playingList() {
    // SCAN statt KEYS (Event-Datenmengen sind klein, trotzdem sauber);
    // Frische garantiert Redis selbst via SETEX-TTL
    const names = [];
    let cursor = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, { match: 'playing:*', count: 100 });
      cursor = Number(next);
      for (const k of keys) names.push(String(k).slice('playing:'.length));
    } while (cursor !== 0);
    return names.sort((a, b) => a.localeCompare(b)).slice(0, PLAYING_MAX);
  }

  // v2.5: plain ZADD (kein GT mehr — jede Runde ist eigener Member), danach
  // Trim auf die Top 100. rank = ZREVRANK des NEUEN Members (ZRANK wäre der
  // aufsteigende Rang — Live-Falle 18.07.); null = direkt weggetrimmt.
  async submit(name, score) {
    const runId = makeRunId();
    const member = `${name}#${runId}`;
    await this.redis.zadd('lb', { score, member });
    await this.redis.zremrangebyrank('lb', 0, -(LB_KEEP + 1)); // Top 100 behalten

    const metaKey = `lb:meta:${name}`;
    const tries = await this.redis.hincrby(metaKey, 'tries', 1);
    let prevBest = await this.redis.hget(metaKey, 'best');
    if (prevBest == null) {
      // Alt-Bestand (Best-of-Ära): Member ohne '#' trägt die alte Bestmarke
      prevBest = await this.redis.zscore('lb', name);
    }
    const isNewBest = prevBest == null || score > Number(prevBest); // GT-Vergleich
    const best = isNewBest ? score : Number(prevBest);
    if (isNewBest) await this.redis.hset(metaKey, { best: score, ts: Date.now() });

    const r = await this.redis.zrevrank('lb', member);
    return { runId, rank: r === null || r === undefined ? null : r + 1, best, isNewBest, tries };
  }

  async top(n = 10) {
    const flat = await this.redis.zrange('lb', 0, n - 1, { rev: true, withScores: true });
    const out = [];
    for (let i = 0; i < flat.length; i += 2) {
      const member = String(flat[i]);
      out.push({ name: memberName(member), score: Number(flat[i + 1]), id: member });
    }
    return out;
  }

  async entryAt(rank1) {
    const flat = await this.redis.zrange('lb', rank1 - 1, rank1 - 1, { rev: true, withScores: true });
    if (!flat.length) return null;
    const member = String(flat[0]);
    return { name: memberName(member), score: Number(flat[1]), id: member };
  }

  async incrRounds() {
    return await this.redis.incr('lb:rounds');
  }

  async getRounds() {
    return Number(await this.redis.get('lb:rounds')) || 0;
  }

  async reset() {
    await this.redis.del('lb', 'lb:rounds'); // v2.4: Reset nullt auch rounds
    // Meta-Hashes wegräumen (SCAN, Event-Datenmengen sind klein)
    let cursor = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, { match: 'lb:meta:*', count: 100 });
      cursor = Number(next);
      if (keys.length) await this.redis.del(...keys);
    } while (cursor !== 0);
  }

  async getConfig() {
    const cfg = (await this.redis.hgetall('cfg')) || {};
    return {
      banner: cfg.banner != null ? String(cfg.banner) : CFG_DEFAULTS.banner,
      duration: cfg.duration != null ? Number(cfg.duration) : CFG_DEFAULTS.duration,
      eventName: cfg.eventName != null ? String(cfg.eventName) : CFG_DEFAULTS.eventName,
    };
  }

  async setConfig(key, value) {
    await this.redis.hset('cfg', { [key]: value });
  }

  async ratelimit(ip) {
    const { success } = await this.limiter.limit(ip);
    return success;
  }

  async ratelimitPlaying(ip) {
    const { success } = await this.playingLimiter.limit(ip);
    return success;
  }
}

let _store = null;
export function getStore() {
  if (_store) return _store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  _store = url && token ? new RedisStore(url, token) : new MemoryStore();
  return _store;
}
