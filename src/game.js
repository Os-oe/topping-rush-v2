// TOPPING RUSH — Spiel-Simulation + Render-Loop.
// Greybox-Phase: Primitive statt Sprites; Zahlen kommen aus config.js.

import { CFG, TOPPINGS, POWERUPS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let itemId = 1;

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { duration, seed, onEnd(stats), onEvent(type,data), autoSpawn }
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.duration = opts.duration || CFG.roundDefault;
    this.rng = mulberry32(opts.seed ?? ((Math.random() * 2 ** 31) | 0));
    this.onEnd = opts.onEnd || (() => {});
    this.onEvent = opts.onEvent || (() => {});
    this.autoSpawn = opts.autoSpawn !== false;
    this.skin = opts.skin || null; // Phase 3: Neon-Skin

    this.running = false;
    this.over = false;
    this._raf = 0;
    this._lastTs = 0;

    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.dprCap);
    const rect = this.canvas.getBoundingClientRect();
    this.W = Math.round(rect.width);
    this.H = Math.round(rect.height);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
  }

  // ---------- Runden-Setup ----------
  start() {
    const scale = this.duration / 60; // 90-s-Runde: Kurve zeitlich strecken
    this.timeScale = scale;
    this.rampEnd = this.duration - CFG.frenzyDur; // Rampen-Ende (Sek. 50 bei 60 s)

    this.t = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.catches = 0;
    this.misses = 0;
    this.items = [];
    this.frenzy = false;

    this.spawnedTotal = 0;
    this.spawnedBad = 0;
    this.lastBadT = -99;
    this.lastGood = null; // {t, x}
    this.recentGoods = []; // für Bad-Platzierung: {t, x}
    this.nextSpawnT = 0.6; // erster Spawn kurz nach GO

    // Power-Up-Slots: deterministisch, Fenster skaliert, Typen ohne Wiederholung
    const types = [...POWERUPS];
    for (let i = types.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.puSlots = CFG.puWindows.map(([a, b], i) => ({
      t: (a + this.rng() * (b - a)) * scale,
      type: types[i],
      done: false,
    }));
    this.puSpawned = 0;
    this.puCollected = 0;

    // Becher
    this.cup = {
      x: this.W / 2,
      target: this.W / 2,
      w: CFG.cupW,
      tween: null, // {from, t0, dur}
      xxlUntil: 0,
      magnetUntil: 0,
      slowmoUntil: 0,
    };
    this.cupY = this.H - CFG.cupBottomOffset;

    this.running = true;
    this.over = false;
    this._lastTs = 0;
    cancelAnimationFrame(this._raf);
    const loop = (ts) => {
      if (!this.running) return;
      if (!this._lastTs) this._lastTs = ts;
      let dt = (ts - this._lastTs) / 1000;
      this._lastTs = ts;
      if (dt > 0.1) dt = 0.1; // Tab-Wechsel-Spikes clampen
      this.update(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    this.onEvent('start', {});
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  // ---------- Kurven ----------
  spawnInterval() {
    if (this.frenzy) return CFG.spawnFrenzy;
    const p = Math.min(this.t / this.rampEnd, 1);
    return (CFG.spawnStart + (CFG.spawnEnd - CFG.spawnStart) * p) * this.timeScale;
  }

  fallTime(atT = this.t) {
    // sqrt-Kurve; in der Frenzy eingefroren (Wert am Rampen-Ende)
    const tt = this.frenzy ? this.rampEnd : Math.min(atT, this.rampEnd);
    const p = Math.sqrt(tt / this.rampEnd);
    return CFG.fallTimeStart / (1 + (CFG.fallSpeedupMax - 1) * p);
  }

  // ---------- Spawner ----------
  trySpawn() {
    const cap = this.frenzy ? CFG.maxConcurrentFrenzy : CFG.maxConcurrent;
    if (this.items.filter((i) => !i.dead).length >= cap) return;

    const shareMax = this.frenzy ? CFG.badShareFrenzy : CFG.badShareMax;
    const canBad =
      this.t >= CFG.badEarliest * this.timeScale &&
      this.catches >= CFG.badMinCatches &&
      this.t - this.lastBadT >= CFG.badMinGap &&
      (this.spawnedBad + 1) / (this.spawnedTotal + 1) <= shareMax;

    const wantBad = canBad && this.rng() < 0.25;
    if (wantBad) {
      const type = this.rng() < 0.5 ? 'bomb' : 'wasp';
      this.spawnItem(type, { x: this.pickBadX() });
    } else {
      const variant = TOPPINGS[(this.rng() * TOPPINGS.length) | 0];
      this.spawnItem('topping', { x: this.pickGoodX(), variant });
    }
  }

  pickGoodX() {
    const m = 44;
    let x = m + this.rng() * (this.W - 2 * m);
    // Fairness: 2 gute Items < 0,5 s auseinander → dx ≤ 60 % Screenbreite
    if (this.lastGood && this.t - this.lastGood.t < CFG.goodPairWindow) {
      const maxDx = CFG.goodPairMaxDx * this.W;
      if (Math.abs(x - this.lastGood.x) > maxDx) {
        x = this.lastGood.x + Math.sign(x - this.lastGood.x) * maxDx;
        x = Math.max(m, Math.min(this.W - m, x));
      }
    }
    return x;
  }

  pickBadX() {
    const m = 44;
    for (let tries = 0; tries < 12; tries++) {
      const x = m + this.rng() * (this.W - 2 * m);
      // nie < 80 px neben gleichhohem Gut-Item (Spawn-Zeitfenster ~0,35 s)
      const clash = this.recentGoods.some(
        (g) => this.t - g.t < 0.35 && Math.abs(x - g.x) < CFG.badGoodMinDx
      );
      if (!clash) return x;
    }
    return this.W / 2;
  }

  spawnItem(type, opts = {}) {
    const ft = (type === 'powerup' ? CFG.puFallFactor : 1) * this.fallTime();
    const item = {
      id: itemId++,
      type,
      variant: opts.variant || null, // Topping-Sorte oder Power-Up-Typ
      x: opts.x ?? this.W / 2,
      baseX: opts.x ?? this.W / 2,
      y: opts.y ?? -40,
      vy: (this.H + 140) / ft,
      born: this.t,
      rot: this.rng() * Math.PI * 2,
      rotV: (this.rng() - 0.5) * 2.2, // leichte Rotation
      r: type === 'wasp' ? 20 : type === 'bomb' ? 20 : type === 'powerup' ? 22 : 17,
      dead: false,
    };
    this.items.push(item);
    this.spawnedTotal++;
    if (type === 'bomb' || type === 'wasp') {
      this.spawnedBad++;
      this.lastBadT = this.t;
      this.onEvent(type === 'bomb' ? 'bombSpawn' : 'waspSpawn', item);
    } else if (type === 'topping') {
      this.lastGood = { t: this.t, x: item.x };
      this.recentGoods.push({ t: this.t, x: item.x });
      if (this.recentGoods.length > 8) this.recentGoods.shift();
    } else if (type === 'powerup') {
      this.puSpawned++;
      this.onEvent('powerupSpawn', item);
    }
    return item;
  }

  // ---------- Update ----------
  update(dt) {
    if (this.over) return;
    this.t += dt;
    const remaining = this.duration - this.t;

    if (!this.frenzy && remaining <= CFG.frenzyDur) {
      this.frenzy = true;
      this.onEvent('frenzy', {});
    }
    if (remaining <= 0) return this.endRound();

    // Spawns
    if (this.autoSpawn) {
      if (this.t >= this.nextSpawnT) {
        this.trySpawn();
        this.nextSpawnT = this.t + this.spawnInterval();
      }
      for (const slot of this.puSlots) {
        if (!slot.done && this.t >= slot.t) {
          slot.done = true;
          this.spawnItem('powerup', { variant: slot.type, x: this.pickGoodX() });
        }
      }
    }

    // Becher-Bewegung: Touch-Down-Tween (80 ms) → Lerp 0,3
    const cup = this.cup;
    if (cup.tween) {
      cup.tween.t += dt;
      const p = Math.min(cup.tween.t / cup.tween.dur, 1);
      const ease = 1 - (1 - p) * (1 - p); // ease-out
      cup.x = cup.tween.from + (cup.target - cup.tween.from) * ease;
      if (p >= 1) cup.tween = null;
    } else {
      const f = 1 - Math.pow(1 - CFG.cupLerp, dt * 60);
      cup.x += (cup.target - cup.x) * f;
    }
    cup.x = Math.max(20, Math.min(this.W - 20, cup.x));

    // Effekt-Timer (v2.1: kein Becher-Schrumpf mehr — Bombe kostet Punkte)
    const now = this.t;
    const xxl = now < cup.xxlUntil;
    cup.w = CFG.cupW * (xxl ? CFG.xxlScale : 1);
    const slowmo = now < cup.slowmoUntil;
    const magnet = now < cup.magnetUntil;

    // Items
    const speedF = slowmo ? CFG.slowmoFactor : 1;
    const halfHit = (cup.w * CFG.hitboxScale) / 2;
    for (const it of this.items) {
      if (it.dead) continue;
      it.y += it.vy * speedF * dt;
      it.rot += it.rotV * dt;
      if (it.type === 'wasp') {
        it.x = it.baseX + CFG.waspAmp * Math.sin(2 * Math.PI * CFG.waspHz * (this.t - it.born));
      }
      // Magnet zieht NUR gute Items + Power-Ups
      if (magnet && (it.type === 'topping' || it.type === 'powerup')) {
        const dx = cup.x - it.x;
        const dy = this.cupY - it.y;
        const d = Math.hypot(dx, dy);
        if (d < CFG.magnetRadius && d > 1) {
          const pull = 420 * dt;
          it.x += (dx / d) * pull;
          it.y += (dy / d) * pull;
        }
      }
      // Catch-Check
      if (
        it.y + it.r >= this.cupY &&
        it.y - it.r <= this.cupY + CFG.cupH &&
        Math.abs(it.x - cup.x) <= halfHit + it.r * 0.4
      ) {
        it.dead = true;
        this.handleCatch(it);
        continue;
      }
      // Miss
      if (it.y - it.r > this.H + 40) {
        it.dead = true;
        if (it.type === 'topping') {
          this.misses++;
          if (CFG.missResetsCombo) this.streak = 0; // Playtest-Kalibrierung (Score-Bänder)
        }
        this.onEvent('despawn', it); // kontinuierliche Sounds (Pfeifen/Summen/Shimmer) stoppen
      }
    }
    this.items = this.items.filter((i) => !i.dead);

    // Power-Up läuft aus → einmalige Tick-Tick-Warnung (< 1 s Rest)
    for (const [key, until] of [['magnet', cup.magnetUntil], ['xxl', cup.xxlUntil], ['slowmo', cup.slowmoUntil]]) {
      const remain = until - this.t;
      const flag = `_warned_${key}`;
      if (remain > 1) this[flag] = false;
      else if (remain > 0 && remain <= 1 && !this[flag]) {
        this[flag] = true;
        this.onEvent('powerupEnding', { kind: key });
      }
    }

    // Letzte 5 Sekunden: Sekunden-Tick
    const secLeft = Math.ceil(this.duration - this.t);
    if (secLeft !== this._lastSec) {
      this._lastSec = secLeft;
      if (secLeft <= 5 && secLeft > 0) this.onEvent('secondTick', { n: secLeft });
    }

    // Becher-Breite nach Catches im selben Frame aktualisieren (XXL wirkt sofort)
    cup.w = CFG.cupW * (this.t < cup.xxlUntil ? CFG.xxlScale : 1);

    this.onEvent('tick', { dt });
  }

  handleCatch(it) {
    const cup = this.cup;
    if (it.type === 'topping') {
      this.streak++;
      this.catches++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const bonus = Math.min((this.streak - 1) * CFG.comboStep, CFG.comboCap);
      const pts = (CFG.catchBase + bonus) * (this.frenzy ? CFG.frenzyMult : 1);
      this.score += pts;
      this.onEvent('catch', { item: it, pts, streak: this.streak });
      if (this.streak > 0 && this.streak % 5 === 0) {
        this.onEvent('comboMilestone', { streak: this.streak });
      }
    } else if (it.type === 'bomb') {
      // Nachtrag v2.1: −30 Punkte (Score-Floor 0) + Combo → 0
      this.score = Math.max(0, this.score - CFG.bombPenalty);
      const lost = this.streak;
      this.streak = 0;
      this.onEvent('bomb', { item: it, lostStreak: lost });
    } else if (it.type === 'wasp') {
      const lost = this.streak;
      this.streak = 0;
      this.onEvent('wasp', { item: it, lostStreak: lost });
    } else if (it.type === 'powerup') {
      this.puCollected++;
      const d = { magnet: CFG.magnetDur, xxl: CFG.xxlDur, slowmo: CFG.slowmoDur }[it.variant];
      // gleicher Typ refresht (kein Stacking), verschiedene dürfen überlappen
      if (it.variant === 'magnet') cup.magnetUntil = this.t + d;
      if (it.variant === 'xxl') cup.xxlUntil = this.t + d;
      if (it.variant === 'slowmo') cup.slowmoUntil = this.t + d;
      this.onEvent('powerup', { item: it, kind: it.variant, dur: d });
    }
  }

  endRound() {
    this.over = true;
    this.running = false;
    cancelAnimationFrame(this._raf);
    const stats = {
      score: this.score,
      catches: this.catches,
      misses: this.misses,
      bestStreak: this.bestStreak,
      puSpawned: this.puSpawned,
      puCollected: this.puCollected,
      duration: this.duration,
    };
    this.onEvent('end', stats);
    this.onEnd(stats);
  }

  // ---------- Input ----------
  pointerDown(x) {
    this.cup.target = x;
    this.cup.tween = { from: this.cup.x, t: 0, dur: CFG.touchTween };
  }
  pointerMove(x) {
    this.cup.target = x;
  }

  // ---------- Render (Greybox) ----------
  render() {
    if (this.skin) return this.skin.render(this);
    const c = this.ctx;
    c.fillStyle = CFG.bg;
    c.fillRect(0, 0, this.W, this.H);

    // Fangzonen-Linie (Debug-Orientierung)
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.beginPath();
    c.moveTo(0, (this.H * 2) / 3);
    c.lineTo(this.W, (this.H * 2) / 3);
    c.stroke();

    // Items
    for (const it of this.items) {
      if (it.type === 'topping') {
        c.fillStyle = {
          nar: '#FF2D55', limon: '#FFF200', karpuz: '#ff7eb0', nane: '#39FF14',
          visne: '#e0115f', portakal: '#ff8c1a', cilek: '#FF2D95', cay: '#FFB238',
        }[it.variant] || '#fff';
        c.beginPath();
        c.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        c.fill();
      } else if (it.type === 'bomb') {
        c.fillStyle = '#2E3440';
        c.strokeStyle = CFG.colors.warnRed;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (it.type === 'wasp') {
        c.fillStyle = CFG.colors.yellow;
        c.fillRect(it.x - 18, it.y - 12, 36, 24);
        c.fillStyle = '#111';
        c.fillRect(it.x - 10, it.y - 12, 7, 24);
        c.fillRect(it.x + 3, it.y - 12, 7, 24);
      } else if (it.type === 'powerup') {
        c.fillStyle = 'rgba(255,242,0,0.25)';
        c.fillRect(it.x - 22, it.y - 22, 44, 44);
        c.strokeStyle = CFG.colors.yellow;
        c.lineWidth = 2;
        c.strokeRect(it.x - 22, it.y - 22, 44, 44);
        c.fillStyle = '#fff';
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillText({ magnet: 'M', xxl: 'XL', slowmo: 'SL' }[it.variant] || '?', it.x, it.y + 6);
      }
    }

    // Becher
    const cup = this.cup;
    c.fillStyle = CFG.colors.cyan;
    c.fillRect(cup.x - cup.w / 2, this.cupY, cup.w, CFG.cupH);
    if (this.t < cup.magnetUntil) {
      c.strokeStyle = CFG.colors.magenta;
      c.beginPath();
      c.arc(cup.x, this.cupY, CFG.magnetRadius, 0, Math.PI * 2);
      c.stroke();
    }
  }
}
