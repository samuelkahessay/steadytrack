#!/usr/bin/env python3
"""
Structure PDFs into coherent Markdown + hierarchical JSON with headings, sections, and an extracted Table of Contents.

Outputs per document under --out-dir (default data/structured/<stem>/):
  - doc.json        : hierarchical sections with titles, level, page ranges, body
  - doc.md          : Markdown with proper # headings and paragraphs
  - toc.json        : parsed table of contents entries if detected

Heuristics:
  - Uses pdfplumber (pdfminer.six) to read characters and font sizes
  - Detects repeated headers/footers by normalized strings in page top/bottom 10%
  - Groups characters into lines, sorts into reading order (one or two columns)
  - Heading detection via font size tiers, bold font names, short line length, and numbering patterns
  - Builds a section tree via a level stack; assigns page ranges based on heading positions

Install deps before running:
  pip install pdfplumber
"""

import argparse
import json
import math
import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def normalize_for_repeat(s: str) -> str:
    s = s.lower()
    s = re.sub(r"\d+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def clean_text(s: str) -> str:
    s = s.replace("\u00AD", "")  # soft hyphen
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_bold(fontname: str) -> bool:
    fn = fontname.lower()
    return "bold" in fn or "black" in fn or "heavy" in fn


@dataclass
class Line:
    page: int
    y: float
    x0: float
    x1: float
    size_med: float
    is_bold: bool
    text: str

    @property
    def center(self) -> float:
        return (self.x0 + self.x1) / 2.0


@dataclass
class Section:
    title: str
    level: int
    page_start: int
    page_end: Optional[int] = None
    body: List[str] = field(default_factory=list)
    children: List["Section"] = field(default_factory=list)


def detect_header_footer(pl_pages: list) -> Tuple[Optional[str], Optional[str]]:
    # Use page.chars y positions to collect text in top/bottom 10%
    top_norms: List[str] = []
    bot_norms: List[str] = []
    for p in pl_pages:
        h = float(p.height)
        top_y = h * 0.10
        bot_y = h * 0.90
        top_chars = [c.get("text", "") for c in (p.chars or []) if float(c.get("top", 0.0)) < top_y]
        bot_chars = [c.get("text", "") for c in (p.chars or []) if float(c.get("top", 0.0)) > bot_y]
        top_norms.append(normalize_for_repeat("".join(top_chars)))
        bot_norms.append(normalize_for_repeat("".join(bot_chars)))

    def common(arr: List[str]) -> Optional[str]:
        arr = [a for a in arr if a]
        if not arr:
            return None
        freq: Dict[str, int] = {}
        for a in arr:
            freq[a] = freq.get(a, 0) + 1
        best, cnt = max(freq.items(), key=lambda kv: kv[1])
        if cnt / max(1, len(arr)) >= 0.6 and len(best) >= 6:
            return best
        return None

    return common(top_norms), common(bot_norms)


def group_chars_into_lines(page) -> List[Line]:
    chars = page.chars or []
    if not chars:
        return []

    # Cluster characters into lines by y with tolerance
    items = [
        (
            float(c.get("top", 0.0)),
            float(c.get("x0", 0.0)),
            float(c.get("x1", 0.0)),
            float(c.get("size", 0.0)),
            c.get("fontname", ""),
            c.get("text", ""),
        )
        for c in chars
    ]
    items.sort(key=lambda t: (round(t[0], 1), t[1]))

    lines: List[Line] = []
    current_y = None
    buff: List[Tuple[float, float, float, float, str, str]] = []

    def flush():
        nonlocal buff
        if not buff:
            return
        y_vals = [b[0] for b in buff]
        x0 = min(b[1] for b in buff)
        x1 = max(b[2] for b in buff)
        size_med = statistics.median(b[3] for b in buff)
        bold = any(is_bold(b[4]) for b in buff)
        text = clean_text("".join(b[5] for b in buff))
        # Drop ultra-short noise lines that are a single glyph and not a digit/letter
        if text and not re.fullmatch(r"\W", text):
            lines.append(Line(page=page.page_number, y=min(y_vals), x0=x0, x1=x1, size_med=size_med, is_bold=bold, text=text))
        buff = []

    for item in items:
        y = round(item[0], 1)
        if current_y is None:
            current_y = y
        if abs(y - current_y) > 0.5:
            flush()
            current_y = y
        buff.append(item)
    flush()
    return lines


def sort_lines_reading_order(lines: List[Line], page_width: float) -> List[Line]:
    if not lines:
        return lines
    # Split into left/right based on center and width
    left = [ln for ln in lines if ln.center < page_width * 0.5]
    right = [ln for ln in lines if ln.center >= page_width * 0.5]
    two_cols = len(left) >= 8 and len(right) >= 8
    if two_cols:
        return sorted(left, key=lambda l: (l.y, l.x0)) + sorted(right, key=lambda l: (l.y, l.x0))
    return sorted(lines, key=lambda l: (l.y, l.x0))


def detect_heading_levels(lines: List[Line], body_size: float) -> List[int]:
    # Determine size tiers among candidate heading lines to assign levels
    # Larger font -> higher level heading
    sizes = sorted({round(l.size_med, 1) for l in lines})
    sizes_desc = list(reversed(sizes))
    size_to_rank = {s: i for i, s in enumerate(sizes_desc)}
    levels = []
    for l in lines:
        rank = size_to_rank.get(round(l.size_med, 1), 0)
        # Cap level depth to 4; ensure H1 is at least level 1
        level = min(4, rank + 1)
        # Edge: if size only slightly above body and not bold, push to deeper level
        if l.size_med < body_size * 1.25 and not l.is_bold:
            level = min(4, level + 1)
        levels.append(level)
    return levels


HEADING_RE = re.compile(r"^(chapter|unit|lesson|part|section)\b\s*\d+|^\d+(?:\.\d+)*\b", re.I)


def is_heading_candidate(line: Line, body_size: float) -> bool:
    txt = line.text
    if not txt or len(txt) > 120:
        return False
    # Avoid obvious noise like page numbers
    if re.fullmatch(r"\d{1,4}", txt):
        return False
    # Require a minimum text length or numbering cue
    words = txt.split()
    word_count = len(words)
    has_words = (word_count >= 2) and (len(txt) >= 6)
    # Punctuation density filter (to avoid full sentences)
    punc = sum(1 for ch in txt if ch in ",.;:!?·••·…")
    if len(txt) > 0 and (punc / len(txt)) > 0.2:
        return False
    # Size thresholds
    large = line.size_med >= body_size * 1.35
    boldish = line.is_bold and line.size_med >= body_size * 1.18
    numbered = bool(HEADING_RE.search(txt))
    # Title-like heuristic: most words capitalized or all-caps
    cap_words = sum(1 for w in words if (w[:1].isupper() and not w.isupper()) or w.isupper())
    title_like = (txt.isupper() or (has_words and (cap_words / max(1, word_count) >= 0.6)))
    has_no_period = not txt.endswith(".")
    # Strengthen filter: need size clue OR numbering; and sensible wordiness
    if numbered and has_no_period and word_count <= 16:
        return True
    return ((large or boldish) and has_no_period and title_like and has_words and word_count <= 12)


def build_structure(pl_pages, rep_head: Optional[str], rep_foot: Optional[str], verbose: bool = False) -> Tuple[Section, List[Dict]]:
    # Compute body font baseline from all characters
    all_sizes = [float(c.get("size", 0.0)) for p in pl_pages for c in (p.chars or []) if c.get("text", "").strip()]
    body_size = statistics.median(all_sizes) if all_sizes else 10.0
    if verbose:
        print(f"  Body size baseline: {body_size:.2f}")

    # Collect lines in reading order per page
    page_lines: Dict[int, List[Line]] = {}
    for p in pl_pages:
        ls = group_chars_into_lines(p)
        # filter header/footer repeating strings
        top = float(p.height) * 0.10
        bot = float(p.height) * 0.90
        filtered: List[Line] = []
        for ln in ls:
            if ln.y < top and rep_head and normalize_for_repeat(ln.text).startswith(rep_head[:40]):
                continue
            if ln.y > bot and rep_foot and normalize_for_repeat(ln.text).startswith(rep_foot[:40]):
                continue
            filtered.append(ln)
        page_lines[p.page_number] = sort_lines_reading_order(filtered, float(p.width))

    # Identify heading candidates
    candidates: List[Tuple[int, Line]] = []
    for pn, ls in page_lines.items():
        for ln in ls:
            if is_heading_candidate(ln, body_size):
                candidates.append((pn, ln))

    # Assign levels
    heading_lines = [ln for _, ln in candidates]
    heading_levels = detect_heading_levels(heading_lines, body_size) if heading_lines else []
    headings: List[Tuple[int, Line, int]] = []
    for (pn, ln), lvl in zip(candidates, heading_levels):
        headings.append((pn, ln, lvl))

    if verbose:
        print(f"  Detected {len(headings)} heading candidates")

    # Build hierarchical section tree
    root = Section(title="ROOT", level=0, page_start=1)
    stack: List[Section] = [root]
    # Iterate through pages and lines, starting new sections on headings
    for pn in sorted(page_lines.keys()):
        ls = page_lines[pn]
        i = 0
        while i < len(ls):
            ln = ls[i]
            # Is this line a heading?
            lvl = None
            for (hp, hln, hlvl) in headings:
                if hp == pn and hln is ln:
                    lvl = hlvl
                    break
            if lvl is not None:
                # Close sections with level >= lvl
                while stack and stack[-1].level >= lvl:
                    sec = stack.pop()
                    if sec.page_end is None:
                        sec.page_end = pn if pn >= sec.page_start else sec.page_start
                sec = Section(title=ln.text.strip(), level=lvl, page_start=pn)
                if stack:
                    stack[-1].children.append(sec)
                stack.append(sec)
                if verbose:
                    print(f"    H{lvl} @p{pn}: {ln.text[:80]}")
            else:
                # Body text line; append to current section
                if stack:
                    stack[-1].body.append(ln.text)
            i += 1

    # Close remaining sections
    last_page = max(page_lines.keys()) if page_lines else 1
    while stack:
        sec = stack.pop()
        if sec.page_end is None:
            sec.page_end = last_page if sec is not root else last_page

    # Flatten ToC-like quick view
    flat: List[Dict] = []
    def walk(s: Section):
        if s is not root:
            flat.append({
                "title": s.title,
                "level": s.level,
                "page_start": s.page_start,
                "page_end": s.page_end,
                "char_count": sum(len(p) for p in s.body),
            })
        for c in s.children:
            walk(c)
    walk(root)
    return root, flat


def section_to_markdown(sec: Section) -> str:
    parts: List[str] = []
    def emit(s: Section):
        if s.level > 0:
            lvl = max(1, min(6, s.level))
            parts.append("#" * lvl + " " + s.title)
            if s.body:
                parts.append("\n".join(s.body))
        for c in s.children:
            emit(c)
    emit(sec)
    return "\n\n".join(parts) + ("\n" if parts else "")


def extract_toc(pl_pages, verbose: bool = False) -> List[Dict]:
    # Search first ~12 pages for a Table of Contents
    toc_pages = pl_pages[: min(12, len(pl_pages))]
    entries: List[Dict] = []
    found_header = False
    for p in toc_pages:
        lines = group_chars_into_lines(p)
        for ln in lines:
            t = ln.text.strip()
            if not found_header and re.search(r"\b(table of contents|contents)\b", t, re.I):
                found_header = True
                if verbose:
                    print(f"  Found TOC header on page {p.page_number}")
            if not found_header:
                continue
            # Try to parse entries like: Title .... 12
            m = re.match(r"^(.+?)(?:\.{3,}|·{3,}|\s{4,})(\d{1,4})$", t)
            if m:
                title = clean_text(m.group(1))
                page = int(m.group(2))
                if title:
                    entries.append({"title": title, "page": page})
                continue
            # Fallback: line ends with number
            m2 = re.match(r"^(.+?)\s+(\d{1,4})$", t)
            if m2 and len(t) > 8:
                title = clean_text(m2.group(1))
                page = int(m2.group(2))
                entries.append({"title": title, "page": page})
    if verbose:
        print(f"  TOC entries: {len(entries)}")
    return entries


def process_one(pdf_path: Path, out_dir: Path, verbose: bool = True) -> None:
    import pdfplumber  # type: ignore
    if verbose:
        print(f"Processing: {pdf_path.name}")
    with pdfplumber.open(str(pdf_path)) as pdf:
        pages = list(pdf.pages)
        rep_head, rep_foot = detect_header_footer(pages)
        if verbose:
            print(f"  Repeating header: {'yes' if rep_head else 'no'}; footer: {'yes' if rep_foot else 'no'}")
        toc = extract_toc(pages, verbose=verbose)
        root, flat = build_structure(pages, rep_head, rep_foot, verbose=verbose)

    # Emit outputs
    out_dir.mkdir(parents=True, exist_ok=True)
    # Hierarchical JSON
    def section_to_dict(s: Section) -> Dict:
        return {
            "title": s.title,
            "level": s.level,
            "page_start": s.page_start,
            "page_end": s.page_end,
            "body": s.body,
            "children": [section_to_dict(c) for c in s.children],
        }
    (out_dir / "doc.json").write_text(json.dumps(section_to_dict(root), indent=2), encoding="utf-8")
    # Flat summary
    (out_dir / "flat.json").write_text(json.dumps(flat, indent=2), encoding="utf-8")
    # Markdown
    (out_dir / "doc.md").write_text(section_to_markdown(root), encoding="utf-8")
    # TOC
    (out_dir / "toc.json").write_text(json.dumps(toc, indent=2), encoding="utf-8")
    if verbose:
        print(f"  Wrote: {out_dir/'doc.json'}")
        print(f"  Wrote: {out_dir/'doc.md'}")
        print(f"  Wrote: {out_dir/'toc.json'} ({len(toc)} entries)")


def main():
    parser = argparse.ArgumentParser(description="Structure PDFs into headings/sections/ToC (Markdown + JSON)")
    parser.add_argument("--books-dir", default="data/sources/books")
    parser.add_argument("--out-dir", default="data/structured")
    parser.add_argument("--docs", nargs="*", help="Specific filenames to process; if empty, process all PDFs")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    books_dir = Path(args.books_dir)
    out_root = Path(args.out_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    if args.docs:
        docs = args.docs
    else:
        docs = [p.name for p in sorted(books_dir.glob("*.pdf"))]

    print(f"Selected {len(docs)} document(s)")
    for i, name in enumerate(docs, 1):
        pdf_path = books_dir / name
        if not pdf_path.exists():
            print(f"[!] Missing: {pdf_path}")
            continue
        print(f"\n[{i}/{len(docs)}] {name}")
        out_dir = out_root / pdf_path.stem
        try:
            process_one(pdf_path, out_dir, verbose=args.verbose)
        except Exception as e:
            print(f"  !! Failed: {e}")


if __name__ == "__main__":
    main()
