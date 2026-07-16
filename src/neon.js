// Neon-Skin: Rendering NUR mit vorgerenderten Glow-Sprites + 'lighter',
// Trail-Fade statt clearRect, Partikel-Pool, Juice-Kaskade
// (Sound sofort → Flash +20 ms → Partikel +50 ms → Text +100 ms).
import { CFG } from './config.js';
import { getSprites } from './sprites.js';
import { ParticlePool } from './particles.js';

const C = CFG.colors;
// Catch-Partikel in der Objektfarbe (Nachtrag v1.1)
const TOPPING_COLORS = {
  nar: 'red', limon: 'yellow', karpuz: 'magenta', nane: 'lime',
  visne: 'magenta', portakal: 'orange', cilek: 'red', cay: 'amber',
};

export class NeonSkin {
  constructor() {
    this.sprites = getSprites();
    this.particles = new ParticlePool(this.sprites);
    this.popups = []; // {text,x,y,color,age,ttl,size,vx,vy,rot,rotV}
    this.shakeMag = 0;
    this.shakeT = 0;
    this.flash = null; // {color, age, ttl}
    this.centerText = null; // {text, age, ttl, color, size}
    this.queue = []; // Timing-Kaskade: {at, fn}
    this.squashT = 1; // Becher-Squash
    this.dispW = null; // animierte Becher-Breite (Schrumpf-/XXL-Animation)
    this.ringPulses = []; // Power-Up-Collect: expandierender Ring
    this.clock = 0;
    this.bgPrimed = false;
    this.bgSprite = null; // Hintergrund mit Girih-Gitter (Nachtrag v1.1)
    this.bgFrenzy = null;
    this.bgSize = '';
  }

  // Girih-Hintergrund: generisches 8-Stern-Liniengitter (Khatam-Geometrie,
  // KEIN Rub-el-Hizb-Zeichen), Iznik-Kobalt #1a3a8f bei ~7 % Opazität.
  // Wird als Trail-Fill benutzt (drawImage @ alpha 0.3) — Muster bleibt so
  // dauerhaft dezent unter dem Motion-Blur, stört die Lesbarkeit nie.
  buildBg(game) {
    const make = (baseColor) => {
      const cv = document.createElement('canvas');
      cv.width = game.W;
      cv.height = game.H;
      const x = cv.getContext('2d');
      x.fillStyle = baseColor;
      x.fillRect(0, 0, game.W, game.H);
      // Iznik-Kobalt-Verlauf als Akzent
      const grad = x.createRadialGradient(game.W / 2, -game.H * 0.2, 0, game.W / 2, -game.H * 0.2, game.H);
      grad.addColorStop(0, 'rgba(26,58,143,0.14)');
      grad.addColorStop(1, 'rgba(26,58,143,0)');
      x.fillStyle = grad;
      x.fillRect(0, 0, game.W, game.H);
      // 8-Stern-Gitter ({8/3}-Sternpolygon + Verbindungsdiagonalen)
      x.strokeStyle = 'rgba(26,58,143,0.07)';
      x.lineWidth = 1;
      const T = 130;
      const R = T * 0.34;
      const r = R * 0.42;
      for (let gy = 0; gy * T < game.H + T; gy++) {
        for (let gx = 0; gx * T < game.W + T; gx++) {
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
          // Verbindungslinien zum Gitter
          x.beginPath();
          x.moveTo(cx + R, cy);
          x.lineTo(cx + T - R, cy);
          x.stroke();
        }
      }
      return cv;
    };
    this.bgSprite = make(CFG.bg);
    this.bgFrenzy = make('#1a0716');
    this.bgSize = `${game.W}x${game.H}`;
  }

  schedule(delayMs, fn) {
    this.queue.push({ at: this.clock + delayMs / 1000, fn });
  }

  addPopup(text, x, y, color, size = 22) {
    this.popups.push({
      text, x, y, color, size,
      age: 0, ttl: 0.7, // 0,6–0,8 s
      vy: -70, // 40–60 px Drift über ttl
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

  // Juice-Events (aus main.js) — jede Aktion ≥ 3 Feedback-Kanäle
  handleEvent(type, data, game) {
    if (type === 'catch') {
      const it = data.item;
      const colorKey = TOPPING_COLORS[it.variant] || 'white';
      // Partikel +50 ms, Text +100 ms (Sound sofort in audio.js)
      this.schedule(50, () => this.particles.spawn(10, it.x, it.y, colorKey, { size: 16 }));
      this.schedule(100, () => this.addPopup(`+${data.pts}`, it.x, it.y - 14, C.lime));
      this.squashT = 0;
      navigator.vibrate?.(6);
    } else if (type === 'comboMilestone') {
      this.centerText = { text: `COMBO ×${data.streak}`, age: 0, ttl: 0.9, color: C.magenta, size: 44 };
      this.shake(3.5, 0.15);
    } else if (type === 'chili') {
      const it = data.item;
      // Hitze-Flash: orange statt weiß/rot (Nachtrag v1.1)
      this.schedule(20, () => (this.flash = { color: 'rgba(255,103,0,0.4)', age: 0, ttl: 0.09 }));
      this.schedule(50, () => this.particles.spawn(22, it.x, it.y, 'orange', { speedMin: 250, speedMax: 420, size: 18 }));
      this.schedule(100, () => this.addPopup('ZU SCHARF!', it.x, it.y - 10, C.orange, 26));
      this.shake(9, 0.28);
      navigator.vibrate?.([30, 40, 60]);
    } else if (type === 'wasp') {
      const it = data.item;
      if (data.lostStreak >= 2) {
        this.schedule(100, () => this.scatterText(`×${data.lostStreak}`, game.cup.x, game.cupY - 40, C.magenta));
      } else {
        this.schedule(100, () => this.addPopup('AUTSCH', it.x, it.y - 10, C.yellow));
      }
      this.schedule(50, () => this.particles.spawn(8, it.x, it.y, 'yellow', { size: 12 }));
      this.shake(2, 0.1);
      navigator.vibrate?.(20);
    } else if (type === 'powerup') {
      const it = data.item;
      const label = { magnet: 'MAGNET', xxl: 'XXL', slowmo: 'ZEITLUPE' }[data.kind];
      this.ringPulses.push({ x: game.cup.x, y: game.cupY + CFG.cupH / 2, age: 0, ttl: 0.45, color: C.yellow });
      this.schedule(50, () => this.particles.spawn(14, it.x, it.y, 'yellow', { size: 16 }));
      this.schedule(100, () => this.addPopup(label, it.x, it.y - 16, C.yellow, 24));
      navigator.vibrate?.(12);
    } else if (type === 'frenzy') {
      // Nachtrag v1.1: Şerbet-Branding (osmanische Frucht-Sorbetgetränke)
      this.centerText = {
        text: 'ŞERBET-RUSH ×2!', sub: 'Doppelte Punkte!',
        age: 0, ttl: 1.6, color: C.magenta, size: 40, font: 'Bungee',
      };
      this.shake(4, 0.2);
    }
  }

  shake(mag, dur) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.min(dur, 0.3); // nie > 0,3 s
  }

  // Overlay-Canvas für Texte/Flash: wird pro Frame gecleart — Trail-Fade
  // auf dem Spiel-Canvas würde Schrift sonst ghosten (Sichtprüfung Gate 3).
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

    // Hintergrund-Sprite (inkl. Girih-Gitter) als Trail-Fill: Erst-Frame voll,
    // danach drawImage @ 0.3 = Motion-Blur + dauerhaft dezentes Muster
    if (this.bgSize !== `${game.W}x${game.H}`) this.buildBg(game);
    const bg = game.frenzy ? this.bgFrenzy : this.bgSprite;
    if (!this.bgPrimed) {
      ctx.drawImage(bg, 0, 0, game.W, game.H);
      this.bgPrimed = true;
    }
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bg, 0, 0, game.W, game.H);
    ctx.globalAlpha = 1;

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

    // ---------- Items (drawImage, Glow via 'lighter') ----------
    ctx.globalCompositeOperation = 'lighter';
    for (const it of game.items) {
      const x = it.x | 0;
      const y = it.y | 0;
      if (it.type === 'topping') {
        const spr = S.toppings[it.variant] || S.toppings.nar;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(it.rot) * 0.35);
        ctx.drawImage(spr, -32, -32);
        ctx.restore();
      } else if (it.type === 'chili') {
        const frame = ((game.t * 8) | 0) % 2; // pulsierender Orange-Glow
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(it.rot) * 0.2);
        ctx.drawImage(S.chili[frame], -36, -36);
        ctx.restore();
      } else if (it.type === 'wasp') {
        const frame = ((game.t * 14) | 0) % 2; // Flügelschlag
        const dir = Math.cos(2 * Math.PI * CFG.waspHz * (game.t - it.born)) >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.drawImage(S.wasp[frame], -40, -32);
        ctx.restore();
      } else if (it.type === 'powerup') {
        const pulse = 1 + Math.sin(game.t * 6) * 0.08;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pulse, pulse);
        ctx.drawImage(S.capsules[it.variant] || S.capsules.magnet, -38, -38);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---------- Becher (Breite animiert: Schrumpf/XXL gleiten statt springen) ----------
    const cup = game.cup;
    if (this.dispW == null) this.dispW = cup.w;
    this.dispW += (cup.w - this.dispW) * (1 - Math.pow(0.75, dt * 60));
    const wQ = Math.round(this.dispW / 4) * 4; // 4-px-Quantisierung: begrenzt den Sprite-Cache
    const hot = game.t < cup.shrinkUntil; // Chili: Becher glüht 3 s rötlich
    const { cv, pad } = S.cup(wQ, hot);
    this.squashT = Math.min(1, this.squashT + dt / 0.12);
    const squash = 1 - 0.16 * Math.sin(Math.min(this.squashT, 1) * Math.PI); // kurzer Squash
    ctx.save();
    ctx.translate(cup.x | 0, game.cupY + CFG.cupH / 2);
    ctx.scale(2 - squash, squash);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(cv, -wQ / 2 - pad, -CFG.cupH / 2 - pad);
    ctx.restore();

    // Power-Up-Collect: Ring-Puls
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.ringPulses.length - 1; i >= 0; i--) {
      const r = this.ringPulses[i];
      r.age += dt;
      if (r.age >= r.ttl) {
        this.ringPulses.splice(i, 1);
        continue;
      }
      const k = r.age / r.ttl;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 20 + k * 130, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Aktive Power-Ups: Timer-Ring + Aura am Becher
    const rings = [];
    if (game.t < cup.magnetUntil) rings.push({ frac: (cup.magnetUntil - game.t) / CFG.magnetDur, color: C.magenta });
    if (game.t < cup.xxlUntil) rings.push({ frac: (cup.xxlUntil - game.t) / CFG.xxlDur, color: C.cyan });
    if (game.t < cup.slowmoUntil) rings.push({ frac: (cup.slowmoUntil - game.t) / CFG.slowmoDur, color: C.lime });
    rings.forEach((r, i) => {
      const rad = cup.w / 2 + 16 + i * 9;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cup.x, game.cupY + CFG.cupH / 2, rad, -Math.PI / 2, -Math.PI / 2 + r.frac * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // Magnet-Radius dezent anzeigen
    if (game.t < cup.magnetUntil) {
      ctx.strokeStyle = 'rgba(255,45,149,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -game.t * 40;
      ctx.beginPath();
      ctx.arc(cup.x, game.cupY, CFG.magnetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Chili-Schrumpf: das rötliche Glühen kommt aus dem Hot-Cup-Sprite (oben)

    // ---------- Partikel ----------
    this.particles.updateAndDraw(ctx, dt);
    ctx.restore(); // Shake (Spiel-Layer)

    // ---------- Overlay: Popups + Center-Text + Flash (crisp, kein Trail) ----------
    fx.clearRect(0, 0, game.W, game.H);
    fx.save();
    fx.translate(shX, shY);
    const octx = fx;
    octx.textAlign = 'center';
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      if (p.age >= p.ttl) {
        this.popups.splice(i, 1);
        continue;
      }
      const k = p.age / p.ttl;
      // Pop-in 1,3× in 80 ms (ease-out-back), Fade ab 50 %
      const popIn = p.age < 0.08 ? 0.7 + (p.age / 0.08) * 0.6 : k < 0.25 ? 1.3 - (k - 0.08) * 1.8 : 1;
      p.vy += (p.gravity ?? 0) * dt;
      p.x += (p.vx ?? 0) * dt;
      p.y += p.vy * dt * (p.gravity ? 1 : 0.9);
      p.rot += (p.rotV ?? 0) * dt;
      octx.save();
      octx.translate(p.x, p.y);
      octx.rotate(p.rot);
      octx.scale(popIn, popIn);
      octx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
      octx.font = `700 ${p.size}px Orbitron, sans-serif`;
      octx.fillStyle = p.color; // kein shadowBlur zur Laufzeit (Konzept-PFLICHT)
      octx.fillText(p.text, 0, 0);
      octx.restore();
    }
    octx.globalAlpha = 1;

    // ---------- Center-Text (Combo-Meilenstein / Frenzy) ----------
    if (this.centerText) {
      const t = this.centerText;
      t.age += dt;
      if (t.age >= t.ttl) this.centerText = null;
      else {
        const k = t.age / t.ttl;
        const scale = t.age < 0.09 ? 1.5 + 0.5 * (1 - t.age / 0.09) : k > 0.6 ? 1.5 - (k - 0.6) * 0.4 : 1.5;
        octx.save();
        octx.translate(game.W / 2, game.H * 0.32);
        octx.scale(scale / 1.5, scale / 1.5);
        octx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        octx.font = t.font === 'Bungee' ? `${t.size}px Bungee, sans-serif` : `900 ${t.size}px Orbitron, sans-serif`;
        octx.fillStyle = t.color; // kein shadowBlur zur Laufzeit (Konzept-PFLICHT)
        octx.fillText(t.text, 0, 0);
        if (t.sub) {
          octx.font = `700 ${Math.round(t.size * 0.42)}px Orbitron, sans-serif`;
          octx.fillStyle = '#f6ffff';
          octx.fillText(t.sub, 0, t.size * 0.95);
        }
        octx.restore();
        octx.globalAlpha = 1;
      }
    }
    fx.restore(); // Shake (Overlay)

    // ---------- Flash (über allem, ohne Shake) ----------
    if (this.flash) {
      this.flash.age += dt;
      if (this.flash.age >= this.flash.ttl) this.flash = null;
      else {
        fx.fillStyle = this.flash.color;
        fx.fillRect(0, 0, game.W, game.H);
      }
    }
  }
}
