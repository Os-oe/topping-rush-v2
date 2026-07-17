#!/usr/bin/env bash
# Restserie (12 Sprites) per i2i-Referenz auf den Anker (MIXR-Muster).
# Serien-Konstanten identisch; nur das Objekt wechselt.
set -euo pipefail
cd "$(dirname "$0")/.."
REF="assets-src/raw/nar.png"

CONST="Using the attached reference image STRICTLY as the style guide: same thick clean dark-brown outline (#4A2E1F), same white sticker border, same glossy semi-flat casual game asset look, same subtle 3D shading, same single top-left rim light with one white specular highlight, same smooth vector-like finish, no texture noise, same solid magenta background (#FF00FF). Draw exactly ONE object, centered, filling 70-75% of the frame, no drop shadow, camera frontal tilted about 10 degrees from above:"

gen() { tools/gen-sprite.sh "$1" "$CONST $2" "$REF"; }

gen limon    "a fresh lemon slice seen face-on — bright saturated yellow rind, thin white pith ring, 8 juicy yellow segments with visible white radial gaps and tiny glossy highlights."
gen karpuz   "a watermelon wedge — vivid pink-red flesh with 5 small dark teardrop seeds, thin pale inner layer, green rind with darker green stripes along the bottom curve."
gen nane     "a single fresh mint leaf with a short stem — vivid saturated green, clear lighter midrib and side veins, gently curved pointed tip, slightly serrated edge."
gen visne    "a pair of dark sour cherries (visne) hanging from one joined green stem with a small leaf — deep glossy red, each cherry with one white specular highlight."
gen portakal "a fresh orange slice seen face-on — rich orange rind, thin white pith ring, 8 juicy orange segments with visible white radial gaps and tiny glossy highlights."
gen cilek    "a ripe strawberry with a lively green leafy crown — saturated red glossy body, small pale-yellow seeds, one white specular highlight."
gen cay      "a traditional Turkish tulip-shaped tea glass on a small round saucer, completely filled with opaque amber-red black tea, a sugar-cube-free clean look, two delicate pale steam wisps drawn as solid shapes above the rim. The glass and tea read as one solid opaque game object, no see-through areas."
gen chili    "a curved bright red chili pepper with green stem and calyx — glossy, dynamic curve, a tiny bit fierce but still cute and cartoonish."
gen wasp     "a friendly cartoon wasp, side view flying — round yellow body with bold black stripes, two wings drawn as SOLID pale blue-white shapes (no transparency), big cute eye, tiny harmless stinger, cheeky mischievous smile — annoying but absolutely not scary."
gen pu-magnet "a rounded pill-shaped power-up capsule, upright — cream-white top half, warm amber-gold bottom half, thin midline; centered on the capsule a white circular badge with a bold red-and-silver horseshoe magnet icon."
gen pu-xxl    "a rounded pill-shaped power-up capsule, upright — cream-white top half, warm amber-gold bottom half, thin midline; centered on the capsule a white circular badge with a bold turquoise double-arrow icon pointing left and right (expand symbol)."
gen pu-slowmo "a rounded pill-shaped power-up capsule, upright — cream-white top half, warm amber-gold bottom half, thin midline; centered on the capsule a white circular badge with a bold blue alarm-clock icon."

echo "SERIE KOMPLETT"
