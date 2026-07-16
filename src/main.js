// TOPPING RUSH — Screen-Flow: Start → Countdown → Spiel → Ergebnis.
import { CFG } from './config.js';
import { Game } from './game.js';
import { NeonSkin } from './neon.js';
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

// ---------- Countdown ----------
let countTimer = 0;
function startCountdown() {
  show('countdown');
  $('count-hint').innerHTML =
    'Fang die <b class="c-lime">Früchte</b> — weich <b class="c-orange">Chili</b> &amp; <b class="c-yellow">Wespe</b> aus!';
  let n = 3;
  const el = $('count-num');
  el.textContent = n;
  el.classList.remove('go');
  window.__audio?.play('countTick');
  clearInterval(countTimer);
  countTimer = setInterval(() => {
    n--;
    if (n > 0) {
      el.textContent = n;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      window.__audio?.play('countTick');
    } else {
      clearInterval(countTimer);
      el.textContent = 'GO!';
      el.classList.add('go');
      window.__audio?.play('countGo');
      setTimeout(startGame, 350);
    }
  }, 750);
}

// ---------- Spiel ----------
function startGame() {
  show('game');
  const canvas = $('game-canvas');
  const game = new Game(canvas, {
    duration: state.duration,
    seed: state.seed ?? undefined,
    onEnd: onRoundEnd,
    onEvent: onGameEvent,
    skin: new NeonSkin(),
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
  state.game?.pointerDown(e.clientX);
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
  $('res-attempt').textContent = `Versuch #${attempts} — dein bester zählt`;
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
  if (res.rank === 1) {
    $('res-rank').textContent = 'PLATZ 1!';
    $('res-delta').textContent = 'Du führst das Board an!';
  } else if (res.rank) {
    $('res-rank').textContent = `Platz ${res.rank}`;
    if (res.deltaUp && res.deltaUp.points > 0) {
      $('res-delta').textContent = `Nur ${res.deltaUp.points} Punkte hinter Platz ${res.deltaUp.rank}!`;
    }
  }
  if (res.isNewBest && res.tries > 1) {
    $('res-newbest').hidden = false; // Versuch #1 ist keine „Bestmarke"
    window.__audio?.play('newBest');
  }
  renderTop10($('res-top10'), state.top);
}

function renderTop10(ol, top) {
  ol.innerHTML = '';
  (top || []).slice(0, 10).forEach((e, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${e.score}</span>`;
    li.querySelector('.lb-name').textContent = e.name;
    if (e.name.toLowerCase() === state.name.toLowerCase()) li.classList.add('me');
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
// Beide Bungee-Faces (latin + latin-ext) laden, bevor „ŞERBET-RUSH ×2!" auf
// dem Canvas gebraucht wird (Canvas nutzt nur bereits geladene Fonts)
document.fonts?.load('26px Bungee', 'ŞERBET-RUSH ×2! A').catch(() => {});
document.fonts?.load('700 26px Orbitron', '0123').catch(() => {});

// ---------- Test-Hooks (deterministische Systemtests) ----------
window.__TR = {
  state,
  show,
  startCountdown,
  startGame,
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
      skin: opts.greybox ? null : new NeonSkin(),
    });
    state.game = game;
    game.resize();
    game.start();
    return true;
  },
};
