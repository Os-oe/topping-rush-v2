// Phase-4-Gate: Audio-System — Init NUR nach User-Geste, alle Event-Sounds
// crashen nicht (headless = stumm, Codepfade laufen), Continuous-Cleanup.
import { test, expect } from '@playwright/test';

test('Audio: Init nach Geste, SFX-Events sauber, Musik-Loop geladen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/?seed=42');
  // VOR der Geste: kein AudioContext (Konzept-PFLICHT)
  expect(await page.evaluate(() => window.__audio.ctx === null)).toBe(true);

  await page.locator('#name-input').fill('AudioBot');
  await page.locator('#btn-play').tap(); // Geste → ensureStarted
  await page.waitForFunction(() => window.__audio.ctx !== null);

  // Countdown überspringen, deterministisches Spiel starten
  await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    // alle Sound-Pfade durchspielen
    for (let i = 0; i < 6; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.spawnItem('chili', { x: g.cup.x, y: g.cupY - 5 });
    g.update(1 / 60);
    g.spawnItem('wasp', { x: g.cup.x, y: g.cupY - 5 });
    g.items[g.items.length - 1].baseX = g.cup.x;
    g.update(1 / 60);
    g.spawnItem('powerup', { x: g.cup.x, y: g.cupY - 5, variant: 'magnet' });
    g.update(1 / 60);
    // Bad-Item spawnen und durchfallen lassen → despawn-Cleanup
    g.spawnItem('chili', { x: 30, y: g.H - 10 });
    for (let i = 0; i < 40; i++) g.update(1 / 60);
    // Frenzy + letzte Sekunden + Ende
    g.t = g.duration - 4;
    g.update(1 / 60);
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  });

  await expect(page.locator('#screen-result')).toBeVisible();
  // Continuous-Sounds (Pfeifen/Summen/Shimmer) alle gestoppt
  const cont = await page.evaluate(() => window.__audio.continuous.size);
  expect(cont).toBe(0);
  // Musik-Loop geladen (public/music/loop.mp3 → decodeAudioData, async)
  await page.waitForFunction(() => !!window.__audio.musicBuffer, null, { timeout: 10_000 });

  expect(errors, errors.join('\n')).toEqual([]);
});
