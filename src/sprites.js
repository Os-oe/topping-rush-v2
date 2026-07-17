// Sprites V2 „Fresh": 13 KI-Illustrationen (Nano Banana 2, Magenta-Key-Pipeline,
// MIXR-Stil) als PNGs in public/sprites/, aufs Display-Grid gerechnet
// (Fallgröße 64–76 px logisch @390-px-Screen, PNGs in 2×-Auflösung für dpr 2).
// Becher bleibt prozedural (MIXR-Lesson: Gefäße nie als KI-Layer).
// KEIN Laufzeit-shadowBlur, KEIN Glow — Schatten sind vorgerenderte Ellipsen.
import { CFG } from './config.js';

const C = CFG.colors;

function offscreen(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
}

// ---------- Sprite-Entry: sofort zeichenbarer Offscreen-Canvas ----------
// Bis das PNG dekodiert ist, liegt ein simpler konturierter Farb-Blob im
// Canvas (nie ein leerer Frame); onload ersetzt ihn contain-fit durchs Bild.
function spriteEntry(wLogical, hLogical, url, fallbackColor) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(wLogical * 2);
  cv.height = Math.round(hLogical * 2);
  const x = cv.getContext('2d');
  // Fallback-Blob (konturiert, hell-tauglich)
  const r = Math.min(cv.width, cv.height) * 0.42;
  x.fillStyle = fallbackColor;
  x.strokeStyle = C.outline;
  x.lineWidth = 6;
  x.beginPath();
  x.arc(cv.width / 2, cv.height / 2, r, 0, Math.PI * 2);
  x.fill();
  x.stroke();
  const entry = { cv, w: wLogical, h: hLogical, ready: false };
  const img = new Image();
  img.onload = () => {
    const s = Math.min(cv.width / img.width, cv.height / img.height);
    const w = img.width * s;
    const h = img.height * s;
    x.clearRect(0, 0, cv.width, cv.height);
    x.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    entry.ready = true;
  };
  img.src = url;
  return entry;
}

// ---------- Becher V2 „Fresh" (prozedural — MIXR-Lesson: Gefäße nie als KI-Layer)
// Cremeweiß, braune Kontur, Pseudo-3D-Bodenkante.
// (v2.1: Hot-Zustand entfernt — Chili-Glühen gibt es mit der Bombe nicht mehr.)
function drawCup(w) {
  const pad = 26;
  const h = CFG.cupH;
  const [cv, x] = offscreen(w + pad * 2, h + pad * 2);
  const top = pad;
  const lipL = pad;
  const lipR = pad + w;
  const taper = Math.min(10, w * 0.12);
  const edge = 7; // Pseudo-3D-Bodenkante
  const body = '#FFFDF6';
  const bodyDark = '#F3E4CC'; // Kante = dunklere Bodenfläche
  const outline = C.outline;
  const accent = C.teal;

  // Körper (Trapez, unten leicht schmaler)
  x.fillStyle = body;
  x.beginPath();
  x.moveTo(lipL, top);
  x.lineTo(lipR, top);
  x.lineTo(lipR - taper, top + h - edge);
  x.lineTo(lipL + taper, top + h - edge);
  x.closePath();
  x.fill();
  // Bodenkante (Pseudo-3D)
  x.fillStyle = bodyDark;
  x.beginPath();
  x.moveTo(lipL + taper * 0.85, top + h - edge);
  x.lineTo(lipR - taper * 0.85, top + h - edge);
  x.lineTo(lipR - taper, top + h);
  x.lineTo(lipL + taper, top + h);
  x.closePath();
  x.fill();
  // Kontur um alles
  x.strokeStyle = outline;
  x.lineWidth = 3;
  x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(lipL, top);
  x.lineTo(lipR, top);
  x.lineTo(lipR - taper, top + h);
  x.lineTo(lipL + taper, top + h);
  x.closePath();
  x.stroke();
  x.beginPath();
  x.moveTo(lipL + taper * 0.85, top + h - edge);
  x.lineTo(lipR - taper * 0.85, top + h - edge);
  x.stroke();
  // Fangkante: Akzentband direkt unter dem Rand (Türkis / hot: Orange)
  x.fillStyle = accent;
  x.beginPath();
  x.moveTo(lipL + 1.5, top + 3);
  x.lineTo(lipR - 1.5, top + 3);
  x.lineTo(lipR - 2.5, top + 10);
  x.lineTo(lipL + 2.5, top + 10);
  x.closePath();
  x.fill();
  // Rand-Deckstrich (betonte Fangkante)
  x.strokeStyle = outline;
  x.lineWidth = 3.5;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(lipL - 2, top);
  x.lineTo(lipR + 2, top);
  x.stroke();
  // Glanz-Streifen links (dezente Politur)
  x.strokeStyle = 'rgba(255,255,255,0.85)';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(lipL + w * 0.16, top + 14);
  x.lineTo(lipL + taper * 0.7 + w * 0.12, top + h - edge - 6);
  x.stroke();
  return { cv, pad };
}

// ---------- Splash-Tropfen (EIN konturiertes Sprite pro Farbe, kein Glow) ----------
function drawDot(color) {
  const [cv, x] = offscreen(28, 32);
  // Tropfenform: Kreis mit leichter Spitze oben
  x.fillStyle = color;
  x.strokeStyle = C.outline;
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(14, 4);
  x.bezierCurveTo(19, 10, 24, 14, 24, 20);
  x.arc(14, 20, 10, 0, Math.PI, false);
  x.bezierCurveTo(4, 14, 9, 10, 14, 4);
  x.closePath();
  x.fill();
  x.stroke();
  // Mini-Glanzpunkt
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.beginPath();
  x.arc(10.5, 17, 2.4, 0, Math.PI * 2);
  x.fill();
  return cv;
}

// ---------- Bodenschatten-Ellipse (vorgerendert weich — KEIN Laufzeit-Blur) ----------
function drawShadow() {
  const [cv, x] = offscreen(96, 48);
  const g = x.createRadialGradient(48, 24, 4, 48, 24, 44);
  g.addColorStop(0, CFG.shadow.color);
  g.addColorStop(0.55, CFG.shadow.color.replace(/[\d.]+\)$/, '0.14)'));
  g.addColorStop(1, 'rgba(60,30,20,0)');
  x.save();
  x.translate(48, 24);
  x.scale(1, 0.42); // Ellipse
  x.translate(-48, -24);
  x.fillStyle = g;
  x.fillRect(0, 0, 96, 48);
  x.restore();
  return cv;
}

let SPRITES = null;
export function buildSprites() {
  const cupCache = new Map();
  // Display-Grid: Toppings 68 px, Çay 72, Bombe 72, Wespe 76, Kapseln 74 (logisch)
  SPRITES = {
    toppings: {
      nar: spriteEntry(68, 68, '/sprites/nar.png', '#C0392B'),
      limon: spriteEntry(68, 68, '/sprites/limon.png', '#F5C518'),
      karpuz: spriteEntry(68, 68, '/sprites/karpuz.png', '#E05780'),
      nane: spriteEntry(68, 68, '/sprites/nane.png', '#3FA34D'),
      visne: spriteEntry(68, 68, '/sprites/visne.png', '#8E1F3B'),
      portakal: spriteEntry(68, 68, '/sprites/portakal.png', '#F58A1F'),
      cilek: spriteEntry(68, 68, '/sprites/cilek.png', '#E63946'),
      cay: spriteEntry(72, 72, '/sprites/cay.png', '#C87B2E'),
    },
    bomb: spriteEntry(72, 72, '/sprites/bomb.png', '#2E3440'),
    wasp: spriteEntry(76, 76, '/sprites/wasp.png', '#F5C518'),
    capsules: {
      magnet: spriteEntry(74, 74, '/sprites/pu-magnet.png', '#F5A623'),
      xxl: spriteEntry(74, 74, '/sprites/pu-xxl.png', '#F5A623'),
      slowmo: spriteEntry(74, 74, '/sprites/pu-slowmo.png', '#F5A623'),
    },
    dots: {
      // Splash-Farben V2: an die Sprite-Palette angelehnt, satt genug für hellen BG
      teal: drawDot(C.teal),
      cyan: drawDot(C.teal), // Legacy-Key
      magenta: drawDot('#E05780'),
      lime: drawDot('#3FA34D'),
      orange: drawDot('#FF8C42'),
      yellow: drawDot('#FFC53D'),
      red: drawDot('#E63946'),
      amber: drawDot('#E8A33D'),
      white: drawDot('#FFFFFF'),
      smoke: drawDot('#A9A19A'), // Bomben-Rauch-Pöff (warmes Grau, konturiert)
    },
    shadow: drawShadow(),
    cup(w) {
      const key = `${Math.round(w)}`;
      if (!cupCache.has(key)) cupCache.set(key, drawCup(Math.round(w)));
      return cupCache.get(key);
    },
  };
  return SPRITES;
}

export function getSprites() {
  return SPRITES || buildSprites();
}
