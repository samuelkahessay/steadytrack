#!/usr/bin/env python3
"""
Extract 'Table of Correlations' style mappings from cleaned/extracted docs.
Outputs per doc: data/alignment/correlations/<doc-stem>.json with entries:
  { code: "2.2.1.a", pages: [44, 55, 60] }

Heuristics:
  - Scans data/extracted/<doc>/full.md first, then falls back to data/clean/<doc>/doc_clean.md
  - Looks for lines that contain outcome codes like:
      - 2.2.1.a / 2.1.3.c (English style)
      - 30-A1.1k / 30-A1 (Biology style)
  - Aggregates page numbers present on same/nearby lines.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple


EXTRACTED = Path("data/extracted")
CLEAN = Path("data/clean")
OUT = Path("data/alignment/correlations")

# Patterns to detect codes and pages
# Codes like 2.2.1 or 2.2.1.a (no leading zeroes), and 30-A1(.1k)
CODE_PATTERNS = [
    re.compile(r"\b(?:[1-9]\d?)(?:\.(?:[1-9]\d?)){1,3}(?:\.[a-z])?\b"),
    re.compile(r"\b\d{2}-[A-Z]\d(?:\.(?:\d+[a-z]?))?\b"),
]
PAGES_RE = re.compile(r"\b(\d{1,3})\b")


def load_lines(doc_stem: str) -> List[str]:
    # prefer full.md (richer raw text), else cleaned markdown
    full = EXTRACTED / doc_stem / "full.md"
    if full.exists():
        return full.read_text(encoding="utf-8", errors="ignore").splitlines()
    clean = CLEAN / doc_stem / "doc_clean.md"
    if clean.exists():
        return clean.read_text(encoding="utf-8", errors="ignore").splitlines()
    return []


def extract_for_doc(doc_stem: str) -> List[Dict[str, object]]:
    lines = load_lines(doc_stem)
    if not lines:
        return []
    # find candidate regions (look for lines with 'TABLE OF CORRELATIONS' or many codes)
    # We will simply scan whole file and aggregate codes with any page numbers on same/next lines.
    entries: Dict[str, set] = {}
    for i, line in enumerate(lines):
        codes: List[str] = []
        for pat in CODE_PATTERNS:
            codes += pat.findall(line)
        if not codes:
            continue
        # gather pages from this line and the next 2 lines
        pages = set()
        for j in range(i, min(i + 3, len(lines))):
            for m in PAGES_RE.findall(lines[j]):
                try:
                    n = int(m)
                    # guard against common non-page small numbers (e.g., 1-2 letter counts)
                    if 1 <= n <= 800:  # typical page range for these books
                        pages.add(n)
                except Exception:
                    pass
        for code in codes:
            entries.setdefault(code, set()).update(pages)

    result = [
        {"code": code, "pages": sorted(list(pages))}
        for code, pages in sorted(entries.items()) if pages
    ]
    return result


def main():
    parser = argparse.ArgumentParser(description="Extract correlation mappings from docs")
    parser.add_argument("--docs", nargs="*", help="Doc stems to process; default all extracted")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    stems = args.docs or [p.name for p in EXTRACTED.iterdir() if p.is_dir()]
    for i, stem in enumerate(sorted(stems), 1):
        print(f"[{i}/{len(stems)}] {stem}")
        entries = extract_for_doc(stem)
        (OUT / f"{stem}.json").write_text(json.dumps(entries, indent=2), encoding="utf-8")
        print(f"  -> {len(entries)} entries")


if __name__ == "__main__":
    main()
