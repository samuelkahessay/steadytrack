#!/usr/bin/env python3
"""
Quick quality/coherence sweep for PDFs in data/sources/books.

Outputs:
  - data/qc/books_qc.jsonl  (per-doc metrics)
  - data/qc/books_qc.csv    (sortable summary with coherence score)

Backends (auto-detected):
  - PyMuPDF (fitz)
  - pdfplumber (pdfminer.six)
  - Optional fallback to `pdftotext` if present (limited metrics)

Minimal dependencies to get robust metrics:
  pip install pymupdf pdfplumber
"""

import argparse
import csv
import json
import os
import re
import shutil
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


BOOKS_DIR_DEFAULT = Path("data/sources/books")
OUT_DIR_DEFAULT = Path("data/qc")


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


LIGATURES = set("ﬀﬁﬂﬃﬄﬅﬆ")


@dataclass
class PageStats:
    page_index: int
    width: float
    height: float
    char_count: int
    line_count: int
    image_count: int
    header_chars: int
    footer_chars: int
    hyphen_breaks: int
    ligatures: int
    non_ascii: int
    is_image_only: bool
    x_centers: List[float]


@dataclass
class DocStats:
    filename: str
    pages_total: int
    image_only_pages: int
    chars_total: int
    median_chars_per_page: float
    lines_total: int
    lines_per_1k_chars: float
    non_ascii_ratio: float
    ligature_ratio: float
    header_footer_char_share: float
    image_only_ratio: float
    columns: str  # "single" | "two" | "unknown"
    coherence_score: float


def normalize_text_for_repeat(s: str) -> str:
    # Lowercase, remove digits and most whitespace to detect repeating headers/footers
    s = s.lower()
    s = re.sub(r"\d+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def detect_columns(page_centers: List[float], width: float) -> str:
    if not page_centers or width <= 0:
        return "unknown"
    left = sum(1 for c in page_centers if c < width * 0.45)
    right = sum(1 for c in page_centers if c > width * 0.55)
    if left >= 5 and right >= 5:
        return "two"
    return "single"


def score_doc(stats: DocStats) -> float:
    # Compose a coherence score in [0, 100]
    # Higher is better: digital text, single column, low noise, good density
    # Weights are heuristic and can be tuned later.
    score = 40.0

    # Image-only penalty/bonus (dominant factor)
    score += 35.0 * (1.0 - min(1.0, max(0.0, stats.image_only_ratio)))

    # ASCII-ish bonus
    score += 10.0 * (1.0 - min(1.0, max(0.0, stats.non_ascii_ratio)))

    # Ligature penalty (mild)
    score -= min(5.0, 500.0 * stats.ligature_ratio)

    # Header/footer noise penalty (moderate)
    score += 15.0 * (1.0 - min(1.0, max(0.0, stats.header_footer_char_share)))

    # Lines per 1k chars (lower is smoother)
    smooth = max(0.0, min(1.0, 1.0 - stats.lines_per_1k_chars / 50.0))
    score += 15.0 * smooth

    # Column simplicity
    if stats.columns == "single":
        score += 5.0
    elif stats.columns == "two":
        score -= 5.0

    # Density: very low median chars/page likely poor extraction
    if stats.median_chars_per_page >= 1200:
        score += 5.0
    elif stats.median_chars_per_page <= 300:
        score -= 5.0

    return float(max(0.0, min(100.0, score)))


def analyze_with_pymupdf(pdf_path: Path) -> Tuple[List[PageStats], List[str], List[str]]:
    import fitz  # type: ignore
    pages: List[PageStats] = []
    header_strings: List[str] = []
    footer_strings: List[str] = []

    doc = fitz.open(pdf_path)
    try:
        for i, page in enumerate(doc):
            width = float(page.rect.width)
            height = float(page.rect.height)
            top_margin = height * 0.10
            bottom_margin = height * 0.90

            info = page.get_text("dict")
            blocks = info.get("blocks", [])
            char_count = 0
            line_count = 0
            image_count = 0
            header_chars = 0
            footer_chars = 0
            hyphen_breaks = 0
            ligatures = 0
            non_ascii = 0
            x_centers: List[float] = []
            page_text_parts: List[str] = []
            header_parts: List[str] = []
            footer_parts: List[str] = []

            for b in blocks:
                btype = b.get("type", 0)
                bbox = b.get("bbox", [0, 0, 0, 0])
                if btype == 1:
                    image_count += 1
                    continue

                # text block
                lines = b.get("lines", [])
                if not lines:
                    # some blocks may provide direct text
                    text = b.get("text", "") or ""
                    if text:
                        page_text_parts.append(text)
                        char_count += len(text)
                        line_count += text.count("\n") + 1
                        hyphen_breaks += text.count("-\n")
                        ligatures += sum(1 for ch in text if ch in LIGATURES)
                        non_ascii += sum(1 for ch in text if ord(ch) > 127)
                        x_centers.append((float(bbox[0]) + float(bbox[2])) / 2.0)
                        if float(bbox[1]) < top_margin:
                            header_parts.append(text)
                            header_chars += len(text)
                        if float(bbox[3]) > bottom_margin:
                            footer_parts.append(text)
                            footer_chars += len(text)
                    continue

                # collect text from lines/spans
                block_text_parts: List[str] = []
                for line in lines:
                    spans = line.get("spans", [])
                    line_text = "".join(s.get("text", "") for s in spans)
                    if not line_text:
                        continue
                    block_text_parts.append(line_text)
                    char_count += len(line_text)
                    hyphen_breaks += line_text.count("-\n")
                    ligatures += sum(1 for ch in line_text if ch in LIGATURES)
                    non_ascii += sum(1 for ch in line_text if ord(ch) > 127)
                    line_count += 1

                block_text = "\n".join(block_text_parts)
                if block_text:
                    page_text_parts.append(block_text)
                x_centers.append((float(bbox[0]) + float(bbox[2])) / 2.0)
                if float(bbox[1]) < top_margin:
                    header_parts.append(block_text)
                    header_chars += len(block_text)
                if float(bbox[3]) > bottom_margin:
                    footer_parts.append(block_text)
                    footer_chars += len(block_text)

            page_text = "\n".join(page_text_parts)
            is_image_only = (char_count == 0 and image_count > 0)
            header_strings.append(normalize_text_for_repeat(" ".join(header_parts)))
            footer_strings.append(normalize_text_for_repeat(" ".join(footer_parts)))

            pages.append(
                PageStats(
                    page_index=i,
                    width=width,
                    height=height,
                    char_count=char_count,
                    line_count=line_count,
                    image_count=image_count,
                    header_chars=header_chars,
                    footer_chars=footer_chars,
                    hyphen_breaks=hyphen_breaks,
                    ligatures=ligatures,
                    non_ascii=non_ascii,
                    is_image_only=is_image_only,
                    x_centers=x_centers,
                )
            )
    finally:
        doc.close()

    return pages, header_strings, footer_strings


def analyze_with_pdfplumber(pdf_path: Path) -> Tuple[List[PageStats], List[str], List[str]]:
    import pdfplumber  # type: ignore
    pages: List[PageStats] = []
    header_strings: List[str] = []
    footer_strings: List[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for i, page in enumerate(pdf.pages):
            width = float(page.width)
            height = float(page.height)
            top_margin = height * 0.10
            bottom_margin = height * 0.90

            chars = page.chars or []
            images = page.images or []
            char_count = len(chars)
            # Approximate lines: group by rounded y0
            line_keys = [round(float(c.get("top", 0.0)), 1) for c in chars]
            line_count = len(set(line_keys)) if line_keys else 0
            image_count = len(images)
            is_image_only = (char_count == 0 and image_count > 0)

            # Build rough blocks near top/bottom to assess header/footer chars
            header_chars = 0
            footer_chars = 0
            header_text_parts: List[str] = []
            footer_text_parts: List[str] = []
            for c in chars:
                t = c.get("text", "")
                y0 = float(c.get("top", 0.0))
                if y0 < top_margin:
                    header_chars += 1
                    header_text_parts.append(t)
                if y0 > bottom_margin:
                    footer_chars += 1
                    footer_text_parts.append(t)

            page_text = "".join(c.get("text", "") for c in chars)
            hyphen_breaks = page_text.count("-\n")
            ligatures = sum(1 for ch in page_text if ch in LIGATURES)
            non_ascii = sum(1 for ch in page_text if ord(ch) > 127)

            # Column detection via centers of words
            x_centers: List[float] = []
            try:
                words = page.extract_words() or []
                for w in words:
                    x0 = float(w.get("x0", 0.0))
                    x1 = float(w.get("x1", 0.0))
                    x_centers.append((x0 + x1) / 2.0)
            except Exception:
                pass

            header_strings.append(normalize_text_for_repeat("".join(header_text_parts)))
            footer_strings.append(normalize_text_for_repeat("".join(footer_text_parts)))

            pages.append(
                PageStats(
                    page_index=i,
                    width=width,
                    height=height,
                    char_count=char_count,
                    line_count=line_count,
                    image_count=image_count,
                    header_chars=header_chars,
                    footer_chars=footer_chars,
                    hyphen_breaks=hyphen_breaks,
                    ligatures=ligatures,
                    non_ascii=non_ascii,
                    is_image_only=is_image_only,
                    x_centers=x_centers,
                )
            )

    return pages, header_strings, footer_strings


def analyze_with_pdftotext(pdf_path: Path) -> Tuple[List[PageStats], List[str], List[str]]:
    # Extremely limited fallback: just char counts per page from pdftotext output
    # Requires poppler's `pdftotext` binary on PATH.
    pages: List[PageStats] = []
    header_strings: List[str] = []
    footer_strings: List[str] = []
    try:
        import subprocess
        tmp_dir = Path(".tmp_pdf_qc")
        tmp_dir.mkdir(exist_ok=True)
        txt_path = tmp_dir / (pdf_path.stem + ".txt")
        # one file per page: use -layout -f/-l not straightforward; so dump whole then split naively on \f
        subprocess.run(["pdftotext", "-q", str(pdf_path), str(txt_path)], check=True)
        content = txt_path.read_text(encoding="utf-8", errors="ignore")
        parts = content.split("\f")
        for i, part in enumerate(parts):
            text = part or ""
            char_count = len(text)
            ligatures = sum(1 for ch in text if ch in LIGATURES)
            non_ascii = sum(1 for ch in text if ord(ch) > 127)
            hyphen_breaks = text.count("-\n")
            pages.append(
                PageStats(
                    page_index=i,
                    width=0.0,
                    height=0.0,
                    char_count=char_count,
                    line_count=text.count("\n"),
                    image_count=0,
                    header_chars=0,
                    footer_chars=0,
                    hyphen_breaks=hyphen_breaks,
                    ligatures=ligatures,
                    non_ascii=non_ascii,
                    is_image_only=False,
                    x_centers=[],
                )
            )
    except Exception:
        pass
    return pages, header_strings, footer_strings


def analyze_pdf(pdf_path: Path, prefer_backend: Optional[str] = None) -> Optional[DocStats]:
    has_fitz, has_pdfplumber = try_imports()

    pages: List[PageStats] = []
    header_strings: List[str] = []
    footer_strings: List[str] = []

    backends: List[str] = []
    if prefer_backend:
        backends = [prefer_backend]
        # We'll still fall back if the preferred one is unavailable
    else:
        backends = ["pymupdf", "pdfplumber", "pdftotext"]

    for backend in backends:
        if backend == "pymupdf" and has_fitz:
            try:
                pages, header_strings, footer_strings = analyze_with_pymupdf(pdf_path)
                break
            except Exception:
                pass
        elif backend == "pdfplumber" and has_pdfplumber:
            try:
                pages, header_strings, footer_strings = analyze_with_pdfplumber(pdf_path)
                break
            except Exception:
                pass
        elif backend == "pdftotext" and shutil.which("pdftotext"):
            pages, header_strings, footer_strings = analyze_with_pdftotext(pdf_path)
            break

    if not pages:
        return None

    pages_total = len(pages)
    image_only_pages = sum(1 for p in pages if p.is_image_only)
    chars_total = sum(p.char_count for p in pages)
    char_counts = [p.char_count for p in pages]
    median_chars = float(statistics.median(char_counts)) if char_counts else 0.0
    lines_total = sum(p.line_count for p in pages)
    lines_per_1k = (lines_total / max(1, chars_total)) * 1000.0
    non_ascii_total = sum(p.non_ascii for p in pages)
    ligature_total = sum(p.ligatures for p in pages)
    header_footer_chars = sum(p.header_chars + p.footer_chars for p in pages)
    image_only_ratio = image_only_pages / max(1, pages_total)
    non_ascii_ratio = non_ascii_total / max(1, chars_total)
    ligature_ratio = ligature_total / max(1, chars_total)
    header_footer_share = header_footer_chars / max(1, chars_total)

    # Column mode: vote per-page
    col_votes = []
    for p in pages:
        mode = detect_columns(p.x_centers, p.width)
        col_votes.append(mode)
    if col_votes:
        two_count = sum(1 for m in col_votes if m == "two")
        single_count = sum(1 for m in col_votes if m == "single")
        columns = "two" if two_count > single_count and two_count >= max(3, int(0.3 * pages_total)) else "single"
    else:
        columns = "unknown"

    doc = DocStats(
        filename=pdf_path.name,
        pages_total=pages_total,
        image_only_pages=image_only_pages,
        chars_total=chars_total,
        median_chars_per_page=median_chars,
        lines_total=lines_total,
        lines_per_1k_chars=lines_per_1k,
        non_ascii_ratio=non_ascii_ratio,
        ligature_ratio=ligature_ratio,
        header_footer_char_share=header_footer_share,
        image_only_ratio=image_only_ratio,
        columns=columns,
        coherence_score=0.0,  # placeholder; set below
    )

    doc.coherence_score = score_doc(doc)
    return doc


def derive_subject_from_name(name: str) -> str:
    # Expected pattern from our normalized names: subject-level-series...
    base = Path(name).stem
    parts = base.split("-")
    return parts[0] if parts else base


def main():
    parser = argparse.ArgumentParser(description="PDF quality sweep and ranking")
    parser.add_argument("--books-dir", default=str(BOOKS_DIR_DEFAULT))
    parser.add_argument("--out-dir", default=str(OUT_DIR_DEFAULT))
    parser.add_argument("--backend", default="auto", choices=["auto", "pymupdf", "pdfplumber", "pdftotext"]) 
    parser.add_argument("--limit", type=int, default=0, help="Limit number of PDFs processed")
    args = parser.parse_args()

    books_dir = Path(args.books_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    pdfs = [p for p in sorted(books_dir.iterdir()) if p.suffix.lower() == ".pdf" and p.is_file()]
    if args.limit:
        pdfs = pdfs[: args.limit]
    if not pdfs:
        print(f"No PDFs found in {books_dir}")
        return

    prefer = None if args.backend == "auto" else args.backend

    jsonl_path = out_dir / "books_qc.jsonl"
    csv_path = out_dir / "books_qc.csv"

    rows: List[Dict[str, object]] = []
    with open(jsonl_path, "w", encoding="utf-8") as jf:
        for i, pdf in enumerate(pdfs, 1):
            print(f"[{i}/{len(pdfs)}] Analyzing {pdf.name}...")
            doc = analyze_pdf(pdf, prefer_backend=prefer)
            if doc is None:
                print(f"  !! Skipped (no available extractor). Install PyMuPDF or pdfplumber.")
                continue

            record = {
                "filename": doc.filename,
                "subject": derive_subject_from_name(doc.filename),
                "pages_total": doc.pages_total,
                "image_only_pages": doc.image_only_pages,
                "image_only_ratio": round(doc.image_only_ratio, 4),
                "chars_total": doc.chars_total,
                "median_chars_per_page": round(doc.median_chars_per_page, 1),
                "lines_per_1k_chars": round(doc.lines_per_1k_chars, 3),
                "non_ascii_ratio": round(doc.non_ascii_ratio, 4),
                "ligature_ratio": round(doc.ligature_ratio, 5),
                "header_footer_char_share": round(doc.header_footer_char_share, 4),
                "columns": doc.columns,
                "coherence_score": round(doc.coherence_score, 2),
            }
            jf.write(json.dumps(record) + "\n")
            rows.append(record)

    # Sort rows by descending coherence score, then by filename
    rows.sort(key=lambda r: (-float(r.get("coherence_score", 0.0)), str(r.get("filename", ""))))

    with open(csv_path, "w", encoding="utf-8", newline="") as cf:
        writer = csv.DictWriter(
            cf,
            fieldnames=[
                "filename",
                "subject",
                "pages_total",
                "image_only_pages",
                "image_only_ratio",
                "chars_total",
                "median_chars_per_page",
                "lines_per_1k_chars",
                "non_ascii_ratio",
                "ligature_ratio",
                "header_footer_char_share",
                "columns",
                "coherence_score",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {jsonl_path} and {csv_path}")
    print("Tip: open the CSV and sort by coherence_score desc to triage.")


if __name__ == "__main__":
    main()

