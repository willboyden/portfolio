#!/usr/bin/env python3
"""R7-C readability estimator (read-only scratch tool, lives under reviews/).

Flesch Reading Ease, Flesch-Kincaid Grade, Gunning Fog for content markdown
and prerendered page visible text. Simple vowel-group syllable heuristic,
applied consistently across all files so comparisons are fair.
"""
import re
import sys
import glob
import os

VOWELS = "aeiouy"


def syllables(word: str) -> int:
    w = word.lower().strip(".,;:!?()[]{}\"'`—–-")
    if not w:
        return 0
    groups = 0
    prev_vowel = False
    for ch in w:
        is_v = ch in VOWELS
        if is_v and not prev_vowel:
            groups += 1
        prev_vowel = is_v
    if w.endswith("e") and groups > 1 and not w.endswith(("le", "ee", "ye")):
        groups -= 1
    return max(1, groups)


def analyze(name: str, text: str, keep_frontmatter: bool = False) -> dict:
    t = text
    if not keep_frontmatter:
        t = re.sub(r"\A---\n.*?\n---\n", "", t, flags=re.S)
    t = re.sub(r"```.*?```", " CODEBLOCK ", t, flags=re.S)
    t = re.sub(r"`[^`]+`", " CODE ", t)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[#*_>|]", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&[a-z]+;|&#\d+;", " ", t)
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", t) if len(s.strip()) > 2]
    words = re.findall(r"[A-Za-z][A-Za-z'\-]*", t)
    if not sentences or not words:
        return {"name": name, "error": "empty"}
    n_sent, n_words = len(sentences), len(words)
    n_syll = sum(syllables(w) for w in words)
    wps = n_words / n_sent
    spw = n_syll / n_words
    fre = 206.835 - 1.015 * wps - 84.6 * spw
    fk = 0.39 * wps + 11.8 * spw - 15.59
    fog = 0.4 * (wps + 100 * (sum(1 for w in words if syllables(w) >= 3) / n_words))
    complex_pct = 100 * sum(1 for w in words if syllables(w) >= 3) / n_words
    long_sents = sum(
        1 for s in sentences if len(re.findall(r"[A-Za-z][A-Za-z'\-]*", s)) > 25
    )
    return {
        "name": name,
        "words": n_words,
        "sentences": n_sent,
        "wps": round(wps, 1),
        "fre": round(fre, 1),
        "fk": round(fk, 1),
        "fog": round(fog, 1),
        "complex_pct": round(complex_pct, 1),
        "long_sents": long_sents,
    }


def visible_text(html: str) -> str:
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<head>.*?</head>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return t


def main() -> None:
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    rows = []
    for f in sorted(glob.glob(os.path.join(root, "content/posts/*.md"))):
        rows.append(analyze(os.path.basename(f), open(f, encoding="utf-8").read()))
    for f in sorted(glob.glob(os.path.join(root, "content/projects/*.md"))):
        rows.append(
            analyze(os.path.basename(f) + " (frontmatter)", open(f, encoding="utf-8").read(), keep_frontmatter=True)
        )
    for page in ["index", "about", "now", "contact", "projects", "writing"]:
        p = os.path.join(root, "dist", page, "index.html")
        if page == "index":
            p = os.path.join(root, "dist", "index.html")
        if not os.path.exists(p):
            continue
        rows.append(analyze(f"dist/{page} (visible)", visible_text(open(p, encoding="utf-8").read())))

    hdr = f"{'file':44s} {'words':>6s} {'sents':>6s} {'w/sent':>6s} {'FRE':>6s} {'FK':>5s} {'Fog':>5s} {'cplx%':>6s} {'>25w':>5s}"
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        if "error" in r:
            print(f"{r['name']:44s} {r['error']}")
            continue
        print(
            f"{r['name'][:44]:44s} {r['words']:6d} {r['sentences']:6d} {r['wps']:6.1f} "
            f"{r['fre']:6.1f} {r['fk']:5.1f} {r['fog']:5.1f} {r['complex_pct']:6.1f} {r['long_sents']:5d}"
        )


if __name__ == "__main__":
    main()
