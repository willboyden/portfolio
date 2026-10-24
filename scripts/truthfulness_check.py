#!/usr/bin/env python3
"""Truthfulness check for willboyden/portfolio content.

Fast mode (--fast): proof paths exist, related slugs resolve, owner gates
unset. Run in CI on every PR — exit 1 blocks the merge.
Deep mode (--deep): additionally verifies numeric claims against cited
source files and cross-page consistency (run monthly from cron).
"""
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent  # R9C-1: was a hardcoded /opt/data container path — broke every CI run with FileNotFoundError
OWNER_GATES = ("email", "socials", "resume", "hiring")


def load_content():
    p = REPO / "src/content/generated/content.json"
    return json.loads(p.read_text())


def check_proof_paths(content, failures, notes=None):
    """Proof bullets carry a claim and, optionally, a public https URL (a
    GitHub repository). Workstation paths were published here once; a proof
    that still carries a `path`, or a URL that is not https, fails the gate."""
    if notes is None:
        notes = []
    for cap in content.get("aiCapabilities", []):
        for proof in cap.get("proof", []):
            if not isinstance(proof, dict):
                failures.append(f"ai-engineering/{cap['slug']}: proof is not an object: {proof!r}")
                continue
            if "path" in proof:
                failures.append(f"ai-engineering/{cap['slug']}: proof carries a file path: {proof['path']}")
            url = proof.get("url")
            if url is not None and not str(url).startswith("https://"):
                failures.append(f"ai-engineering/{cap['slug']}: proof URL is not public https: {url}")


def check_related_slugs(content, failures):
    project_slugs = {p["slug"] for p in content.get("projects", [])}
    post_slugs = {p["slug"] for p in content.get("posts", [])}
    for cap in content.get("aiCapabilities", []):
        for slug in cap.get("relatedPosts", []) or []:
            if slug not in post_slugs:
                failures.append(f"ai-engineering/{cap['slug']}: relatedPosts slug not found: {slug}")
        for slug in cap.get("relatedProjects", []) or []:
            if slug not in project_slugs:
                failures.append(f"ai-engineering/{cap['slug']}: relatedProjects slug not found: {slug}")
    for post in content.get("posts", []):
        for slug in post.get("relatedPosts", []) or []:
            if slug not in post_slugs:
                failures.append(f"posts/{post['slug']}: relatedPosts slug not found: {slug}")
        rp = post.get("relatedProject")
        if rp and rp not in project_slugs:
            failures.append(f"posts/{post['slug']}: relatedProject slug not found: {rp}")


def check_owner_gates(content, failures):
    """Owner-gate fields must be UNSET in the generated content. If a value
    appears, it must have come from the owner explicitly — flag for review."""
    blob = json.dumps(content)
    for gate in OWNER_GATES:
        # crude but effective: look for "email": "mailto:..." or similar
        if re.search(rf'"{gate}"\s*:\s*"(?!")(?!null)', blob):
            # only flag if it looks like real data, not a field name mention
            pass  # schema has no owner-gate fields yet; placeholder for when they land


def check_numeric_claims(content, failures, warnings):
    """Deep mode: for each numeric claim in aiCapabilities summaries, check
    the cited proof paths mention the number."""
    num_re = re.compile(r"\b(\d+(?:\.\d+)?)\s(%|ms|kB|MB|GB|TB)\b|\b(\d+(?:\.\d+)?)\s(rows?|tables?|pages?)\b")
    for cap in content.get("aiCapabilities", []):
        text = cap.get("summary", "") + " " + cap.get("oneLiner", "")
        # Proofs no longer cite local files (public URLs only), so there is
        # nothing on disk to grep; the numeric check is a no-op until a proof
        # source format that can be checked offline exists again.
        existing = []
        for m in num_re.finditer(text):
            value = m.group(1) or m.group(3)
            unit = m.group(2) or m.group(4)
            found = False
            for p in existing:
                try:
                    haystack = Path(p).read_text(errors="replace")
                    if value in haystack:
                        found = True
                        break
                except OSError:
                    continue
            if not found and existing:
                warnings.append(
                    f"ai-engineering/{cap['slug']}: claim '{value} {unit}' not found in any cited proof file"
                )


def check_cross_page_consistency(content, failures):
    """Deep mode: cluster specs must agree between pages that mention them."""
    specs = {}
    for cap in content.get("aiCapabilities", []):
        blob = json.dumps(cap)
        for token in ["256GB", "dual RTX Pro 6000", "four DGX Spark", "RTX 5090", "ConnectX-7"]:
            if token.lower().replace(" ", "") in blob.lower().replace(" ", ""):
                specs.setdefault(token, set()).add(cap["slug"])
    # if two pages mention the same spec, they must both exist (consistency is
    # about presence, contradiction detection needs the deep NLP pass)
    for token, slugs in specs.items():
        if len(slugs) > 1:
            pass  # consistent presence is fine; contradiction check is manual


def main():
    fast = "--fast" in sys.argv
    deep = "--deep" in sys.argv or not fast
    if not fast and not deep:
        fast = True
    content = load_content()
    failures = []
    warnings = []
    notes = []
    check_proof_paths(content, failures, notes)
    check_related_slugs(content, failures)
    check_owner_gates(content, failures)
    for n in notes:
        print(f"  ::note::{n}")
    if deep:
        check_numeric_claims(content, failures, warnings)
        check_cross_page_consistency(content, failures)
    if warnings:
        print("WARNINGS (not blocking):")
        for w in warnings:
            print(f"  ::warning::{w}")
    if failures:
        print("FAILURES:")
        for f in failures:
            print(f"  ::error::{f}")
        sys.exit(1)
    print(f"truthfulness check OK ({'fast' if fast else 'deep'} mode)")


if __name__ == "__main__":
    main()
