// v2.2-Gate: Board-Celebration — Trigger-Logik (rein) + Integration über den
// Poll (v2.4: 3 s, startet ab Seiten-Load). Der Poll wird per route-Stub
// gefüttert statt echter /api/score-Submits: das Rate-Limit-Budget der Suite
// (10/60 s) bleibt unangetastet (Lesson aus dem /admin-UI-Test). route statt
// fetch-Stub, weil das Board seit v2.4 schon beim Load pollt.
import { test, expect } from '@playwright/test';

test('Celebration-Trigger v2.5 (id-basiert): Erst-Load nie, neuer id in Top 3 ja, Rang 4 nein, Mehrfach-Name ok', async ({ page }) => {
  await page.goto('/board');
  const logic = await page.evaluate(() => {
    const d = window.__BOARD.detectCelebration;
    return {
      firstLoad: d(null, [{ name: 'A', score: 100, id: 'A#r1' }]),
      newLeader: d(
        [{ name: 'A', score: 100, id: 'A#r1' }],
        [{ name: 'B', score: 200, id: 'B#r1' }, { name: 'A', score: 100, id: 'A#r1' }]
      ),
      // v2.5: „verbessert" = NEUE Runde desselben Namens = neuer id
      newRunSameName: d(
        [{ name: 'A', score: 100, id: 'A#r1' }],
        [{ name: 'A', score: 150, id: 'A#r2' }, { name: 'A', score: 100, id: 'A#r1' }]
      ),
      unchanged: d([{ name: 'A', score: 100, id: 'A#r1' }], [{ name: 'A', score: 100, id: 'A#r1' }]),
      rank4: d(
        [{ name: 'A', score: 400, id: 'A#r1' }, { name: 'B', score: 300, id: 'B#r1' }, { name: 'C', score: 200, id: 'C#r1' }],
        [{ name: 'A', score: 400, id: 'A#r1' }, { name: 'B', score: 300, id: 'B#r1' }, { name: 'C', score: 200, id: 'C#r1' }, { name: 'E', score: 150, id: 'E#r1' }]
      ),
      // Alt-Member ohne '#' (id = Name) bleiben stabil — kein Fehl-Feuern
      legacyStable: d(
        [{ name: 'Selcuk', score: 1551, id: 'Selcuk' }],
        [{ name: 'Selcuk', score: 1551, id: 'Selcuk' }]
      ),
    };
  });
  expect(logic.firstLoad).toBeNull();
  expect(logic.newLeader).toEqual({ name: 'B', rank: 1 });
  expect(logic.newRunSameName).toEqual({ name: 'A', rank: 1 });
  expect(logic.unchanged).toBeNull();
  expect(logic.rank4).toBeNull();
  expect(logic.legacyStable).toBeNull();
});

test('Celebration-Integration: neuer Platz 1 im Poll → 🏆-Banner + Konfetti + Gold-Puls, danach Cleanup', async ({ page }) => {
  test.setTimeout(45_000);
  // Poll-Antworten stubben (VOR goto — v2.4 pollt ab Load):
  // 1. Poll = Basis-Stand, ab 2. Poll = neuer Rekord
  const base = { duration: 60, eventName: 'Test', banner: '', mode: 'memory' };
  const seq = [
    { ...base, rounds: 41, playing: ['LISA', 'OSMAN'], top: [{ name: 'Basis', score: 400, id: 'Basis#r1' }] },
    // v2.5: zweite Sturm-Runde bleibt liegen — derselbe Name 2× auf dem Board
    { ...base, rounds: 42, playing: ['OSMAN'], top: [
      { name: 'Sturm', score: 900, id: 'Sturm#r2' },
      { name: 'Basis', score: 400, id: 'Basis#r1' },
      { name: 'Sturm', score: 350, id: 'Sturm#r1' },
    ] },
  ];
  let i = 0;
  await page.route('**/api/leaderboard', (route) => {
    route.fulfill({ json: seq[Math.min(i++, seq.length - 1)] });
  });
  await page.goto('/board');
  // v2.4: Board sofort sichtbar — kein Start-Gate, keine Geste
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#board-list li.rank-1 .b-name')).toHaveText('Basis');
  // v2.4: Runden-Zähler + Playing-Zeile (Plural) aus dem ersten Poll
  await expect(page.locator('#rounds-num')).toHaveText('41');
  await expect(page.locator('#board-playing')).toBeVisible();
  await expect(page.locator('#playing-text')).toHaveText('LISA, OSMAN spielen gerade…');
  // Erst-Load: KEINE Celebration
  await expect(page.locator('#celebrate-pop')).toBeHidden();
  // 2. Poll (+3 s): Sturm stürmt auf Platz 1 → Rekord-Celebration ~6 s
  await expect(page.locator('#celebrate-pop')).toBeVisible({ timeout: 9000 });
  await expect(page.locator('#celebrate-text')).toContainText('NEUER REKORD: Sturm');
  await expect(page.locator('#celebrate-canvas')).toBeVisible();
  await expect(page.locator('#board-list')).toHaveClass(/gold-pulse/);
  await expect(page.locator('#board-list li.rank-1 .b-name')).toHaveText('Sturm');
  // v2.5: Mehrfach-Name — beide Sturm-Runden werden 1:1 gerendert
  await expect(page.locator('#board-list li .b-name').filter({ hasText: 'Sturm' })).toHaveCount(2);
  await expect(page.locator('#board-list li.rank-3 .b-score')).toHaveText('350');
  // v2.4: Count-up auf 42, Playing-Zeile jetzt Singular
  await expect(page.locator('#rounds-num')).toHaveText('42');
  await expect(page.locator('#playing-text')).toHaveText('OSMAN spielt gerade…');
  // Celebration endet und räumt auf (Banner weg, Canvas hidden, Puls weg)
  await expect(page.locator('#celebrate-pop')).toBeHidden({ timeout: 9000 });
  await expect(page.locator('#celebrate-canvas')).toBeHidden();
  await expect(page.locator('#board-list')).not.toHaveClass(/gold-pulse/);
});
