// Phase-5-Gate: E2E gegen die LIVE-URL (mobil, hasTouch) — inkl. echtem
// Score-Submit auf dem Produktions-Store und Board-Sichtbarkeit.
// v2.4-Gate: Board OHNE Gate offen, Playing-Zeile erscheint bei Rundenstart
// und verschwindet nach Submit, Score erscheint ≤ 4 s OHNE Reload.
// Lauf: npm run test:live (Projekt "live", baseURL = LIVE_URL)
import { test, expect } from '@playwright/test';

const NAME = `E2E-${Date.now().toString(36).slice(-6)}`;

test('Live: Start-Screen, Legal, API erreichbar (mode:redis)', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('#logo')).toBeVisible();
  await expect(page.locator('#btn-play')).toBeVisible();

  // API + no-store
  const r = await request.get('/api/leaderboard');
  expect(r.status()).toBe(200);
  expect(r.headers()['cache-control']).toContain('no-store');
  const j = await r.json();
  expect(Array.isArray(j.top)).toBe(true);
  expect(j.duration).toBeGreaterThanOrEqual(60);
  expect(j.mode).toBe('redis'); // v2.4-Gate: echter Store, kein Memory-Fallback
  expect(typeof j.rounds).toBe('number'); // v2.4: Runden-Zähler liefert
  expect(Array.isArray(j.playing)).toBe(true); // v2.4: Presence-Liste liefert
  console.log('LIVE store mode:', j.mode, '| rounds:', j.rounds, '| eventName:', j.eventName);

  // Legal enthält echte Stammdaten (§5 DDG)
  await page.locator('#btn-legal').tap();
  await expect(page.locator('#legal-content')).toContainText('Öztopcu');
  await expect(page.locator('#legal-content')).toContainText('DE462559965');
});

test('Live v2.5: zwei Runden desselben Namens BEIDE in Top 10, Ränge listen-konsistent, Alt-Einträge unversehrt, Board live ohne Reload', async ({ page, context }) => {
  test.setTimeout(150_000);

  // v2.4: Board ZUERST öffnen — ohne Gate sofort sichtbar, pollt ab Load
  const board = await context.newPage();
  const firstPoll = board.waitForResponse((r) => r.url().includes('/api/leaderboard') && r.ok(), { timeout: 15_000 });
  await board.goto('/board');
  await expect(board.locator('#board')).toBeVisible();
  // QA 18.07. (c): Button nur bei vorhandener Fullscreen-API (iPhone: versteckt)
  const fsAvail = await board.evaluate(() => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled));
  if (fsAvail) await expect(board.locator('#btn-fullscreen')).toBeVisible();
  else await expect(board.locator('#btn-fullscreen')).toBeHidden();
  await expect(board.locator('.qr-tile canvas')).toHaveCount(1);
  await expect(board.locator('#board-rounds')).toContainText('Runden');
  const roundsBefore = Number(((await (await firstPoll).json()).rounds) || 0);

  await page.goto('/?seed=42');
  await page.locator('#name-input').fill(NAME);
  await page.locator('#btn-play').tap();
  // v2.1: Legende erscheint (inhaltlicher Live-Check), Tap-Start
  await expect(page.locator('#legend-card')).toBeVisible();
  await expect(page.locator('#legend-card')).toContainText('Bombe −30');
  await page.locator('#btn-start-round').tap(); // → LOS! → Playing-Ping (v2.4)
  await expect(page.locator('#screen-game')).toBeVisible({ timeout: 8000 });

  // v2.4-Gate: Playing-Zeile erscheint auf dem OFFENEN Board (3-s-Poll + Puffer)
  await expect(board.locator('#board-playing')).toBeVisible({ timeout: 8000 });
  await expect(board.locator('#playing-text')).toContainText(NAME);

  // v2.1: Bombe fällt live — Sprite geladen, −30-Mechanik + Combo-Reset greifen
  const bomb = await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    g.score = 50;
    g.streak = 3;
    g.spawnItem('bomb', { x: g.cup.x, y: g.cupY - 5 });
    g.update(1 / 60);
    return { score: g.score, streak: g.streak, ready: !!g.skin?.sprites?.bomb?.ready };
  });
  expect(bomb.score).toBe(20);
  expect(bomb.streak).toBe(0);
  expect(bomb.ready).toBe(true);

  // Runde 1 deterministisch verkürzen: 25 echte Catches (Endscore 459 —
  // landet sicher in den Top 10 des Live-Boards), dann Zeit ablaufen lassen
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    for (let i = 0; i < 25; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });
  await expect(page.locator('#screen-result')).toBeVisible();
  // Server-Antwort angekommen: Rang sichtbar (v2.5: Rang-Jubel gilt der Runde)
  await expect(page.locator('#res-rank')).toContainText(/Platz/i, { timeout: 10_000 });
  await expect(page.locator('#res-top10 li.me .lb-name')).toHaveText(NAME);
  const run1 = await page.evaluate(() => ({
    runId: window.__TR.state.lastRunId,
    score: window.__TR.state.lastStats.score,
  }));
  expect(typeof run1.runId).toBe('string'); // v2.5: Server liefert runId

  // v2.4-Gate: Runde 1 erscheint OHNE Reload binnen ≤ 4 s auf dem offenen Board
  await expect(board.locator('#board-list li').filter({ hasText: NAME })).toHaveCount(1, { timeout: 4000 });
  await expect(board.locator('#offline-badge')).toBeHidden();

  // v2.4: Presence nach Submit gelöscht → NAME verschwindet aus der Zeile
  // (not.toContainText statt toBeHidden: andere echte Spieler dürfen drinstehen)
  await expect(board.locator('#playing-text')).not.toContainText(NAME, { timeout: 8000 });

  // v2.4: Runden-Zähler ist live hochgezählt (>= +1; parallele Spieler erlaubt)
  await expect
    .poll(async () => Number(await board.locator('#rounds-num').textContent()), { timeout: 8000 })
    .toBeGreaterThan(roundsBefore);

  // ---------- Runde 2, GLEICHER Name (v2.5-Kernbeweis) ----------
  // Restart < 1 s auch live
  const t0 = Date.now();
  await page.locator('#btn-again').tap();
  await expect(page.locator('#screen-countdown')).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
  await page.locator('#btn-start-round').tap();
  await expect(page.locator('#screen-game')).toBeVisible({ timeout: 8000 });

  // 12 Catches = 201 Punkte (schlechter als Runde 1, aber Top-10-fähig)
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    for (let i = 0; i < 12; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });
  await expect(page.locator('#screen-result')).toBeVisible();
  await expect(page.locator('#res-rank')).toContainText(/Platz/i, { timeout: 10_000 });
  const run2 = await page.evaluate(() => ({
    runId: window.__TR.state.lastRunId,
    score: window.__TR.state.lastStats.score,
    rankText: document.getElementById('res-rank').textContent,
    top: window.__TR.state.top,
  }));
  expect(run2.runId).not.toBe(run1.runId);
  expect(run2.score).toBeLessThan(run1.score);

  // (a) BEIDE Runden in der Top 10, Ränge listen-konsistent
  const mine = run2.top.filter((e) => e.name === NAME);
  expect(mine).toHaveLength(2);
  expect(mine.map((e) => e.score).sort((a, b) => b - a)).toEqual([run1.score, run2.score]);
  const idx2 = run2.top.findIndex((e) => e.id === `${NAME}#${run2.runId}`);
  expect(idx2).toBeGreaterThanOrEqual(0);
  expect(run2.rankText).toBe(`Platz ${idx2 + 1}`); // angezeigter Rang = Listen-Position der Runde
  // me-Markierung trifft NUR die frische Runde 2
  await expect(page.locator('#res-top10 li.me')).toHaveCount(1);
  await expect(page.locator('#res-top10 li.me .lb-score')).toHaveText(String(run2.score));

  // (b) Alt-Einträge der Best-of-Ära unversehrt (Member ohne '#')
  const selcuk = run2.top.find((e) => e.id === 'Selcuk');
  const osman = run2.top.find((e) => e.id === 'Osman');
  expect(selcuk).toBeTruthy();
  expect(selcuk.score).toBe(1551);
  expect(osman).toBeTruthy();
  expect(osman.score).toBe(1519);

  // (c) Board zeigt BEIDE Runden live ohne Reload (≤ 4 s nach Submit)
  await expect(board.locator('#board-list li').filter({ hasText: NAME })).toHaveCount(2, { timeout: 4000 });
  await expect(board.locator('#board-list li').filter({ hasText: 'Selcuk' })).toHaveCount(1);
  await expect(board.locator('#board-list li').filter({ hasText: 'Osman' })).toHaveCount(1);
});
