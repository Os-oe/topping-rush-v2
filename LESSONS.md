# Lessons — TOPPING RUSH Build (2026-07-17)

Erkenntnisse aus dem autonomen One-Prompt-Lauf (op-build), wiederverwendbar für
künftige Canvas-Game-/Event-Tool-Builds.

## Canvas / Neon-Rendering
- **Trail-Fade + Text vertragen sich nicht.** Floating-Scores/Banner auf dem
  Spiel-Canvas ghosten unter dem Motion-Blur (rgba-Fill statt clearRect).
  Lösung: zweites Overlay-Canvas nur für Texte/Flash, pro Frame gecleart —
  Spiel-Layer behält den Blur, Schrift bleibt crisp. Kostet nichts (59,9 fps).
- **Statisches Hintergrund-Muster unter Trail-Fade:** Muster nicht separat
  zeichnen, sondern Hintergrund (Farbe + Girih-Gitter) als bgSprite vorrendern
  und DIESES Sprite mit `globalAlpha 0.3` als Trail-Fill drawImagen. Ergebnis:
  Motion-Blur UND dauerhaft sichtbares (dezentes) Muster in einem Draw.
- **`[hidden]` verliert gegen ID-Selektoren** (`#screen-game{display:block}`
  schlägt `.screen[hidden]`). Global `[hidden]{display:none!important}` setzen —
  zwei „unsichtbare Screens fangen Taps"-Bugs (Start + Board) mit einer Regel gefixt.
- Becher-Breite (XXL/Schrumpf) am **Ende** von update() neu berechnen, sonst
  wirken Catch-Effekte erst im Folgeframe (Test deckte es auf).
- Cup-Sprite-Cache bei animierter Breite **quantisieren** (4-px-Stufen), sonst
  füllt der Gleit-Tween den Cache mit ~90 Offscreen-Canvases.

## Playwright
- **Rate-Limit (10/60 s) ist Suite-globaler State**: Browser-Fetches (::1) und
  request-Fixture (127.0.0.1) landen in ZWEI IP-Buckets → flaky. baseURL auf
  `127.0.0.1` festnageln und Submits pro Suite-Lauf budgetieren (Rate-Limit-Test
  als letzter Test im letzten Spec).
- Sim-Tests deterministisch: `game.stop()` (RAF aus) + manuelles
  `update(1/60)`-Stepping — Combo-Mathe, Fairness-Regeln und 60-s-Vollsimulation
  laufen so in <100 ms statt in Echtzeit.
- Balance-Bots brauchen **menschliche Fehlerprofile** (Reaktion 350–400 ms,
  Entscheidungsintervall 700–850 ms, Wespen-Blindheit, „Fehlgriff"-Chance auf
  Bad-Items), sonst spielen sie übermenschlich — der Becher quert den Screen in
  ~170 ms, jeder naive Bot fängt >90 %.

## Balancing (Konzept-Kalibrierung)
- Mit Cap +10 und „Miss resettet nicht" lagen die Bänder unerreichbar hoch
  (Casual ~720, Profi ~1420). Die zwei im Konzept **markierten** Stellschrauben
  gedreht: Combo-Cap +10 → **+6** und **Miss resettet Combo**. Ergebnis:
  Casual 394 (Ziel 300–500) · Profi 1270 (Ziel 900–1300). Frenzy ×2 ist der
  heimliche Score-Inflator (+~36 % aufs Grundergebnis) — bei künftigen
  Score-Band-Designs zuerst die Frenzy-Doublings durchrechnen.

## Audio
- WebAudio-Synth erneut die richtige Wahl (16 SFX, 0 €): kontinuierliche
  Sounds (Sizzle/Summen/Shimmer) als **Nodes pro Item-ID** mit Map-Cleanup bei
  Catch/Despawn/Rundenende — Test prüft `continuous.size === 0`.
- **Canvas nutzt nur bereits geladene Fonts:** latin-ext-Face (Ş) vor dem
  ersten `fillText` explizit mit `document.fonts.load('26px Bungee', 'Ş…')`
  vorladen, sonst rendert der Frenzy-Banner im Fallback-Font.
- Suno-Loop „nahtlos": Tail-zu-Head-Crossfade via ffmpeg
  (`acrossfade d=2` + concat) macht aus jedem ~60-s-Fenster einen sauberen Loop.
- Orbitron hat **kein latin-ext** bei Google Fonts — für türkische Glyphen
  (Ş/İ) Bungee (hat latin-ext) oder Systemfont einplanen.

## Kultur-sensibles Event-Design (Nachtrag v1.1)
- Bad-Item-Metaphern gegen den Veranstaltungskontext prüfen: Bombe im
  Moschee-Umfeld = No-Go; Chilischote „ZU SCHARF!" trägt dieselbe Mechanik
  ohne Kollateralschaden — Identitätswechsel kostete <1 h inkl. Sound/Tests.
- Kultur-Layer trägt über **Kunst-/Getränkewelt** (Iznik-Farben, Girih-Geometrie,
  Lale, Çay-Glas), nie über religiöse Symbole. Don't-Liste als eigener
  Gate-Punkt dokumentieren — das diszipliniert jede Design-Entscheidung.
- Substring-Blocklisten (LDNOOBW): Einträge < 4 Zeichen rauswerfen, sonst
  blockt „ass" Namen wie „Passau".

## Deploy / Betrieb
- **Upstash-ENV fehlt beim Build → In-Memory-Fallback-Adapter** mit identischer
  Schnittstelle (eine Catch-all-Function = ein warmer Container, Board bleibt
  konsistent — MIXR-Muster). ⚠️ **TODO vor dem echten Event:** Im Vercel-Dashboard
  die Marketplace-Integration „Upstash for Redis" ans Projekt hängen (liefert
  `KV_REST_API_URL`/`KV_REST_API_TOKEN`, genau die Namen liest `lib/store.js`)
  und redeployen — sonst leert ein Cold Start das Leaderboard.
- Upstash-Client IMMER explizit konstruieren (`new Redis({url, token})`) —
  `fromEnv()` erwartet UPSTASH_-Namen, Vercel-Marketplace liefert KV_-Namen.
- `vercel deploy --prod` direkt (git push triggert keinen Build — bekanntes
  Muster) + danach `vercel alias set <deploy-url> <domain>` + inhaltlicher
  Live-Check (neues Feature, nie nur HTTP 200).

## Kosten (Ist)
| Posten | Menge | Ist |
|---|---|---|
| Suno-Loop v1 (Synthwave) | 1 Call | 0,10 € |
| Suno-Loop v1.1 (Arcade + Darbuka) | 1 Call | 0,10 € |
| SFX (WebAudio-Synth) | 16 Stück | 0,00 € |
| Sprites (code-gezeichnet) | 12 Objekte | 0,00 € |
| **Gesamt** | | **0,20 €** (Budget 10 €, Schätzung ≤ 0,20 €) |
