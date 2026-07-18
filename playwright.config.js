import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  retries: 0,
  workers: 1, // geteilter Server-State (In-Memory-Store) — sequenziell
  reporter: [['list']],
  projects: [
    {
      name: 'mobile',
      testIgnore: /live\.spec\.js/,
      use: {
        ...devices['Pixel 7'],
        // 127.0.0.1 statt localhost: sonst splitten Browser-Fetches (::1) und
        // request-Fixture (127.0.0.1) in ZWEI Rate-Limit-Buckets → flakys Fenster
        baseURL: 'http://127.0.0.1:4573',
      },
    },
    {
      // iPhone-Profil (WebKit = Safari-Engine) — gleiche lokale Specs wie
      // 'mobile'. balance.spec bleibt Chromium-only: die Bot-Heuristik ist
      // auf Chromium-Frame-Timing kalibriert (setInterval/rAF-Jitter weicht
      // in WebKit ab, die Bänder würden nur Engine-Rauschen messen).
      name: 'iphone',
      testIgnore: [/live\.spec\.js/, /balance\.spec\.js/],
      use: {
        ...devices['iPhone 13'],
        baseURL: 'http://127.0.0.1:4573',
      },
    },
    {
      name: 'live',
      testMatch: /live\.spec\.js/,
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.LIVE_URL || 'https://topping-rush-v2.demo.osai.solutions',
      },
    },
    {
      // Live-Smoke auf der Safari-Engine (Kern-Flow gegen die Live-URL)
      name: 'live-iphone',
      testMatch: /live\.spec\.js/,
      use: {
        ...devices['iPhone 13'],
        baseURL: process.env.LIVE_URL || 'https://topping-rush-v2.demo.osai.solutions',
      },
    },
  ],
  webServer: {
    // exec-Pattern: node wird Haupt-PID → sauberer Teardown, test:2x läuft durch (MIXR-Lesson)
    // PLAYING_TTL_S=2: Presence-Ablauf (Prod 100 s) in Testzeit prüfbar (v2.4)
    command: 'npm run build && PLAYING_TTL_S=2 exec node server.js',
    port: 4573,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
