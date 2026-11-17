#!/usr/bin/env python3
"""Generate the site's share images and touch icon in its own visual identity.

Usage:
  python3 scripts/gen_media.py                 # the default set (see DEFAULT_SET)
  python3 scripts/gen_media.py --title "X" --subtitle "Y" --kicker writing --out public/og/x.png

Identity (README "Design: a lab notebook, typeset"): paper, ink and one
highlighter, set in IBM Plex. The colours are the Paper theme's
(src/theme/tokens.ts: lightTheme) and the type is read straight from the
site's own font files in public/fonts/, so a card looks like the page it
links to. Needs Pillow built with WOFF2 support (the published wheels are).

The name and the address printed on every card are NAME and ADDRESS below;
src/media.test.ts pins the name against the site's own configuration, so a
card can never again go out under a placeholder.

public/favicon.svg is not drawn here: it is a static file, the same mark cut
down to what survives at 16 pixels: the W, as an outline, on the highlighter.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
# Canonical assets live in public/ so vite copies them into dist/ (dist is
# wiped on every build).
OUT = ROOT / "public"
FONTS = OUT / "fonts"

NAME = "William Boyden"
ADDRESS = "willboyden.github.io/portfolio"
MONOGRAM = "WB"

# The Paper theme (src/theme/tokens.ts: lightTheme).
PAPER = (251, 251, 249)  # color.bg        #fbfbf9
INK = (22, 22, 26)  # color.text      #16161a
MUTED = (74, 74, 69)  # color.textMuted #4a4a45
MARK = (255, 214, 10)  # color.mark      #ffd60a
HAIRLINE = (220, 218, 210)  # color.border    #dcdad2

SERIF_SEMIBOLD = FONTS / "IBMPlexSerif-SemiBold-Latin1.woff2"
SERIF = FONTS / "IBMPlexSerif-Regular-Latin1.woff2"
SANS_SEMIBOLD = FONTS / "IBMPlexSans-SemiBold-Latin1.woff2"
MONO = FONTS / "IBMPlexMono-Regular-Latin1.woff2"

WIDTH, HEIGHT = 1200, 630
MARGIN = 80


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int, max_lines: int) -> list[str]:
    """Greedy word wrap. Stops the run if the text does not fit: a card with
    its title cut off is worse than no card."""
    lines: list[str] = []
    current = ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        raise SystemExit(f"gen_media: {text!r} needs {len(lines)} lines, the card has room for {max_lines}")
    return lines


def monogram(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], size: int) -> None:
    """The site's mark: the two initials in ink on a block of highlighter."""
    draw.rectangle(box, fill=MARK)
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    draw.text((cx, cy), MONOGRAM, font=font(SERIF_SEMIBOLD, size), fill=INK, anchor="mm")


def card(title: str, subtitle: str, kicker: str, out: Path, mark: str = "") -> Path:
    """One 1200x630 share card. `mark` is a phrase of the title to run the
    highlighter behind (it must sit on one line)."""
    img = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(img)

    # Header: the mark and the name, then a full-width ink rule.
    monogram(draw, (MARGIN, 60, MARGIN + 68, 128), 32)
    draw.text((MARGIN + 88, 94), NAME, font=font(SANS_SEMIBOLD, 30), fill=INK, anchor="lm")
    draw.text((WIDTH - MARGIN, 94), kicker, font=font(MONO, 24), fill=MUTED, anchor="rm")
    draw.rectangle((MARGIN, 152, WIDTH - MARGIN, 154), fill=INK)

    # Title: serif, ink, with one phrase highlighted.
    lines = wrap(draw, title, font(SERIF_SEMIBOLD, 70), WIDTH - 2 * MARGIN, max_lines=3)
    big = font(SERIF_SEMIBOLD, 70)
    line_height = 88
    y = 190
    marked = False
    for line in lines:
        if mark and mark in line:
            before = line[: line.index(mark)]
            x0 = MARGIN + draw.textlength(before, font=big)
            x1 = x0 + draw.textlength(mark, font=big)
            draw.rectangle((x0 - 8, y + 14, x1 + 8, y + line_height - 2), fill=MARK)
            marked = True
        draw.text((MARGIN, y), line, font=big, fill=INK)
        y += line_height
    if mark and not marked:
        raise SystemExit(f"gen_media: the phrase to highlight, {mark!r}, is not on one line of {title!r}")

    # Standfirst.
    sub = font(SERIF, 32)
    y += 16
    for line in wrap(draw, subtitle, sub, WIDTH - 2 * MARGIN - 40, max_lines=2):
        draw.text((MARGIN, y), line, font=sub, fill=MUTED)
        y += 46
    if y > 536:
        raise SystemExit(f"gen_media: {title!r} and its standfirst run into the footer (y={y})")

    # Footer: a hairline and the address, as data.
    draw.rectangle((MARGIN, 546, WIDTH - MARGIN, 546), fill=HAIRLINE)
    draw.text((MARGIN, 580), ADDRESS, font=font(MONO, 24), fill=MUTED, anchor="lm")

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


def touch_icon(out: Path, size: int = 180) -> Path:
    """The home-screen icon: the mark, full bleed (the device rounds it)."""
    img = Image.new("RGB", (size, size), MARK)
    draw = ImageDraw.Draw(img)
    monogram(draw, (0, 0, size, size), round(size * 0.47))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


# (title, standfirst, kicker, file under public/, phrase to highlight)
DEFAULT_SET = [
    (
        "I run open-weight models on a six-machine GPU lab and publish what I measure.",
        "AI engineer and technical consultant.",
        "portfolio",
        "og-default.png",
        "publish what I measure.",
    ),
    (
        "Selected work",
        "Open-source tools built for the lab, each with its repository, its tests and the numbers that judged it.",
        "projects",
        "og/projects.png",
        "work",
    ),
    (
        "Writing",
        "Engineering and data-science notes, written for the teammate who has to maintain what I built.",
        "writing",
        "og/writing.png",
        "Writing",
    ),
    (
        "AI engineering",
        "Local inference, agent harnesses, routing and evaluation on hardware I run myself, with the measurements.",
        "ai-engineering",
        "og/ai-engineering.png",
        "engineering",
    ),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default="")
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--kicker", default="portfolio")
    ap.add_argument("--mark", default="", help="a phrase of the title to highlight")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    written = []
    if args.out:
        if not args.title:
            raise SystemExit("gen_media: --out needs --title")
        written.append(card(args.title, args.subtitle, args.kicker, Path(args.out), args.mark))
    else:
        for title, subtitle, kicker, name, mark in DEFAULT_SET:
            written.append(card(title, subtitle, kicker, OUT / name, mark))
        written.append(touch_icon(OUT / "apple-touch-icon.png"))

    for p in written:
        print(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
