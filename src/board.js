// TV-Board: Top 10, Gewinn-Banner, weiße QR-Kachel, Fullscreen + Wake Lock
// in EINER Geste, 5-s-Polling mit Offline-Badge.
import QrCreator from 'qr-creator';

const $ = (id) => document.getElementById(id);
let wakeLock = null;
let lastJson = '';

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
    wakeLock?.addEventListener('release', () => (wakeLock = null));
  } catch {
    /* Wake Lock optional (z. B. Desktop) */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) acquireWakeLock();
});

$('btn-board-start').addEventListener('click', async () => {
  // EINE Geste: Fullscreen + Wake Lock
  try {
    await document.documentElement.requestFullscreen?.();
  } catch { /* Fullscreen optional */ }
  await acquireWakeLock();
  $('board-start').hidden = true;
  $('board').hidden = false;
  renderQr();
  poll();
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

function render(data) {
  // Re-Render nur bei Datenänderung (MIXR-Lesson: Polling-DOM frisst sonst Klicks/Flackern)
  const json = JSON.stringify([data.top, data.banner, data.eventName]);
  if (json === lastJson) return;
  lastJson = json;

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

async function poll() {
  try {
    const data = await fetchBoard();
    $('offline-badge').hidden = true;
    render(data);
  } catch {
    $('offline-badge').hidden = false; // letzten Stand weiterzeigen
  }
  setTimeout(poll, 5000);
}
