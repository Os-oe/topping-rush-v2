// Phase-5-Gate: E2E gegen die LIVE-URL (mobil, hasTouch) — inkl. echtem
// Score-Submit auf dem Produktions-Store und Board-Sichtbarkeit.
// Lauf: npm run test:live (Projekt "live", baseURL = LIVE_URL)
import { test, expect } from '@playwright/test';

const NAME = `E2E-${Date.now().toString(36).slice(-6)}`;

test('Live: Start-Screen, Legal, API erreichbar', async ({ page, request }) => {
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
  console.log('LIVE store mode:', j.mode, '| eventName:', j.eventName);

  // Legal enthält echte Stammdaten (§5 DDG)
  await page.locator('#btn-legal').tap();
  await expect(page.locator('#legal-content')).toContainText('Öztopcu');
  await expect(page.locator('#legal-content')).toContainText('DE462559965');
});

test('Live: Runde spielen → Score auf Server → /board zeigt Eintrag', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('/?seed=42');
  await page.locator('#name-input').fill(NAME);
  await page.locator('#btn-play').tap();
  await expect(page.locator('#screen-game')).toBeVisible({ timeout: 8000 });

  // Runde deterministisch verkürzen: ein paar echte Catches, dann Zeit ablaufen lassen
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    for (let i = 0; i < 5; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });
  await expect(page.locator('#screen-result')).toBeVisible();
  // Server-Antwort angekommen: Rang sichtbar (nicht Offline-Hinweis)
  await expect(page.locator('#res-rank')).toContainText(/Platz/i, { timeout: 10_000 });
  await expect(page.locator('#res-top10 li.me .lb-name')).toHaveText(NAME);

  // TV-Board in zweitem Tab: Eintrag sichtbar nach Poll
  const board = await context.newPage();
  await board.goto('/board');
  await board.locator('#btn-board-start').tap();
  await expect(board.locator('#board')).toBeVisible();
  await expect(board.locator('.qr-tile canvas')).toHaveCount(1);
  await expect(board.locator('#board-list li').filter({ hasText: NAME })).toHaveCount(1, { timeout: 12_000 });
  await expect(board.locator('#offline-badge')).toBeHidden();

  // Restart < 1 s auch live
  const t0 = Date.now();
  await page.locator('#btn-again').tap();
  await expect(page.locator('#screen-countdown')).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
});
