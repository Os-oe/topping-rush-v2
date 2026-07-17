// Partikel-Pool V2 „Fresh": max 150, EIN vorgerendertes konturiertes
// Tropfen-Sprite pro Farbe (dunkle Outline #4A2E1F), normales Alpha-Blending —
// KEIN 'lighter', kein Glow. Splash: 300–500 ms, Gravity, Fade+Shrink.
import { CFG } from './config.js';

export class ParticlePool {
  constructor(sprites) {
    this.sprites = sprites;
    this.pool = Array.from({ length: CFG.particleMax }, () => ({ live: false }));
    this.cursor = 0;
  }

  spawn(n, x, y, color, opts = {}) {
    const speedMin = opts.speedMin ?? 180;
    const speedMax = opts.speedMax ?? 360;
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length; // ältester wird recycelt
      const a = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 1.2) : Math.random() * Math.PI * 2;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      p.live = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (opts.up ?? 80);
      p.ttl = 0.3 + Math.random() * 0.2; // 300–500 ms (Konzept)
      p.age = 0;
      p.size = (opts.size ?? 9) * (0.7 + Math.random() * 0.6); // 6–12 px
      p.color = color;
      p.gravity = opts.gravity ?? 700;
      p.rot = Math.random() * Math.PI * 2;
      p.rotV = (Math.random() - 0.5) * 8;
    }
  }

  updateAndDraw(ctx, dt) {
    const dots = this.sprites.dots;
    for (const p of this.pool) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.ttl) {
        p.live = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      const k = 1 - p.age / p.ttl; // Fade + Shrink
      const s = p.size * (0.5 + 0.5 * k);
      const spr = dots[p.color] || dots.white;
      ctx.save();
      ctx.translate(p.x | 0, p.y | 0);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, k * 1.6); // erst spät ausfaden — Tropfen bleiben satt
      ctx.drawImage(spr, -s / 2, -s / 2, s, s * 1.15); // leicht länglich = Tropfenform
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
