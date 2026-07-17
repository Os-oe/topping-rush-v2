// Sichtprüfungs-Shots Nachtrag v2.5 (Gate): Board mit Mehrfach-Namen
// (Desktop 1280×720 + Mobile 390er) + Ergebnis-Screen mit me-Markierung bei
// doppeltem Namen (nur die frische Runde markiert).
// Voraussetzung: server.js auf :4573.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4573';
const OUT = process.env.OUT || 'shots/v25';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const PIN = '4242';

// Seed: Scores inkl. MEHRFACH-Namen (Ayse 2×, Deniz 2× — v2.5 Jede Runde
// zählt), Banner, zwei „spielt gerade"-Namen
const ctx0 = await browser.newContext();
const req = ctx0.request;
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'reset' } });
await req.post(`${BASE}/api/admin`, { data: { pin: PIN, action: 'banner', value: 'Platz 1 heute: 1 Getränk aufs Haus!' } });
let ip = 0;
for (const [name, score] of [
  ['Luna', 1240], ['Ayse', 1105], ['Toni', 980], ['Ayse', 870], ['Ben', 760],
  ['Deniz', 655], ['Deniz', 540], ['Eli', 430],
]) {
  await req.post(`${BASE}/api/score`, { data: { name, score }, headers: { 'x-forwarded-for': `10.77.0.${++ip}` } });
}
await req.post(`${BASE}/api/playing`, { data: { name: 'OSMAN' } });
await req.post(`${BASE}/api/playing`, { data: { name: 'LISA' } });
await ctx0.close();

// ---------- Board Desktop 1280×720 (Mehrfach-Namen sichtbar) ----------
const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const dpage = await desk.newPage();
await dpage.goto(`${BASE}/board`);
await dpage.waitForSelector('#board-list li.rank-1');
await dpage.waitForTimeout(1200); // Count-up ausklingen lassen
await dpage.screenshot({ path: `${OUT}/board-desktop-1280x720-mehrfachname.png` });
await desk.close();

// ---------- Board Mobile 390er Viewport ----------
const mobB = await browser.newContext({ viewport: { width: 390, height: 844 } });
const bpage = await mobB.newPage();
await bpage.goto(`${BASE}/board`);
await bpage.waitForSelector('#board-list li.rank-1');
await bpage.waitForTimeout(1200);
await bpage.screenshot({ path: `${OUT}/board-mobile-390-mehrfachname.png` });
await mobB.close();

// ---------- Ergebnis-Screen: 2 Runden desselben Namens, me = frische Runde ----------
const mob = await browser.newContext({ ...devices['Pixel 7'] });
const page = await mob.newPage();
await page.goto(`${BASE}/?seed=42`);
await page.evaluate(() => {
  localStorage.setItem('tr-name', 'SHOTBOT');
  window.__TR.state.name = 'SHOTBOT';
  return 1;
});
const playRound = async (catches) => {
  await page.evaluate((n) => {
    window.__TR.newGame({ autoSpawn: false });
    const g = window.__TR.game;
    g.stop();
    for (let i = 0; i < n; i++) {
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
    }
    g.t = g.duration + 0.01;
    g.update(1 / 60);
    return 1;
  }, catches);
  await page.waitForSelector('#screen-result:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#res-rank').textContent.length > 0);
  await page.waitForTimeout(1000);
};
// Runde 1: 14 Catches = 233
await playRound(14);
// Runde 2: 7 Catches = 91 — Board hat jetzt SHOTBOT 233 UND SHOTBOT 91;
// me-Markierung sitzt auf der frischen 91er-Runde, Rang-Jubel gilt der Runde
await playRound(7);
await page.screenshot({ path: `${OUT}/result-doppelname-me-frische-runde.png` });
await mob.close();

await browser.close();
console.log(`Shots → ${OUT}/`);
