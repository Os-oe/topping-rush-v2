// Eine Catch-all-Function für alle API-Routen — ein warmer Container teilt
// sich den In-Memory-Fallback-Store (MIXR-Lesson). Mit Upstash-ENV echte DB.
import { getStore } from '../lib/store.js';
import { sanitizeName, validateScore, clientIp } from '../lib/sanitize.js';

const ROUND_MIN = 60;
const ROUND_MAX = 90;

async function readBody(req) {
  if (req.body !== undefined) {
    // Vercel parst JSON bereits; String-Body noch selbst parsen
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const store = getStore();
  const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');

  try {
    // ---------- GET /api/leaderboard ----------
    if (path === '/api/leaderboard' && req.method === 'GET') {
      const [top, cfg, rounds, playing] = await Promise.all([
        store.top(10), store.getConfig(), store.getRounds(), store.playingList(),
      ]);
      return send(res, 200, {
        top, banner: cfg.banner, duration: cfg.duration, eventName: cfg.eventName, rounds, playing, mode: store.mode,
      });
    }

    // ---------- POST /api/playing (v2.4: Presence „spielt gerade") ----------
    if (path === '/api/playing' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_json' });
      const n = sanitizeName(body.name);
      if (!n.ok) return send(res, 400, { error: n.error });
      if (!(await store.ratelimitPlaying(clientIp(req)))) {
        return send(res, 429, { error: 'rate_limited' });
      }
      await store.setPlaying(n.name);
      return send(res, 200, { ok: true });
    }

    // ---------- POST /api/score ----------
    if (path === '/api/score' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_json' });

      const n = sanitizeName(body.name);
      if (!n.ok) return send(res, 400, { error: n.error });
      const s = validateScore(body.score);
      if (!s.ok) return send(res, 400, { error: s.error });

      if (!(await store.ratelimit(clientIp(req)))) {
        return send(res, 429, { error: 'rate_limited' });
      }

      await store.incrRounds(); // v2.4: jeder gültige Score-Submit = eine Runde
      await store.clearPlaying(n.name); // v2.4: Runde vorbei → Presence weg
      // v2.5 „Jede Runde zählt": rank = echter Rang DIESER Runde (Member
      // name#runId); Delta bezieht sich auf die nächsthöhere Runde.
      const { runId, rank, best, isNewBest, tries } = await store.submit(n.name, s.score);
      let deltaUp = null;
      if (rank && rank > 1) {
        const above = await store.entryAt(rank - 1);
        if (above) deltaUp = { rank: rank - 1, points: above.score - s.score };
      }
      const top = await store.top(10);
      return send(res, 200, { ok: true, runId, rank, best, isNewBest, tries, deltaUp, top });
    }

    // ---------- POST /api/admin ----------
    if (path === '/api/admin' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: 'bad_json' });
      const pin = String(process.env.ADMIN_PIN || '4242');
      if (String(body.pin || '') !== pin) {
        await new Promise((r) => setTimeout(r, 400)); // Brute-Force bremsen
        return send(res, 401, { error: 'unauthorized' });
      }
      const { action, value } = body;
      if (action === 'list') {
        const [entries, cfg] = await Promise.all([store.top(50), store.getConfig()]);
        return send(res, 200, {
          entries, banner: cfg.banner, duration: cfg.duration, eventName: cfg.eventName, mode: store.mode,
        });
      }
      if (action === 'reset') {
        await store.reset();
        return send(res, 200, { ok: true });
      }
      if (action === 'banner') {
        const banner = String(value ?? '').slice(0, 120);
        await store.setConfig('banner', banner);
        return send(res, 200, { ok: true, banner });
      }
      if (action === 'eventName') {
        const eventName = String(value ?? '').slice(0, 60);
        await store.setConfig('eventName', eventName);
        return send(res, 200, { ok: true, eventName });
      }
      if (action === 'duration') {
        const d = Number(value);
        if (!Number.isInteger(d) || d < ROUND_MIN || d > ROUND_MAX) {
          return send(res, 400, { error: 'duration_invalid' });
        }
        await store.setConfig('duration', d);
        return send(res, 200, { ok: true, duration: d });
      }
      return send(res, 400, { error: 'unknown_action' });
    }

    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error('api error', e);
    return send(res, 500, { error: 'internal' });
  }
}
