// Partikel-Pool: max 150, EIN vorgerendertes Dot-Sprite pro Farbe,
// Zeichnen ausschließlich drawImage + globalCompositeOperation 'lighter'.
import { CFG } from './config.js';

export class ParticlePool {
  constructor(sprites) {
    this.sprites = sprites;
    this.pool = Array.from({ length: CFG.particleMax }, () => ({ live: false }));
    this.cursor = 0;
  }

  spawn(n, x, y, color, opts = {}) {
    const speedMin = opts.speedMin ?? 200;
    const speedMax = opts.speedMax ?? 400;
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length; // ältester wird recycelt
      const a = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 1.2) : Math.random() * Math.PI * 2;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      p.live = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (opts.up ?? 60);
      p.ttl = 0.4 + Math.random() * 0.4; // 0,4–0,8 s
      p.age = 0;
      p.size = (opts.size ?? 14) * (0.7 + Math.random() * 0.6);
      p.color = color;
      p.gravity = opts.gravity ?? 500;
    }
  }

  updateAndDraw(ctx, dt) {
    const dots = this.sprites.dots;
    ctx.globalCompositeOperation = 'lighter';
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
      const k = 1 - p.age / p.ttl; // Fade + Shrink
      const s = p.size * (0.4 + 0.6 * k);
      ctx.globalAlpha = k;
      ctx.drawImage(dots[p.color] || dots.white, (p.x - s / 2) | 0, (p.y - s / 2) | 0, s | 0, s | 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
