// WebAudio-Synth: komplette SFX-Liste aus dem Konzept (0 €, 0 ms Latenz,
// pixel-runner/MIXR-bewährt) + Musik-Loop (Suno) über BiquadFilter —
// Frenzy öffnet den Filter. Init NUR nach User-Geste (PLAY-Tap).
const SEMI = Math.pow(2, 1 / 12);

class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicFilter = null;
    this.musicSrc = null;
    this.musicBuffer = null;
    this.muted = localStorage.getItem('tr-muted') === '1';
    this.continuous = new Map(); // itemId → {stop()}
    this.started = false;
  }

  ensureStarted() {
    if (this.started) {
      this.ctx?.resume?.();
      if (!this.musicSrc && this.musicBuffer) this.startMusic();
      return;
    }
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    // Musik-Kette: Source → Lowpass (in-Game gefiltert) → Gain → Master
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1300;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicFilter.connect(this.musicGain).connect(this.master);
    this.loadMusic();
  }

  async loadMusic() {
    try {
      const r = await fetch('/music/loop.mp3');
      if (!r.ok) return; // Musik optional — SFX tragen allein
      const buf = await r.arrayBuffer();
      this.musicBuffer = await this.ctx.decodeAudioData(buf);
      this.startMusic();
    } catch { /* ohne Musik weiterspielen */ }
  }

  startMusic() {
    if (!this.musicBuffer || this.musicSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicFilter);
    src.start();
    this.musicSrc = src;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  setFrenzy(on) {
    if (!this.musicFilter) return;
    // Frenzy öffnet den Filter (Intensitäts-Kick)
    this.musicFilter.frequency.setTargetAtTime(on ? 9000 : 1300, this.ctx.currentTime, 0.25);
    this.musicGain?.gain.setTargetAtTime(on ? 0.4 : 0.32, this.ctx.currentTime, 0.25);
  }

  // ---------- Bausteine ----------
  env(gainNode, t0, a, peak, d) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.2, attack = 0.005, pan = 0, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const g = this.ctx.createGain();
    this.env(g, t0, attack, vol, dur);
    let node = osc.connect(g);
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node = g.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
    }
    osc.start(t0);
    osc.stop(t0 + attack + dur + 0.05);
  }

  noise({ dur = 0.3, vol = 0.25, f0 = 1000, f1 = null, type = 'bandpass', q = 1, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t0);
    if (f1 != null) filt.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const g = this.ctx.createGain();
    this.env(g, t0, 0.005, vol, dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
  }

  arpeggio(freqs, { step = 0.07, dur = 0.12, vol = 0.16, type = 'triangle' } = {}) {
    freqs.forEach((f, i) => this.tone({ type, f0: f, dur, vol, delay: i * step }));
  }

  // ---------- Kontinuierliche Sounds (pro Item) ----------
  startContinuous(id, build) {
    if (!this.ctx || this.continuous.has(id)) return;
    this.continuous.set(id, build());
  }

  stopContinuous(id) {
    const c = this.continuous.get(id);
    if (c) {
      try { c.stop(); } catch { /* schon beendet */ }
      this.continuous.delete(id);
    }
  }

  stopAllContinuous() {
    for (const id of [...this.continuous.keys()]) this.stopContinuous(id);
  }

  bombFuse(id) {
    // Zisch-Lunte ab Spawn (Nachtrag v2.1 — Audio-Telegraphing der Bombe)
    this.startContinuous(id, () => {
      const len = Math.ceil(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 5200;
      filt.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.value = 0.035; // leise
      src.connect(filt).connect(g).connect(this.master);
      src.start();
      return { stop: () => { g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03); src.stop(this.ctx.currentTime + 0.15); } };
    });
  }

  waspBuzz(id) {
    this.startContinuous(id, () => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 190;
      const trem = this.ctx.createOscillator();
      trem.frequency.value = 26;
      const tremGain = this.ctx.createGain();
      tremGain.gain.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const pan = this.ctx.createStereoPanner();
      trem.connect(tremGain).connect(g.gain);
      osc.connect(g).connect(pan).connect(this.master);
      osc.start();
      trem.start();
      return {
        pan,
        stop: () => { g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03); osc.stop(this.ctx.currentTime + 0.12); trem.stop(this.ctx.currentTime + 0.12); },
      };
    });
  }

  shimmer(id) {
    this.startContinuous(id, () => {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = o2.type = 'triangle';
      o1.frequency.value = 1568;
      o2.frequency.value = 1576; // Detune-Schwebung
      const g = this.ctx.createGain();
      g.gain.value = 0.035;
      o1.connect(g);
      o2.connect(g);
      g.connect(this.master);
      o1.start(); o2.start();
      return { stop: () => { g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04); o1.stop(this.ctx.currentTime + 0.15); o2.stop(this.ctx.currentTime + 0.15); } };
    });
  }

  // ---------- benannte SFX ----------
  play(name, opts = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'catch': {
        // Sinus-Pluck, Pitch +1 Halbton pro Combo-Stufe (Cap +12)
        const f = 523.25 * Math.pow(SEMI, Math.min(opts.combo ?? 0, 12));
        this.tone({ type: 'sine', f0: f, dur: 0.1, vol: 0.22 });
        this.tone({ type: 'triangle', f0: f * 2, dur: 0.07, vol: 0.07 });
        break;
      }
      case 'comboJingle':
        this.arpeggio([659.25, 830.61, 987.77, 1318.5], { step: 0.055, vol: 0.14 });
        break;
      case 'poff':
        // comic „Poff!"-Boom (Nachtrag v2.1): dumpf, kurz, freundlich —
        // kein realistischer Explosions-Sound
        this.tone({ type: 'sine', f0: 170, f1: 52, dur: 0.2, vol: 0.5, attack: 0.004 });
        this.noise({ dur: 0.13, vol: 0.3, f0: 420, f1: 170, q: 0.7, type: 'lowpass' });
        break;
      case 'sting':
        this.tone({ type: 'square', f0: 880, f1: 180, dur: 0.16, vol: 0.22 });
        this.noise({ dur: 0.08, vol: 0.18, f0: 2400, q: 2 });
        break;
      case 'collect-magnet':
        this.arpeggio([440, 660, 880], { step: 0.04, dur: 0.09, vol: 0.16 });
        this.tone({ type: 'sine', f0: 110, dur: 0.35, vol: 0.1 });
        break;
      case 'collect-xxl':
        this.arpeggio([261.63, 329.63, 392, 523.25], { step: 0.03, dur: 0.22, vol: 0.18, type: 'square' });
        break;
      case 'collect-slowmo':
        this.tone({ type: 'sine', f0: 980, f1: 490, dur: 0.5, vol: 0.18 });
        this.tone({ type: 'sine', f0: 984, f1: 494, dur: 0.5, vol: 0.12 });
        break;
      case 'powerupEnd':
        this.tone({ type: 'square', f0: 1050, dur: 0.045, vol: 0.12 });
        this.tone({ type: 'square', f0: 1050, dur: 0.045, vol: 0.12, delay: 0.14 });
        this.tone({ type: 'square', f0: 1050, dur: 0.045, vol: 0.1, delay: 0.28 });
        break;
      case 'countTick':
        this.tone({ type: 'square', f0: 880, dur: 0.07, vol: 0.16 });
        break;
      case 'countGo':
        this.arpeggio([659.25, 987.77, 1318.5], { step: 0.02, dur: 0.25, vol: 0.2, type: 'square' });
        break;
      case 'frenzySiren':
        this.tone({ type: 'sawtooth', f0: 620, f1: 920, dur: 0.4, vol: 0.16 });
        this.tone({ type: 'sawtooth', f0: 920, f1: 620, dur: 0.4, vol: 0.16, delay: 0.4 });
        this.tone({ type: 'sawtooth', f0: 620, f1: 920, dur: 0.4, vol: 0.14, delay: 0.8 });
        break;
      case 'secondTick':
        this.noise({ dur: 0.035, vol: 0.2, f0: 2600, type: 'highpass' });
        break;
      case 'fanfare':
        this.arpeggio([523.25, 659.25, 783.99, 1046.5], { step: 0.09, dur: 0.3, vol: 0.2 });
        this.tone({ type: 'triangle', f0: 1046.5, dur: 0.6, vol: 0.14, delay: 0.36 });
        break;
      case 'newBest':
        this.arpeggio([783.99, 987.77, 1174.66, 1567.98, 2093], { step: 0.07, dur: 0.22, vol: 0.16 });
        break;
      case 'uiTap':
        this.tone({ type: 'sine', f0: 700, dur: 0.04, vol: 0.1 });
        break;
    }
  }

  // ---------- Spiel-Events → Sounds (Kaskade: Sound SOFORT) ----------
  event(type, data, g) {
    if (!this.ctx) return;
    switch (type) {
      case 'start':
        this.stopAllContinuous();
        this.setFrenzy(false);
        break;
      case 'catch':
        this.play('catch', { combo: Math.min(data.streak - 1, 12) });
        break;
      case 'comboMilestone':
        this.play('comboJingle');
        break;
      case 'bombSpawn':
        this.bombFuse(data.id);
        break;
      case 'waspSpawn':
        this.waspBuzz(data.id);
        break;
      case 'powerupSpawn':
        this.shimmer(data.id);
        break;
      case 'bomb':
        this.stopContinuous(data.item.id);
        this.play('poff');
        break;
      case 'wasp':
        this.stopContinuous(data.item.id);
        this.play('sting');
        break;
      case 'powerup':
        this.stopContinuous(data.item.id);
        this.play(`collect-${data.kind}`);
        break;
      case 'powerupEnding':
        this.play('powerupEnd');
        break;
      case 'despawn':
        this.stopContinuous(data.id);
        break;
      case 'frenzy':
        this.play('frenzySiren');
        this.setFrenzy(true);
        break;
      case 'secondTick':
        this.play('secondTick');
        break;
      case 'end':
        this.stopAllContinuous();
        this.setFrenzy(false);
        this.play('fanfare');
        break;
      case 'tick': {
        // Wespen-Stereo-Pan folgt der X-Position
        if (this.continuous.size && g) {
          for (const it of g.items) {
            if (it.type === 'wasp') {
              const c = this.continuous.get(it.id);
              if (c?.pan) c.pan.pan.value = Math.max(-1, Math.min(1, (it.x / g.W) * 2 - 1));
            }
          }
        }
        break;
      }
    }
  }
}

window.__audio = new AudioSys();
export default window.__audio;
