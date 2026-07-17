// Phase-2-Gate: Systeme — API + Schutz + /board + /admin + Ergebnis-Flow.
// Läuft gegen server.js (In-Memory-Store); Reihenfolge bewusst: Rate-Limit zuletzt.
import { test, expect } from '@playwright/test';

const PIN = '4242'; // lokaler ENV-Default

test.describe.configure({ mode: 'serial' });

test('Leaderboard: leer → Defaults', async ({ request }) => {
  // Board zuerst leeren (andere Specs können Scores hinterlassen haben)
  await request.post('/api/admin', { data: { pin: PIN, action: 'reset' } });
  const r = await request.get('/api/leaderboard');
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.top).toEqual([]);
  expect(j.duration).toBe(60);
  expect(j.eventName).toBe('Kermes • Fatih Camii Fellbach'); // Default (Nachtrag v1.1)
  expect(j.rounds).toBe(0); // v2.4: Runden-Zähler startet bei 0 (Reset nullt)
  expect(j.mode).toBe('memory');
});

test('Score: Best-of pro Name (ZADD-GT-Semantik) + Rang + Delta', async ({ request }) => {
  let r = await request.post('/api/score', { data: { name: 'Alina', score: 500 } });
  let j = await r.json();
  expect(j.rank).toBe(1);
  expect(j.isNewBest).toBe(true);
  expect(j.tries).toBe(1);
  expect(j.deltaUp).toBeNull();

  // schlechterer zweiter Versuch → Bestmarke bleibt
  r = await request.post('/api/score', { data: { name: 'Alina', score: 300 } });
  j = await r.json();
  expect(j.isNewBest).toBe(false);
  expect(j.best).toBe(500);
  expect(j.tries).toBe(2);

  // zweiter Spieler knapp dahinter → Delta-Framing-Daten
  r = await request.post('/api/score', { data: { name: 'Ben', score: 488 } });
  j = await r.json();
  expect(j.rank).toBe(2);
  expect(j.deltaUp).toEqual({ rank: 1, points: 12 }); // „Nur 12 Punkte hinter Platz 1!"
  expect(j.top[0].name).toBe('Alina');
  expect(j.top[1].name).toBe('Ben');

  // besserer Versuch → neue Bestmarke
  r = await request.post('/api/score', { data: { name: 'Ben', score: 505 } });
  j = await r.json();
  expect(j.isNewBest).toBe(true);
  expect(j.rank).toBe(1);

  // v2.4: Runden-Zähler — 4 gültige Submits seit Reset = 4 Runden
  const lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.rounds).toBe(4);
});

test('Schutz: Whitelist-Regex, Blockliste, Score-Deckel 3000', async ({ request }) => {
  const cases = [
    [{ name: 'Häx<>!', score: 100 }, 'name_chars'],
    [{ name: '', score: 100 }, 'name_missing'],
    [{ score: 100 }, 'name_missing'],
    [{ name: 'arschloch99', score: 100 }, 'name_blocked'], // LDNOOBW-DE
    [{ name: 'FUCKER', score: 100 }, 'name_blocked'], // LDNOOBW-EN, case-insensitiv
    [{ name: 'Clara', score: 3001 }, 'score_invalid'],
    [{ name: 'Clara', score: -5 }, 'score_invalid'],
    [{ name: 'Clara', score: 12.5 }, 'score_invalid'],
    [{ name: 'Clara', score: '500' }, 'score_invalid'],
  ];
  for (const [data, error] of cases) {
    const r = await request.post('/api/score', { data });
    expect(r.status(), JSON.stringify(data)).toBe(400);
    expect((await r.json()).error).toBe(error);
  }
  // 16-Zeichen-Kappung serverseitig
  const r = await request.post('/api/score', { data: { name: 'A'.repeat(30), score: 100 } });
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.top.find((e) => e.name === 'A'.repeat(16))).toBeTruthy();
});

test('Admin: PIN-Gate, Banner, Rundenlänge, Reset', async ({ request }) => {
  // falsche PIN
  let r = await request.post('/api/admin', { data: { pin: '0000', action: 'list' } });
  expect(r.status()).toBe(401);

  // Banner setzen → im Leaderboard sichtbar
  r = await request.post('/api/admin', { data: { pin: PIN, action: 'banner', value: 'Platz 1: Getränk aufs Haus!' } });
  expect(r.status()).toBe(200);
  // Rundenlänge 75 s
  r = await request.post('/api/admin', { data: { pin: PIN, action: 'duration', value: 75 } });
  expect(r.status()).toBe(200);
  // ungültige Rundenlänge
  r = await request.post('/api/admin', { data: { pin: PIN, action: 'duration', value: 45 } });
  expect(r.status()).toBe(400);

  // Event-Name setzen (Nachtrag v1.1)
  r = await request.post('/api/admin', { data: { pin: PIN, action: 'eventName', value: 'Sommerfest Testverein' } });
  expect(r.status()).toBe(200);

  const lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.banner).toBe('Platz 1: Getränk aufs Haus!');
  expect(lb.duration).toBe(75);
  expect(lb.eventName).toBe('Sommerfest Testverein');

  // list liefert Einträge
  r = await request.post('/api/admin', { data: { pin: PIN, action: 'list' } });
  const list = await r.json();
  expect(list.entries.length).toBeGreaterThan(0);

  // Reset → leer, Runden-Zähler mitgenullt (v2.4)
  await request.post('/api/admin', { data: { pin: PIN, action: 'reset' } });
  const after = await (await request.get('/api/leaderboard')).json();
  expect(after.top).toEqual([]);
  expect(after.rounds).toBe(0);
  // Aufräumen für Folgetests
  await request.post('/api/admin', { data: { pin: PIN, action: 'duration', value: 60 } });
  await request.post('/api/admin', { data: { pin: PIN, action: 'banner', value: '' } });
  await request.post('/api/admin', { data: { pin: PIN, action: 'eventName', value: 'Kermes • Fatih Camii Fellbach' } });
});

test('UI-Flow: Runde endet → Server-Rang + Delta + Top 10 auf dem Ergebnis-Screen', async ({ page, request }) => {
  await request.post('/api/admin', { data: { pin: PIN, action: 'reset' } });
  await request.post('/api/score', { data: { name: 'Champ', score: 300 } });

  await page.goto('/?seed=42');
  await page.evaluate(() => {
    localStorage.setItem('tr-name', 'FlowBot');
    window.__TR.state.name = 'FlowBot';
    window.__TR.newGame({ autoSpawn: false });
    return 1;
  });
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    // 14 Catches = 91 (Rampe 10..16) + 7×16 = 203 + 30 Füll-Bonus (10.) = 233 (unter Champ=300)
    for (let i = 0; i < 14; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });
  await expect(page.locator('#screen-result')).toBeVisible();
  await expect(page.locator('#res-rank')).toHaveText('Platz 2', { timeout: 5000 });
  await expect(page.locator('#res-delta')).toContainText('hinter Platz 1');
  await expect(page.locator('#res-top10 li')).toHaveCount(2);
  await expect(page.locator('#res-top10 li.me .lb-name')).toHaveText('FlowBot');

  // v2.4: 2. Runde SCHLECHTER als Bestwert (91 < 233) → KEIN „Platz N"-Jubel,
  // sondern ehrliche Beschriftung: Bestwert-Rang + „dein Bestwert zählt weiter"
  await page.evaluate(() => {
    window.__TR.newGame({ autoSpawn: false });
    const g = window.__TR.game;
    g.stop();
    // 7 Catches = 91 (Rampe 10..16), kein Füll-Bonus
    for (let i = 0; i < 7; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });
  await expect(page.locator('#screen-result')).toBeVisible();
  await expect(page.locator('#res-rank')).toHaveText('Dein Bestwert: 233 — Platz 2', { timeout: 5000 });
  await expect(page.locator('#res-delta')).toContainText('Diese Runde: 91 — dein Bestwert zählt weiter');
  await expect(page.locator('#res-delta')).toContainText('hinter Platz 1'); // deltaUp bleibt (bezieht sich auf Bestwert)
  await expect(page.locator('#res-newbest')).toBeHidden();
});

test('Playing-Presence: Ping → Liste (alphabetisch, max 6), Submit löscht, TTL läuft ab', async ({ request }) => {
  // Eigener Rate-Limit-Bucket via x-forwarded-for: schont das knappe
  // Score-Budget (10/60 s) der Suite für die übrigen Tests
  const headers = { 'x-forwarded-for': '10.99.0.1' };

  let r = await request.post('/api/playing', { data: { name: 'Zoe' }, headers });
  expect(r.status()).toBe(200);
  await request.post('/api/playing', { data: { name: 'Adam' }, headers });
  let lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.playing).toEqual(['Adam', 'Zoe']); // alphabetisch

  // sanitizeName-Pipeline greift auch hier
  r = await request.post('/api/playing', { data: { name: 'Häx<>!' }, headers });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toBe('name_chars');

  // Score-Submit beendet die Runde → Presence des Namens weg
  r = await request.post('/api/score', { data: { name: 'Zoe', score: 120 }, headers });
  expect(r.status()).toBe(200);
  lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.playing).toEqual(['Adam']);

  // max 6, alphabetisch: 6 weitere Namen → 7 frisch, aber nur 6 geliefert
  for (const name of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) {
    await request.post('/api/playing', { data: { name }, headers });
  }
  lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.playing).toEqual(['Adam', 'B1', 'B2', 'B3', 'B4', 'B5']);

  // TTL (lokal PLAYING_TTL_S=2 via webServer-Env, Prod 100 s) → alles läuft ab
  await new Promise((resolve) => setTimeout(resolve, 2600));
  lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.playing).toEqual([]);
});

test('/board: ohne Gate sofort sichtbar, QR-Kachel weiß, Daten ab Load gepollt', async ({ page, request }) => {
  await request.post('/api/admin', { data: { pin: PIN, action: 'reset' } });
  await request.post('/api/score', { data: { name: 'BoardStar', score: 777 } });
  await request.post('/api/admin', { data: { pin: PIN, action: 'banner', value: 'Sieger bekommt 1 Drink!' } });

  await page.goto('/board');
  // v2.4: kein Start-Overlay mehr — Board + Daten ohne jede Geste
  await expect(page.locator('#board-start')).toHaveCount(0);
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#btn-fullscreen')).toBeVisible(); // dezenter Vollbild-Button

  // QR: Canvas in weißer Kachel (nie invertiert)
  await expect(page.locator('.qr-tile canvas')).toHaveCount(1);
  const bg = await page.locator('.qr-tile').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');

  await expect(page.locator('#board-list li.rank-1 .b-name')).toHaveText('BoardStar');
  await expect(page.locator('#board-banner')).toHaveText('Sieger bekommt 1 Drink!');
  // v2.4: Runden-Zähler im Header (1 Submit seit Reset), Count-up landet auf 1
  await expect(page.locator('#board-rounds')).toContainText('Runden');
  await expect(page.locator('#rounds-num')).toHaveText('1');
  // v2.4: Playing-Zeile versteckt, wenn niemand spielt
  await expect(page.locator('#board-playing')).toBeHidden();
  await expect(page.locator('#offline-badge')).toBeHidden();
  await request.post('/api/admin', { data: { pin: PIN, action: 'banner', value: '' } });
});

test('/admin-UI: Login, Banner speichern, Live-Liste, Reset-Doppelklick', async ({ page, request }) => {
  // Kein eigener Seed-Submit (Rate-Limit-Budget 10/60 s der Suite) —
  // BoardStar liegt noch aus dem /board-Test im Store.
  await page.goto('/admin');
  await page.locator('#pin-input').fill('9999');
  await page.locator('#btn-pin').tap();
  await expect(page.locator('#pin-error')).toBeVisible();

  await page.locator('#pin-input').fill(PIN);
  await page.locator('#btn-pin').tap();
  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.locator('#admin-list li').filter({ hasText: 'BoardStar' })).toHaveCount(1);

  await page.locator('#banner-input').fill('Kermes-Board aktiv');
  await page.locator('#btn-banner').tap();
  await expect(page.locator('#admin-msg')).toHaveText('Banner gespeichert');

  // Reset braucht Bestätigung
  await page.locator('#btn-reset').tap();
  await expect(page.locator('#btn-reset-confirm')).toBeVisible();
  await page.locator('#btn-reset-confirm').tap();
  await expect(page.locator('#admin-msg')).toHaveText('Board zurückgesetzt');
  const lb = await (await request.get('/api/leaderboard')).json();
  expect(lb.top).toEqual([]);
  await request.post('/api/admin', { data: { pin: PIN, action: 'banner', value: '' } });
});

test('Rundenlänge aus Admin wirkt im Spiel (60–90 s)', async ({ page, request }) => {
  await request.post('/api/admin', { data: { pin: PIN, action: 'duration', value: 90 } });
  await page.goto('/?seed=42');
  await page.waitForFunction(() => window.__TR.state.duration === 90);
  const dur = await page.evaluate(() => {
    window.__TR.newGame({ autoSpawn: false });
    return window.__TR.game.duration;
  });
  expect(dur).toBe(90);
  await request.post('/api/admin', { data: { pin: PIN, action: 'duration', value: 60 } });
});

test('Rate-Limit: slidingWindow(10, 60 s) pro IP → 429 (zuletzt!)', async ({ request }) => {
  let got429 = false;
  for (let i = 0; i < 15; i++) {
    const r = await request.post('/api/score', { data: { name: 'RateBot', score: 100 + i } });
    if (r.status() === 429) {
      got429 = true;
      expect((await r.json()).error).toBe('rate_limited');
      break;
    }
  }
  expect(got429).toBe(true);
  // und bleibt geblockt
  const r = await request.post('/api/score', { data: { name: 'RateBot', score: 999 } });
  expect(r.status()).toBe(429);
});
