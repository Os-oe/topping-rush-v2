// FreshSkin V2 — helles Rendering ohne Blur-Tricks:
// voll deckender BG-Sprite (kein Trail-Fade), source-over (kein 'lighter'),
// vorgerenderte Bodenschatten-Ellipsen (kein Laufzeit-shadowBlur),
// Squash & Stretch, konturierte Splash-Tropfen, Baloo-2-Popups mit Doppelkontur.
// Juice-Kaskade aus V1 bleibt: Sound sofort → Flash +20 ms → Partikel +50 ms → Text +100 ms.
import { CFG } from './config.js';
import { getSprites } from './sprites.js';
import { ParticlePool } from './particles.js';

const C = CFG.colors;
// Catch-Partikel in der Objektfarbe (an die KI-Sprite-Palette angelehnt)
const TOPPING_COLORS = {
  nar: 'red', limon: 'yellow', karpuz: 'magenta', nane: 'lime',
  visne: 'red', portakal: 'orange', cilek: 'red', cay: 'amber',
};
// Konfetti-Palette (ŞERBET-RUSH-Banner + Frenzy-Burst)
const CONFETTI = ['#2EC4B6', '#FF6B6B', '#FFC53D', '#D81E5B', '#3FA34D'];

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class FreshSkin {
  constructor() {
    this.sprites = getSprites();
    this.particles = new ParticlePool(this.sprites);
    this.popups = []; // {text,x,y,color,age,ttl,size,vx,vy,rot,rotV}
    this.shakeMag = 0;
    this.shakeT = 0;
    this.edgeFlash = null; // Chili: oranger RAND-Flash {age, ttl} — nie Fullscreen
    this.centerText = null; // {text, age, ttl, color, size, confetti}
    this.queue = []; // Timing-Kaskade: {at, fn}
    this.catchSquash = 1; // Becher: 130 % breit / 70 % hoch → zurück (ease-out-back)
    this.wobble = null; // {age, dur, amp} ±6–8°, 250 ms gedämpfte Sinus
    this.catchGhosts = []; // Objekt-Weißblitz ≤ 60 ms (70 % Tint auf dem Sprite)
    this.dispW = null; // animierte Becher-Breite (Schrumpf-/XXL-Gleiten)
    this.ringPulses = []; // Power-Up-Collect: expandierender Ring
    this.clock = 0;
    this.bgSprite = null;
    this.bgFrenzy = null;
    this.edgeSprite = null; // vorgerenderter oranger Rand-Verlauf
    this.bgSize = '';
    this._tintCache = new Map();
  }

  // ---------- Helle Bühne: 3-Stop-Verlauf + Rand-Blobs + Iznik-Layer ----------
  // Mittleres Drittel (Fallschneise + Fangzone) bleibt formfrei.
  // Iznik-8-Stern: Kachel ≥ 120 px, Ton-in-Ton, Opacity 3–5 %, nur obere 25 % + unterer Rand.
  buildBg(game) {
    const make = (stops, blobAlpha) => {
      const cv = document.createElement('canvas');
      cv.width = game.W;
      cv.height = game.H;
      const x = cv.getContext('2d');
      const grad = x.createLinearGradient(0, 0, 0, game.H);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.55, stops[1]);
      grad.addColorStop(1, stops[2]);
      x.fillStyle = grad;
      x.fillRect(0, 0, game.W, game.H);

      // 2–4 sehr große Deko-Blobs (Ø 30–60 % Screenbreite), nur Ränder/Ecken,
      // 4–7 % Lightness-Differenz → sehr dezente Ton-in-Ton-Flächen.
      const blobs = [
        { cx: 0.04, cy: 0.10, r: 0.26, c: `rgba(255,255,255,${0.5 * blobAlpha})` },   // heller, Ecke oben links
        { cx: 0.97, cy: 0.30, r: 0.24, c: `rgba(240,170,120,${0.22 * blobAlpha})` },  // dunkler, Rand rechts
        { cx: 0.02, cy: 0.86, r: 0.28, c: `rgba(235,150,120,${0.20 * blobAlpha})` },  // Ecke unten links
        { cx: 0.95, cy: 0.94, r: 0.22, c: `rgba(255,255,255,${0.45 * blobAlpha})` },  // Ecke unten rechts
      ];
      for (const b of blobs) {
        const r = b.r * game.W;
        const g2 = x.createRadialGradient(b.cx * game.W, b.cy * game.H, 0, b.cx * game.W, b.cy * game.H, r);
        g2.addColorStop(0, b.c);
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g2;
        x.fillRect(0, 0, game.W, game.H);
      }

      // Iznik-/8-Stern-Ornament ({8/3}-Geometrie, KEIN Rub-el-Hizb):
      // Ton-in-Ton-Konturbraun, alpha 0.04 (3–5 %), Kachel 132 px (≥ 120).
      const drawStars = (y0, y1) => {
        x.save();
        x.beginPath();
        x.rect(0, y0, game.W, y1 - y0);
        x.clip();
        x.strokeStyle = 'rgba(74,46,31,0.04)';
        x.lineWidth = 1.4;
        const T = 132;
        const R = T * 0.36;
        const r = R * 0.42;
        for (let gy = Math.floor(y0 / (T * 0.86)) - 1; gy * T * 0.86 < y1 + T; gy++) {
          for (let gx = -1; gx * T < game.W + T; gx++) {
            const cx = gx * T + (gy % 2 ? T / 2 : 0);
            const cy = gy * T * 0.86;
            x.beginPath();
            for (let k = 0; k < 16; k++) {
              const rad = k % 2 === 0 ? R : r;
              const a = (k * Math.PI) / 8 - Math.PI / 2;
              const px = cx + Math.cos(a) * rad;
              const py = cy + Math.sin(a) * rad;
              k === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
            }
            x.closePath();
            x.stroke();
          }
        }
        x.restore();
      };
      drawStars(0, game.H * 0.25);         // obere 25 %
      drawStars(game.H * 0.92, game.H);    // unterer Rand
      return cv;
    };
    this.bgSprite = make(CFG.bgStops, 1);
    // Frenzy: gleiche Helligkeit, wärmer gesättigt — Lesbarkeitsregeln gelten weiter
    this.bgFrenzy = make(['#FFF1D6', '#FFD9A6', '#FFC2B0'], 1.3);

    // Rand-Flash-Sprite (Chili): oranger Verlauf von allen 4 Kanten nach innen
    const e = document.createElement('canvas');
    e.width = game.W;
    e.height = game.H;
    const ex = e.getContext('2d');
    const D = Math.round(Math.min(game.W, game.H) * 0.16);
    const mk = (x0, y0, x1, y1) => {
      const g = ex.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(241,100,30,0.85)');
      g.addColorStop(1, 'rgba(241,100,30,0)');
      return g;
    };
    ex.fillStyle = mk(0, 0, D, 0); ex.fillRect(0, 0, D, game.H);
    ex.fillStyle = mk(game.W, 0, game.W - D, 0); ex.fillRect(game.W - D, 0, D, game.H);
    ex.fillStyle = mk(0, 0, 0, D); ex.fillRect(0, 0, game.W, D);
    ex.fillStyle = mk(0, game.H, 0, game.H - D); ex.fillRect(0, game.H - D, game.W, D);
    this.edgeSprite = e;

    this.bgSize = `${game.W}x${game.H}`;
  }

  // Weiß-Tint-Variante eines Sprites (70 %), einmalig vorgerendert
  whiteTint(src) {
    let t = this._tintCache.get(src);
    if (!t) {
      const cv = document.createElement('canvas');
      cv.width = src.width;
      cv.height = src.height;
      const x = cv.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = 'rgba(255,255,255,0.7)';
      x.fillRect(0, 0, cv.width, cv.height);
      this._tintCache.set(src, (t = cv));
    }
    return t;
  }

  schedule(delayMs, fn) {
    this.queue.push({ at: this.clock + delayMs / 1000, fn });
  }

  addPopup(text, x, y, color, size = 24) {
    this.popups.push({
      text, x, y, color, size,
      age: 0, ttl: 0.6, // Konzept: 600 ms
      vy: -133, // ≈ 80 px Aufstieg über 0,6 s
      vx: 0, rot: 0, rotV: 0,
    });
    if (this.popups.length > 24) this.popups.shift();
  }

  scatterText(text, x, y, color) {
    // Combo-Text zerbricht: einzelne Zeichen fliegen auseinander (Wespe)
    const chars = [...text];
    chars.forEach((ch, i) => {
      this.popups.push({
        text: ch, x: x + (i - chars.length / 2) * 16, y, color,
        age: 0, ttl: 0.8, size: 26,
        vx: (Math.random() - 0.5) * 380,
        vy: -120 - Math.random() * 150,
        rot: 0, rotV: (Math.random() - 0.5) * 10,
        gravity: 700,
      });
    });
  }

  spriteFor(it) {
    const S = this.sprites;
    if (it.type === 'topping') return S.toppings[it.variant] || S.toppings.nar;
    if (it.type === 'chili') return S.chili;
    if (it.type === 'wasp') return S.wasp;
    return S.capsules[it.variant] || S.capsules.magnet;
  }

  // Juice-Events (aus main.js) — jede Aktion ≥ 3 Feedback-Kanäle
  handleEvent(type, data, game) {
    if (type === 'catch') {
      const it = data.item;
      const colorKey = TOPPING_COLORS[it.variant] || 'white';
      // Objekt-Weißblitz ≤ 60 ms (Flash-Kanal, +20 ms)
      const spr = this.sprites.toppings[it.variant] || this.sprites.toppings.nar;
      this.schedule(20, () => this.catchGhosts.push({ spr, x: it.x, y: it.y, age: 0, ttl: 0.06 }));
      // Splash 8–14 konturierte Tropfen in Objektfarbe (+50 ms), Text +100 ms
      this.schedule(50, () => this.particles.spawn(11, it.x, it.y, colorKey, { size: 9 }));
      this.schedule(100, () => this.addPopup(`+${data.pts}`, it.x, it.y - 14, C.lime));
      this.catchSquash = 0; // Squash & Stretch 130/70 → ease-out-back
      this.wobble = { age: 0, dur: 0.25, amp: (6.5 * Math.PI) / 180 };
      navigator.vibrate?.(6);
    } else if (type === 'comboMilestone') {
      this.centerText = { text: `COMBO ×${data.streak}`, age: 0, ttl: 0.9, color: C.magenta, size: 44 };
      this.shake(2.5, 0.15); // Shake NUR Combo-Meilenstein/Chili (dezenter als V1)
    } else if (type === 'chili') {
      const it = data.item;
      // Hitze: oranger RAND-Flash statt Fullscreen (+20 ms)
      this.schedule(20, () => (this.edgeFlash = { age: 0, ttl: 0.35 }));
      this.schedule(50, () => this.particles.spawn(14, it.x, it.y, 'orange', { speedMin: 240, speedMax: 420, size: 10 }));
      this.schedule(100, () => this.addPopup('ZU SCHARF!', it.x, it.y - 10, C.orange, 27));
      this.shake(4, 0.25);
      this.wobble = { age: 0, dur: 0.3, amp: (8 * Math.PI) / 180 };
      navigator.vibrate?.([30, 40, 60]);
    } else if (type === 'wasp') {
      const it = data.item;
      if (data.lostStreak >= 2) {
        this.schedule(100, () => this.scatterText(`×${data.lostStreak}`, game.cup.x, game.cupY - 40, C.magenta));
      } else {
        this.schedule(100, () => this.addPopup('AUTSCH', it.x, it.y - 10, C.yellow));
      }
      this.schedule(50, () => this.particles.spawn(8, it.x, it.y, 'yellow', { size: 8 }));
      navigator.vibrate?.(20); // kein Shake (V2: nur Meilenstein/Chili)
    } else if (type === 'powerup') {
      const it = data.item;
      const label = { magnet: 'MAGNET', xxl: 'XXL', slowmo: 'ZEITLUPE' }[data.kind];
      this.ringPulses.push({ x: game.cup.x, y: game.cupY + CFG.cupH / 2, age: 0, ttl: 0.45, color: C.yellow });
      this.schedule(50, () => this.particles.spawn(12, it.x, it.y, 'yellow', { size: 9 }));
      this.schedule(100, () => this.addPopup(label, it.x, it.y - 16, C.yellow, 24));
      navigator.vibrate?.(12);
    } else if (type === 'frenzy') {
      // ŞERBET-RUSH-Banner konfetti-bunt (statt Neon)
      this.centerText = {
        text: 'ŞERBET-RUSH ×2!', sub: 'Doppelte Punkte!',
        age: 0, ttl: 1.6, color: C.magenta, size: 38, confetti: true,
      };
      this.schedule(60, () => {
        CONFETTI.slice(0, 4).forEach((c, i) => {
          const key = ['teal', 'red', 'yellow', 'magenta'][i];
          this.particles.spawn(6, game.W / 2 + (i - 1.5) * 40, game.H * 0.3, key, { size: 9, up: 160 });
        });
      });
      this.shake(3, 0.2);
    }
  }

  shake(mag, dur) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.min(dur, 0.25); // V2: 150–250 ms
  }

  // Overlay-Canvas für Texte/Flash: pro Frame gecleart — Schrift bleibt crisp
  ensureFx(game) {
    if (!this.fx) {
      const cv = document.createElement('canvas');
      cv.id = 'fx-canvas';
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      game.canvas.parentElement.appendChild(cv);
      this.fxCanvas = cv;
      this.fx = cv.getContext('2d');
    }
    if (this.fxCanvas.width !== game.canvas.width || this.fxCanvas.height !== game.canvas.height) {
      this.fxCanvas.width = game.canvas.width;
      this.fxCanvas.height = game.canvas.height;
    }
    this.fx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    return this.fx;
  }

  // Text mit Doppelkontur: 1–2 px weiße Außenkontur um 4–6 px dunkle Kontur
  outlinedText(ctx, text, x, y, fill, size, weight = 800) {
    ctx.font = `${weight} ${size}px 'Baloo 2', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(7, size * 0.30);
    ctx.strokeText(text, x, y);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = Math.max(4.5, size * 0.19);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  render(game) {
    const ctx = game.ctx;
    const fx = this.ensureFx(game);
    const dt = 1 / 60; // Render-Takt (rAF); Sim nutzt echtes dt
    this.clock += dt;

    // Kaskaden-Queue
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.clock >= this.queue[i].at) {
        this.queue[i].fn();
        this.queue.splice(i, 1);
      }
    }

    // Voll deckender Hintergrund — kein Trail, kein Fade
    if (this.bgSize !== `${game.W}x${game.H}`) this.buildBg(game);
    ctx.drawImage(game.frenzy ? this.bgFrenzy : this.bgSprite, 0, 0, game.W, game.H);

    // Screen-Shake (ein Offset für beide Layer)
    let shX = 0;
    let shY = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.shakeMag *= 0.85;
      shX = (Math.random() * 2 - 1) * this.shakeMag;
      shY = (Math.random() * 2 - 1) * this.shakeMag;
    } else {
      this.shakeMag = 0;
    }
    ctx.save();
    ctx.translate(shX, shY);

    const S = this.sprites;

    // ---------- Bodenschatten zuerst (liegen unter allen Objekten) ----------
    for (const it of game.items) {
      const e = this.spriteFor(it);
      const sw = e.w * 0.92;
      const sh = sw * 0.34;
      ctx.drawImage(S.shadow, (it.x - sw / 2) | 0, (it.y + e.h * 0.45 + e.h * CFG.shadow.offsetYFrac - sh / 2) | 0, sw | 0, sh | 0);
    }
    // Becher-Schatten
    const cup = game.cup;
    if (this.dispW == null) this.dispW = cup.w;
    this.dispW += (cup.w - this.dispW) * (1 - Math.pow(0.75, dt * 60));
    const cupShW = this.dispW * 1.15;
    ctx.drawImage(S.shadow, (cup.x - cupShW / 2) | 0, (game.cupY + CFG.cupH - 6) | 0, cupShW | 0, (cupShW * 0.3) | 0);

    // ---------- Items (source-over, Fall-Stretch 105/95 %) ----------
    for (const it of game.items) {
      const x = it.x | 0;
      const y = it.y | 0;
      const e = this.spriteFor(it);
      ctx.save();
      ctx.translate(x, y);
      if (it.type === 'topping') {
        ctx.rotate(Math.sin(it.rot) * 0.35);
        ctx.scale(0.95, 1.05); // Fall-Stretch
      } else if (it.type === 'chili') {
        // Gefahr-Telegraphing ohne Glow: schnelles Zittern + Puls
        ctx.rotate(Math.sin(it.rot) * 0.2 + Math.sin(game.t * 18) * 0.06);
        const p = 1 + Math.sin(game.t * 10) * 0.05;
        ctx.scale(0.95 * p, 1.05 * p);
      } else if (it.type === 'wasp') {
        const dir = Math.cos(2 * Math.PI * CFG.waspHz * (game.t - it.born)) >= 0 ? 1 : -1;
        // Flug-Bob statt 2-Frame-Flügelschlag (ein PNG)
        ctx.rotate(Math.sin(game.t * 16) * 0.08 * dir);
        ctx.scale(dir, 1 + Math.sin(game.t * 22) * 0.04);
      } else {
        const pulse = 1 + Math.sin(game.t * 6) * 0.08;
        ctx.scale(pulse, pulse);
      }
      ctx.drawImage(e.cv, -e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    }

    // ---------- Objekt-Weißblitz (≤ 60 ms, 70 % Tint — nie Fullscreen) ----------
    for (let i = this.catchGhosts.length - 1; i >= 0; i--) {
      const gh = this.catchGhosts[i];
      gh.age += dt;
      if (gh.age >= gh.ttl) {
        this.catchGhosts.splice(i, 1);
        continue;
      }
      const t = this.whiteTint(gh.spr.cv);
      ctx.save();
      ctx.translate(gh.x | 0, gh.y | 0);
      const k = 1 + (gh.age / gh.ttl) * 0.15;
      ctx.scale(k, k);
      ctx.drawImage(t, -gh.spr.w / 2, -gh.spr.h / 2, gh.spr.w, gh.spr.h);
      ctx.restore();
    }

    // ---------- Becher: Squash & Stretch + Wobble ----------
    const wQ = Math.round(this.dispW / 4) * 4; // 4-px-Quantisierung: begrenzt den Sprite-Cache
    const hot = game.t < cup.shrinkUntil; // Chili: Becher glüht 3 s warm
    const { cv, pad } = S.cup(wQ, hot);
    // Fang: 130 % breit / 70 % hoch → zurück in ~150 ms (ease-out-back)
    this.catchSquash = Math.min(1, this.catchSquash + dt / 0.15);
    const e = easeOutBack(this.catchSquash);
    const sx = 1.3 + (1 - 1.3) * e;
    const sy = 0.7 + (1 - 0.7) * e;
    // Wobble ±6–8°, 2–3 Schwingungen, gedämpfte Sinus
    let rot = 0;
    if (this.wobble) {
      this.wobble.age += dt;
      const w = this.wobble;
      if (w.age >= w.dur) this.wobble = null;
      else {
        const p = w.age / w.dur;
        rot = Math.sin(p * Math.PI * 5) * w.amp * (1 - p);
      }
    }
    ctx.save();
    ctx.translate(cup.x | 0, game.cupY + CFG.cupH);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.drawImage(cv, -wQ / 2 - pad, -CFG.cupH - pad); // Pivot: Becherboden
    ctx.restore();

    // Power-Up-Collect: Ring-Puls (normales Blending)
    for (let i = this.ringPulses.length - 1; i >= 0; i--) {
      const r = this.ringPulses[i];
      r.age += dt;
      if (r.age >= r.ttl) {
        this.ringPulses.splice(i, 1);
        continue;
      }
      const k = r.age / r.ttl;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.lineWidth = 6 * (1 - k) + 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 20 + k * 130, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Aktive Power-Ups: Timer-Ring am Becher
    const rings = [];
    if (game.t < cup.magnetUntil) rings.push({ frac: (cup.magnetUntil - game.t) / CFG.magnetDur, color: C.magenta });
    if (game.t < cup.xxlUntil) rings.push({ frac: (cup.xxlUntil - game.t) / CFG.xxlDur, color: C.teal });
    if (game.t < cup.slowmoUntil) rings.push({ frac: (cup.slowmoUntil - game.t) / CFG.slowmoDur, color: C.lime });
    rings.forEach((r, i) => {
      const rad = cup.w / 2 + 16 + i * 9;
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cup.x, game.cupY + CFG.cupH / 2, rad, -Math.PI / 2, -Math.PI / 2 + r.frac * Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cup.x, game.cupY + CFG.cupH / 2, rad, -Math.PI / 2, -Math.PI / 2 + r.frac * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // Magnet-Radius dezent anzeigen
    if (game.t < cup.magnetUntil) {
      ctx.strokeStyle = 'rgba(216,30,91,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -game.t * 40;
      ctx.beginPath();
      ctx.arc(cup.x, game.cupY, CFG.magnetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---------- Partikel (konturierte Tropfen, normales Blending) ----------
    this.particles.updateAndDraw(ctx, dt);
    ctx.restore(); // Shake (Spiel-Layer)

    // ---------- Overlay: Popups + Center-Text + Rand-Flash (crisp) ----------
    fx.clearRect(0, 0, game.W, game.H);
    fx.save();
    fx.translate(shX, shY);
    fx.textAlign = 'center';
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      if (p.age >= p.ttl) {
        this.popups.splice(i, 1);
        continue;
      }
      const k = p.age / p.ttl;
      // Pop-in 1,3 → 1,0 in 80 ms, Fade ab 50 %
      const popIn = p.age < 0.08 ? 0.8 + (p.age / 0.08) * 0.5 : k < 0.25 ? 1.3 - (k - 0.08) * 1.8 : 1;
      p.vy += (p.gravity ?? 0) * dt;
      p.x += (p.vx ?? 0) * dt;
      p.y += p.vy * dt * (p.gravity ? 1 : 0.9);
      p.rot += (p.rotV ?? 0) * dt;
      fx.save();
      fx.translate(p.x, p.y);
      fx.rotate(p.rot);
      fx.scale(popIn, popIn);
      fx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
      this.outlinedText(fx, p.text, 0, 0, p.color, p.size);
      fx.restore();
    }
    fx.globalAlpha = 1;

    // ---------- Center-Text (Combo-Meilenstein / ŞERBET-RUSH konfetti-bunt) ----------
    if (this.centerText) {
      const t = this.centerText;
      t.age += dt;
      if (t.age >= t.ttl) this.centerText = null;
      else {
        const k = t.age / t.ttl;
        const scale = t.age < 0.09 ? 1 + 0.33 * (1 - t.age / 0.09) : k > 0.6 ? 1 - (k - 0.6) * 0.25 : 1;
        fx.save();
        fx.translate(game.W / 2, game.H * 0.32);
        fx.scale(scale, scale);
        fx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        if (t.confetti) {
          // Buchstaben einzeln in Konfetti-Farben (gemeinsame Doppelkontur-Optik)
          fx.font = `800 ${t.size}px 'Baloo 2', sans-serif`;
          const chars = [...t.text];
          const widths = chars.map((ch) => fx.measureText(ch).width);
          const total = widths.reduce((a, b) => a + b, 0);
          let cx = -total / 2;
          chars.forEach((ch, i) => {
            const wobY = Math.sin(t.age * 10 + i * 0.9) * 3;
            this.outlinedText(fx, ch, cx + widths[i] / 2, wobY, CONFETTI[i % CONFETTI.length], t.size);
            cx += widths[i];
          });
        } else {
          this.outlinedText(fx, t.text, 0, 0, t.color, t.size);
        }
        if (t.sub) {
          this.outlinedText(fx, t.sub, 0, t.size * 0.95, '#FFFFFF', Math.round(t.size * 0.45), 700);
        }
        fx.restore();
        fx.globalAlpha = 1;
      }
    }
    fx.restore(); // Shake (Overlay)

    // ---------- Chili: oranger RAND-Flash (nie Fullscreen) ----------
    if (this.edgeFlash) {
      this.edgeFlash.age += dt;
      if (this.edgeFlash.age >= this.edgeFlash.ttl) this.edgeFlash = null;
      else {
        const k = this.edgeFlash.age / this.edgeFlash.ttl;
        fx.globalAlpha = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
        fx.drawImage(this.edgeSprite, 0, 0, game.W, game.H);
        fx.globalAlpha = 1;
      }
    }
  }
}
