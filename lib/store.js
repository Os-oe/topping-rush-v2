// Leaderboard-Store: Upstash Redis (KV_REST_API_URL/TOKEN) ODER In-Memory-
// Fallback mit identischer Schnittstelle. Client wird EXPLIZIT konstruiert —
// fromEnv() erwartet UPSTASH_-Namen, Vercel-Marketplace liefert KV_-Namen.
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const CFG_DEFAULTS = { banner: '', duration: 60, eventName: 'Kermes • Fatih Camii Fellbach' };

// v2.4: Presence-TTL „spielt gerade" — 100 s deckt eine 60–90-s-Runde + Puffer.
// Lokal via ENV verkürzbar (Playwright testet den Ablauf mit PLAYING_TTL_S=2).
const PLAYING_TTL_S = Number(process.env.PLAYING_TTL_S || 100);
const PLAYING_MAX = 6;

// ---------- In-Memory (lokal / Fallback, eine warme Function reicht für Demo) ----------
class MemoryStore {
  constructor() {
    this.mode = 'memory';
    this.scores = new Map(); // name → score
    this.meta = new Map(); // name → {ts, tries}
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

  async submit(name, score) {
    const old = this.scores.get(name);
    const changed = old === undefined || score > old;
    if (changed) this.scores.set(name, score);
    const m = this.meta.get(name) || { ts: 0, tries: 0 };
    m.tries += 1;
    if (changed) m.ts = Date.now();
    this.meta.set(name, m);
    return { changed, best: this.scores.get(name), tries: m.tries };
  }

  _sorted() {
    return [...this.scores.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  async top(n = 10) {
    return this._sorted().slice(0, n);
  }

  async rank(name) {
    const idx = this._sorted().findIndex((e) => e.name === name);
    return idx < 0 ? null : idx + 1;
  }

  async entryAt(rank1) {
    return this._sorted()[rank1 - 1] || null;
  }

  async reset() {
    this.scores.clear();
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

  async submit(name, score) {
    // ZADD GT CH: 1 = neu angelegt ODER nach oben aktualisiert
    const changed = await this.redis.zadd('lb', { gt: true, ch: true }, { score, member: name });
    const metaKey = `lb:meta:${name}`;
    const tries = await this.redis.hincrby(metaKey, 'tries', 1);
    if (changed === 1) await this.redis.hset(metaKey, { ts: Date.now() });
    const best = await this.redis.zscore('lb', name);
    return { changed: changed === 1, best: Number(best), tries };
  }

  async top(n = 10) {
    const flat = await this.redis.zrange('lb', 0, n - 1, { rev: true, withScores: true });
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ name: String(flat[i]), score: Number(flat[i + 1]) });
    return out;
  }

  async rank(name) {
    const r = await this.redis.zrank('lb', name, { rev: true });
    return r === null || r === undefined ? null : r + 1;
  }

  async entryAt(rank1) {
    const flat = await this.redis.zrange('lb', rank1 - 1, rank1 - 1, { rev: true, withScores: true });
    if (!flat.length) return null;
    return { name: String(flat[0]), score: Number(flat[1]) };
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
