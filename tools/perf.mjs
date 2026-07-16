// 60-fps-Gate: Median-Frametime auf Mobile-Viewport, echte GPU
// (--use-angle=metal --enable-gpu), 3 Läufe mit Warmup (MIXR-Lesson:
// Headless ohne GPU ist Rauschen).
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:4573';
const runs = [];

for (let run = 0; run < 3; run++) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-angle=metal', '--enable-gpu', '--window-position=2000,50'],
  });
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?seed=42`);
  await page.evaluate(() => {
    window.__TR.newGame({ autoSpawn: true, seed: 42 });
    return 1;
  });
  // Bot bewegt den Becher, damit realistisch gezeichnet wird
  await page.evaluate(() => {
    window.__perfBot = setInterval(() => {
      const g = window.__TR.game;
      if (g?.running) g.cup.target = 40 + Math.random() * (g.W - 80);
    }, 300);
    return 1;
  });
  await page.waitForTimeout(2000); // Warmup
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (times.length >= 600) {
            times.sort((a, b) => a - b);
            resolve({
              median: times[300],
              p95: times[Math.floor(times.length * 0.95)],
              worst: times[times.length - 1],
            });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
  );
  await page.evaluate(() => clearInterval(window.__perfBot));
  runs.push(result);
  console.log(`Lauf ${run + 1}: median ${result.median.toFixed(2)} ms (${(1000 / result.median).toFixed(1)} fps) · p95 ${result.p95.toFixed(2)} ms · worst ${result.worst.toFixed(1)} ms`);
  await browser.close();
}

const medFps = runs.map((r) => 1000 / r.median);
const ok = medFps.every((f) => f >= 58);
console.log(ok ? 'GATE PASS: 60 fps Median in allen 3 Läufen' : 'GATE FAIL');
process.exit(ok ? 0 : 1);
