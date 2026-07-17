#!/usr/bin/env python3
"""Magenta-Key + Display-Grid-Rechnung für topping-rush-v2 (MIXR-Pipeline).

- keyt soliden Magenta-BG (#FF00FF, großzügige Toleranz — Modell schwankt bis g~55)
- 1px-Alpha-Erosion gegen Fringe
- trimmt auf Inhalt, skaliert LANCZOS auf Zielbox (2x-Auflösung für dpr 2)
- schreibt public/sprites/<name>.png + meldet Kennzahlen

Usage: process-sprite.py <raw.png> <out.png> --box <px>  (Box = 2x Displaygröße)
"""
import sys
from PIL import Image, ImageFilter


def is_magenta(c):
    r, g, b = c[0], c[1], c[2]
    return r > 185 and b > 175 and g < 120 and (r - g) > 85 and (b - g) > 70


def main():
    raw, out = sys.argv[1], sys.argv[2]
    box = int(sys.argv[sys.argv.index('--box') + 1]) if '--box' in sys.argv else 136
    img = Image.open(raw).convert('RGBA')
    px = img.load()
    w, h = img.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    n_mag = sum(1 for c in corners if is_magenta(c))
    if n_mag < 3:
        print(f"WARN {raw}: nur {n_mag}/4 Ecken magenta — Prompt prüfen!")
    for y in range(h):
        for x in range(w):
            if is_magenta(px[x, y]):
                c = px[x, y]
                px[x, y] = (c[0], c[1], c[2], 0)
    # 1px-Erosion gegen Magenta-Fringe
    a = img.getchannel('A').filter(ImageFilter.MinFilter(3))
    img.putalpha(a)
    bbox = img.getchannel('A').getbbox()
    if not bbox:
        print(f"ERROR {raw}: nichts übrig nach Key")
        sys.exit(1)
    img = img.crop(bbox)
    fill = (bbox[2] - bbox[0]) / w
    img.thumbnail((box, box), Image.LANCZOS)
    img.save(out, 'PNG')
    alpha = img.getchannel('A').histogram()
    transparent = sum(alpha[:8]) / (img.width * img.height)
    print(f"OK {out} {img.width}x{img.height} fill={fill:.0%} transparent={transparent:.0%}")


if __name__ == '__main__':
    main()
