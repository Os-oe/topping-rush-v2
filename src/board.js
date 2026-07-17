// TV-Board: Top 10, Gewinn-Banner, weiße QR-Kachel, Polling ab Seiten-Load
// (v2.4: kein Start-Gate). Fullscreen + Wake Lock in EINER Geste über den
// dezenten Vollbild-Button. 3-s-Polling, bei document.hidden 30 s.
import QrCreator from 'qr-creator';

const $ = (id) => document.getElementById(id);
let wakeLock = null;
let lastJson = '';

// ---------- v2.2: Board-Celebration („der TV feiert mit") ----------
// Konturierter Konfetti-Regen (Frucht-Palette, kein Blur) + Banner bei neuem/
// verbessertem Top-3-Eintrag. Erst-Load feiert nie; Celebrations queuen.
const FRUIT_CONFETTI = ['#D7263D', '#F5C518', '#E05780', '#3FA34D', '#F58A1F', '#2EC4B6'];
let prevTop = null; // null = Erst-Load (leerer Vergleichsstand)
let celebrating = false;
const celebrationQueue = [];

// Reine Trigger-Logik (Test-Hook window.__BOARD): max 1 pro Poll-Zyklus —
// der beste neue/verbesserte Top-3-Eintrag gewinnt.
function detectCelebration(oldTop, newTop) {
  if (!oldTop) return null;
  const old = new Map(oldTop.map((e) => [e.name.toLowerCase(), e.score]));
  for (let i = 0; i < Math.min(3, newTop.length); i++) {
    const e = newTop[i];
    const prev = old.get(e.name.toLowerCase());
    if (prev === undefined || e.score > prev) return { name: e.name, rank: i + 1 };
  }
  return null;
}

function enqueueCelebration(cel) {
  if (celebrating) {
    celebrationQueue.push(cel); // nie überlappen
    return;
  }
  runCelebration(cel);
}

function runCelebration(cel) {
  celebrating = true;
  const durMs = cel.rank === 1 ? 6000 : 4000; // Platz 1: 🏆 + länger
  const pop = $('celebrate-pop');
  const txt = $('celebrate-text');
  txt.textContent = cel.rank === 1 ? `🏆 NEUER REKORD: ${cel.name}!` : `${cel.name} stürmt auf Platz ${cel.rank}!`;
  txt.classList.toggle('rekord', cel.rank === 1);
  pop.hidden = false;
  if (cel.rank === 1) $('board-list').classList.add('gold-pulse');
  startConfetti(durMs);
  setTimeout(() => {
    pop.hidden = true;
    $('board-list').classList.remove('gold-pulse');
    celebrating = false;
    const next = celebrationQueue.shift();
    if (next) runCelebration(next);
  }, durMs);
}

// rAF-Loop läuft NUR während einer Celebration (kein Idle-Redraw)
function startConfetti(durMs) {
  const cv = $('celebrate-canvas');
  cv.hidden = false;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const parts = Array.from({ length: 90 }, (_, i) => ({
    x: Math.random() * innerWidth,
    y: -30 - Math.random() * innerHeight * 0.9,
    w: 9 + Math.random() * 8,
    h: 6 + Math.random() * 5,
    vy: 170 + Math.random() * 190,
    sway: 24 + Math.random() * 40,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI,
    rotV: (Math.random() - 0.5) * 6,
    color: FRUIT_CONFETTI[i % FRUIT_CONFETTI.length],
  }));
  const t0 = performance.now();
  let last = t0;
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const elapsed = now - t0;
    x.clearRect(0, 0, innerWidth, innerHeight);
    x.globalAlpha = elapsed > durMs - 600 ? Math.max(0, (durMs - elapsed) / 600) : 1;
    for (const p of parts) {
      p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      if (p.y > innerHeight + 30 && elapsed < durMs - 900) {
        p.y = -30;
        p.x = Math.random() * innerWidth;
      }
      const px = p.x + Math.sin(p.phase + (now / 1000) * 2.2) * p.sway * 0.4;
      x.save();
      x.translate(px, p.y);
      x.rotate(p.rot);
      x.fillStyle = p.color;
      x.strokeStyle = '#4A2E1F';
      x.lineWidth = 2;
      x.beginPath();
      x.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2.5);
      x.fill();
      x.stroke();
      x.restore();
    }
    x.globalAlpha = 1;
    if (elapsed < durMs) {
      requestAnimationFrame(loop);
    } else {
      x.clearRect(0, 0, innerWidth, innerHeight);
      cv.hidden = true;
    }
  };
  requestAnimationFrame(loop);
}

window.__BOARD = { detectCelebration }; // Test-Hook (reine Funktion)

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
    wakeLock?.addEventListener('release', () => (wakeLock = null));
  } catch {
    /* Wake Lock optional (z. B. Desktop) */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!wakeLock) acquireWakeLock();
    poll(); // v2.4: bei Rückkehr sofort frischer Stand (und zurück auf 3-s-Takt)
  }
});

// v2.4: EINE Geste — Fullscreen + Wake Lock; das Board läuft davor schon
$('btn-fullscreen').addEventListener('click', async () => {
  try {
    await document.documentElement.requestFullscreen?.();
  } catch { /* Fullscreen optional */ }
  await acquireWakeLock();
});

function renderQr() {
  const url = location.origin + '/';
  const el = $('qr');
  el.innerHTML = '';
  // QR NIE invertieren: schwarz auf weißer Kachel (CSS), Quiet Zone via Padding
  QrCreator.render(
    { text: url, radius: 0, ecLevel: 'M', fill: '#000000', background: '#ffffff', size: 480 },
    el
  );
}

async function fetchBoard() {
  const r = await fetch('/api/leaderboard', {
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

// v2.4: Runden-Zähler — Zahl zählt bei Änderung sichtbar hoch (ease-out, 700 ms)
let shownRounds = 0;
function renderRounds(target) {
  target = Number(target) || 0;
  const el = $('rounds-num');
  if (target === shownRounds) {
    el.textContent = String(target);
    return;
  }
  const from = shownRounds;
  shownRounds = target;
  const t0 = performance.now();
  const dur = 700;
  (function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = String(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1 && shownRounds === target) requestAnimationFrame(tick);
  })(t0);
}

function render(data) {
  // Re-Render nur bei Datenänderung (MIXR-Lesson: Polling-DOM frisst sonst Klicks/Flackern)
  const json = JSON.stringify([data.top, data.banner, data.eventName, data.rounds, data.playing]);
  if (json === lastJson) return;
  lastJson = json;

  renderRounds(data.rounds);

  // v2.4: „spielt gerade"-Zeile — versteckt (und Text geleert) wenn leer
  const playing = data.playing || [];
  const pl = $('board-playing');
  if (playing.length) {
    $('playing-text').textContent =
      playing.join(', ') + (playing.length === 1 ? ' spielt gerade…' : ' spielen gerade…');
    pl.hidden = false;
  } else {
    $('playing-text').textContent = '';
    pl.hidden = true;
  }

  // v2.2: Celebration-Erkennung VOR dem Stand-Update; Erst-Load (prevTop null)
  // setzt nur den Vergleichsstand und feiert nichts
  const top10 = (data.top || []).slice(0, 10);
  const cel = detectCelebration(prevTop, top10);
  prevTop = top10.map((e) => ({ name: e.name, score: e.score }));
  if (cel) enqueueCelebration(cel);

  $('board-event').textContent = data.eventName || '';
  const banner = $('board-banner');
  banner.textContent = data.banner || '';
  document.querySelector('.banner-arch').style.display = data.banner ? '' : 'none';

  const ol = $('board-list');
  ol.innerHTML = '';
  (data.top || []).slice(0, 10).forEach((e, i) => {
    const li = document.createElement('li');
    li.className = `rank-${i + 1}`;
    li.innerHTML = `<span class="b-rank">${i + 1}</span><span class="b-name"></span><span class="b-score">${e.score}</span>`;
    li.querySelector('.b-name').textContent = e.name;
    ol.appendChild(li);
  });
  if (!(data.top || []).length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Noch keine Scores — sei die Nummer 1!';
    ol.appendChild(li);
  }
}

// v2.4: 3-s-Takt sichtbar, 30 s bei document.hidden (Redis-Free-Tier-Schonung);
// in-flight-Guard, damit visibilitychange-Sofort-Polls keine zweite Kette starten
const POLL_MS = 3000;
const POLL_HIDDEN_MS = 30_000;
let pollTimer = null;
let polling = false;

async function poll() {
  if (polling) return;
  polling = true;
  clearTimeout(pollTimer);
  try {
    const data = await fetchBoard();
    $('offline-badge').hidden = true;
    render(data);
  } catch {
    $('offline-badge').hidden = false; // letzten Stand weiterzeigen
  }
  polling = false;
  pollTimer = setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
}

// Boot: Board ist sofort sichtbar — QR rendern, Polling starten
renderQr();
poll();
