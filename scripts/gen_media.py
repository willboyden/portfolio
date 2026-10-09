#!/usr/bin/env python3
"""Generate OG/social images (1200x630 PNG) with the site's visual identity.

Usage:
  python3 scripts/gen_media.py                 # default OG card + hero variants
  python3 scripts/gen_media.py --title "X" --out public/og/x.png   # one card

Identity: deep-space bg #0b0e14, violet accent #7c5cff (peak of the mark),
green status dot, big confident type. Uses system DejaVu (offline-safe).
"""
from __future__ import annotations

import argparse
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
# Canonical assets live in public/ so vite copies them into dist/ (dist is
# wiped on every build).
OUT = ROOT / "public"

BG = (11, 14, 20)
INK = (238, 241, 248)
MUTED = (154, 165, 187)
ACCENT = (124, 92, 255)
GREEN = (74, 222, 128)
GRID = (22, 27, 38)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def grid(draw: ImageDraw.ImageDraw) -> None:
    for x in range(0, 1200, 60):
        draw.line((x, 0, x, 630), fill=GRID, width=1)
    for y in range(0, 630, 60):
        draw.line((0, y, 1200, y), fill=GRID, width=1)


def spark(draw: ImageDraw.ImageDraw, origin=(860, 300), scale=1.0) -> None:
    """The logo mark, blown up: M14 44 L26 20 L32 32 L38 20 L50 44."""
    pts = [(14, 44), (26, 20), (32, 32), (38, 20), (50, 44)]
    ox, oy = origin
    pts = [(ox + (x - 32) * scale * 3, oy + (y - 32) * scale * 3) for x, y in pts]
    draw.line(pts, fill=ACCENT, width=max(4, int(14 * scale)), joint="curve")
    cx, cy = pts[-1]
    r = max(6, int(9 * scale))
    draw.ellipse((cx - r, cy + 12 * scale - r, cx + r, cy + 12 * scale + r), fill=GREEN)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int, max_lines: int = 4) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    return lines


def card(title: str, subtitle: str, kicker: str, out: Path) -> Path:
    img = Image.new("RGB", (1200, 630), BG)
    draw = ImageDraw.Draw(img)
    grid(draw)
    # logo lives bottom-right in its own zone — verified clear of text
    # (first pass overlapped the headline; fixed per vision review)
    spark(draw, origin=(1020, 540), scale=1.6)

    # accent rule
    draw.rectangle((80, 84, 150, 90), fill=ACCENT)

    k = font(FONT_MONO, 28)
    draw.text((80, 118), kicker.upper(), font=k, fill=(190, 198, 214))

    big = font(FONT_BOLD, 72)
    y = 190
    for line in wrap(draw, title, big, 980, max_lines=3):
        draw.text((80, y), line, font=big, fill=INK)
        y += 88

    sub = font(FONT_REG, 34)
    y += 18
    for line in wrap(draw, subtitle, sub, 920, max_lines=2):
        draw.text((80, y), line, font=sub, fill=(203, 210, 224))
        y += 48

    # footer strip (kept left of the logo zone)
    f = font(FONT_MONO, 24)
    draw.text((80, 560), "alexrivera.dev  —  consulting · engineering · data", font=f, fill=(120, 130, 152))

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default="William Boyden — Technical Consultant")
    ap.add_argument("--subtitle", default="Full-stack engineering and data science for teams that ship.")
    ap.add_argument("--kicker", default="portfolio")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    written = []
    if not args.out:
        # default set: home card + a per-section card
        written.append(card(args.title, args.subtitle, "portfolio", OUT / "og-default.png"))
        written.append(card("Selected work", "Systems I designed, shipped, and stood behind.", "projects", OUT / "og" / "projects.png"))
        written.append(card("Writing", "Field notes from consulting engagements and the tools behind them.", "writing", OUT / "og" / "writing.png"))
    else:
        written.append(card(args.title, args.subtitle, args.kicker, Path(args.out)))

    for p in written:
        print(f"wrote {p} ({p.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
