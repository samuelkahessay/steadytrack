#!/usr/bin/env python3
"""
Robust, layout‑aware text extraction + chunking for top-N easiest PDFs.

Inputs:
  - --qc-csv data/qc/books_qc.csv (used to pick top N by coherence)
  - --books-dir data/sources/books

Outputs per document (under --out-dir data/extracted/<doc_stem>/):
  - chunks.jsonl   : chunked, normalized text with metadata
  - full.md        : concatenated Markdown with headings
  - meta.json      : summary metrics

Heuristics:
  - Prefers PyMuPDF; falls back to pdfplumber if needed
  - Header/footer removal via repeated text in top/bottom margins (>60% pages)
  - Multi-column reading order (simple 1 vs 2 column detection)
  - Dehyphenation across line breaks and ligature normalization
  - Heading detection via font size vs median body size and short line length
  - Chunking by headings + paragraph size (~2000 chars default), keeping page refs

Dependencies (install beforehand):
  pip install pymupdf pdfplumber
"""

import argparse
import csv
import json
import math
import os
import re
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


LIGATURES = {
    "ﬀ": "ff",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬅ": "ft",
    "ﬆ": "st",
}


def replace_ligatures(s: str) -> str:
    for k, v in LIGATURES.items():
        s = s.replace(k, v)
    return s.replace("\u00AD", "")  # soft hyphen


def norm_ws(s: str) -> str:
    # Normalize whitespace and bullets
    s = s.replace("\t", " ")
    s = re.sub(r"\r\n|\r|\n", "\n", s)
    s = re.sub(r"\xa0", " ", s)
    # Unify bullet characters to '- '
    s = re.sub(r"^[•·◦▪■]\s*", "- ", s, flags=re.MULTILINE)
    # Collapse 3+ newlines to max 2
    s = re.sub(r"\n{3,}", "\n\n", s)
    # Trim trailing spaces on lines
    s = re.sub(r"[ \t]+\n", "\n", s)
    return s.strip()


def normalize_for_repeat(s: str) -> str:
    s = s.lower()
    s = re.sub(r"\d+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def estimate_tokens(chars: int) -> int:
    # Very rough: ~4 chars per token
    return max(1, chars // 4)


@dataclass
class Span:
    text: str
    size: float
    bold: bool
    italic: bool


@dataclass
class Block:
    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1
    lines: List[str]
    spans: List[Span]

    @property
    def text(self) -> str:
        return "\n".join(self.lines)

    @property
    def x_center(self) -> float:
        x0, y0, x1, y1 = self.bbox
        return (x0 + x1) / 2.0

    @property
    def y_top(self) -> float:
        return self.bbox[1]


@dataclass
class PageExtract:
    index: int
    width: float
    height: float
    blocks: List[Block]


def try_imports():
    has_fitz = False
    has_pdfplumber = False
    try:
        import fitz  # type: ignore
        has_fitz = True
    except Exception:
        pass
    try:
        import pdfplumber  # type: ignore  # noqa: F401
        has_pdfplumber = True
    except Exception:
        pass
    return has_fitz, has_pdfplumber


def page_blocks_pymupdf(pdf_path: Path) -> Iterable[PageExtract]:
    import fitz  # type: ignore
    doc = fitz.open(pdf_path)
    try:
        for i, page in enumerate(doc):
            info = page.get_text("dict")
            blocks: List[Block] = []
            for b in info.get("blocks", []):
                if b.get("type", 0) == 1:
                    continue  # image
                bbox = tuple(map(float, b.get("bbox", [0, 0, 0, 0])))  # type: ignore
                lines: List[str] = []
                spans_meta: List[Span] = []
                for line in b.get("lines", []):
                    spans = line.get("spans", [])
                    # Join span texts per visual line
                    text = "".join(s.get("text", "") for s in spans)
                    if text:
                        lines.append(text)
                    for s in spans:
                        size = float(s.get("size", 0.0))
                        flags = int(s.get("flags", 0))
                        bold = bool(flags & 2)
                        italic = bool(flags & 1)
                        spans_meta.append(Span(text=s.get("text", ""), size=size, bold=bold, italic=italic))
                # Some blocks store direct 'text'
                if not lines:
                    t = b.get("text", "") or ""
                    if t:
                        lines = t.splitlines()
                blocks.append(Block(bbox=bbox, lines=lines, spans=spans_meta))

            yield PageExtract(index=i, width=float(page.rect.width), height=float(page.rect.height), blocks=blocks)
    finally:
        doc.close()


def page_blocks_pdfplumber(pdf_path: Path) -> Iterable[PageExtract]:
    import pdfplumber  # type: ignore
    with pdfplumber.open(str(pdf_path)) as pdf:
        for i, page in enumerate(pdf.pages):
            blocks: List[Block] = []
            words = page.extract_words() or []
            # Group words into crude lines by y0
            by_line: Dict[float, List[dict]] = {}
            for w in words:
                y0 = round(float(w.get("top", 0.0)), 1)
                by_line.setdefault(y0, []).append(w)
            lines: List[str] = []
            for y0 in sorted(by_line.keys()):
                ws = sorted(by_line[y0], key=lambda w: float(w.get("x0", 0.0)))
                lines.append(" ".join(w.get("text", "") for w in ws))
            # pdfplumber lacks font size per word by default; approximate spans empty
            blocks.append(Block(bbox=(0.0, 0.0, float(page.width), float(page.height)), lines=lines, spans=[]))
            yield PageExtract(index=i, width=float(page.width), height=float(page.height), blocks=blocks)


def detect_repeated_header_footer(pages: List[PageExtract]) -> Tuple[Optional[str], Optional[str], float, float]:
    # Collect normalized header/footer strings from top/bottom 10% of page
    top_norms: List[str] = []
    bot_norms: List[str] = []
    for pg in pages:
        top_margin = pg.height * 0.10
        bot_margin = pg.height * 0.90
        top_text = []
        bot_text = []
        for b in pg.blocks:
            x0, y0, x1, y1 = b.bbox
            bt = b.text.strip()
            if not bt:
                continue
            if y0 < top_margin:
                top_text.append(bt)
            if y1 > bot_margin:
                bot_text.append(bt)
        top_norms.append(normalize_for_repeat(" ".join(top_text)))
        bot_norms.append(normalize_for_repeat(" ".join(bot_text)))

    def most_common_nontrivial(arr: List[str]) -> Tuple[Optional[str], float]:
        arr = [a for a in arr if a]
        if not arr:
            return None, 0.0
        freq: Dict[str, int] = {}
        for a in arr:
            freq[a] = freq.get(a, 0) + 1
        best, cnt = max(freq.items(), key=lambda kv: kv[1])
        share = cnt / max(1, len(arr))
        # consider only if appears on >= 60% pages and not tiny
        if share >= 0.60 and len(best) >= 6:
            return best, share
        return None, share

    top, top_share = most_common_nontrivial(top_norms)
    bot, bot_share = most_common_nontrivial(bot_norms)
    return top, bot, top_share, bot_share


def is_heading(block: Block, body_size: float) -> bool:
    text = " ".join(block.lines).strip()
    if not text:
        return False
    # Ignore very long lines from being headings
    if len(text) > 120:
        return False
    if not block.spans:
        return False
    sizes = [s.size for s in block.spans if s.text.strip()]
    if not sizes:
        return False
    med = statistics.median(sizes)
    max_s = max(sizes)
    # Heading if noticeably larger than body
    if med >= body_size * 1.20 or max_s >= body_size * 1.25:
        return True
    # Or bold and slightly larger
    if any(s.bold for s in block.spans) and med >= body_size * 1.12:
        return True
    return False


def dehyphenate_lines(lines: List[str]) -> List[str]:
    if not lines:
        return lines
    out: List[str] = []
    for i, line in enumerate(lines):
        if i + 1 < len(lines):
            nxt = lines[i + 1]
            if line.endswith("-") and re.match(r"^[a-zA-Z].*", nxt):
                out.append(line[:-1] + nxt)
                # skip next by consuming it; mark as empty
                lines[i + 1] = ""
                continue
        out.append(line)
    return [l for l in out if l != ""]


def sort_blocks_reading_order(blocks: List[Block], width: float) -> List[Block]:
    if not blocks:
        return blocks
    # Determine columns by x-center clustering (simple left/right heuristic)
    left: List[Block] = []
    right: List[Block] = []
    for b in blocks:
        if b.x_center < width * 0.5:
            left.append(b)
        else:
            right.append(b)
    # If both sides have enough blocks and medians are well separated, assume two columns
    two_cols = len(left) >= 4 and len(right) >= 4
    if two_cols:
        left_sorted = sorted(left, key=lambda b: (b.y_top, b.x_center))
        right_sorted = sorted(right, key=lambda b: (b.y_top, b.x_center))
        return left_sorted + right_sorted
    # Single column
    return sorted(blocks, key=lambda b: (b.y_top, b.x_center))


def chunk_document(doc_name: str, pages: List[PageExtract], verbose: bool = False, max_chars: int = 2000) -> Tuple[List[dict], dict, str]:
    # Header/footer detection
    rep_head, rep_foot, head_share, foot_share = detect_repeated_header_footer(pages)
    if verbose:
        print(f"  Repeated header share={head_share:.2f}, footer share={foot_share:.2f}")
        if rep_head:
            print(f"  Header pattern: '{rep_head[:80]}'")
        if rep_foot:
            print(f"  Footer pattern: '{rep_foot[:80]}'")

    chunks: List[dict] = []
    md_parts: List[str] = [f"# {doc_name}"]
    chunk_index = 0

    # Collect body font sizes across pages for baseline
    body_sizes: List[float] = []
    for pg in pages:
        for b in pg.blocks:
            body_sizes.extend(s.size for s in b.spans if s.text.strip())
    body_size = statistics.median(body_sizes) if body_sizes else 10.0
    if verbose:
        print(f"  Estimated body font size: {body_size:.2f}")

    current_heading: Optional[str] = None
    current_pages: List[int] = []
    current_text: List[str] = []

    def flush_chunk():
        nonlocal chunk_index, current_heading, current_pages, current_text
        if not current_text:
            return
        text = norm_ws(replace_ligatures("\n".join(current_text)))
        if not text.strip():
            current_text = []
            current_pages = []
            return
        chunk_id = f"{Path(doc_name).stem}-chunk-{chunk_index:04d}"
        chunk = {
            "doc": doc_name,
            "chunk_id": chunk_id,
            "index": chunk_index,
            "pages": sorted(set(current_pages)),
            "heading": current_heading,
            "text": text,
            "char_count": len(text),
            "tokens_est": estimate_tokens(len(text)),
        }
        chunks.append(chunk)
        # Markdown
        if current_heading:
            md_parts.append(f"\n## {current_heading}\n")
        md_parts.append(text)
        if verbose:
            print(f"    Emitted chunk {chunk_index} (chars={len(text)})")
        chunk_index += 1
        current_text = []
        current_pages = []

    for pg in pages:
        top_margin = pg.height * 0.10
        bottom_margin = pg.height * 0.90
        # Sort blocks by reading order
        blocks = sort_blocks_reading_order(pg.blocks, pg.width)
        if verbose:
            print(f"  Page {pg.index+1}/{len(pages)}: blocks={len(blocks)}")

        for b in blocks:
            x0, y0, x1, y1 = b.bbox
            text_lines = dehyphenate_lines([replace_ligatures(l) for l in b.lines])
            text = "\n".join(text_lines).strip()
            if not text:
                continue
            # Header/footer removal if repeating pattern detected
            in_header = y0 < top_margin
            in_footer = y1 > bottom_margin
            if in_header and rep_head:
                if normalize_for_repeat(text).startswith(rep_head[:40]):
                    if verbose:
                        print("    Skipped header block")
                    continue
            if in_footer and rep_foot:
                if normalize_for_repeat(text).startswith(rep_foot[:40]):
                    if verbose:
                        print("    Skipped footer block")
                    continue

            # Heading detection
            if is_heading(b, body_size):
                # Flush previous chunk if any
                flush_chunk()
                current_heading = norm_ws(text)
                current_pages = [pg.index + 1]
                if verbose:
                    print(f"    Heading: '{current_heading[:80]}'")
                continue

            # Accumulate body text
            current_text.append(text)
            current_pages.append(pg.index + 1)
            # Split large chunks
            if sum(len(t) for t in current_text) >= max_chars:
                flush_chunk()

    # Final flush
    flush_chunk()

    meta = {
        "doc": doc_name,
        "pages": len(pages),
        "chunks": len(chunks),
        "body_font_size": body_size,
        "header_repeat": bool(rep_head),
        "footer_repeat": bool(rep_foot),
    }
    return chunks, meta, "\n".join(md_parts) + "\n"


def extract_one(pdf_path: Path, out_dir: Path, backend: str = "auto", verbose: bool = True, max_chars: int = 2000) -> None:
    has_fitz, has_pdfplumber = try_imports()
    if backend == "pymupdf" and not has_fitz:
        raise RuntimeError("PyMuPDF not available; install with 'pip install pymupdf'")
    if backend == "pdfplumber" and not has_pdfplumber:
        raise RuntimeError("pdfplumber not available; install with 'pip install pdfplumber'")

    if verbose:
        print(f"Processing: {pdf_path.name}")

    # Choose backend
    pages: List[PageExtract] = []
    try_order = []
    if backend == "auto":
        try_order = (["pymupdf"] if has_fitz else []) + (["pdfplumber"] if has_pdfplumber else [])
    else:
        try_order = [backend]

    for be in try_order:
        try:
            if be == "pymupdf":
                pages = list(page_blocks_pymupdf(pdf_path))
                if verbose:
                    print(f"  Backend: PyMuPDF; pages={len(pages)}")
                break
            elif be == "pdfplumber":
                pages = list(page_blocks_pdfplumber(pdf_path))
                if verbose:
                    print(f"  Backend: pdfplumber; pages={len(pages)}")
                break
        except Exception as e:
            if verbose:
                print(f"  Backend {be} failed: {e}")

    if not pages:
        raise RuntimeError("No extraction backend succeeded.")

    chunks, meta, md = chunk_document(pdf_path.name, pages, verbose=verbose, max_chars=max_chars)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "chunks.jsonl").write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in chunks) + "\n", encoding="utf-8")
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (out_dir / "full.md").write_text(md, encoding="utf-8")

    if verbose:
        print(f"  Wrote: {out_dir/'chunks.jsonl'} ({len(chunks)} chunks)")
        print(f"  Wrote: {out_dir/'meta.json'}")
        print(f"  Wrote: {out_dir/'full.md'}")


def pick_top_from_qc(qc_csv: Path, top_n: int) -> List[str]:
    rows: List[Dict[str, str]] = []
    with open(qc_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    # Sort by coherence_score desc; fallback to filename
    rows.sort(key=lambda r: (-float(r.get("coherence_score", 0.0)), r.get("filename", "")))
    return [r["filename"] for r in rows[:top_n]]


def main():
    parser = argparse.ArgumentParser(description="Extract + chunk top-N easiest PDFs with verbose logging")
    parser.add_argument("--qc-csv", default="data/qc/books_qc.csv")
    parser.add_argument("--books-dir", default="data/sources/books")
    parser.add_argument("--out-dir", default="data/extracted")
    parser.add_argument("--top-n", type=int, default=3)
    parser.add_argument("--backend", choices=["auto", "pymupdf", "pdfplumber"], default="auto")
    parser.add_argument("--max-chars", type=int, default=2000)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--docs", nargs="*", help="Specific filenames to process instead of top-N from QC")
    args = parser.parse_args()

    books_dir = Path(args.books_dir)
    out_root = Path(args.out_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    if args.docs:
        targets = args.docs
    else:
        targets = pick_top_from_qc(Path(args.qc_csv), args.top_n)

    print(f"Selected {len(targets)} document(s):")
    for t in targets:
        print(f"  - {t}")

    for i, name in enumerate(targets, 1):
        pdf_path = books_dir / name
        if not pdf_path.exists():
            print(f"[!] Missing file: {pdf_path}")
            continue
        print(f"\n[{i}/{len(targets)}] Starting {name}")
        out_dir = out_root / Path(name).stem
        extract_one(pdf_path, out_dir, backend=args.backend, verbose=args.verbose, max_chars=args.max_chars)
        print(f"[{i}/{len(targets)}] Done {name}")


if __name__ == "__main__":
    main()

