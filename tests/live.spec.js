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

test('Live: Board offen → Playing-Zeile bei Rundenstart, Score ohne Reload ≤ 4 s, Presence weg nach Submit', async ({ page, context }) => {
  test.setTimeout(120_000);

  // v2.4: Board ZUERST öffnen — ohne Gate sofort sichtbar, pollt ab Load
  const board = await context.newPage();
  const firstPoll = board.waitForResponse((r) => r.url().includes('/api/leaderboard') && r.ok(), { timeout: 15_000 });
  await board.goto('/board');
  await expect(board.locator('#board')).toBeVisible();
  await expect(board.locator('#btn-fullscreen')).toBeVisible();
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

  // Runde deterministisch verkürzen: 25 echte Catches (~450 Punkte — landet
  // sicher in den Top 10 des Live-Boards), dann Zeit ablaufen lassen
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
  // Server-Antwort angekommen: Rang sichtbar (nicht Offline-Hinweis) —
  // NAME ist frisch → isNewBest → Jubel-Pfad zeigt „Platz N"
  await expect(page.locator('#res-rank')).toContainText(/Platz/i, { timeout: 10_000 });
  await expect(page.locator('#res-top10 li.me .lb-name')).toHaveText(NAME);

  // v2.4-Gate: Eintrag erscheint OHNE Reload binnen ≤ 4 s auf dem offenen Board
  await expect(board.locator('#board-list li').filter({ hasText: NAME })).toHaveCount(1, { timeout: 4000 });
  await expect(board.locator('#offline-badge')).toBeHidden();

  // v2.4: Presence nach Submit gelöscht → NAME verschwindet aus der Zeile
  // (not.toContainText statt toBeHidden: andere echte Spieler dürfen drinstehen)
  await expect(board.locator('#playing-text')).not.toContainText(NAME, { timeout: 8000 });

  // v2.4: Runden-Zähler ist live hochgezählt (>= +1; parallele Spieler erlaubt)
  await expect
    .poll(async () => Number(await board.locator('#rounds-num').textContent()), { timeout: 8000 })
    .toBeGreaterThan(roundsBefore);

  // Restart < 1 s auch live
  const t0 = Date.now();
  await page.locator('#btn-again').tap();
  await expect(page.locator('#screen-countdown')).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
});
