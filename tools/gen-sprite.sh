#!/usr/bin/env bash
# NB2-Sprite-Render (MIXR-Pipeline): Magenta-BG fordern, NIE "transparent background".
# Usage: gen-sprite.sh <name> <prompt-file-or-text> [ref-image]
# Output: assets-src/raw/<name>.png  — Keying macht process-sprite.py.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="$1"
PROMPT="$2"
REF="${3:-}"
MODEL="gemini-3.1-flash-image-preview"
OUT="assets-src/raw/${NAME}.png"
mkdir -p assets-src/raw

BG="node /Users/Osman/Desktop/APPS/agent-studio/commandcenter/scripts/lib/budget-guard.js"
$BG check image 0.05 || { echo "BUDGET BLOCK — Abbruch"; exit 1; }

if [ -n "$REF" ]; then
  B64=$(base64 -i "$REF" | tr -d '\n')
  REQ=$(jq -n --arg p "$PROMPT" --arg d "$B64" '{
    contents: [{ parts: [ {text: $p}, {inline_data: {mime_type: "image/png", data: $d}} ] }],
    generationConfig: { imageConfig: { imageSize: "1K", aspectRatio: "1:1" } }
  }')
else
  REQ=$(jq -n --arg p "$PROMPT" '{
    contents: [{ parts: [{text: $p}] }],
    generationConfig: { imageConfig: { imageSize: "1K", aspectRatio: "1:1" } }
  }')
fi

RESP=$(curl -sS -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_AI_STUDIO_KEY}" \
  -H "Content-Type: application/json" \
  -d "$REQ")

IMG_B64=$(echo "$RESP" | jq -r '.candidates[0].content.parts[]? | (.inline_data // .inlineData) | select(.) | .data' | head -n1)
if [ -z "$IMG_B64" ] || [ "$IMG_B64" = "null" ]; then
  echo "ERROR: no image in response for $NAME"
  echo "$RESP" | jq -r '.candidates[0].finishReason // .error.message // "unknown"'
  exit 1
fi
echo "$IMG_B64" | base64 -d > "$OUT"

/Users/Osman/Desktop/APPS/agent-studio/commandcenter/scripts/register-generation.sh \
  "$(pwd)/$OUT" --prompt "topping-rush-v2 sprite: $NAME" \
  --model "$MODEL (Nano Banana 2)" --cost-eur 0.05 --cost-category image >/dev/null
echo "SAVED: $OUT ($(stat -f%z "$OUT") bytes)"
sleep 2 # register-generation Collision-Bug + API-Schonung
