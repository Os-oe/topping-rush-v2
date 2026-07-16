# TOPPING RUSH

Event-Arcade-Catch-Game im Neon-Look — gebaut für Feste mit Getränkeverkauf
(Kermes-Edition): Gast scannt den QR-Code am Bar-Monitor, tippt seinen Namen,
3-2-1 — **60 Sekunden Zutaten fangen**, Chilischote und Wespe ausweichen,
Power-Ups schnappen. Der beste Versuch pro Name steht auf dem TV-Leaderboard.

**Live:** https://topping-rush.demo.osai.solutions
· `/board` (TV-Vollbild + QR) · `/admin` (PIN)

## Features

- 8 code-gezeichnete Neon-Zutaten (Granatapfel, Zitrone, Wassermelone, Minze,
  Vişne, Orange, Erdbeere, Çay-Tulpenglas) — Glow-Sprites, vorgerendert
- Combo-Scoring mit Frenzy-Finale („ŞERBET-RUSH ×2!"), deterministische
  Power-Up-Slots (Magnet / XXL / Zeitlupe), faire Bad-Item-Regeln
- Best-of-Leaderboard (Upstash Redis, `ZADD GT` — In-Memory-Fallback ohne ENV),
  Name-Sanitizing + Blockliste, Score-Deckel, Rate-Limit
- TV-Board: Top 10, Gewinn-Banner, weiße QR-Kachel, Fullscreen + Wake Lock in
  einer Geste, 5-s-Polling mit Offline-Badge
- 16 WebAudio-Synth-SFX + nahtloser Musik-Loop, Mute-Toggle
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

ENV (Production): `ADMIN_PIN` (4-stellig) · `KV_REST_API_URL` +
`KV_REST_API_TOKEN` (Upstash-Marketplace-Integration; ohne sie läuft ein
In-Memory-Fallback — fürs echte Event Redis anbinden).

Erkenntnisse aus dem Build: [LESSONS.md](LESSONS.md)

---
powered by [OsAI](https://osai.solutions)
