// Phase-1-Gate: Greybox-Kernloop. Deterministische Sim-Tests (g.stop() +
// manuelles update-Stepping) + echte Touch-Flow-Tests (hasTouch, .tap()).
import { test, expect } from '@playwright/test';

test.describe('Greybox — Kernloop', () => {
  test('Start-Flow: Name → PLAY → Legende → START-Tap = sofort → Spiel', async ({ page }) => {
    await page.goto('/?seed=42');
    // PLAY ohne Name → bleibt auf Start
    await page.locator('#btn-play').tap();
    await expect(page.locator('#screen-start')).toBeVisible();
    // Name eingeben, ungültige Zeichen werden gefiltert
    await page.locator('#name-input').fill('Tester<>!Ä');
    await expect(page.locator('#name-input')).toHaveValue('TesterÄ');
    await page.locator('#btn-play').tap();
    await expect(page.locator('#screen-countdown')).toBeVisible();
    await expect(page.locator('#legend-card')).toBeVisible();
    // Tap-Skip: Wiederholer verlieren keine Sekunde (v2.1)
    await page.locator('#btn-start-round').tap();
    await expect(page.locator('#screen-game')).toBeVisible({ timeout: 3000 });
    const running = await page.evaluate(() => window.__TR.game.running);
    expect(running).toBe(true);
  });

  test('Legende (v2.1): 3 Zeilen auf 390 px komplett lesbar, Auto-Start nach ~5 s mit LOS!', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/?seed=42');
    await page.locator('#name-input').fill('LegendeBot');
    await page.locator('#btn-play').tap();
    await expect(page.locator('#legend-card')).toBeVisible();
    // Zeile 1: 8 Zutaten · Zeile 2: Bombe + Wespe mit Warn-Ring · Zeile 3: 3 Kapseln
    await expect(page.locator('.legend-row').nth(0).locator('.legend-spr')).toHaveCount(8);
    await expect(page.locator('.warn-wrap')).toHaveCount(2);
    await expect(page.locator('.legend-row').nth(2).locator('.legend-spr')).toHaveCount(3);
    await expect(page.locator('#legend-card')).toContainText('+10');
    await expect(page.locator('#legend-card')).toContainText('Bombe −30');
    await expect(page.locator('#legend-card')).toContainText('ausweichen');
    await expect(page.locator('#legend-card')).toContainText('Einsammeln lohnt sich');
    // Karte + START-Button komplett im 390-px-Viewport (nichts abgeschnitten)
    const fits = await page.evaluate(() => {
      const r = document.getElementById('legend-card').getBoundingClientRect();
      const btn = document.getElementById('btn-start-round').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, btnW: btn.width };
    });
    expect(fits.top).toBeGreaterThanOrEqual(0);
    expect(fits.bottom).toBeLessThanOrEqual(fits.vh + 0.5);
    expect(fits.left).toBeGreaterThanOrEqual(0);
    expect(fits.right).toBeLessThanOrEqual(fits.vw + 0.5);
    expect(fits.btnW).toBeGreaterThan(70); // Daumen-tauglich
    // Ohne Tap: Ring läuft ab → „LOS!" (nur ~380 ms sichtbar → rAF-Polling) → Spiel
    await page.waitForFunction(
      () => {
        const num = document.getElementById('count-num');
        return !num.hidden && num.textContent === 'LOS!';
      },
      null,
      { timeout: 8000, polling: 'raf' }
    );
    await expect(page.locator('#screen-game')).toBeVisible({ timeout: 2000 });
  });

  test('Becher: absolute X-Touch, Tween statt Teleport, Lerp danach', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    await page.evaluate(() => { window.__TR.game.stop(); return 1; });

    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      const startX = g.cup.x;
      g.pointerDown(40); // Tap weit links
      const afterDown = g.cup.x; // noch kein Update → kein Teleport
      g.update(1 / 60);
      const after1 = g.cup.x;
      for (let i = 0; i < 10; i++) g.update(1 / 60); // ~180 ms gesamt
      const settled = g.cup.x;
      return { startX, afterDown, after1, settled, target: g.cup.target };
    });
    expect(r.afterDown).toBeCloseTo(r.startX, 1); // kein Teleport beim Touch-Down
    expect(Math.abs(r.after1 - r.startX)).toBeGreaterThan(2); // Tween läuft
    expect(Math.abs(r.after1 - 40)).toBeGreaterThan(20); // aber nicht sofort am Ziel
    expect(Math.abs(r.settled - 40)).toBeLessThan(12); // nach ~180 ms fast da
  });

  test('Echter Touch: tap() steuert den Becher', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    await page.locator('#screen-game').tap({ position: { x: 60, y: 500 } });
    await page.waitForTimeout(400);
    const x1 = await page.evaluate(() => window.__TR.game.cup.x);
    expect(Math.abs(x1 - 60)).toBeLessThan(10);
    await page.locator('#screen-game').tap({ position: { x: 350, y: 500 } });
    await page.waitForTimeout(400);
    const x2 = await page.evaluate(() => window.__TR.game.cup.x);
    expect(Math.abs(x2 - 350)).toBeLessThan(10);
  });

  test('Scoring: +10 Basis, Combo-Rampe +1/Catch, Cap +6 (Playtest-Kalibrierung)', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      const scores = [];
      const catchOne = () => {
        const it = g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
        const before = g.score;
        g.update(1 / 60);
        scores.push(g.score - before);
        return it.dead;
      };
      for (let i = 0; i < 14; i++) catchOne();
      return { scores, streak: g.streak, score: g.score };
    });
    expect(r.scores[0]).toBe(10); // Basis
    expect(r.scores[1]).toBe(11); // +1 Rampe
    expect(r.scores[4]).toBe(14);
    expect(r.scores[6]).toBe(16); // Cap +6 erreicht
    expect(r.scores[13]).toBe(16); // bleibt gedeckelt
    expect(r.streak).toBe(14);
  });

  test('Wespe UND Miss resetten Combo (Playtest-Kalibrierung)', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      const catchTop = () => {
        g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
        g.update(1 / 60);
      };
      catchTop(); catchTop(); catchTop();
      const streakAfter3 = g.streak;
      // Miss: Topping weit weg vom Becher, bis unten durchfallen lassen
      g.spawnItem('topping', { x: g.cup.x > 200 ? 30 : 380, y: g.H - 20, variant: 'nane' });
      for (let i = 0; i < 30; i++) g.update(1 / 60);
      const streakAfterMiss = g.streak;
      const misses = g.misses;
      // Wespe fangen → Combo weg
      g.spawnItem('wasp', { x: g.cup.x, y: g.cupY - 5 });
      // Wespen-Sinus verschiebt x — direkt über Becher spawnen und 1 Frame updaten
      g.items[g.items.length - 1].baseX = g.cup.x;
      g.update(1 / 60);
      const streakAfterWasp = g.streak;
      catchTop();
      const nextCatchPts = 10; // erwartet: Basis ohne Bonus
      return { streakAfter3, streakAfterMiss, misses, streakAfterWasp, score: g.score, nextCatchPts };
    });
    expect(r.streakAfter3).toBe(3);
    expect(r.misses).toBe(1);
    expect(r.streakAfterMiss).toBe(0); // Miss resettet (Stellschraube gedreht — Score-Bänder)
    expect(r.streakAfterWasp).toBe(0);
  });

  test('Bombe (v2.1): −30 Punkte mit Floor 0, Combo → 0, KEIN Becher-Schrumpf', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      const catchTop = () => {
        g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
        g.update(1 / 60);
      };
      catchTop(); catchTop(); catchTop(); // 10 + 11 + 12 = 33, Streak 3
      const before = { score: g.score, streak: g.streak, w: g.cup.w };
      g.spawnItem('bomb', { x: g.cup.x, y: g.cupY - 5 });
      g.update(1 / 60);
      const afterBomb = { score: g.score, streak: g.streak, w: g.cup.w };
      // zweite Bombe bei Score 3 → Floor 0, nie negativ
      g.spawnItem('bomb', { x: g.cup.x, y: g.cupY - 5 });
      g.update(1 / 60);
      const floorScore = g.score;
      // Combo resettet → nächster Catch wieder Basis +10
      const preCatch = g.score;
      catchTop();
      return { before, afterBomb, floorScore, nextPts: g.score - preCatch };
    });
    expect(r.before.score).toBe(33);
    expect(r.before.streak).toBe(3);
    expect(r.afterBomb.score).toBe(3); // 33 − 30
    expect(r.afterBomb.streak).toBe(0); // Combo → 0
    expect(r.afterBomb.w).toBeCloseTo(r.before.w, 0); // Becher-Schrumpf ENTFÄLLT
    expect(r.floorScore).toBe(0); // Score-Floor 0
    expect(r.nextPts).toBe(10); // Combo neu ab Basis
  });

  test('Spawn-Kurve + Fairness über volle 60-s-Simulation (Seed 7)', async ({ page }) => {
    await page.goto('/?seed=7');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: true, seed: 7 }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      g.catches = 5; // Bad-Items freischalten (sonst spawnt nie eins)
      const badTimes = [];
      const puInfo = [];
      let maxConcurrent = 0;
      let firstBadT = null;
      const origSpawn = g.spawnItem.bind(g);
      g.spawnItem = (type, opts) => {
        const it = origSpawn(type, opts);
        if (type === 'bomb' || type === 'wasp') {
          badTimes.push(g.t);
          if (firstBadT === null) firstBadT = g.t;
        }
        if (type === 'powerup') puInfo.push({ t: g.t, kind: it.variant });
        return it;
      };
      const fallAt50 = g.fallTime(50);
      while (!g.over && g.t < 61) {
        g.update(1 / 60);
        const alive = g.items.length;
        if (alive > maxConcurrent) maxConcurrent = alive;
      }
      const gaps = badTimes.slice(1).map((t, i) => t - badTimes[i]);
      return {
        over: g.over,
        total: g.spawnedTotal,
        bad: g.spawnedBad,
        share: g.spawnedBad / g.spawnedTotal,
        firstBadT,
        minGap: gaps.length ? Math.min(...gaps) : 99,
        maxConcurrent,
        puInfo,
        fallAt50,
        fallFrozen: g.fallTime(58),
      };
    });
    expect(r.over).toBe(true);
    expect(r.total).toBeGreaterThan(55); // ≈75 Spawns minus Concurrency-Skips
    expect(r.total).toBeLessThan(95);
    expect(r.share).toBeLessThanOrEqual(0.15 + 0.001);
    expect(r.firstBadT).toBeGreaterThanOrEqual(6);
    expect(r.minGap).toBeGreaterThanOrEqual(1.5 - 0.02);
    expect(r.maxConcurrent).toBeLessThanOrEqual(7);
    // Power-Ups: 3 Slots, Typen ohne Wiederholung, in den Fenstern 10–20/25–40/45–55
    expect(r.puInfo.length).toBe(3);
    expect(new Set(r.puInfo.map((p) => p.kind)).size).toBe(3);
    const wins = [[10, 20], [25, 40], [45, 55]];
    r.puInfo.forEach((p, i) => {
      expect(p.t).toBeGreaterThanOrEqual(wins[i][0] - 0.5);
      expect(p.t).toBeLessThanOrEqual(wins[i][1] + 1.5);
    });
    // Frenzy friert Fallgeschwindigkeit ein
    expect(r.fallFrozen).toBeCloseTo(r.fallAt50, 2);
  });

  test('Frenzy: Punkte ×2 in den letzten 10 s', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      g.t = g.duration - 9; // in die Frenzy springen
      g.update(1 / 60);
      const frenzy = g.frenzy;
      const before = g.score;
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'limon' });
      g.update(1 / 60);
      return { frenzy, pts: g.score - before };
    });
    expect(r.frenzy).toBe(true);
    expect(r.pts).toBe(20); // 10 Basis ×2
  });

  test('Rundenende → Ergebnis-Screen mit Score + Versuchszähler', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => {
      localStorage.setItem('tr-name', 'GreyboxBot');
      window.__TR.state.name = 'GreyboxBot';
      window.__TR.newGame({ autoSpawn: false, duration: 60 });
      return 1;
    });
    await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.update(1 / 60);
      g.t = g.duration + 0.01; // Zeit ablaufen lassen
      g.update(1 / 60);
      return 1;
    });
    await expect(page.locator('#screen-result')).toBeVisible();
    await expect(page.locator('#res-score')).toHaveText('10', { timeout: 3000 });
    await expect(page.locator('#res-attempt')).toContainText('Versuch #');
    // NOCHMAL → Restart ohne Menü (< 1 s bis Countdown läuft)
    const t0 = Date.now();
    await page.locator('#btn-again').tap();
    await expect(page.locator('#screen-countdown')).toBeVisible({ timeout: 1000 });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test('Power-Ups: Magnet zieht nur Gutes, XXL verdoppelt, SlowMo halbiert', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: false }));
    const r = await page.evaluate(() => {
      const g = window.__TR.game;
      g.stop();
      // XXL
      g.spawnItem('powerup', { x: g.cup.x, y: g.cupY - 5, variant: 'xxl' });
      g.update(1 / 60);
      const wXxl = g.cup.w;
      // SlowMo einsammeln → Fallgeschwindigkeit halbiert
      g.spawnItem('powerup', { x: g.cup.x, y: g.cupY - 5, variant: 'slowmo' });
      g.update(1 / 60);
      const it = g.spawnItem('topping', { x: 30, y: 100, variant: 'nar' });
      const y0 = it.y;
      g.update(0.1);
      const dySlow = it.y - y0;
      g.cup.slowmoUntil = 0; // SlowMo aus
      const y1 = it.y;
      g.update(0.1);
      const dyNorm = it.y - y1;
      // Magnet: zieht Topping in Radius, Bombe nicht
      g.items.length = 0;
      g.spawnItem('powerup', { x: g.cup.x, y: g.cupY - 5, variant: 'magnet' });
      g.update(1 / 60);
      const top = g.spawnItem('topping', { x: g.cup.x + 100, y: g.cupY - 60, variant: 'nane' });
      const bomb = g.spawnItem('bomb', { x: g.cup.x - 100, y: g.cupY - 60 });
      const topDx0 = Math.abs(top.x - g.cup.x);
      const bombDx0 = Math.abs(bomb.x - g.cup.x);
      g.update(0.05);
      const topPulled = topDx0 - Math.abs(top.x - g.cup.x);
      const bombPulled = bombDx0 - Math.abs(bomb.x - g.cup.x);
      return { wXxl, dySlow, dyNorm, topPulled, bombPulled, magnetActive: g.t < g.cup.magnetUntil };
    });
    expect(r.wXxl).toBeCloseTo(88 * 2, 0);
    expect(r.dyNorm / r.dySlow).toBeGreaterThan(1.7); // ~2× schneller ohne SlowMo
    expect(r.magnetActive).toBe(true);
    expect(r.topPulled).toBeGreaterThan(5); // Topping wird gezogen
    expect(Math.abs(r.bombPulled)).toBeLessThan(1); // Bombe NIE
  });
});
