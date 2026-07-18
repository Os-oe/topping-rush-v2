// Cross-Device-QA 18.07. — Sichtprüfungs-Shots (LESSON: Layout-Änderung ⇒
// Screenshot-Pflicht): iPhone 13 auf ECHTEM WebKit (Start, Legende, Spiel,
// Ergebnis, Board) + Android-klein 360×640 Chromium (Start, Legende, Spiel).
// Voraussetzung: server.js auf :4573 (npm run build && node server.js).
import { chromium, webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4573';
const OUT = process.env.OUT || 'shots/qa-mobile';
mkdirSync(OUT, { recursive: true });
const PIN = '4242';

// ---------- Seed: Board-Inhalt (lokaler Memory-Store) ----------
const seedBrowser = await chromium.launch();
const seedCtx = await seedBrowser.newContext();
const req = seedCtx.request;
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'reset' } });
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'banner', value: 'Platz 1 heute: 1 Getränk aufs Haus!' } });
let ip = 0;
for (const [name, score] of [
  ['Selcuk', 1551], ['Osman', 1519], ['Luna', 1240], ['Ayse', 1105], ['Toni', 980],
  ['Ben', 760], ['Deniz', 655], ['Eli', 430],
]) {
  await req.post(`${BASE}/api/score`, { data: { name, score }, headers: { 'x-forwarded-for': `10.88.0.${++ip}` } });
}
await req.post(`${BASE}/api/playing`, { data: { name: 'LISA' } });
await seedBrowser.close();

async function shootFlow(browser, ctxOpts, prefix, { withResult, withBoard }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();

  // Start
  await page.goto(`${BASE}/?seed=42`);
  await page.waitForSelector('#top3 .top3-row'); // Top 3 geladen
  await page.screenshot({ path: `${OUT}/${prefix}-1-start.png` });

  // Legende
  await page.locator('#name-input').fill('QA-BOT');
  await page.locator('#btn-play').tap();
  await page.waitForSelector('#legend-card:not([hidden])');
  await page.screenshot({ path: `${OUT}/${prefix}-2-legende.png` });

  // Spiel mit Objekten: deterministisch einfrieren, Items sichtbar platzieren
  await page.evaluate(() => {
    window.__TR.newGame({ autoSpawn: false, seed: 42 });
    const g = window.__TR.game;
    g.stop();
    g.t = 12; g.score = 173; g.streak = 4;
    g.spawnItem('topping', { x: g.W * 0.22, y: g.H * 0.28, variant: 'nar' });
    g.spawnItem('topping', { x: g.W * 0.62, y: g.H * 0.16, variant: 'limon' });
    g.spawnItem('wasp', { x: g.W * 0.78, y: g.H * 0.42 });
    g.spawnItem('bomb', { x: g.W * 0.38, y: g.H * 0.55 });
    g.spawnItem('powerup', { x: g.W * 0.52, y: g.H * 0.35, variant: 'magnet' });
    g.update(1 / 60);
    g.render();
    return 1;
  });
  await page.waitForTimeout(600); // Sprites onload ersetzen Fallback-Blobs
  await page.evaluate(() => { window.__TR.game.render(); return 1; });
  await page.screenshot({ path: `${OUT}/${prefix}-3-spiel.png` });

  if (withResult) {
    await page.evaluate(() => {
      window.__TR.newGame({ autoSpawn: false, seed: 42 });
      const g = window.__TR.game;
      g.stop();
      for (let i = 0; i < 14; i++) {
        g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
        g.update(1 / 60);
      }
      g.t = g.duration + 0.01;
      g.update(1 / 60);
      return 1;
    });
    await page.waitForSelector('#screen-result:not([hidden])');
    await page.waitForFunction(() => document.getElementById('res-rank').textContent.length > 0);
    await page.waitForTimeout(1000); // Count-up ausklingen
    await page.screenshot({ path: `${OUT}/${prefix}-4-ergebnis.png` });
  }

  if (withBoard) {
    await page.goto(`${BASE}/board`);
    await page.waitForSelector('#board-list li.rank-1');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${prefix}-5-board.png` });
  }

  await ctx.close();
}

// ---------- iPhone 13 auf echtem WebKit ----------
const wk = await webkit.launch();
await shootFlow(wk, { ...devices['iPhone 13'] }, 'iphone13-webkit', { withResult: true, withBoard: true });
await wk.close();

// ---------- Android klein (360×640, günstige Geräte) ----------
const cr = await chromium.launch();
await shootFlow(
  cr,
  { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'android-360x640',
  { withResult: false, withBoard: false }
);
await cr.close();

console.log(`Shots → ${OUT}/`);
