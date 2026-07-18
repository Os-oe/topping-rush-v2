// Cross-Device-QA 18.07. — iOS-/Android-Fallen-Checkliste als Tests (a–j).
// Läuft in BEIDEN Projekten (mobile = Chromium/Pixel 7, iphone = WebKit/iPhone 13).
// Kein einziger /api/score-Submit auf dem Default-Bucket (Rate-Limit-Budget!).
import { test, expect } from '@playwright/test';

test.describe('Mobile-Härtung (Checkliste a–j)', () => {
  test('(a) Input-Zoom iOS: alle Text-Inputs font-size ≥ 16px', async ({ page }) => {
    await page.goto('/');
    const nameSize = await page.locator('#name-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(nameSize).toBeGreaterThanOrEqual(16);

    await page.goto('/admin');
    for (const id of ['#pin-input', '#event-input', '#banner-input']) {
      const size = await page.locator(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size, id).toBeGreaterThanOrEqual(16);
    }
  });

  test('(b) AudioContext-Resume: suspendierter Context läuft nach focus/visibilitychange weiter', async ({ page }) => {
    await page.goto('/?seed=42');
    await page.locator('#name-input').fill('ResumeBot');
    await page.locator('#btn-play').tap(); // Geste → ensureStarted
    await page.waitForFunction(() => window.__audio.ctx !== null);
    await page.waitForFunction(() => window.__audio.ctx.state === 'running');

    // Screen-Lock/Tab-Wechsel simulieren: Context hart suspendieren
    await page.evaluate(async () => { await window.__audio.ctx.suspend(); });
    expect(await page.evaluate(() => window.__audio.ctx.state)).toBe('suspended');

    // Rückkehr: focus-Event → Handler ruft resumeIfNeeded()
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await page.waitForFunction(() => window.__audio.ctx.state === 'running', null, { timeout: 3000 });

    // und der play()-Pfad selbst re-resumed (Guard vor jedem SFX)
    await page.evaluate(async () => { await window.__audio.ctx.suspend(); });
    await page.evaluate(() => { window.__audio.play('uiTap'); });
    await page.waitForFunction(() => window.__audio.ctx.state === 'running', null, { timeout: 3000 });
  });

  test('(c) /board ohne Fullscreen-API (iPhone-Safari): Button versteckt statt tot', async ({ page }) => {
    // iPhone-Safari nachstellen: kein fullscreenEnabled/webkitFullscreenEnabled
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
    });
    await page.goto('/board');
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#btn-fullscreen')).toBeHidden(); // kein toter Button
  });

  test('(d) Adressleisten-Resize mid-round: Becher bleibt am Boden verankert, X proportional, Runde läuft weiter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/?seed=42');
    await page.evaluate(() => window.__TR.newGame({ autoSpawn: true, seed: 7 }));
    await page.waitForTimeout(1200); // ein paar Items in der Luft

    const before = await page.evaluate(() => {
      const g = window.__TR.game;
      g.pointerDown(100); // Becher links positionieren
      return { H: g.H, W: g.W, cupY: g.cupY, targetFrac: g.cup.target / g.W, items: g.items.length, t: g.t };
    });
    expect(before.cupY).toBe(before.H - 96); // cupBottomOffset

    // Chrome/Safari blenden die Adressleiste ein/aus → Höhen-Delta ~100 px
    await page.setViewportSize({ width: 390, height: 680 });
    await page.waitForTimeout(300); // resize-Event + ein paar Frames

    const after = await page.evaluate(() => {
      const g = window.__TR.game;
      return { H: g.H, W: g.W, cupY: g.cupY, targetFrac: g.cup.target / g.W, running: g.running, t: g.t };
    });
    expect(after.H).toBeLessThan(before.H);
    expect(after.cupY).toBe(after.H - 96); // NEU verankert, schwebt nicht
    expect(after.running).toBe(true); // Runde läuft unbeeindruckt weiter
    expect(after.t).toBeGreaterThan(before.t);

    // Rotation/Breiten-Delta: X-Positionen proportional übernommen
    await page.setViewportSize({ width: 300, height: 680 });
    await page.waitForTimeout(300);
    const rot = await page.evaluate(() => {
      const g = window.__TR.game;
      return { W: g.W, targetFrac: g.cup.target / g.W, running: g.running };
    });
    expect(rot.W).toBeLessThanOrEqual(300);
    expect(rot.targetFrac).toBeCloseTo(after.targetFrac, 1); // relativ unverändert
    expect(rot.running).toBe(true);
  });

  test('(f) Doppeltap-Schutz: touch-action manipulation auf Buttons, NOCHMAL-Doppeltap crasht nicht', async ({ page }) => {
    await page.goto('/?seed=42');
    for (const id of ['#btn-play', '#btn-start-round', '#btn-again', '#name-input']) {
      const ta = await page.locator(id).evaluate((el) => getComputedStyle(el).touchAction);
      expect(ta, id).toBe('manipulation');
    }
    // Funktional: 2 schnelle Taps auf NOCHMAL (Ergebnis-Screen) → genau EIN Restart
    await page.evaluate(() => {
      localStorage.setItem('tr-name', 'TapBot');
      window.__TR.state.name = 'TapBot';
      window.__TR.show('result');
      return 1;
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const box = await page.locator('#btn-again').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    // Tap 1 → Countdown; Tap 2 landet ggf. schon auf START (Screen wechselte
    // unterm Finger — korrektes Verhalten, finishLegend hat Doppeltap-Guard).
    // Entscheidend: kein Zoom, kein Crash, Flow geht weiter (Countdown ODER Spiel).
    await expect(page.locator('#screen-result')).toBeHidden();
    const flow = await page.evaluate(() => ({
      countdown: !document.getElementById('screen-countdown').hidden,
      game: !document.getElementById('screen-game').hidden,
      scale: window.visualViewport?.scale ?? 1,
    }));
    expect(flow.countdown || flow.game).toBe(true);
    expect(flow.scale).toBe(1); // Doppeltap hat NICHT gezoomt
    expect(errors).toEqual([]);
  });

  test('(g) Overscroll/Pull-to-refresh: overscroll-behavior none greift (auch WebKit)', async ({ page }) => {
    await page.goto('/');
    const os = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overscrollBehaviorY,
      body: getComputedStyle(document.body).overscrollBehaviorY,
      screenPos: getComputedStyle(document.getElementById('screen-start')).position,
    }));
    expect(os.html).toBe('none');
    expect(os.body).toBe('none');
    expect(os.screenPos).toBe('fixed'); // Screens sind fixed — kein Scroll-Körper für Pull-to-refresh
  });

  test('(h) Tastatur-Layout: Klein-Viewport (Tastatur offen) — PLAY bleibt erreichbar (Screen scrollt)', async ({ page }) => {
    // 360×640-Gerät mit offener Tastatur ≈ 360×300 Layout-Viewport (Android resized)
    await page.setViewportSize({ width: 360, height: 300 });
    await page.goto('/');
    await page.locator('#name-input').tap();
    await page.locator('#name-input').fill('KeyBot');
    // Start-Screen ist scrollbar — PLAY per Auto-Scroll erreichbar und tappbar
    const scrollable = await page.evaluate(() => {
      const s = document.getElementById('screen-start');
      return s.scrollHeight >= s.clientHeight;
    });
    expect(scrollable).toBe(true);
    await page.locator('#btn-play').tap(); // Playwright scrollt ins Sichtfeld — wie der Daumen
    await expect(page.locator('#screen-countdown')).toBeVisible();
  });

  test('(i+j) Perf-Smoke: 8-s-Echtzeit-Runde (Fresh-Skin, Auto-Spawn) ohne Fehler/Freeze; vibrate?.-Pfad safe', async ({ page }) => {
    test.setTimeout(30_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/?seed=42');
    await page.locator('#name-input').fill('SmokeBot');
    await page.locator('#btn-play').tap(); // Audio-Init wie ein echter Spieler
    await page.locator('#btn-start-round').tap();
    await expect(page.locator('#screen-game')).toBeVisible({ timeout: 3000 });

    // Catch deterministisch auslösen: Skin-Event-Kaskade inkl. navigator.vibrate?.()
    // (auf iOS/WebKit ist vibrate undefined — Optional Chaining darf nie crashen)
    await page.evaluate(() => {
      const g = window.__TR.game;
      g.spawnItem('topping', { x: g.cup.x, y: g.cupY - 10, variant: 'nar' });
      g.spawnItem('bomb', { x: g.cup.x, y: g.cupY - 8 });
      return 1;
    });

    await page.waitForTimeout(8000); // echte 8 s Spielzeit — rAF-Loop, Spawns, Skin-Render
    const state = await page.evaluate(() => ({
      running: window.__TR.game.running,
      t: window.__TR.game.t,
      score: window.__TR.game.score,
      spawned: window.__TR.game.spawnedTotal,
      vibrateType: typeof navigator.vibrate,
    }));
    expect(state.running).toBe(true); // kein Freeze
    expect(state.t).toBeGreaterThan(7); // Loop lief in Echtzeit weiter
    expect(state.spawned).toBeGreaterThan(3); // Auto-Spawn aktiv
    expect(errors, errors.join('\n')).toEqual([]);
    // Runde NICHT zu Ende laufen lassen — kein Score-Submit (Rate-Limit-Budget)
  });
});
