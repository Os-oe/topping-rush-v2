// TOPPING RUSH — alle Stellschrauben aus dem Konzept (CONCEPT.md, eingefroren).
// Zeiten in Sekunden, Distanzen in CSS-Pixeln (logische Koordinaten).

export const CFG = {
  // Runde
  roundDefault: 60,        // Admin: 60–90 s
  roundMin: 60,
  roundMax: 90,
  frenzyDur: 10,           // letzte 10 s = Frenzy

  // Spawn-Pacing (Referenz 60 s — bei anderer Länge zeitlich gestreckt)
  spawnStart: 1.2,         // s Intervall bei t=0
  spawnEnd: 0.7,           // s Intervall am Rampen-Ende (Sekunde 50 bei 60 s)
  spawnFrenzy: 0.45,       // s Intervall in der Frenzy
  fallTimeStart: 2.3,      // s oben→unten bei t=0
  fallSpeedupMax: 1.75,    // Faktor am Rampen-Ende (sqrt-Kurve; v2.5: 1.6 → 1.75)
  frenzyFallBoost: 1.10,   // v2.5: Frenzy nicht mehr eingefroren — +10 % auf den 50-s-Wert

  // Fairness / Bad-Items
  badShareMax: 0.15,       // Anteil Bad-Items gesamt
  badShareFrenzy: 0.14,    // v2.5: 0.10 → 0.14 (Fairness-Regeln unangetastet)
  badMinGap: 1.5,          // s Mindestabstand zwischen Bad-Spawns
  badEarliest: 6,          // s Schonfrist
  badMinCatches: 3,        // erst nach 3 Catches
  badGoodMinDx: 80,        // px Mindestabstand zu gleichhohem Gut-Item
  goodPairMaxDx: 0.6,      // 2 gute Items <0.5s auseinander → dx ≤ 60 % Screenbreite
  goodPairWindow: 0.5,     // s
  maxConcurrent: 5,        // sichtbare Objekte (4–5)
  maxConcurrentFrenzy: 7,  // Frenzy 6–7

  // Scoring — Playtest-Kalibrierung 2026-07-17 (erlaubte Stellschrauben laut
  // Konzept: Combo-Rampe + Miss-Reset). Original Cap +10 / Miss resettet nicht
  // ergab Casual ~720 / Profi ~1420 — beide über den Ziel-Bändern (300–500 / 900–1300).
  catchBase: 10,
  comboStep: 1,            // +1 pro Catch in Serie
  comboCap: 6,             // Bonus-Cap (war +10)
  missResetsCombo: true,   // war false („Event-freundlich") — Bänder schlagen Weichheit
  frenzyMult: 2,
  scoreServerCap: 3000,

  // Becher / Steuerung
  cupW: 88,                // Basis-Breite Sprite
  cupH: 56,
  cupLerp: 0.3,            // Lerp pro Frame @60fps
  touchTween: 0.08,        // s Touch-Down-Tween zur Finger-X
  hitboxScale: 1.18,       // Fang-Hitbox 15–20 % breiter als Sprite
  cupBottomOffset: 96,     // px vom unteren Rand

  // Bad-Item-Effekte (Nachtrag v2.1: Bombe −30 statt Chili-Becher-Schrumpf)
  bombPenalty: 30,         // Punktabzug beim Bomben-Fang (Score-Floor 0), Combo → 0

  // Becher-Füllstand (Nachtrag v2.2): nur echte Zutaten füllen; voll → Bonus.
  // Entscheidung dokumentiert: Bonus flach +30, NICHT frenzy-multipliziert
  // (Konzept nennt nur „Bonus +30").
  fillTarget: 10,          // Catches bis „DRINK FERTIG!"
  fillBonus: 30,
  waspAmp: 50,             // px Sinus-Amplitude
  waspAmpLate: 65,         // v2.5: ±65 px ab Sekunde 40 (skaliert mit Rundenlänge)
  waspAmpLateT: 40,        // s Schwelle (Referenz 60-s-Runde)
  waspHz: 1.0,             // Sinus-Frequenz

  // Power-Ups (deterministische Slots, Fenster bei 60 s — skaliert mit Rundenlänge)
  puWindows: [ [10, 20], [25, 40], [45, 55] ],
  puFallFactor: 1.3,       // Kapsel fällt langsamer
  magnetDur: 4,
  magnetRadius: 130,
  xxlDur: 5,
  xxlScale: 2,
  slowmoDur: 3,
  slowmoFactor: 0.5,

  // Partikel / Rendering — V2 „Fresh": kein Trail-Fade, kein additives
  // Blending, kein Laufzeit-shadowBlur. clearRect + vorgerenderte Schatten.
  particleMax: 150,
  dprCap: 2,
  bg: '#FFF6E8', // oberster Stop des 3-Stop-Verlaufs (Fallback-Fläche)
  bgStops: ['#FFF6E8', '#FFE3C2', '#FFD1C4'], // Creme → Pfirsich → Rosé
  spriteSize: 68, // Fallgröße px @390-px-Screen (Konzept: 64–72, nie <56)

  // Bodenschatten-Ellipse unter jedem fallenden Objekt (Konzept-Pflicht)
  shadow: {
    color: 'rgba(60,30,20,0.22)', // 0.18–0.25
    offsetYFrac: 0.08,            // 6–10 % der Objekthöhe
    blurFrac: 0.30,               // Blur ≈ 30 % der Breite (vorgerendert)
  },

  // Palette V2 „Fresh" (UI max. 2 Akzentfarben: Türkis + Koralle)
  colors: {
    outline: '#4A2E1F',  // dunkle Kontur (Sprites, Buttons, Popups)
    teal: '#2EC4B6',     // primär (Iznik-Türkis-Brücke)
    coral: '#FF6B6B',    // sekundär
    cream: '#FFFDF6',    // Panels / Becher
    ink: '#4A2E1F',      // Text auf hellem Grund
    // Feedback-Farben (sat, dunkel genug für hellen BG)
    lime: '#3FA34D',     // Fang/Positiv (Blattgrün statt Neon-Lime)
    orange: '#F1641E',   // Bomben-Rand-Flash
    blinkRed: '#D7263D', // „−30"-Popup-Rot
    warnRed: '#E63946',  // Bad-Item-Warn-Ring (Nachtrag v2.1)
    yellow: '#F5A623',   // Power-Ups (sattes Amber statt Neon-Gelb)
    magenta: '#D81E5B',  // Combo-Highlights (Beere statt Neon-Magenta)
    cyan: '#2EC4B6',     // Legacy-Key → zeigt auf Türkis (Becher-Akzente)
  },
};

// Nachtrag v1.1: 8 erkennbare Zutaten der türkischen alkoholfreien Getränkewelt
export const TOPPINGS = ['nar', 'limon', 'karpuz', 'nane', 'visne', 'portakal', 'cilek', 'cay'];
export const POWERUPS = ['magnet', 'xxl', 'slowmo'];
