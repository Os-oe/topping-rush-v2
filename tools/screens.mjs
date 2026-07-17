// Screenshots aller Screens für die Stil-Sichtprüfung (Gate 3).
// Voraussetzung: server.js läuft auf :4573 (dist gebaut).
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4573';
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const PIN = '4242';

// Seed-Daten
const ctx0 = await browser.newContext();
const req = ctx0.request;
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'reset' } });
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'banner', value: 'Platz 1 heute: 1 Getränk aufs Haus!' } });
for (const [name, score] of [['Luna', 1240], ['Mex', 1105], ['Toni', 980], ['Ayse', 870], ['Ben', 760], ['Caro', 655], ['Deniz', 540], ['Eli', 430], ['Fio', 320]]) {
  await req.post(`${BASE}/api/score`, { data: { name, score } });
  // Rate-Limit ist 10/60 s — 9 Seeds, damit der Spiel-Submit noch durchgeht
}
await ctx0.close();

// ---------- Mobile Screens ----------
const mob = await browser.newContext({ ...devices['Pixel 7'] });
const page = await mob.newPage();

await page.goto(`${BASE}/?seed=42`);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/01-start.png` });

// Countdown
await page.locator('#name-input').fill('NEONFAN');
await page.locator('#btn-play').tap();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-countdown.png` });

// Spiel: echte Spawns, Mitte der Runde + Frenzy
await page.waitForSelector('#screen-game:not([hidden])', { timeout: 8000 });
await page.waitForTimeout(6000);
await page.locator('#screen-game').tap({ position: { x: 200, y: 500 } });
await page.screenshot({ path: `${OUT}/03-game-early.png` });
// Power-Up + Bombe erzwingen für den Shot
await page.evaluate(() => {
  const g = window.__TR.game;
  g.spawnItem('powerup', { x: g.cup.x, y: g.cupY - 8, variant: 'magnet' });
  g.spawnItem('bomb', { x: 80, y: g.H * 0.4 });
  g.spawnItem('wasp', { x: g.W - 90, y: g.H * 0.3 });
  return 1;
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-game-powerup.png` });
// Zutaten-Lineup: alle 8 + Bombe + Wespe eingefroren (Gate: Erkennbarkeit in Fallgröße)
await page.evaluate(() => {
  const g = window.__TR.game;
  g.stop();
  g.items.length = 0;
  const kinds = ['nar', 'limon', 'karpuz', 'nane', 'visne', 'portakal', 'cilek', 'cay'];
  kinds.forEach((k, i) => {
    const col = i % 4;
    const row = (i / 4) | 0;
    const it = g.spawnItem('topping', { x: 70 + col * 92, y: 260 + row * 120, variant: k });
    it.rot = 0;
    it.rotV = 0;
  });
  g.spawnItem('bomb', { x: 116, y: 500 });
  const w = g.spawnItem('wasp', { x: 300, y: 500 });
  w.baseX = 300;
  g.update(0);
  g.render();
  g.render(); // zweiter Render: Trail-Fade über dem Erst-Frame
  return 1;
});
await page.screenshot({ path: `${OUT}/04b-zutaten-lineup.png` });
await page.evaluate(() => { window.__TR.game.start(); return 1; }); // Loop für Frenzy-Shot neu starten
// Frenzy
await page.evaluate(() => { window.__TR.game.t = window.__TR.game.duration - 9.5; return 1; });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/05-game-frenzy.png` });
// Ergebnis
await page.evaluate(() => { window.__TR.game.t = window.__TR.game.duration + 0.01; return 1; });
await page.waitForSelector('#screen-result:not([hidden])');
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/06-result.png` });
await mob.close();

// ---------- TV-Board (1080p) ----------
const tv = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tvPage = await tv.newPage();
await tvPage.goto(`${BASE}/board`);
await tvPage.screenshot({ path: `${OUT}/07-board-start.png` });
await tvPage.locator('#btn-board-start').click();
await tvPage.waitForSelector('#board-list li');
await tvPage.waitForTimeout(600);
await tvPage.screenshot({ path: `${OUT}/08-board.png` });
await tv.close();

// ---------- Admin (mobil) ----------
const adm = await browser.newContext({ ...devices['Pixel 7'] });
const admPage = await adm.newPage();
await admPage.goto(`${BASE}/admin`);
await admPage.locator('#pin-input').fill(PIN);
await admPage.locator('#btn-pin').tap();
await admPage.waitForSelector('#admin-panel:not([hidden])');
await admPage.waitForTimeout(400);
await admPage.screenshot({ path: `${OUT}/09-admin.png`, fullPage: true });
await adm.close();

await browser.close();
console.log('Screenshots →', OUT);
