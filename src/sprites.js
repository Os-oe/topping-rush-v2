// Glow-Sprites: ALLE Objekte werden EINMALIG beim Start auf eng zugeschnittene
// Offscreen-Canvases gerendert — shadowBlur NUR hier. Zur Laufzeit ausschließlich
// drawImage (+ 'lighter' für Glow/Partikel). Kerne fast weiß, Farbe im Glow-Saum.
//
// Nachtrag v1.1: 8 erkennbare Zutaten der türkischen alkoholfreien Getränkewelt
// (Limonata, Nar, Vişne, Karpuz, Şerbet, Çay) — liebevoll, appetitlich, eindeutig.
// Bad-Item: Chilischote „ZU SCHARF!" (statt Bombe). Wespe unverändert.
import { CFG } from './config.js';

const C = CFG.colors;
const RUBY = '#FF2D55'; // Granatapfel-Rubinrot (Nachtrag)
const AMBER = '#FFB238'; // Çay-Bernstein

function offscreen(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

// ---------- 1. Granatapfel-Hälfte (Nar) ----------
function drawNar() {
  const [cv, x] = offscreen(68, 68);
  // Schale außen
  glow(x, RUBY, 16);
  x.fillStyle = '#5c0f1e';
  x.beginPath();
  x.arc(34, 36, 24, 0, Math.PI * 2);
  x.fill();
  glow(x, RUBY, 9);
  x.strokeStyle = RUBY;
  x.lineWidth = 3;
  x.beginPath();
  x.arc(34, 36, 24, 0, Math.PI * 2);
  x.stroke();
  x.shadowBlur = 0;
  // helle Schnittfläche (Pith)
  x.fillStyle = '#ffe8ec';
  x.beginPath();
  x.arc(34, 36, 19.5, 0, Math.PI * 2);
  x.fill();
  // Kammern-Trennwände (5 Wedges — typische Granatapfel-Anatomie)
  x.strokeStyle = 'rgba(255,120,150,0.9)';
  x.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    x.beginPath();
    x.moveTo(34 + Math.cos(a) * 4, 36 + Math.sin(a) * 4);
    x.lineTo(34 + Math.cos(a) * 18.5, 36 + Math.sin(a) * 18.5);
    x.stroke();
  }
  // Krönchen oben (größer, markant)
  glow(x, RUBY, 8);
  x.fillStyle = RUBY;
  x.beginPath();
  x.moveTo(26, 14); x.lineTo(29, 5); x.lineTo(33, 11); x.lineTo(36, 4); x.lineTo(39, 11); x.lineTo(42, 6); x.lineTo(43, 14);
  x.closePath();
  x.fill();
  x.shadowBlur = 0;
  // glitzernde Kerne (Arils) in Kammern gruppiert — sattes Rubinrot
  const seeds = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
    for (const [dr, da] of [ [8, 0], [13, -0.22], [13, 0.22], [16.5, 0] ]) {
      seeds.push([34 + Math.cos(a + da) * dr, 36 + Math.sin(a + da) * dr]);
    }
  }
  for (const [sx, sy] of seeds) {
    glow(x, RUBY, 5);
    x.fillStyle = '#ff2050';
    x.beginPath();
    x.arc(sx, sy, 2.7, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.beginPath();
    x.arc(sx - 0.9, sy - 0.9, 0.9, 0, Math.PI * 2);
    x.fill();
  }
  return cv;
}

// ---------- 2./6. Zitrus-Scheibe (Limon / Portakal) ----------
function drawCitrus(rimColor, fleshColor, glowColor) {
  const [cv, x] = offscreen(68, 68);
  glow(x, glowColor, 16);
  x.fillStyle = rimColor;
  x.beginPath();
  x.arc(34, 34, 25, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  // weißer Innenring (Albedo) — die Segment-Gaps bleiben WEISS sichtbar
  x.fillStyle = '#fffdf2';
  x.beginPath();
  x.arc(34, 34, 21, 0, Math.PI * 2);
  x.fill();
  // Segmente: satte Keile mit deutlichem weißen Zwischenraum
  x.fillStyle = fleshColor;
  const SEG = 8;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2 + 0.11;
    const a1 = ((i + 1) / SEG) * Math.PI * 2 - 0.11;
    x.beginPath();
    x.moveTo(34 + Math.cos((a0 + a1) / 2) * 3.5, 34 + Math.sin((a0 + a1) / 2) * 3.5);
    x.arc(34, 34, 18.5, a0, a1);
    x.closePath();
    x.fill();
  }
  // Segment-Glanzpunkte
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (const a of [0.6, 2.2, 4.0]) {
    x.beginPath();
    x.arc(34 + Math.cos(a) * 12, 34 + Math.sin(a) * 12, 1.7, 0, Math.PI * 2);
    x.fill();
  }
  return cv;
}

// ---------- 3. Wassermelonen-Schnitz (Karpuz) ----------
function drawKarpuz() {
  const [cv, x] = offscreen(72, 68);
  // Rinde (Bogen unten)
  glow(x, C.lime, 14);
  x.fillStyle = '#0f6b2f';
  x.beginPath();
  x.moveTo(8, 30);
  x.quadraticCurveTo(36, 66, 64, 30);
  x.lineTo(64, 38);
  x.quadraticCurveTo(36, 74, 8, 38);
  x.closePath();
  x.fill();
  glow(x, C.lime, 8);
  x.strokeStyle = C.lime;
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(8, 37);
  x.quadraticCurveTo(36, 72, 64, 37);
  x.stroke();
  x.shadowBlur = 0;
  // weiße Zwischenschicht
  x.fillStyle = '#f2ffe9';
  x.beginPath();
  x.moveTo(9, 30);
  x.quadraticCurveTo(36, 64, 63, 30);
  x.lineTo(60, 26);
  x.quadraticCurveTo(36, 56, 12, 26);
  x.closePath();
  x.fill();
  // Fruchtfleisch (pink, appetitlich hell)
  glow(x, C.magenta, 12);
  x.fillStyle = '#ff7eb0';
  x.beginPath();
  x.moveTo(12, 26);
  x.quadraticCurveTo(36, 56, 60, 26);
  x.quadraticCurveTo(36, 6, 12, 26);
  x.closePath();
  x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#ffd3e6';
  x.beginPath();
  x.moveTo(20, 24);
  x.quadraticCurveTo(36, 42, 52, 24);
  x.quadraticCurveTo(36, 12, 20, 24);
  x.closePath();
  x.fill();
  // Kerne
  x.fillStyle = '#14141c';
  for (const [sx, sy, rot] of [ [26, 28, 0.4], [36, 34, 0], [46, 28, -0.4], [31, 21, 0.2], [41, 21, -0.2] ]) {
    x.save();
    x.translate(sx, sy);
    x.rotate(rot);
    x.beginPath();
    x.ellipse(0, 0, 1.7, 2.8, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return cv;
}

// ---------- 4. Minzblatt (Nane) — EIN Blatt mit Spitze, Stiel + Adern ----------
function drawNane() {
  const [cv, x] = offscreen(64, 68);
  x.save();
  x.translate(32, 34);
  x.rotate(0.35);
  // Blatt-Silhouette: spitz zulaufend, leicht gezackter Eindruck über 2 Bögen je Seite
  glow(x, C.lime, 16);
  x.fillStyle = '#f0fff4';
  x.beginPath();
  x.moveTo(0, -26); // Spitze
  x.bezierCurveTo(9, -20, 15, -12, 14, -2);
  x.bezierCurveTo(13.5, 10, 8, 20, 0, 25);
  x.bezierCurveTo(-8, 20, -13.5, 10, -14, -2);
  x.bezierCurveTo(-15, -12, -9, -20, 0, -26);
  x.closePath();
  x.fill();
  // grüner Saum
  glow(x, C.lime, 9);
  x.strokeStyle = C.lime;
  x.lineWidth = 2.6;
  x.stroke();
  x.shadowBlur = 0;
  // Mittelrippe + Seitenadern (kräftig — DAS Blatt-Signal)
  x.strokeStyle = '#2fd411';
  x.lineWidth = 2.2;
  x.beginPath();
  x.moveTo(0, -24);
  x.lineTo(0, 24);
  x.stroke();
  x.lineWidth = 1.5;
  for (const [sy, len] of [ [-14, 8], [-5, 11], [4, 11], [13, 8] ]) {
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(0, sy);
      x.quadraticCurveTo(s * len * 0.6, sy + 2, s * len, sy + 6);
      x.stroke();
    }
  }
  // Stiel
  x.strokeStyle = '#2fd411';
  x.lineWidth = 2.4;
  x.beginPath();
  x.moveTo(0, 25);
  x.quadraticCurveTo(-3, 30, -6, 32);
  x.stroke();
  x.restore();
  return cv;
}

// ---------- 5. Vişne-Kirschpaar ----------
function drawVisne() {
  const [cv, x] = offscreen(68, 72);
  // Stiele (V-Form)
  glow(x, C.lime, 6);
  x.strokeStyle = '#7dd87d';
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(34, 8);
  x.quadraticCurveTo(30, 22, 22, 38);
  x.moveTo(34, 8);
  x.quadraticCurveTo(40, 24, 46, 40);
  x.stroke();
  x.shadowBlur = 0;
  // zwei Kirschen, tiefrot-magenta, glänzend
  for (const [cx, cy] of [ [22, 48], [46, 50] ]) {
    glow(x, '#e0115f', 15);
    x.fillStyle = '#7a0f2e';
    x.beginPath();
    x.arc(cx, cy, 13, 0, Math.PI * 2);
    x.fill();
    glow(x, '#ff3d7a', 8);
    x.strokeStyle = '#ff3d7a';
    x.lineWidth = 2.5;
    x.beginPath();
    x.arc(cx, cy, 13, 0, Math.PI * 2);
    x.stroke();
    x.shadowBlur = 0;
    // Glanzpunkt
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.beginPath();
    x.ellipse(cx - 4.5, cy - 5, 3.4, 2.3, -0.6, 0, Math.PI * 2);
    x.fill();
  }
  return cv;
}

// ---------- 7. Erdbeere (Çilek) ----------
function drawCilek() {
  const [cv, x] = offscreen(64, 64);
  glow(x, RUBY, 16);
  x.fillStyle = '#ffe9f0';
  x.beginPath();
  x.moveTo(32, 56);
  x.bezierCurveTo(12, 42, 10, 24, 20, 18);
  x.bezierCurveTo(26, 14, 38, 14, 44, 18);
  x.bezierCurveTo(54, 24, 52, 42, 32, 56);
  x.fill();
  glow(x, RUBY, 10);
  x.fillStyle = RUBY;
  x.globalAlpha = 0.6;
  x.beginPath();
  x.moveTo(32, 54);
  x.bezierCurveTo(15, 41, 13, 25, 22, 20);
  x.bezierCurveTo(27, 16, 37, 16, 42, 20);
  x.bezierCurveTo(51, 25, 49, 41, 32, 54);
  x.fill();
  x.globalAlpha = 1;
  x.shadowBlur = 0;
  // Neon-Kernchen
  glow(x, C.yellow, 4);
  x.fillStyle = '#fff9c9';
  for (const [sx, sy] of [ [26, 30], [38, 30], [32, 40], [23, 24], [41, 24], [29, 47], [35, 47] ]) {
    x.beginPath();
    x.ellipse(sx, sy, 1.1, 1.8, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.shadowBlur = 0;
  // grünes Krönchen
  glow(x, C.lime, 8);
  x.fillStyle = C.lime;
  x.beginPath();
  x.moveTo(24, 16); x.lineTo(32, 20); x.lineTo(28, 10); x.lineTo(34, 18);
  x.lineTo(38, 9); x.lineTo(36, 19); x.lineTo(44, 15); x.lineTo(36, 22);
  x.lineTo(28, 22); x.closePath();
  x.fill();
  return cv;
}

// ---------- 8. Çay-Tulpenglas (kultureller Anker, normales +10-Objekt) ----------
function drawCay() {
  const [cv, x] = offscreen(64, 76);
  // Untertasse
  glow(x, AMBER, 8);
  x.fillStyle = '#f5e6cf';
  x.beginPath();
  x.ellipse(32, 64, 20, 5, 0, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  x.fillStyle = 'rgba(180,140,90,0.5)';
  x.beginPath();
  x.ellipse(32, 64, 12, 3, 0, 0, Math.PI * 2);
  x.fill();
  // Tulpenglas-Silhouette (tailliert)
  glow(x, AMBER, 14);
  x.strokeStyle = '#eafcff';
  x.lineWidth = 2.6;
  x.beginPath();
  x.moveTo(19, 16);
  x.bezierCurveTo(21, 30, 27, 34, 27, 42);
  x.bezierCurveTo(27, 52, 22, 56, 24, 61);
  x.lineTo(40, 61);
  x.bezierCurveTo(42, 56, 37, 52, 37, 42);
  x.bezierCurveTo(37, 34, 43, 30, 45, 16);
  x.stroke();
  x.shadowBlur = 0;
  // Tee (Bernstein, 3/4 gefüllt)
  glow(x, AMBER, 12);
  x.fillStyle = 'rgba(255,178,56,0.85)';
  x.beginPath();
  x.moveTo(21.5, 26);
  x.bezierCurveTo(23, 32, 28.5, 35, 28.5, 42);
  x.bezierCurveTo(28.5, 52, 24, 56, 25.5, 59.5);
  x.lineTo(38.5, 59.5);
  x.bezierCurveTo(40, 56, 35.5, 52, 35.5, 42);
  x.bezierCurveTo(35.5, 35, 41, 32, 42.5, 26);
  x.closePath();
  x.fill();
  x.shadowBlur = 0;
  // Tee-Oberfläche
  x.fillStyle = '#ffd88f';
  x.beginPath();
  x.ellipse(32, 26, 10.5, 2.6, 0, 0, Math.PI * 2);
  x.fill();
  // Glas-Glanzlinie
  x.strokeStyle = 'rgba(255,255,255,0.75)';
  x.lineWidth = 1.6;
  x.beginPath();
  x.moveTo(23.5, 20);
  x.bezierCurveTo(25, 30, 30, 34, 30, 42);
  x.stroke();
  // Dampf-Fähnchen
  glow(x, '#ffffff', 6);
  x.strokeStyle = 'rgba(255,255,255,0.65)';
  x.lineWidth = 1.8;
  for (const dx of [-4, 4]) {
    x.beginPath();
    x.moveTo(32 + dx, 12);
    x.bezierCurveTo(29 + dx, 8, 35 + dx, 5, 32 + dx, 1);
    x.stroke();
  }
  return cv;
}

// ---------- Chilischote „ZU SCHARF!" (2 Frames: pulsierender Orange-Glow) ----------
function drawChili(pulse) {
  const [cv, x] = offscreen(72, 72);
  const glowColor = pulse ? C.orange : C.blinkRed;
  // gebogene Schote
  glow(x, glowColor, pulse ? 20 : 13);
  x.fillStyle = '#c40f1f';
  x.beginPath();
  x.moveTo(24, 18);
  x.bezierCurveTo(12, 26, 12, 44, 24, 54);
  x.bezierCurveTo(34, 62, 50, 60, 58, 48);
  x.bezierCurveTo(50, 52, 38, 52, 30, 44);
  x.bezierCurveTo(22, 36, 22, 24, 24, 18);
  x.closePath();
  x.fill();
  glow(x, glowColor, 8);
  x.strokeStyle = C.blinkRed;
  x.lineWidth = 2.5;
  x.stroke();
  x.shadowBlur = 0;
  // Glanzlinie
  x.strokeStyle = 'rgba(255,255,255,0.7)';
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(21, 26);
  x.bezierCurveTo(17, 34, 19, 42, 26, 49);
  x.stroke();
  // Stiel + Kelch
  glow(x, C.lime, 6);
  x.fillStyle = '#2e8b3a';
  x.beginPath();
  x.moveTo(20, 14);
  x.quadraticCurveTo(28, 10, 30, 16);
  x.quadraticCurveTo(27, 22, 20, 20);
  x.closePath();
  x.fill();
  x.strokeStyle = '#5dd96a';
  x.lineWidth = 2.4;
  x.beginPath();
  x.moveTo(24, 12);
  x.quadraticCurveTo(26, 6, 32, 5);
  x.stroke();
  return cv;
}

// ---------- Wespe (2 Frames Flügelschlag, unverändert) ----------
function drawWasp(frame) {
  const [cv, x] = offscreen(80, 64);
  glow(x, 'rgba(200,230,255,0.9)', 10);
  x.fillStyle = 'rgba(220,240,255,0.55)';
  const wy = frame ? -10 : -4;
  for (const dx of [-8, 8]) {
    x.save();
    x.translate(40 + dx, 24);
    x.rotate(dx < 0 ? -0.5 : 0.5);
    x.beginPath();
    x.ellipse(0, wy, 7, frame ? 14 : 10, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  glow(x, C.yellow, 14);
  x.fillStyle = C.yellow;
  x.beginPath();
  x.ellipse(40, 36, 22, 13, 0, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  x.save();
  x.beginPath();
  x.ellipse(40, 36, 22, 13, 0, 0, Math.PI * 2);
  x.clip();
  x.fillStyle = '#14141c';
  x.fillRect(30, 20, 7, 32);
  x.fillRect(43, 20, 7, 32);
  x.restore();
  x.fillStyle = '#14141c';
  x.beginPath();
  x.arc(19, 34, 7, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.moveTo(61, 36); x.lineTo(70, 38); x.lineTo(61, 42); x.closePath();
  x.fill();
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(17, 32, 2.2, 0, Math.PI * 2);
  x.fill();
  return cv;
}

// ---------- Power-Up-Kapseln (unverändert) ----------
function drawCapsule(kind) {
  const [cv, x] = offscreen(76, 76);
  glow(x, C.yellow, 20);
  x.fillStyle = 'rgba(20,20,10,0.85)';
  x.beginPath();
  x.roundRect(16, 20, 44, 36, 12);
  x.fill();
  glow(x, C.yellow, 10);
  x.strokeStyle = C.yellow;
  x.lineWidth = 3;
  x.beginPath();
  x.roundRect(16, 20, 44, 36, 12);
  x.stroke();
  x.shadowBlur = 0;
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.lineWidth = 4;
  if (kind === 'magnet') {
    glow(x, C.magenta, 8);
    x.strokeStyle = '#ffd7ec';
    x.beginPath();
    x.arc(38, 38, 10, Math.PI, 0, false);
    x.moveTo(28, 38); x.lineTo(28, 46);
    x.moveTo(48, 38); x.lineTo(48, 46);
    x.stroke();
  } else if (kind === 'xxl') {
    glow(x, C.cyan, 8);
    x.strokeStyle = '#d8fbff';
    x.beginPath();
    x.moveTo(26, 38); x.lineTo(50, 38);
    x.moveTo(26, 38); x.lineTo(32, 32); x.moveTo(26, 38); x.lineTo(32, 44);
    x.moveTo(50, 38); x.lineTo(44, 32); x.moveTo(50, 38); x.lineTo(44, 44);
    x.stroke();
  } else {
    glow(x, C.lime, 8);
    x.strokeStyle = '#e4ffe9';
    x.beginPath();
    x.arc(38, 38, 10, 0, Math.PI * 2);
    x.moveTo(38, 32); x.lineTo(38, 38); x.lineTo(43, 41);
    x.stroke();
  }
  return cv;
}

// ---------- Becher (hot = Chili-Glühen, 3 s rötlich) ----------
function drawCup(w, hot) {
  const pad = 26;
  const h = CFG.cupH;
  const [cv, x] = offscreen(w + pad * 2, h + pad * 2);
  const top = pad;
  const lipL = pad;
  const lipR = pad + w;
  const taper = Math.min(10, w * 0.12);
  const main = hot ? C.orange : C.cyan;
  glow(x, main, 16);
  x.fillStyle = hot ? 'rgba(70,16,0,0.6)' : 'rgba(0,40,50,0.55)';
  x.beginPath();
  x.moveTo(lipL, top);
  x.lineTo(lipR, top);
  x.lineTo(lipR - taper, top + h);
  x.lineTo(lipL + taper, top + h);
  x.closePath();
  x.fill();
  glow(x, main, 9);
  x.strokeStyle = hot ? '#ffd9c4' : '#d9fdff';
  x.lineWidth = 3;
  x.stroke();
  // Becherrand betont (Fangkante!)
  glow(x, hot ? C.blinkRed : C.cyan, 12);
  x.strokeStyle = '#ffffff';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(lipL - 3, top);
  x.lineTo(lipR + 3, top);
  x.stroke();
  x.shadowBlur = 0;
  x.strokeStyle = hot ? 'rgba(255,103,0,0.4)' : 'rgba(0,240,255,0.35)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(lipL + w * 0.28, top + 6);
  x.lineTo(lipL + taper + w * 0.2, top + h - 6);
  x.stroke();
  return { cv, pad };
}

// ---------- Partikel-Dot (EIN weiches Sprite pro Farbe) ----------
function drawDot(color) {
  const [cv, x] = offscreen(48, 48);
  const g = x.createRadialGradient(24, 24, 0, 24, 24, 22);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 48, 48);
  return cv;
}

let SPRITES = null;
export function buildSprites() {
  const cupCache = new Map();
  SPRITES = {
    toppings: {
      nar: drawNar(),
      limon: drawCitrus('#ffe000', '#ffce00', C.yellow),
      karpuz: drawKarpuz(),
      nane: drawNane(),
      visne: drawVisne(),
      portakal: drawCitrus('#ff8c1a', '#ffb45e', C.orange),
      cilek: drawCilek(),
      cay: drawCay(),
    },
    chili: [drawChili(false), drawChili(true)],
    wasp: [drawWasp(0), drawWasp(1)],
    capsules: { magnet: drawCapsule('magnet'), xxl: drawCapsule('xxl'), slowmo: drawCapsule('slowmo') },
    dots: {
      cyan: drawDot(C.cyan),
      magenta: drawDot(C.magenta),
      lime: drawDot(C.lime),
      orange: drawDot(C.orange),
      yellow: drawDot(C.yellow),
      red: drawDot(RUBY),
      amber: drawDot(AMBER),
      white: drawDot('#cfe8ff'),
    },
    cup(w, hot = false) {
      const key = `${Math.round(w)}|${hot ? 1 : 0}`;
      if (!cupCache.has(key)) cupCache.set(key, drawCup(Math.round(w), hot));
      return cupCache.get(key);
    },
  };
  return SPRITES;
}

export function getSprites() {
  return SPRITES || buildSprites();
}
