// Admin: PIN-Gate (ENV ADMIN_PIN, lokal Default 4242) — Reset, Banner, Rundenlänge.
const $ = (id) => document.getElementById(id);
let pin = sessionStorage.getItem('tr-pin') || '';

async function api(action, value) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, action, value }),
    signal: AbortSignal.timeout(6000),
  });
  if (r.status === 401) throw new Error('unauthorized');
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

function msg(text, ok = true) {
  const el = $('admin-msg');
  el.textContent = text;
  el.style.color = ok ? '#39FF14' : '#FF3131';
  setTimeout(() => (el.textContent = ''), 3000);
}

async function login() {
  pin = $('pin-input').value.trim();
  try {
    const data = await api('list');
    sessionStorage.setItem('tr-pin', pin);
    $('pin-gate').hidden = true;
    $('admin-panel').hidden = false;
    hydrate(data);
    pollList();
  } catch {
    $('pin-error').hidden = false;
    setTimeout(() => ($('pin-error').hidden = true), 2500);
  }
}

function hydrate(data) {
  $('event-input').value = data.eventName || '';
  $('banner-input').value = data.banner || '';
  $('duration-input').value = data.duration || 60;
  $('duration-val').textContent = `${data.duration || 60} s`;
  renderList(data.entries || []);
}

function renderList(entries) {
  const ol = $('admin-list');
  ol.innerHTML = '';
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${e.score}</span>`;
    li.querySelector('.lb-name').textContent = e.name;
    ol.appendChild(li);
  });
  if (!entries.length) {
    const li = document.createElement('li');
    li.textContent = 'Keine Scores.';
    ol.appendChild(li);
  }
}

let pollTimer = 0;
async function pollList() {
  clearTimeout(pollTimer);
  try {
    const data = await api('list');
    renderList(data.entries || []);
  } catch { /* Anzeige behält letzten Stand */ }
  pollTimer = setTimeout(pollList, 5000);
}

$('btn-pin').addEventListener('click', login);
$('pin-input').addEventListener('keydown', (e) => e.key === 'Enter' && login());

$('btn-banner').addEventListener('click', async () => {
  try {
    await api('banner', $('banner-input').value.trim());
    msg('Banner gespeichert');
  } catch { msg('Fehler beim Speichern', false); }
});

$('btn-event').addEventListener('click', async () => {
  try {
    await api('eventName', $('event-input').value.trim());
    msg('Event-Name gespeichert');
  } catch { msg('Fehler beim Speichern', false); }
});

$('duration-input').addEventListener('input', () => {
  $('duration-val').textContent = `${$('duration-input').value} s`;
});
$('btn-duration').addEventListener('click', async () => {
  try {
    await api('duration', parseInt($('duration-input').value, 10));
    msg('Rundenlänge gespeichert');
  } catch { msg('Fehler beim Speichern', false); }
});

$('btn-reset').addEventListener('click', () => {
  $('btn-reset-confirm').hidden = false;
  setTimeout(() => ($('btn-reset-confirm').hidden = true), 5000);
});
$('btn-reset-confirm').addEventListener('click', async () => {
  try {
    await api('reset');
    $('btn-reset-confirm').hidden = true;
    msg('Board zurückgesetzt');
    pollList();
  } catch { msg('Reset fehlgeschlagen', false); }
});

// Auto-Login, wenn PIN in Session
if (pin) {
  $('pin-input').value = pin;
  login();
}
