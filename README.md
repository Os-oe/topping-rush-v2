# TOPPING RUSH V2 „Fresh"

Event-Arcade-Catch-Game im hellen, illustrierten Look — gebaut für Feste mit
Getränkeverkauf (Kermes-Edition): Gast scannt den QR-Code am Bar-Monitor, tippt
seinen Namen, kurze Legende mit 5-s-Countdown — **60 Sekunden Früchte fangen**,
Comic-Bombe (−30 Punkte) und Wespe ausweichen, Power-Ups schnappen. Der beste
Versuch pro Name steht auf dem TV-Leaderboard.

V2 ersetzt den Neon-Look der [V1](https://topping-rush.demo.osai.solutions)
durch illustrierte KI-Frucht-Sprites im MIXR-Stil auf heller Pastell-Bühne —
Mechanik, API und Fairness-Regeln sind identisch (dieselbe Test-Suite beweist es).

**Live:** https://topping-rush-v2.demo.osai.solutions
· `/board` (TV-Vollbild + QR) · `/admin` (PIN)

## Features

- **13 KI-illustrierte Sprites** (Nano Banana 2, Magenta-Key-Pipeline): 8 Zutaten
  (Granatapfel, Zitrone, Wassermelone, Minze, Vişne, Orange, Erdbeere,
  Çay-Tulpenglas) + Comic-Bombe, Wespe, 3 Power-Up-Kapseln — Stil-Anker + i2i-Serie
- **Heller „Fresh"-Look:** 3-Stop-Pastell-Verlauf, vorgerenderte Bodenschatten,
  kein additives Blending, kein Trail-Fade, kein Laufzeit-shadowBlur —
  59,9 fps Median auf Mobile-Viewport (Metal-GPU-Messung)
- **Juice ohne Blur:** Squash & Stretch (130/70, ease-out-back), konturierte
  Splash-Tropfen, Baloo-2-Popups mit Doppelkontur, Becher-Wobble,
  Bomben-Rand-Flash + Rauch-Pöff, konfetti-buntes „ŞERBET-RUSH ×2!"-Banner
- **Bad-Item-Warn-Signatur (v2.1):** pulsierender roter Warn-Ring + rote
  Tint-Kante an Bombe und Wespe — Negatives ist in < 200 ms erkennbar,
  auch im Graustufen-Test
- Combo-Scoring mit Frenzy-Finale, deterministische Power-Up-Slots
  (Magnet / XXL / Zeitlupe), faire Bad-Item-Regeln
- Best-of-Leaderboard (Upstash Redis, `ZADD GT` — In-Memory-Fallback ohne ENV),
  Name-Sanitizing + Blockliste, Score-Deckel, Rate-Limit
- TV-Board: Top 10, Gewinn-Banner, weiße QR-Kachel, Fullscreen + Wake Lock in
  einer Geste, 5-s-Polling mit Offline-Badge
- 16 WebAudio-Synth-SFX + nahtloser Musik-Loop (aus V1 übernommen), Mute-Toggle
- Admin: Board-Reset, Gewinn-Banner, Event-Name, Rundenlänge 60–90 s

## Stack & Betrieb

Vanilla JS + Canvas 2D + Vite (Multi-Page) · Vercel Functions (eine
Catch-all-API) · `@upstash/redis` + `@upstash/ratelimit`.

```bash
npm install
npm run dev        # Vite-Dev auf /
npm run serve      # Prod-Build + lokaler Server (dist + API) auf :4573
npm run test:2x    # Playwright-Suite zweimal (mobil, hasTouch)
BALANCE=1 npx playwright test tests/balance.spec.js --project=mobile  # Score-Band-Bots
npm run test:live  # E2E gegen die Live-URL
```

Sprite-Pipeline (Nano Banana 2 → Magenta-Key → Display-Grid):
`tools/gen-sprite.sh` · `tools/gen-series.sh` · `tools/process-sprite.py`
(Rohdaten in `assets-src/raw/`, gekeyte PNGs in `public/sprites/`).

ENV (Production): `ADMIN_PIN` (4-stellig) · `KV_REST_API_URL` +
`KV_REST_API_TOKEN` (Upstash-Marketplace-Integration; ohne sie läuft ein
In-Memory-Fallback — fürs echte Event Redis anbinden).

Erkenntnisse aus dem Build: [LESSONS.md](LESSONS.md)

---
powered by [OsAI](https://osai.solutions)
