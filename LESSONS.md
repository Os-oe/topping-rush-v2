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

## Nachtrag v2.4 (18.07., Update-Session — Board ohne Gate, ehrlicher Rang, Runden-Zähler, Presence)

- **Best-of-API + Runden-UI = Framing-Falle:** Die API meldet nach POST /score
  den Rang des BESTWERTS — wer das ungefiltert als Rundenergebnis feiert, lügt
  den Spieler an („PLATZ 1!" nach schlechter Runde, live vom User entdeckt).
  Regel: Jubel-Copy IMMER an `isNewBest` koppeln, sonst ehrlich beschriften
  („Dein Bestwert: X — Platz N" / „Diese Runde: Y — dein Bestwert zählt weiter").
- **Suite < 60 s = EIN Rate-Limit-Fenster:** Läuft die ganze Suite in unter
  60 s, teilen sich ALLE Default-Bucket-Submits ein einziges Sliding-Window
  (10/60 s) — zwei neue Tests kippten den 10. Submit in 429. Fix-Muster:
  API-Seed-Submits per `x-forwarded-for` auf eigene Buckets, nur echte
  Browser-Submits bleiben auf dem Default-Bucket (der Rate-Limit-Test testet
  weiter das echte Verhalten).
- **Poll-ab-Load bricht fetch-Stubs:** Sobald das Board beim Seiten-Load pollt,
  kommt `page.evaluate`-Stubbing zu spät (erster Poll ist schon durch) —
  `page.route('**/api/leaderboard')` VOR `goto` ist die robuste Form.
- **Element in volle Flex-Spalte = Layout-Kipper:** Die Presence-Zeile als
  Spaltenkind schob die ohnehin höhen-volle Board-Seitenspalte in den Header
  (Banner-Überlappung). Fix: absolutes Overlay im leeren Bogen-Freiraum —
  kostet 0 Spaltenhöhe. Bestätigt die v2.3-Lehre: CSS-/Layout-Änderungen
  IMMER per Screenshot sichten, die Funktions-Suite sieht Optik nicht.
- **Gate-los heißt mobil-tauglich:** Ohne Start-Overlay landen QR-Neugierige
  direkt auf /board — das TV-only-vh-Layout war auf 390er-Portrait unbrauchbar.
  Media-Query < 700 px (Spalten stapeln, vh→px-Typo, Deko-Bogen weg) gehört
  zum „Gate weg"-Umbau dazu, nicht als Extra.
- **TTL testbar machen statt warten:** Presence-TTL (Prod 100 s) via
  `PLAYING_TTL_S`-ENV im Playwright-webServer auf 2 s — der Ablauf-Test
  wartet 2,6 s statt 100. Redis-SETEX und Memory-Map lesen dieselbe Konstante.
- **Presence-Asserts live tolerant bauen:** Auf dem Live-Board dürfen ECHTE
  Spieler in der Playing-Zeile stehen — `not.toContainText(NAME)` statt
  `toBeHidden()`. Dafür muss der Render den Text beim Verstecken LEEREN,
  sonst matcht der stale Text des versteckten Elements.
- **Fire-and-forget-Ping-Muster:** `pingPlaying()` in try/catch + `.catch()`,
  kein await im Spielstart-Pfad — Presence kann komplett ausfallen, ohne dass
  ein Spieler es merkt. Server räumt via Score-Submit + TTL doppelt auf.

## Nachtrag v2.5 (18.07., Update-Session — Jede Runde zählt + härteres Endgame)

- **Sorted-Set-Umbau ohne Migration:** Member-Format `name#<runId>` + „Anzeige
  = Teil vor dem LETZTEN #" macht Bestands-Member ohne `#` automatisch zu
  gültigen Runden — die Whitelist-Regex (kein `#` in Namen) garantiert die
  Eindeutigkeit des Splits. Bestmarken-Migration gratis: Liegt im Meta-Hash
  kein `best`, liefert `ZSCORE lb <name>` den Alt-Member der Best-of-Ära als
  bisherige Bestmarke → kein falsches `isNewBest` für Bestandsspieler.
- **runId ≠ id — Suffix-Match statt Gleichheit:** Die Response trägt die nackte
  `runId`, die top-Einträge den VOLLEN Member (`name#runId`). Wer im Frontend
  `e.id === runId` vergleicht, markiert nie etwas (erster Suite-Lauf fing es).
  Robuste Form: `e.id.endsWith('#' + runId)`.
- **Store-Unit-Tests im Playwright-Runner:** Spec-Dateien laufen im
  Node-Kontext — `import { MemoryStore } from '../lib/store.js'` testet Pfade,
  die über HTTP nicht erreichbar sind (Trim auf 100 inkl. `rank: null` für
  sofort getrimmte Runden, Alt-Member-Seeding). Kein Test-Framework-Zusatz nötig.
- **Wespen-Amplitude beim Spawn fixieren:** Ein globaler Amplituden-Switch ab
  Sekunde 40 ließe laufende Wespen an der Schwelle seitlich springen
  (amp·sin ändert sich instant um bis zu 15 px). `it.amp` beim Spawn setzen —
  Diskontinuität weg, „ab Sekunde 40" gilt für neu erscheinende Wespen.
- **Balancing-Beleg v2.5:** Härteres Endgame (sqrt 1.75, Frenzy +10 %, Bad
  14 %, Wespe ±65) drückte Profi auf ~1220–1270 und Casual auf ~390–550 —
  beide neuen Bänder (950–1450 / 320–580) OHNE Stellschrauben-Drehen getroffen.
  Der unseedete Casual-Bot bleibt varianzbehaftet: ein Lauf brach ohne
  Score-Ausgabe ab (Test-Timeout), die Wiederholung saß im Band — Bot-Design,
  nicht Produkt.
- **Cleanup-Muster erneut bestätigt:** Live-Testdaten gezielt via
  Namensmuster-ZREM + `DECRBY lb:rounds <n>` + `DEL lb:meta:/playing:`-Keys
  (temporäres Skript mit .env.local + @upstash/redis, danach gelöscht) —
  echte Scores blieben unangetastet auf dem Board.

## Cross-Device-QA (18.07., iPhone/WebKit + Android — Checkliste a–j)

- **WebKit-Projekt kostet fast nichts, findet aber echte Gaps:** Die komplette
  Suite lief auf Playwrights WebKit (iPhone 13) im ERSTEN Lauf 31/31 grün —
  die Mechanik-/API-Tests sind engine-agnostisch. Die echten iOS-Fallen
  (Fokus-Zoom, AudioContext-Suspend, fehlendes requestFullscreen) findet kein
  bestehender Test — dafür braucht es die Checkliste als eigene Spec
  (`tests/mobile-hardening.spec.js`, läuft in beiden Projekten).
- **Playwright-WebKit hat `fullscreenEnabled: false` — wie das echte iPhone:**
  Die Fullscreen-Feature-Detection (Button verstecken statt tot wirken lassen)
  wird dadurch im iphone-Projekt GRATIS mitgetestet; Chromium-seitig deckt ein
  `addInitScript`-Override denselben Pfad. Asserts auf `#btn-fullscreen`
  müssen seitdem engine-bewusst sein (visible NUR wenn API existiert).
- **Ein Testlauf pro Projekt = ein frischer Server:** `test:all` fährt mobile
  und iphone bewusst als getrennte Invocations (je eigener webServer-Start,
  eigenes Rate-Limit-Fenster). Beide Projekte in EINEM `playwright test`
  hätten die Browser-Submits beider Suiten in EIN 10/60-s-Fenster gelegt.
- **balance.spec bleibt Chromium-only (dokumentiert):** Die Bot-Profile sind
  auf Chromium-Frame-Timing kalibriert (setInterval/rAF-Jitter weicht in
  WebKit ab) — auf WebKit würden die Bänder Engine-Rauschen statt Balancing
  messen. `testIgnore` im iphone-Projekt.
- **`resize()` muss ALLE aus H/W abgeleiteten Anker neu setzen:** `cupY`
  stammte aus `start()` — beim Adressleisten-Resize mid-round schwebte der
  Becher. Muster: Resize re-ankert (cupY aus neuem H, X-Positionen
  proportional bei Breiten-Änderung), Fall-Tempo läuft pro Item weiter —
  Höhen-Delta < 120 px stört die Runde nicht.
- **`touch-action` erbt nicht:** `body { touch-action: manipulation }` schützt
  Buttons de facto (Ancestor-Kette), aber erst die explizite Regel auf
  `button, input` macht es per computed style testbar und robust gegen
  künftige Container mit eigenem touch-action.
- **Zentrierter Fixed-Screen + Überlauf = unsichtbar abgeschnitten:**
  `justify-content:center` schneidet bei zu kleinem Viewport OBEN UND UNTEN ab
  (Tastatur auf 360er-Androids, lange Top-10-Liste). Fix-Muster:
  `overflow-y:auto` auf dem Screen + `margin:auto` aufs Kind — zentriert bei
  Platz, scrollbar bei Überlauf. Dazu Kompakt-Media-Query `max-height: 700px`
  (iPhone-Safari-Viewport ist 664 px, nicht 844!).
- **Live-Asserts auf Namen müssen Mehrfach-Runden erlauben:** Unter „jede
  Runde zählt" stehen echte Spieler legitim mehrfach im Board (Osman 1519 +
  1450 live entdeckt) — `toHaveCount(1)` auf einen Namen ist seit v2.5 falsch,
  `not.toHaveCount(0)` + id-basierte Checks sind die robuste Form.
- **iOS-Grundhygiene, jetzt im Code verankert:** Inputs ≥ 16 px (Admin-Inputs
  hatten UA-Default ~13 px → Fokus-Zoom), AudioContext-Resume via
  visibilitychange/focus/pageshow + Guard vor jedem play()/event() (iOS
  liefert auch 'interrupted'), `viewport-fit=cover` auch auf /board
  (user-scalable=no dort bewusst NICHT — Board wird gelesen, Pinch-Zoom ist
  Accessibility), `navigator.vibrate?.()` überall optional gechained.

## Kosten (Ist)

| Posten | Menge | Ist |
|---|---|---|
| NB2-Sprites (Anker 1 + i2i-Serie 12, 0 Retries) | 13 Renders | 0,65 € |
| NB2 Bomben-Sprite v2.1 (i2i auf Anker, 0 Retries) | 1 Render | 0,05 € |
| Audio (SFX + Suno-Loop aus V1; Poff/Kling = WebAudio) | — | 0,00 € |
| Nachträge v2.3 + v2.4 + v2.5 (reiner Code, keine Renders) | — | 0,00 € |
| **Gesamt (inkl. v2.1–v2.5)** | | **0,70 €** (Cap 10 €) |

## Rang-Bug live (18.07., von Osman per Screenshot entdeckt)
- **`zrank(key, member, {rev:true})` ist eine stille Falle:** ZRANK kennt keine
  REV-Option (nur ZRANGE hat sie) — @upstash/redis ignoriert das dritte
  Argument, zurück kommt der AUFSTEIGENDE Rang: niedrigster Score = „Platz 1".
  Richtig: `zrevrank(key, member)`. Der Memory-Fallback sortierte korrekt,
  darum blieb die lokale Suite grün — **Adapter-Diskrepanzen brauchen einen
  Live-Zwei-Spieler-Test gegen die echte DB** (hoher + niedriger Score,
  Ränge gegen die Listen-Reihenfolge asserten).
- **Frontend-Sicherheitsnetz eingebaut:** Der Ergebnis-Screen leitet den Rang
  aus der mitgelieferten Top-Liste ab, wenn der eigene Name drinsteht —
  widersprüchliche Server-Ränge können nie mehr angezeigt werden.
- **localStorage-Bestmarke lügt nach Admin-Reset** (Geister-Bestmarke „1427"
  überlebte den Server-Reset): Server-`best` ist die Wahrheit, localStorage
  wird nach jedem Submit angeglichen.
- Live-Testdaten auf einem Board mit echten Scores NIE per Admin-Reset
  räumen — gezielt `ZREM` + `DECRBY lb:rounds` (cleanup-Skript-Muster).

## Android-Swipe-Bug (18.07., User-Report: Tippen ging, Wischen nicht)
- **`touch-action: manipulation` ist für Spielflächen die halbe Wahrheit:** Es
  stoppt nur Doppeltap-Zoom, NICHT die Pan-/Scroll-Gestenerkennung. Android-
  Chrome deutete horizontales Wischen als Pan → `pointercancel` → keine
  pointermove-Events mehr. Safari war nachsichtiger (deshalb „iPhone geht,
  Android nicht"). Spielflächen brauchen **`touch-action: none`** (nur dort —
  UI-Screens behalten manipulation für natürliches Scrollen) + `setPointerCapture`
  im pointerdown als Robustheits-Netz.
- **Tap-Tests beweisen keine Drags:** Die Suite hatte `.tap()`-Tests, der Bug
  lag im Gesten-Pfad. Echte Wisch-Regression nur via CDP
  `Input.dispatchTouchEvent`-Sequenz (touchStart→12×touchMove→touchEnd,
  Chromium-only) — jetzt Test (k) in mobile-hardening.spec.js.
