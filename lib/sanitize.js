// Name-Sanitizing: 16 Zeichen, Whitelist-Regex, LDNOOBW-Blockliste (substring).
import { BADWORDS } from './badwords.js';

export const NAME_RE = /^[a-zA-ZäöüÄÖÜß0-9 ._-]+$/;
export const SCORE_CAP = 3000;

/** @returns {{ok: true, name: string} | {ok: false, error: string}} */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'name_missing' };
  const name = raw.trim().slice(0, 16);
  if (!name) return { ok: false, error: 'name_missing' };
  if (!NAME_RE.test(name)) return { ok: false, error: 'name_chars' };
  const lower = name.toLowerCase();
  if (BADWORDS.some((w) => lower.includes(w))) return { ok: false, error: 'name_blocked' };
  return { ok: true, name };
}

/** Score-Deckel: ganzzahlig, 0..3000 — sonst 400. */
export function validateScore(raw) {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > SCORE_CAP) {
    return { ok: false, error: 'score_invalid' };
  }
  return { ok: true, score: raw };
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
