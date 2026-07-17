# Lessons — TOPPING RUSH V2 „Fresh" (2026-07-17)

Iterations-Lauf auf V1 (Reskin ohne Mechanik-Änderung). Erkenntnisse,
wiederverwendbar für künftige Reskins/Sprite-Serien. V1-Lessons bleiben gültig:
[topping-rush/LESSONS.md](https://github.com/Os-oe/topping-rush).

## Reskin-Architektur (Fork-Muster)

- **Skin-Interface trägt den kompletten Look-Swap:** V1 hatte Rendering sauber
  in `NeonSkin` gekapselt (handleEvent + render + eigenes fx-Overlay). Der
  V2-Umbau ersetzte EINE Datei (neon.js → fresh.js) + Styles + Sprites — die
  20 Mechanik-Tests liefen ohne eine einzige Anpassung durch. Merksatz: Wer den
  Skin als Klasse mit Event-API baut, bekommt die V2 fast geschenkt.
- **Suite als Mechanik-Beweis:** identische Tests vor/nach dem Reskin (2× 20/20)
  sind der billigste „Mechanik NICHT angefasst"-Beleg — kein Diff-Review nötig.
- **Fremd-Server auf dem Playwright-Port** (eigener Sichtcheck-Server von
  vorhin) lässt die Suite mit „port is already used" sterben, nicht flaky
  werden. Vor test:2x immer `lsof -ti :4573 | xargs kill`.

## NB2-Sprite-Serie (MIXR-Pipeline, dritter bestätigter Lauf)

- **13/13 ohne Retry** — der Hebel war der wörtlich fixierte Stil-Anker-Prompt
  im Konzept + i2i-Referenz. Serien-Konstanten VOR dem ersten Render einfrieren
  (Outline-Farbe, Rim-Light, Highlight, Magenta-BG), nur die Objektbeschreibung
  variieren.
- **„Sticker style" liefert gratis eine weiße Außenkontur** — auf hellem BG ist
  das die Objekt-Separation (gleiche Doppelkontur-Logik wie bei den Popups).
  Für helle Themes: drin lassen, nicht wegprompten.
- **Kritische Key-Fälle vorab entschärfen:** Wespenflügel „as SOLID pale
  shapes (no transparency)" und Çay-Glas „completely filled, opaque, no
  see-through areas" prompten — sonst frisst der Magenta-Key Löcher ins Objekt.
- 1K-Auflösung reicht: Sprites landen eh auf 136–152-px-Boxen (2× Display).

## Heller Look ohne Blur

- **Voll deckender BG-Sprite statt clearRect:** Verlauf + Blobs + Iznik-Layer
  einmal vorrendern, pro Frame 1× drawImage — 59,9 fps Median (Vsync-Anschlag)
  auf Pixel-7-Viewport trotz 0 Laufzeit-Blur-Tricks.
- **Sprite-Entries `{cv, w, h}` mit sofortigem Kontur-Blob-Fallback:** Canvas
  existiert synchron (Render crasht nie), PNG ersetzt den Blob onload —
  robust gegen langsames Event-WLAN, ohne Async-Boot-Umbau.
- **Bodenschatten = ein einziges vorgerendertes Radial-Gradient-Sprite**, pro
  Objekt skaliert gezeichnet. Ersetzt Glow als Tiefen-Signal und kostet nichts.
- **Doppelkontur-Text (weiß außen, braun innen) via 2× strokeText + fillText**
  macht Canvas-Popups auf JEDEM Untergrund lesbar — Neon brauchte dafür Glow.
- Ein-Frame-Sprites brauchen Bewegungs-Ersatz für 2-Frame-Animationen:
  Wespen-Flug-Bob (rotate+scaleY-Sinus) und Chili-Zittern (schnelle
  rotate-Sinus) telegraphieren genauso gut wie V1s Frame-Flip/Glow-Puls.

## Kultur-/Kontext-Hygiene

- **Meta-Tags beim Fork mitprüfen:** V1s `<meta description>` enthielt noch
  „Bomben" — die Don't-Liste (Chili statt Bombe) gilt auch für unsichtbare
  Texte (Suchtreffer!). Don't-Review auf ALLE Textquellen ausweiten.

## Deploy (Studio-Muster, bestätigt)

- `vercel domains add <domain> --scope <team>` (Ein-Argument-Form) + explizites
  `vercel alias set <deploy-url> <domain>` + inhaltlicher Live-Check
  (theme-color/#FFF6E8 gegrept, nicht nur HTTP 200) — lief exakt wie in den
  V1-/MIXR-Lessons beschrieben.
- ⚠️ **TODO vor dem echten Event:** Upstash-Marketplace-Integration ans
  Vercel-Projekt `topping-rush-v2` hängen (liefert `KV_REST_API_URL`/`_TOKEN`)
  und redeployen — bis dahin `mode:"memory"` (Cold Start leert das Board).

## Nachtrag v2.1 + v2.2 (17.07., selbe Session — Bombe, Warn-Signatur, Legende, Füllstand, Celebration)

- **Nachtrag-Pattern 2× validiert, auch gestapelt:** v2.1 (Bombe/−30, Warn-Ringe,
  Legende) und v2.2 (Füllstand, Board-Celebration) kamen als CONCEPT-Nachträge
  in die laufende Update-Session und gingen in EINEM Deploy raus — Gates je
  Nachtrag erneut fahren, ein gemeinsamer Abschluss-Report reicht.
- **Serien-Anker trägt auch Monate „fremde" Motive:** Comic-Bombe (kein
  Lebensmittel) saß im 1. i2i-Render auf den nar-Anker — 4. Bestätigung des
  Musters; Kosten 0,05 € statt Retry-Kaskade.
- **Rote Silhouette via `source-in` = Warn-Tint-Kante ohne Blur:** Sprite-Kopie
  rot füllen, minimal größer HINTER das Sprite — konturierte Doppellinie im
  scharfen V2-Look. Cache erst ab `entry.ready`, sonst friert der
  Fallback-Blob als Silhouette ein.
- **Transiente UI-Zustände (LOS!-Fenster 380 ms) mit `polling: 'raf'` testen:**
  Playwrights Standard-Visibility-Polling (~380-ms-Raster) verpasst kurze
  Fenster komplett — `waitForFunction(..., { polling: 'raf' })` fängt sie.
- **Board-Features mit fetch-Stub testen statt echter Submits:** Das
  Rate-Limit-Budget der Suite (10/60 s) ist knapp kalkuliert; der
  Celebration-Integrationstest stubbt `window.fetch` vor Board-Start und
  testet den vollen Poll→Detect→Feier-Pfad ohne einen einzigen API-Call.
- **Balancing: −30-Bombe und +30-Füll-Bonus kompensieren sich fast:** Die
  v2.2-Bänder (Casual 350–600 / Profi 1000–1500) wurden ohne Drehen einer
  Stellschraube getroffen (Bad-Anteil blieb 15 %, Combo-Rampe unverändert).
- **`vercel alias set` braucht `--scope os-oes-projects`:** ohne Scope-Flag
  „You don't have access to the domain" — obwohl dieselbe CLI deployt hat.
- **Typografische Anführungszeichen in Commit-Messages:** `git commit -m "…"`
  mit ASCII-`"` im Text sprengt das Quoting — Message-File (`git commit -F`)
  ist die robuste Form für lange deutsche Messages.

## Kosten (Ist)

| Posten | Menge | Ist |
|---|---|---|
| NB2-Sprites (Anker 1 + i2i-Serie 12, 0 Retries) | 13 Renders | 0,65 € |
| NB2 Bomben-Sprite v2.1 (i2i auf Anker, 0 Retries) | 1 Render | 0,05 € |
| Audio (SFX + Suno-Loop aus V1; Poff/Kling = WebAudio) | — | 0,00 € |
| **Gesamt (inkl. v2.1+v2.2)** | | **0,70 €** (Cap 10 €) |
