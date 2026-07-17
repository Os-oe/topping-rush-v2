// v2.2-Gate: Board-Celebration — Trigger-Logik (rein) + Integration über den
// Poll (v2.4: 3 s, startet ab Seiten-Load). Der Poll wird per route-Stub
// gefüttert statt echter /api/score-Submits: das Rate-Limit-Budget der Suite
// (10/60 s) bleibt unangetastet (Lesson aus dem /admin-UI-Test). route statt
// fetch-Stub, weil das Board seit v2.4 schon beim Load pollt.
import { test, expect } from '@playwright/test';

test('Celebration-Trigger: Erst-Load nie, neuer/verbesserter Top-3 ja, Rang 4 nein', async ({ page }) => {
  await page.goto('/board');
  const logic = await page.evaluate(() => {
    const d = window.__BOARD.detectCelebration;
    return {
      firstLoad: d(null, [{ name: 'A', score: 100 }]),
      newLeader: d([{ name: 'A', score: 100 }], [{ name: 'B', score: 200 }, { name: 'A', score: 100 }]),
      improved: d([{ name: 'A', score: 100 }], [{ name: 'A', score: 150 }]),
      unchanged: d([{ name: 'A', score: 100 }], [{ name: 'A', score: 100 }]),
      rank4: d(
        [{ name: 'A', score: 400 }, { name: 'B', score: 300 }, { name: 'C', score: 200 }],
        [{ name: 'A', score: 400 }, { name: 'B', score: 300 }, { name: 'C', score: 200 }, { name: 'E', score: 150 }]
      ),
      caseInsensitiv: d([{ name: 'Ayse', score: 100 }], [{ name: 'AYSE', score: 100 }]),
    };
  });
  expect(logic.firstLoad).toBeNull();
  expect(logic.newLeader).toEqual({ name: 'B', rank: 1 });
  expect(logic.improved).toEqual({ name: 'A', rank: 1 });
  expect(logic.unchanged).toBeNull();
  expect(logic.rank4).toBeNull();
  expect(logic.caseInsensitiv).toBeNull();
});

test('Celebration-Integration: neuer Platz 1 im Poll → 🏆-Banner + Konfetti + Gold-Puls, danach Cleanup', async ({ page }) => {
  test.setTimeout(45_000);
  // Poll-Antworten stubben (VOR goto — v2.4 pollt ab Load):
  // 1. Poll = Basis-Stand, ab 2. Poll = neuer Rekord
  const base = { duration: 60, eventName: 'Test', banner: '', mode: 'memory' };
  const seq = [
    { ...base, rounds: 41, playing: ['LISA', 'OSMAN'], top: [{ name: 'Basis', score: 400 }] },
    { ...base, rounds: 42, playing: ['OSMAN'], top: [{ name: 'Sturm', score: 900 }, { name: 'Basis', score: 400 }] },
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
  // v2.4: Count-up auf 42, Playing-Zeile jetzt Singular
  await expect(page.locator('#rounds-num')).toHaveText('42');
  await expect(page.locator('#playing-text')).toHaveText('OSMAN spielt gerade…');
  // Celebration endet und räumt auf (Banner weg, Canvas hidden, Puls weg)
  await expect(page.locator('#celebrate-pop')).toBeHidden({ timeout: 9000 });
  await expect(page.locator('#celebrate-canvas')).toBeHidden();
  await expect(page.locator('#board-list')).not.toHaveClass(/gold-pulse/);
});
