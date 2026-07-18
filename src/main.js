// TOPPING RUSH — Screen-Flow: Start → Countdown → Spiel → Ergebnis.
import { CFG } from './config.js';
import { Game } from './game.js';
import { FreshSkin } from './fresh.js';
import './audio.js'; // registriert window.__audio (Init erst nach User-Geste)

const $ = (id) => document.getElementById(id);
const screens = ['start', 'countdown', 'game', 'result', 'legal'];

const state = {
  name: localStorage.getItem('tr-name') || '',
  duration: CFG.roundDefault,
  banner: '',
  top: [],
  game: null,
  lastStats: null,
  lastRunId: null, // v2.5: runId der zuletzt gemeldeten Runde (me-Markierung)
  submitting: false,
  seed: null,
  muted: localStorage.getItem('tr-muted') === '1',
};

const params = new URLSearchParams(location.search);
if (params.has('seed')) state.seed = parseInt(params.get('seed'), 10);

function show(name) {
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  state.screen = name;
}

// ---------- Start-Screen ----------
const nameInput = $('name-input');
nameInput.value = state.name;
const NAME_RE = /^[a-zA-ZäöüÄÖÜß0-9 ._-]*$/;

nameInput.addEventListener('input', () => {
  const v = nameInput.value;
  if (!NAME_RE.test(v)) {
    nameInput.value = v.replace(/[^a-zA-ZäöüÄÖÜß0-9 ._-]/g, '');
    $('name-error').hidden = false;
    setTimeout(() => ($('name-error').hidden = true), 2000);
  }
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startFlow();
});

$('btn-play').addEventListener('click', startFlow);
$('btn-again').addEventListener('click', () => {
  window.__audio?.ensureStarted();
  window.__audio?.play('uiTap');
  startCountdown(); // Restart < 1 s, kein Menü
});

function startFlow() {
  const name = nameInput.value.trim().slice(0, 16);
  if (!name) {
    nameInput.focus();
    nameInput.classList.add('shake-err');
    setTimeout(() => nameInput.classList.remove('shake-err'), 400);
    return;
  }
  state.name = name;
  localStorage.setItem('tr-name', name);
  window.__audio?.ensureStarted(); // Audio-Init NUR nach User-Geste
  window.__audio?.play('uiTap');
  startCountdown();
}

// ---------- Countdown: Legende-Karte mit Tap-Start (Nachtrag v2.3) ----------
// Kein Auto-Start mehr: Die Karte bleibt stehen, bis der Spieler START tippt —
// jeder liest so lange, wie er will. Danach kurzes „LOS!".
let legendDone = true;

function startCountdown() {
  show('countdown');
  const card = $('legend-card');
  const num = $('count-num');
  card.hidden = false;
  num.hidden = true;
  num.classList.remove('go');
  legendDone = false;
}

function finishLegend() {
  if (legendDone) return; // Doppel-Tap
  legendDone = true;
  $('legend-card').hidden = true;
  const num = $('count-num');
  num.textContent = 'LOS!';
  num.hidden = false;
  num.classList.add('go');
  window.__audio?.play('countGo');
  pingPlaying(); // v2.4: „spielt gerade"-Presence fürs Board
  setTimeout(startGame, 380);
}

// v2.4: fire-and-forget Presence-Ping — darf den Spielstart NIE blockieren
// oder crashen (Server löscht den Eintrag beim Score-Submit, TTL 100 s fängt
// abgebrochene Runden ab)
function pingPlaying() {
  try {
    if (!state.name) return;
    fetch('/api/playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name }),
    }).catch(() => {});
  } catch { /* Presence ist rein optional */ }
}

$('btn-start-round').addEventListener('click', () => {
  window.__audio?.ensureStarted();
  window.__audio?.play('uiTap');
  finishLegend(); // Tap = sofort starten
});

// ---------- Spiel ----------
function startGame() {
  show('game');
  const canvas = $('game-canvas');
  const game = new Game(canvas, {
    duration: state.duration,
    seed: state.seed ?? undefined,
    onEnd: onRoundEnd,
    onEvent: onGameEvent,
    skin: new FreshSkin(),
  });
  state.game = game;
  game.resize();
  game.start();
  updateHud(game);
}

function onGameEvent(type, data) {
  const g = state.game;
  if (!g) return;
  if (type === 'tick') updateHud(g);
  // Frenzy-Banner läuft als Canvas-Center-Text im Skin (kein DOM-Doppel)
  g.skin?.handleEvent?.(type, data, g);
  window.__audio?.event(type, data, g);
}

function updateHud(g) {
  $('hud-score').textContent = g.score;
  $('hud-timer').textContent = Math.max(0, Math.ceil(g.duration - g.t));
  const combo = g.streak >= 2 ? `×${g.streak}` : '';
  $('hud-combo').textContent = combo;
}

// Input: ganzer Game-Screen ist Touchfläche, absolute X, Y ignoriert
const gameScreen = $('screen-game');
gameScreen.addEventListener('pointerdown', (e) => {
  // Pointer ans Spielfeld binden: move-Events bleiben auch dann bei uns, wenn
  // der Finger den Screen-Rand streift (Android-Robustheit zu touch-action:none)
  try { gameScreen.setPointerCapture(e.pointerId); } catch { /* optional */ }
  state.game?.pointerDown(e.clientX);
});
gameScreen.addEventListener('pointercancel', (e) => {
  try { gameScreen.releasePointerCapture(e.pointerId); } catch { /* optional */ }
});
gameScreen.addEventListener('pointermove', (e) => {
  if (!state.game) return;
  if (e.pointerType === 'mouse' && e.buttons === 0) state.game.pointerMove(e.clientX);
  else if (e.buttons > 0 || e.pointerType === 'touch') state.game.pointerMove(e.clientX);
});
// Desktop: Pfeiltasten
window.addEventListener('keydown', (e) => {
  const g = state.game;
  if (!g || !g.running) return;
  if (e.key === 'ArrowLeft') g.cup.target = Math.max(20, g.cup.target - 60);
  if (e.key === 'ArrowRight') g.cup.target = Math.min(g.W - 20, g.cup.target + 60);
});
window.addEventListener('resize', () => state.game?.resize());

// ---------- Ergebnis ----------
async function onRoundEnd(stats) {
  state.lastStats = stats;
  const attempts = bumpAttempts();
  show('result');
  renderResultBase(stats, attempts);
  const res = await submitScore(state.name, stats.score);
  renderResultServer(stats, res);
}

function bumpAttempts() {
  const key = `tr-attempts-${state.name.toLowerCase()}`;
  const n = (parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1;
  localStorage.setItem(key, String(n));
  return n;
}

function localBest() {
  const key = `tr-best-${state.name.toLowerCase()}`;
  return parseInt(localStorage.getItem(key) || '0', 10) || 0;
}

function renderResultBase(stats, attempts) {
  // Count-up
  const el = $('res-score');
  const target = stats.score;
  const t0 = performance.now();
  const dur = 800;
  (function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);

  const prevBest = localBest();
  const isNewLocalBest = stats.score > prevBest;
  if (isNewLocalBest) localStorage.setItem(`tr-best-${state.name.toLowerCase()}`, String(stats.score));

  $('res-newbest').hidden = !isNewLocalBest || prevBest === 0;
  $('res-best').textContent =
    prevBest > 0
      ? isNewLocalBest
        ? `Alte Bestmarke: ${prevBest} (+${stats.score - prevBest})`
        : `Deine Bestmarke: ${prevBest} (${stats.score - prevBest})`
      : '';
  // v2.5-Copy-Abweichung (dokumentiert): „dein bester zählt" wäre im Modus
  // „Jede Runde zählt" faktisch falsch — jede Runde landet auf dem Board.
  $('res-attempt').textContent = `Versuch #${attempts} — jede Runde zählt`;
  const puMissed = stats.puSpawned - stats.puCollected;
  $('res-stat').textContent =
    puMissed > 0 ? `${puMissed} Power-Up${puMissed > 1 ? 's' : ''} verpasst` : stats.puSpawned > 0 ? 'Alle Power-Ups geschnappt!' : '';
  $('res-rank').textContent = '';
  $('res-delta').textContent = '';
}

function renderResultServer(stats, res) {
  const delta = $('res-delta');
  if (!res) {
    delta.textContent = 'Offline — Score konnte gerade nicht gesendet werden';
    delta.classList.add('offline');
    renderTop10($('res-top10'), state.top);
    return;
  }
  delta.classList.remove('offline');
  state.top = res.top || state.top;
  state.lastRunId = res.runId || null;

  // Sicherheitsnetz (18.07., v2.5 auf runId umgestellt): Der angezeigte Rang
  // MUSS zur mitgelieferten Top-Liste passen — steht die frisch gespielte
  // Runde (runId) in res.top, gewinnt ihre Position über res.rank. deltaUp
  // wird dann ebenfalls aus der Liste abgeleitet (Delta zur Runde darüber).
  // id = voller Member `name#runId` — Match über das runId-Suffix
  const meIdx = (res.top || []).findIndex(
    (e) => state.lastRunId && typeof e.id === 'string' && e.id.endsWith(`#${state.lastRunId}`)
  );
  const rank = meIdx >= 0 ? meIdx + 1 : res.rank;
  let deltaUp = res.deltaUp;
  if (meIdx > 0) {
    const above = res.top[meIdx - 1];
    deltaUp = { rank: meIdx, points: above.score - stats.score };
  } else if (meIdx === 0) {
    deltaUp = null;
  }

  // Server-Bestwert ist die Wahrheit — localStorage angleichen, damit nach
  // einem Admin-Reset keine Geister-Bestmarke stehen bleibt.
  if (typeof res.best === 'number') {
    localStorage.setItem(`tr-best-${state.name.toLowerCase()}`, String(res.best));
    if (res.best !== stats.score && !res.isNewBest) {
      $('res-best').textContent = `Deine Bestmarke: ${res.best} (${stats.score - res.best})`;
    }
  }

  // v2.5 „Jede Runde zählt": Der Rang-Jubel gilt IMMER der Runde — jede Runde
  // ist ein eigener Board-Eintrag, der Rang ist trivial ehrlich.
  if (rank === 1) {
    $('res-rank').textContent = 'PLATZ 1!';
    $('res-delta').textContent = 'Du führst das Board an!';
  } else if (rank) {
    $('res-rank').textContent = `Platz ${rank}`;
    if (deltaUp && deltaUp.points > 0) {
      $('res-delta').textContent = `Nur ${deltaUp.points} Punkte hinter Platz ${deltaUp.rank}!`;
    }
  }
  if (res.isNewBest && res.tries > 1) {
    $('res-newbest').hidden = false; // Versuch #1 ist keine „Bestmarke"
    window.__audio?.play('newBest');
  }
  renderTop10($('res-top10'), state.top, state.lastRunId);
}

function renderTop10(ol, top, meId) {
  ol.innerHTML = '';
  (top || []).slice(0, 10).forEach((e, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${e.score}</span>`;
    li.querySelector('.lb-name').textContent = e.name;
    // v2.5: me-Markierung über die runId (id = Member `name#runId`) —
    // markiert NUR die frisch gespielte Runde, nicht alle Einträge des Namens
    if (meId && typeof e.id === 'string' && e.id.endsWith(`#${meId}`)) li.classList.add('me');
    ol.appendChild(li);
  });
}

// ---------- API ----------
async function submitScore(name, score) {
  try {
    state.submitting = true;
    const r = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    state.submitting = false;
  }
}

async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    state.top = data.top || [];
    state.duration = Math.min(CFG.roundMax, Math.max(CFG.roundMin, data.duration || CFG.roundDefault));
    state.banner = data.banner || '';
    $('event-name').textContent = data.eventName || '';
    const b = $('banner');
    if (state.banner) {
      b.textContent = state.banner;
      b.hidden = false;
    } else b.hidden = true;
    renderTop3(data.top || []);
  } catch {
    /* offline ok — Spiel läuft lokal */
  }
}

function renderTop3(top) {
  const el = $('top3');
  el.innerHTML = '';
  if (!top.length) return;
  const title = document.createElement('p');
  title.className = 'top3-title';
  title.textContent = 'TOP 3 HEUTE';
  el.appendChild(title);
  top.slice(0, 3).forEach((e, i) => {
    const row = document.createElement('div');
    row.className = `top3-row medal-${i + 1}`;
    row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${e.score}</span>`;
    row.querySelector('.lb-name').textContent = e.name;
    el.appendChild(row);
  });
}

// ---------- Legal ----------
$('btn-legal').addEventListener('click', async () => {
  const el = $('legal-content');
  if (!el.dataset.loaded) {
    const { LEGAL_HTML } = await import('./legal.js');
    el.innerHTML = LEGAL_HTML;
    el.dataset.loaded = '1';
  }
  show('legal');
});
$('btn-legal-close').addEventListener('click', () => show('start'));

// ---------- Mute ----------
const muteBtn = $('btn-mute');
function renderMute() {
  muteBtn.classList.toggle('muted', state.muted);
}
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.muted = !state.muted;
  localStorage.setItem('tr-muted', state.muted ? '1' : '0');
  window.__audio?.setMuted(state.muted);
  renderMute();
});
renderMute();

// ---------- Boot ----------
show('start');
loadBoard();
// Beide Baloo-2-Faces (latin + latin-ext) laden, bevor „ŞERBET-RUSH ×2!" auf
// dem Canvas gebraucht wird (Canvas nutzt nur bereits geladene Fonts)
document.fonts?.load('800 26px "Baloo 2"', 'ŞERBET-RUSH ×2! A0123').catch(() => {});
document.fonts?.load('700 16px Nunito', 'Doppelte Punkte!').catch(() => {});

// ---------- Test-Hooks (deterministische Systemtests) ----------
window.__TR = {
  state,
  show,
  startCountdown,
  startGame,
  CFG, // v2.5: Balancing-Werte im Test prüfbar (Endgame-Gate)
  get game() {
    return state.game;
  },
  newGame(opts = {}) {
    show('game');
    const canvas = $('game-canvas');
    const game = new Game(canvas, {
      duration: opts.duration ?? state.duration,
      seed: opts.seed ?? 42,
      autoSpawn: opts.autoSpawn ?? false,
      onEnd: onRoundEnd,
      onEvent: onGameEvent,
      skin: opts.greybox ? null : new FreshSkin(),
    });
    state.game = game;
    game.resize();
    game.start();
    return true;
  },
};
