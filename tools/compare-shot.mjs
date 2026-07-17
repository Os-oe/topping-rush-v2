// Vorher/Nachher-Paar (Ship-Gate): identische eingefrorene Spielszene
// gegen V1-Live und V2-Live — Beleg für den User-Report.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'shots/compare';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [tag, base] of [
  ['v1', 'https://topping-rush.demo.osai.solutions'],
  ['v2', 'https://topping-rush-v2.demo.osai.solutions'],
]) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(`${base}/?seed=42`);
  await page.waitForFunction(() => window.__TR);
  await page.evaluate(() => {
    window.__TR.newGame({ autoSpawn: false, seed: 42 });
    return 1;
  });
  await page.waitForTimeout(600); // Sprites/Fonts dekodieren
  await page.evaluate(() => {
    const g = window.__TR.game;
    g.stop();
    g.items.length = 0;
    const kinds = ['nar', 'limon', 'karpuz', 'nane', 'visne', 'portakal', 'cilek', 'cay'];
    kinds.forEach((k, i) => {
      const col = i % 4;
      const row = (i / 4) | 0;
      const it = g.spawnItem('topping', { x: 70 + col * 92, y: 200 + row * 130, variant: k });
      it.rot = 0;
      it.rotV = 0;
    });
    g.spawnItem('chili', { x: 116, y: 480 });
    const w = g.spawnItem('wasp', { x: 300, y: 480 });
    w.baseX = 300;
    g.cup.x = g.cup.target = g.W / 2;
    g.update(0);
    g.render();
    g.render();
    return 1;
  });
  await page.screenshot({ path: `${OUT}/${tag}-gleiche-szene.png` });
  await ctx.close();
  console.log(`${tag} → ${OUT}/${tag}-gleiche-szene.png (${base})`);
}
await browser.close();
