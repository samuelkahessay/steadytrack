#!/usr/bin/env python3
"""
PyMuPDF-based Alberta outcomes extractor + side-by-side comparison report.

What this does
- Extracts outcomes from Alberta PDFs in `data/sources/alberta/pdfs` using PyMuPDF
- Parses sciences (Bio/Chem/Physics) 20/30 outcomes by code (e.g., 20-A1.3k)
- Parses Math 20-1 standards into topic codes (A#, T#, RF#)
- Writes parsed JSON under `data/sources/alberta/parsed`
- Generates an HTML side-by-side report comparing:
    Original (data/curriculum/*.json) vs New (PyMuPDF extraction)

Optional
- Can use an LLM (OpenAI) for fuzzy description matching when codes are absent
  Use only gpt-5 or gpt-5-nano (never 4.x). Disabled by default.

Usage
  python3 scripts/curriculum/alberta_outcomes_pymupdf_compare.py \
    --report data/reports/alberta_outcomes_comparison.html

Dependencies
  pip install pymupdf
  # optional: pip install openai (only if using --use-llm)
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from time import sleep


# ----------------------------
# Paths
# ----------------------------
ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "data" / "sources" / "alberta" / "pdfs"
PARSED_DIR = ROOT / "data" / "sources" / "alberta" / "parsed"
CURR_DIR = ROOT / "data" / "curriculum"
REPORTS_DIR = ROOT / "data" / "reports"


# ----------------------------
# Extraction (PyMuPDF)
# ----------------------------
def extract_text_pymupdf(pdf_path: Path) -> str:
    try:
        import fitz  # PyMuPDF
    except Exception as e:
        sys.stderr.write("PyMuPDF (fitz) is required. Install with: python3 -m pip install pymupdf\n")
        raise

    doc = fitz.open(pdf_path)
    try:
        parts: List[str] = []
        for page in doc:
            # Plain text preserves reading order reasonably well for these PDFs
            parts.append(page.get_text("text") or "")
        return "\n\n".join(parts)
    finally:
        doc.close()


# ----------------------------
# Parsing helpers (text → outcomes)
# ----------------------------
def parse_science(text: str, level_prefix: str = "20-", subject_name: str = "") -> Dict[str, List[dict]]:
    # Accept hyphen '-' or en-dash '–' between level and unit
    dash = r"[-–]"
    # Specific outcome codes like 20–A1.1k, 20–A1.2s, 20–A1.3sts (or 30–... for grade 12)
    spec_pat = re.compile(rf"\b({re.escape(level_prefix[:-1])}{dash}[A-D]\d\.(\d+)(k|s|sts))\b[.:]?\s*(.*)")

    lines = [ln.strip() for ln in text.splitlines()]

    generals: List[dict] = []
    specifics: List[dict] = []

    current_unit: Optional[str] = None  # 'A'..'D'
    current_level: Optional[str] = None  # '20' or '30'
    last_general_code: Optional[str] = None

    # Pending specific outcome description accumulation
    pending_desc: Optional[str] = None
    pending_code: Optional[str] = None
    pending_kind: Optional[str] = None

    # Pending general description accumulation
    collecting_gen_desc = False
    gen_desc_buf: List[str] = []

    def normalize_code(code: str) -> str:
        # Replace en-dash with hyphen and ensure level prefix uses hyphen
        return code.replace("–", "-")

    def flush_pending_specific():
        nonlocal pending_code, pending_desc, pending_kind, last_general_code
        if pending_code is None:
            return
        desc = (pending_desc or "").strip()
        specifics.append({
            "code": normalize_code(pending_code),
            "category": {'k': 'knowledge', 's': 'skills', 'sts': 'sts'}.get(pending_kind or '', pending_kind),
            "description": desc,
            "general_parent": last_general_code,
        })
        pending_code, pending_desc, pending_kind = None, None, None

    def flush_pending_general():
        nonlocal gen_desc_buf, collecting_gen_desc, last_general_code
        if last_general_code and gen_desc_buf:
            generals.append({
                "code": last_general_code,
                "description": " ".join([p for p in gen_desc_buf if p is not None]).strip(),
            })
        gen_desc_buf = []
        collecting_gen_desc = False

    for ln in lines:
        if not ln:
            if pending_desc is not None and len(gen_desc_buf) == 0:
                pending_desc += "\n"
            elif collecting_gen_desc:
                gen_desc_buf.append("")
            continue

        # Track which course level we're in using footer/header lines like "Biology 20" or "Chemistry 20"
        if subject_name:
            if re.search(rf"\b{re.escape(subject_name)}\s+20\b", ln):
                current_level = "20"
            elif re.search(rf"\b{re.escape(subject_name)}\s+30\b", ln):
                current_level = "30"

        # Detect Unit letter (appears throughout the documents)
        m_unit = re.match(r"^Unit\s+([A-D])\b", ln)
        if m_unit:
            # new unit - finalize any in-progress captures
            flush_pending_specific()
            flush_pending_general()
            current_unit = m_unit.group(1)
            last_general_code = None
            continue

        # Detect General Outcome header and start capturing its description
        if ln.startswith("General Outcome ") and current_unit and current_level == level_prefix[:-1]:
            flush_pending_specific()
            flush_pending_general()
            try:
                num_str = ln.split("General Outcome ", 1)[1].split()[0]
                num = int(re.sub(r"[^0-9]", "", num_str))
            except Exception:
                num = None
            if num is not None:
                last_general_code = f"{level_prefix}{current_unit}{num}"
                collecting_gen_desc = True
                gen_desc_buf = []
            continue

        # If capturing general description, append until a terminator
        if collecting_gen_desc:
            if (ln.startswith("Specific Outcomes") or ln.endswith("Outcomes") or
                re.match(r"^(Initiating and Planning|Performing and Recording|Analyzing and Interpreting|Communication and Teamwork)\b", ln) or
                re.search(spec_pat, ln) or
                ln.strip().endswith(":")):
                flush_pending_general()
            else:
                gen_desc_buf.append(ln)
            continue

        # Specific outcome codes
        m_spec = spec_pat.search(ln)
        if m_spec:
            flush_pending_specific()
            code_full = m_spec.group(1)
            kind = m_spec.group(3)
            rest = m_spec.group(4).strip()
            pending_code = code_full
            pending_kind = kind
            pending_desc = rest
            continue

        # If accumulating a specific outcome description, append text
        if pending_code is not None:
            if pending_desc:
                if pending_desc.endswith("-"):
                    pending_desc = pending_desc[:-1] + ln
                else:
                    pending_desc += " " + ln
            else:
                pending_desc = ln

    # flush last pending items
    flush_pending_specific()
    flush_pending_general()

    # Deduplicate generals by code (later captures override earlier empty ones)
    dedup = {}
    for item in generals:
        if not item.get("code"):
            continue
        dedup[item["code"]] = item
    generals = list(dedup.values())

    return {"general_outcomes": generals, "specific_outcomes": specifics}


def parse_math_standards(text: str) -> Dict[str, List[dict]]:
    # Build strand/topic-based codes: A#, T#, RF# based on order in the standards document.
    lines = [ln.strip() for ln in text.splitlines()]

    topic_alias = {
        'Algebra and Number': 'A',
        'Trigonometry': 'T',
        'Relations and Functions': 'RF',
    }

    by_strand: Dict[str, List[dict]] = {k: [] for k in topic_alias}
    counters = {k: 0 for k in topic_alias}

    current_topic: Optional[str] = None
    collecting = False
    buf: List[str] = []
    current_official_no: Optional[int] = None

    def flush():
        nonlocal buf, collecting, current_topic, current_official_no
        if current_topic and buf:
            desc = " ".join(buf).strip()
            counters[current_topic] += 1
            code = f"{topic_alias[current_topic]}{counters[current_topic]}"
            by_strand[current_topic].append({
                "code": code,
                "official_so": current_official_no,
                "description": desc,
            })
        buf = []
        collecting = False
        current_official_no = None

    for ln in lines:
        if not ln:
            if collecting and buf:
                buf.append("")
            continue

        # Detect topic header
        if ln.startswith("Topic:"):
            flush()
            # e.g., "Topic: Algebra and Number"
            t = ln.split("Topic:", 1)[1].strip()
            t = re.sub(r"\s[\.…·•]{3,}.*$", "", t)
            t = re.sub(r"\s+Notes$", "", t)
            current_topic = t if t in topic_alias else None
            continue

        # Detect start of a Specific Outcome block
        if ln == "Specific Outcome":
            flush()
            collecting = True
            continue

        if collecting:
            # End conditions for a block
            if ln.startswith("It is expected that students will:") or ln.startswith("Notes:") or ln.startswith("General Outcome"):
                flush()
                continue
            # Capture the first line starting with e.g., "2. Solve ..."
            m = re.match(r"^(\d+)\.\s*(.*)", ln)
            if m and not buf:
                current_official_no = int(m.group(1))
                buf.append(m.group(2).strip())
            else:
                # continuation lines for the description (avoid process tags like [CN, ME, ...])
                if not re.fullmatch(r"\[[A-Z,\s]+\]", ln):
                    buf.append(ln)

    flush()

    # Remove empty strands
    by_strand = {k: v for k, v in by_strand.items() if v}
    return by_strand


# Dict-layout fallback for Math 20-1 standards (PyMuPDF blocks)
def parse_math_standards_from_fitz(pdf_path: Path) -> Dict[str, List[dict]]:
    try:
        import fitz  # type: ignore
    except Exception:
        return {}
    topic_alias = {
        'Algebra and Number': 'A',
        'Trigonometry': 'T',
        'Relations and Functions': 'RF',
    }
    by_strand: Dict[str, List[dict]] = {k: [] for k in topic_alias}
    counters = {k: 0 for k in topic_alias}

    def flush(buf: List[str], current_topic: Optional[str], current_official_no: Optional[int]):
        if current_topic and buf:
            desc = " ".join(buf).strip()
            counters[current_topic] += 1
            code = f"{topic_alias[current_topic]}{counters[current_topic]}"
            by_strand[current_topic].append({
                "code": code,
                "official_so": current_official_no,
                "description": desc,
            })

    doc = fitz.open(pdf_path)
    try:
        # Build logical lines across pages
        lines: List[str] = []
        for page in doc:
            for (text, x0, x1, y0, y1) in _page_lines_from_fitz(page):
                lines.append(text)

        current_topic: Optional[str] = None
        collecting = False
        buf: List[str] = []
        current_official_no: Optional[int] = None

        def do_flush():
            nonlocal buf, collecting, current_topic, current_official_no
            flush(buf, current_topic, current_official_no)
            buf = []
            collecting = False
            current_official_no = None

        for ln in lines:
            s = ln.strip()
            if not s:
                if collecting and buf:
                    buf.append("")
                continue
            if s.startswith("Topic:"):
                do_flush()
                t = s.split("Topic:", 1)[1].strip()
                t = re.sub(r"\s[\.…·•]{3,}.*$", "", t)
                t = re.sub(r"\s+Notes$", "", t)
                current_topic = t if t in topic_alias else None
                continue
            if s == "Specific Outcome":
                do_flush()
                collecting = True
                continue
            if collecting:
                if s.startswith("Notes:") or s.startswith("General Outcome") or s.startswith("Topic:") or s == "Specific Outcome":
                    do_flush()
                    continue
                m = re.match(r"^(\d+)\.\s*(.*)", s)
                if m and not buf:
                    try:
                        current_official_no = int(m.group(1))
                    except Exception:
                        current_official_no = None
                    first = m.group(2).strip()
                    if first:
                        buf = [first]
                    else:
                        buf = []
                else:
                    if not re.fullmatch(r"\[[A-Z,\s]+\]", s):
                        buf.append(s)
        do_flush()

        return {k: v for k, v in by_strand.items() if v}
    finally:
        doc.close()


def parse_math_30_from_framework(text: str) -> Dict[str, List[dict]]:
    # Port of framework extraction to create PCB and RF topics
    lines = [ln.strip() for ln in text.splitlines()]
    start_marker_idx = None
    end_idx = None
    for i, ln in enumerate(lines):
        if start_marker_idx is None and re.search(r"\bMathematics\s*30-1\b", ln, flags=re.IGNORECASE):
            start_marker_idx = i
            continue
        if start_marker_idx is not None and (re.search(r"\bMathematics\s*30-2\b", ln, flags=re.IGNORECASE) or re.search(r"\bMathematics\s*30-3\b", ln, flags=re.IGNORECASE) or re.search(r"\bMathematics\s*20-2\b", ln, flags=re.IGNORECASE)):
            end_idx = i
            break
    if start_marker_idx is None:
        return {}
    if end_idx is None:
        end_idx = len(lines)

    topic_alias = {
        'Relations and Functions': 'RF',
        'Permutations, Combinations and Binomial Theorem': 'PCB',
    }
    by_topic: Dict[str, List[dict]] = {k: [] for k in topic_alias}
    counters = {k: 0 for k in topic_alias}

    # seek first relevant topic header after start
    start_idx = start_marker_idx
    for i in range(start_marker_idx, end_idx):
        if lines[i] in topic_alias:
            start_idx = i
            break

    current_topic: Optional[str] = None
    collecting = False
    buf: List[str] = []
    current_official_no: Optional[int] = None

    def flush():
        nonlocal buf, collecting, current_topic, current_official_no
        if current_topic and buf:
            desc = " ".join(buf).strip()
            counters[current_topic] += 1
            code = f"{topic_alias[current_topic]}{counters[current_topic]}"
            by_topic[current_topic].append({
                "code": code,
                "official_so": current_official_no,
                "description": desc,
            })
        buf = []
        collecting = False
        current_official_no = None

    for ln in lines[start_idx:end_idx]:
        if not ln:
            if collecting and buf:
                buf.append("")
            continue
        if ln in topic_alias:
            flush()
            current_topic = ln
            continue
        m = re.match(r"^(\d+)\.\s*(.*)", ln)
        if m and current_topic in topic_alias:
            flush()
            collecting = True
            try:
                current_official_no = int(m.group(1))
            except Exception:
                current_official_no = None
            first = m.group(2).strip()
            buf = [first] if first else []
            continue
        if collecting:
            if ln in topic_alias or ln.startswith("General Outcome"):
                flush()
                continue
            if re.fullmatch(r"\[[A-Z,\s\d\.\-–]+\]", ln) or ln.startswith("[ICT:"):
                continue
            buf.append(ln)
    flush()
    return {k: v for k, v in by_topic.items() if v}
# ----------------------------
# Curriculum loader (originals)
# ----------------------------
def load_original_curriculum() -> Dict[str, Dict[str, dict]]:
    """Return mapping: subject_key -> { code -> {code, description} }.
    subject_key examples: 'physics-30', 'chemistry-20', 'biology-30', 'math-20-1'
    """
    out: Dict[str, Dict[str, dict]] = {}
    if not CURR_DIR.exists():
        return out

    for path in CURR_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        # Only handle dict-shaped curriculum files with units
        if not isinstance(data, dict) or not isinstance(data.get("units"), list):
            continue
        subject = str(data.get("subject", "")).strip()
        grade = str(data.get("grade", "")).strip()
        # Some files use short names like "Physics 30"; build a normalized key
        subject_key = None
        if subject:
            subject_key = subject.lower().replace(" ", "-")
        elif path.stem in ("phys-20", "phys-30", "chem-20", "chem-30", "bio-20", "bio-30"):
            # fallback on filename
            subject_key = path.stem.replace("phys", "physics").replace("chem", "chemistry").replace("bio", "biology")
        else:
            # math / ela / social naming
            subject_key = path.stem

        # Flatten outcomes
        code_map: Dict[str, dict] = {}
        for unit in data.get("units", []) or []:
            for oc in unit.get("outcomes", []) or []:
                c = oc.get("code")
                # Prefer description, fallback to title for ELA/Social style files
                d = (oc.get("description") or oc.get("title") or "").strip()
                if not c:
                    continue
                # Keep the longest description for each code
                prev = code_map.get(c)
                if prev is None or len(d) > len(prev.get("description", "")):
                    code_map[c] = {"code": c, "description": d}
        out[subject_key] = code_map
    return out


# ----------------------------
# Matching and report
# ----------------------------
def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a or "", b or "").ratio()


def render_html_report(
    comparisons: Dict[str, Dict[str, Tuple[Optional[dict], Optional[dict], float]]],
    output_path: Path,
    llm_refined: Optional[Dict[str, Dict[str, str]]] = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    html_parts: List[str] = []
    html_parts.append("""
<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <title>Alberta Outcomes Comparison</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; }
    h1 { margin-bottom: 0.25rem; }
    h2 { margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; }
    th { background: #f7f7f7; text-align: left; }
    .code { font-weight: 600; color: #444; white-space: nowrap; }
    .miss { color: #a00; }
    .hit { color: #0a0; }
    .sim { font-size: 12px; color: #666; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  </style>
  </head>
  <body>
    <h1>Alberta Outcomes: Original vs PyMuPDF Extraction</h1>
    <p>Left: original repo outcomes (data/curriculum); Right: newly extracted outcomes (PyMuPDF).</p>
""")

    for subject_key in sorted(comparisons.keys()):
        html_parts.append(f"<h2>{subject_key}</h2>")
        html_parts.append("<table>")
        html_parts.append("<tr><th style='width:12%'>Code</th><th style='width:29%'>Original</th><th style='width:29%'>New (PyMuPDF)</th><th style='width:29%'>LLM-Refined</th></tr>")
        rows = comparisons[subject_key]
        for code in sorted(rows.keys(), key=lambda c: (len(c), c)):
            orig, new, sim = rows[code]
            orig_desc = (orig or {}).get("description", "")
            new_desc = (new or {}).get("description", "")
            cls = "hit" if orig and new else "miss"
            sim_txt = f"<div class='sim'>sim={sim:.2f}</div>" if orig and new else ""
            refined = ""
            if llm_refined and subject_key in llm_refined and code in llm_refined[subject_key]:
                refined = llm_refined[subject_key][code]
            html_parts.append(
                f"<tr>\n"
                f"  <td class='code mono'>{code}</td>\n"
                f"  <td class='{cls}'>{orig_desc}</td>\n"
                f"  <td class='{cls}'>{new_desc}{sim_txt}</td>\n"
                f"  <td>{refined}</td>\n"
                f"</tr>"
            )
        html_parts.append("</table>")

    html_parts.append("</body></html>")
    output_path.write_text("\n".join(html_parts), encoding="utf-8")


# ----------------------------
# Optional LLM (for future fuzzy mapping)
# ----------------------------
def try_llm_match(_descs_a: List[str], _descs_b: List[str], model: str) -> Dict[Tuple[str, str], float]:
    """Placeholder for LLM-assisted matching. Intentionally not implemented here.
    If you enable --use-llm, we will check model name against allowed set and
    leave room for future enhancement without blocking basic operation.
    """
    _ = model  # unused for now
    return {}


# ----------------------------
# ELA and Social parsers (PyMuPDF text)
# ----------------------------
def parse_ela_text(text: str) -> Dict[str, List[dict]]:
    """Parse ELA 10–12 text into general + specific outcomes.
    - General outcomes: code '1'..'5' with titles
    - Specific outcomes: codes like '2.1.2' with titles
    Note: Does not attempt to extract 20-1 column descriptors.
    """
    lines = [ln.strip() for ln in text.splitlines()]
    data = {"general_outcomes": [], "specific_outcomes": []}
    go_index: Dict[str, dict] = {}
    so_index: Dict[str, dict] = {}

    # Capture General Outcome titles if present
    for ln in lines:
        mgo = re.match(r"^General Outcome\s+(\d)\b\s*(.*)", ln)
        if mgo:
            num = mgo.group(1)
            title = mgo.group(2).strip()
            if num not in go_index or (title and len(title) > len(go_index[num].get("title", ""))):
                go_index[num] = {"code": num, "title": title}

    # Fallback to canonical titles
    go_canon = {
        "1": "Explore thoughts, ideas, feelings and experiences",
        "2": "Comprehend and respond personally and critically to texts",
        "3": "Manage ideas and information",
        "4": "Create oral, print, visual and multimedia texts, and enhance clarity and artistry",
        "5": "Respect, support and collaborate with others",
    }
    # Merge canonical if missing or shorter
    for k, v in go_canon.items():
        if k not in go_index or len(v) > len(go_index[k].get("title", "")):
            go_index[k] = {"code": k, "title": v}

    # Specific outcomes: accumulate wrapped titles until next code or header
    pending_code: Optional[str] = None
    pending_title: List[str] = []
    code_pat = re.compile(r"^(\d+\.\d+\.\d+)\s+(.+)")
    code_only_pat = re.compile(r"^(\d+\.\d+\.\d+)\s*$")

    def flush_pending():
        nonlocal pending_code, pending_title
        if pending_code:
            title = re.sub(r"\s*\(continued\)\s*$", "", " ".join(pending_title).strip())
            if pending_code not in so_index or len(title) > len(so_index[pending_code].get("title", "")):
                so_index[pending_code] = {"code": pending_code, "title": title}
        pending_code = None
        pending_title = []

    for ln in lines:
        m = code_pat.match(ln)
        if m:
            flush_pending()
            pending_code = m.group(1)
            first = m.group(2).strip()
            pending_title = [first] if first else []
            continue
        m2 = code_only_pat.match(ln)
        if m2:
            flush_pending()
            pending_code = m2.group(1)
            pending_title = []
            continue
        if pending_code:
            # Stop on new header or empty line
            if not ln or ln.startswith("General Outcome"):
                flush_pending()
                continue
            # Stop on new section header like "2.2 Understand ..." (two-level code)
            if re.match(r"^\d+\.\d+\s", ln):
                flush_pending()
                # do not consume this line; continue outer loop
                continue
            # Skip all-caps tags like [ICT: ...]
            if re.fullmatch(r"\[[A-Z,\s\-–\d\.]+\]", ln):
                continue
            pending_title.append(ln)
    flush_pending()

    data["general_outcomes"] = [go_index[k] for k in sorted(go_index.keys(), key=lambda x: int(x))]
    data["specific_outcomes"] = [so_index[k] for k in sorted(so_index.keys())]
    return data


def parse_social_text(text: str, level: str = "20-1") -> List[dict]:
    """Parse Social Studies related issues from grade 11/12 PDFs.
    Returns list of { code: '20-1.1', description: '...' }
    """
    lines = [ln.strip() for ln in text.splitlines()]
    issues: List[dict] = []
    next_is_desc_for: Optional[int] = None
    for ln in lines:
        if not ln:
            continue
        m = re.match(r"^Related Issue\s+(\d)\b", ln)
        if m:
            try:
                next_is_desc_for = int(m.group(1))
            except Exception:
                next_is_desc_for = None
            continue
        if next_is_desc_for is not None:
            code = f"{level}.{next_is_desc_for}"
            issues.append({"code": code, "description": ln})
            next_is_desc_for = None

    # Deduplicate by code, keep longest description
    best: Dict[str, dict] = {}
    for item in issues:
        c = item["code"]
        if c not in best or len(item.get("description", "")) > len(best[c].get("description", "")):
            best[c] = item
    return [best[k] for k in sorted(best.keys())]


def _page_lines_from_fitz(page) -> List[Tuple[str, float, float, float, float]]:
    """Return page lines as tuples: (text, x0, x1, y0, y1) using PyMuPDF dict layout."""
    info = page.get_text("dict")
    lines_out: List[Tuple[str, float, float, float, float]] = []
    for b in info.get("blocks", []):
        if b.get("type", 0) == 1:
            continue
        for l in b.get("lines", []):
            spans = l.get("spans", [])
            if not spans:
                continue
            text = "".join(s.get("text", "") for s in spans).strip()
            if not text:
                continue
            xs = [float(s.get("bbox", [0, 0, 0, 0])[0]) for s in spans]
            xe = [float(s.get("bbox", [0, 0, 0, 0])[2]) for s in spans]
            ys = [float(s.get("bbox", [0, 0, 0, 0])[1]) for s in spans]
            ye = [float(s.get("bbox", [0, 0, 0, 0])[3]) for s in spans]
            x0 = min(xs) if xs else 0.0
            x1 = max(xe) if xe else 0.0
            y0 = min(ys) if ys else 0.0
            y1 = max(ye) if ye else 0.0
            lines_out.append((text, x0, x1, y0, y1))
    # sort by y then x
    lines_out.sort(key=lambda t: (t[3], t[1]))
    return lines_out


def _detect_ela_column_centers_fitz(doc) -> Optional[Tuple[float, float, float]]:
    """Return median relative x-centers (0..1) for ELA 10-1, 20-1, 30-1 columns.
    Primary: find header spans. Fallback: cluster bullet line x-centers across pages.
    """
    centers_10: List[float] = []
    centers_20: List[float] = []
    centers_30: List[float] = []
    for i, page in enumerate(doc):
        # Limit to first 40 pages for speed
        if i > 40:
            break
        info = page.get_text("dict")
        width = float(page.rect.width)
        for b in info.get("blocks", []):
            if b.get("type", 0) == 1:
                continue
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    txt = (s.get("text") or "").strip()
                    if not txt:
                        continue
                    x0, y0, x1, y1 = [float(v) for v in s.get("bbox", [0, 0, 0, 0])]
                    xc = (x0 + x1) / 2.0
                    rel = xc / width if width else 0.0
                    if txt == "ELA 10-1":
                        centers_10.append(rel)
                    elif txt == "ELA 20-1":
                        centers_20.append(rel)
                    elif txt == "ELA 30-1":
                        centers_30.append(rel)
    if centers_10 and centers_20 and centers_30:
        import statistics
        c10 = statistics.median(centers_10)
        c20 = statistics.median(centers_20)
        c30 = statistics.median(centers_30)
        return (c10, c20, c30)

    # Fallback: cluster bullet line x-centers across first pages
    bullet_centers: List[float] = []
    for i, page in enumerate(doc):
        if i > 40:
            break
        width = float(page.rect.width)
        for (text, x0, x1, y0, y1) in _page_lines_from_fitz(page):
            if re.match(r"^[a-z]\.\s+", text):
                xc = (x0 + x1) / 2.0
                if width:
                    bullet_centers.append(xc / width)
    if len(bullet_centers) < 9:
        return None
    bullet_centers.sort()
    n = len(bullet_centers)
    # Partition into three groups by index
    g1 = bullet_centers[: n // 3]
    g2 = bullet_centers[n // 3 : 2 * n // 3]
    g3 = bullet_centers[2 * n // 3 :]
    import statistics
    c10 = statistics.median(g1)
    c20 = statistics.median(g2)
    c30 = statistics.median(g3)
    return (c10, c20, c30)


def parse_ela_descriptors_pymupdf(pdf_path: Path, base_data: Dict[str, List[dict]]) -> Dict[str, List[dict]]:
    """Enhance ELA base outcomes with 20-1 and 30-1 column descriptors.
    Returns data with specific outcomes entries containing:
      - code
      - title
      - ela_20_1_descriptors: [str]
      - ela_30_1_descriptors: [str]
    """
    try:
        import fitz  # type: ignore
    except Exception as e:
        # If PyMuPDF missing, return base
        return base_data

    doc = fitz.open(pdf_path)
    try:
        centers = _detect_ela_column_centers_fitz(doc)
        if not centers:
            return base_data
        c10, c20, c30 = centers
        # Define relative boundaries between columns
        left_mid = (c10 + c20) / 2.0
        right_mid = (c20 + c30) / 2.0

        # Build index from base specific outcomes
        so_index: Dict[str, dict] = {so["code"]: {**so, "ela_20_1_descriptors": [], "ela_30_1_descriptors": []} for so in base_data.get("specific_outcomes", [])}

        # Helper to assign a line to the most recent heading code
        code_pat = re.compile(r"^(\d+\.\d+\.\d+)\b")
        last_code_global: Optional[str] = None

        for page in doc:
            width = float(page.rect.width)
            x20_0 = left_mid * width
            x20_1 = right_mid * width
            x30_0 = right_mid * width
            x30_1 = width

            lines = _page_lines_from_fitz(page)

            # Collect heading y-positions for this page
            headings: List[Tuple[float, str]] = []  # (y0, code)
            for (text, x0, x1, y0, y1) in lines:
                m = code_pat.match(text)
                if m:
                    code = m.group(1)
                    headings.append((y0, code))
            headings.sort()

            def code_for_y(y: float) -> Optional[str]:
                nonlocal last_code_global
                # Find last heading above this y
                candidates = [c for (yy, c) in headings if yy <= y + 0.1]
                if candidates:
                    last_code_global = candidates[-1]
                return last_code_global

            # Aggregate descriptors by bullet marker for 20-1 and 30-1
            last_bullet_for: Dict[Tuple[str, str], int] = {}
            for (text, x0, x1, y0, y1) in lines:
                xc = (x0 + x1) / 2.0
                col = None
                if x20_0 <= xc <= x20_1:
                    col = "20-1"
                elif x30_0 <= xc <= x30_1:
                    col = "30-1"
                else:
                    continue
                # Skip headers
                if text in ("ELA 10-1", "ELA 20-1", "ELA 30-1"):
                    continue
                # Only capture bullet-led descriptors
                mb = re.match(r"^([a-z])\.(\s+)?(.*)", text)
                code = code_for_y(y0)
                if not code or code not in so_index:
                    continue
                entry = so_index[code]
                key = (code, col)
                if mb:
                    content = (mb.group(3) or "").strip()
                    if not content:
                        continue
                    if col == "20-1":
                        entry["ela_20_1_descriptors"].append(f"{mb.group(1)}. {content}")
                    else:
                        entry["ela_30_1_descriptors"].append(f"{mb.group(1)}. {content}")
                    last_bullet_for[key] = (len(entry["ela_20_1_descriptors"]) - 1 if col == "20-1" else len(entry["ela_30_1_descriptors"]) - 1)
                else:
                    # Continuation of previous bullet in this column
                    if key not in last_bullet_for:
                        continue
                    idx = last_bullet_for[key]
                    if col == "20-1":
                        if entry["ela_20_1_descriptors"]:
                            prev = entry["ela_20_1_descriptors"][idx]
                            entry["ela_20_1_descriptors"][idx] = (prev + " " + text).strip()
                    else:
                        if entry["ela_30_1_descriptors"]:
                            prev = entry["ela_30_1_descriptors"][idx]
                            entry["ela_30_1_descriptors"][idx] = (prev + " " + text).strip()

        # Rebuild data structure
        enriched_specific = list(so_index.values())
        enriched_specific.sort(key=lambda d: d.get("code", ""))
        return {"general_outcomes": base_data.get("general_outcomes", []), "specific_outcomes": enriched_specific}
    finally:
        doc.close()


# ----------------------------
# LLM Refinement (optional)
# ----------------------------
def _load_openai_key() -> Optional[str]:
    key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
    if key:
        return key
    # Try reading .env.local at repo root
    env_path = ROOT / ".env.local"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("#"):
                    continue
                if "OPENAI_API_KEY" in line or line.startswith("OPENAI_KEY"):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if k:
                        return k
        except Exception:
            pass
    return None


def _should_llm_refine(subject_key: str, code: str, orig_desc: str, new_desc: str, sim: float) -> bool:
    # Keep concise, high-quality originals as-is (no LLM):
    if orig_desc:
        short = len(orig_desc) <= 160
        social_q = "to what extent should" in orig_desc.lower()
        if (short and sim >= 0.85) or social_q:
            return False
    # Consider LLM when new text is long or jumbled
    text = new_desc or orig_desc or ""
    if len(text) >= 220:
        return True
    if any(tok in text for tok in ["•", "cid:", "Note:", "\n\n\n"]):
        return True
    if text.count("\n") >= 3:
        return True
    return False


def _llm_refine_batch(entries: List[Tuple[str, str, str, str, float]], model: str, api_key: str) -> Dict[Tuple[str, str], str]:
    """entries: list of (subject_key, code, orig_desc, new_desc, sim). Returns {(subject, code): refined_text}."""
    import requests
    # Prefer Responses API; fall back to Chat Completions if needed
    url_resp = "https://api.openai.com/v1/responses"
    url_chat = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    out: Dict[Tuple[str, str], str] = {}
    total = len(entries)
    for idx, (subject_key, code, orig_desc, new_desc, sim) in enumerate(entries, 1):
        print(f"[llm] {idx}/{total} - Refining {subject_key}::{code}")
        # Build content to refine; prefer new_desc if present
        content = new_desc or orig_desc
        if not content:
            out[(subject_key, code)] = ""
            continue
        prompt = (
            "You are refining official curriculum learning outcomes.\n"
            "Rules:\n"
            "- Preserve meaning; do not add new facts or topics.\n"
            "- Prefer concise, student-friendly phrasing.\n"
            "- Use 1–5 bullet points, each an imperative outcome (e.g., 'Identify...', 'Explain...').\n"
            "- If the text is already a single high-quality outcome, return it as-is (no changes).\n"
            "- Keep technical terms and codes intact if present, but do not invent codes.\n"
            "Output strictly the refined text only: either a single line or bullet list starting with '- '.\n\n"
            f"Original outcome (if available):\n{orig_desc}\n\n"
            f"Extracted outcome (PyMuPDF):\n{content}\n"
        )
        # Try Responses API
        success = False
        txt = ""
        print(f"  → Trying Responses API...")
        try:
            body_resp = {
                "model": model,
                "input": prompt,
                "max_output_tokens": 2000,
            }
            resp = requests.post(url_resp, headers=headers, json=body_resp, timeout=45)
            print(f"  → Responses API status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                # Best-effort extraction for Responses API
                try:
                    # Some variants
                    if isinstance(data.get("output"), list):
                        for seg in data["output"]:
                            if isinstance(seg, dict) and isinstance(seg.get("content"), list) and seg["content"]:
                                for part in seg["content"]:
                                    if isinstance(part, dict) and part.get("type") in ("output_text", "text"):
                                        txt += part.get("text", "")
                    if not txt and isinstance(data.get("choices"), list):
                        txt = data["choices"][0].get("message", {}).get("content", "")
                except Exception:
                    txt = ""
                txt = (txt or "").strip()
                success = bool(txt)
                if success:
                    print(f"  ✓ Responses API succeeded, got {len(txt)} chars")
        except Exception as e:
            print(f"  ✗ Responses API exception: {e}")
            success = False
            txt = ""
        # Fallback to Chat Completions
        if not success:
            print(f"  → Trying Chat Completions API...")
            try:
                body_chat = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You rewrite outcomes clearly without altering meaning."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_completion_tokens": 2000,
                }
                resp = requests.post(url_chat, headers=headers, json=body_chat, timeout=45)
                print(f"  → Chat Completions status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    txt = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    success = bool(txt)
                    if success:
                        print(f"  ✓ Chat Completions succeeded, got {len(txt)} chars")
                else:
                    print(f"  ✗ Chat Completions error: {resp.text[:200]}")
            except Exception as e:
                print(f"  ✗ Chat Completions exception: {e}")
                success = False
                txt = ""
        # If still not successful, do deterministic cleanup fallback
        if not success:
            print(f"  → Using deterministic fallback")
            txt = deterministic_refine(content)
        # Enforce formatting policy and fallback to deterministic if only one run-on bullet
        txt = ensure_llm_format(content, txt)
        out[(subject_key, code)] = txt
        print(f"  ✓ Final refined text: {txt[:100]}...")
        sleep(0.3)  # gentle pacing
    return out


def deterministic_refine(text: str) -> str:
    """Heuristic cleanup when LLM is unavailable.
    - Remove boilerplate (Note:, page footers)
    - Split bullets on common markers
    - Return up to 5 '- ' bullets or original if already concise
    """
    if not text:
        return ""
    t = text
    t = re.sub(r"\s+\d+/\s*(Biology|Chemistry|Physics|Science|Mathematics)\s*\d+\b.*$", "", t, flags=re.MULTILINE)
    t = re.sub(r"\bNote:.*", "", t)
    t = t.replace("•", "\n").replace("·", "\n")
    # Normalize spaces but preserve newlines
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{2,}", "\n", t)
    t = t.replace(" ;", ";").strip()
    if len(t) <= 160 and "\n" not in t:
        return t
    # Split by semicolons and periods if no bullets
    parts = [p.strip(" -:\u2022\u00b7") for p in re.split(r"[\n;•]+", t) if p.strip()]
    if not parts:
        return text
    bullets = parts[:5]
    return "\n".join(f"- {b}" for b in bullets)


def ensure_llm_format(source_text: str, llm_text: str) -> str:
    """Normalize LLM output:
    - Force bullets to start with '- '
    - If only a single long bullet produced and source appears list-like, use deterministic_refine
    - Limit to 5 bullets
    """
    if not llm_text:
        return llm_text
    t = llm_text.strip()
    # If model used alternative bullet markers, normalize
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if len(lines) == 1 and lines[0].startswith("- "):
        # Single bullet; if input looked like a list, fallback to deterministic
        looks_list = ('•' in source_text) or (source_text.count(';') >= 2) or (source_text.count('\n') >= 3)
        if looks_list and len(lines[0]) > 140:
            return deterministic_refine(source_text)
    # Normalize markers and ensure '- ' prefix
    norm = []
    for ln in lines:
        ln2 = re.sub(r"^[\-*•\u2022\u00b7\u2013\u2014]\s*", "", ln)
        # drop leading numbering (1., a.)
        ln2 = re.sub(r"^[0-9]+\.|^[a-zA-Z]\.", "", ln2).strip()
        norm.append(f"- {ln2}")
    if not norm:
        return t
    # collapse to max 5 bullets
    return "\n".join(norm[:5])


# ----------------------------
# Main
# ----------------------------
def main():
    ap = argparse.ArgumentParser(description="Extract Alberta outcomes with PyMuPDF and compare to originals.")
    ap.add_argument("--pdf-dir", default=str(PDF_DIR))
    ap.add_argument("--parsed-dir", default=str(PARSED_DIR))
    ap.add_argument("--curriculum-dir", default=str(CURR_DIR))
    ap.add_argument("--report", default=str(REPORTS_DIR / "alberta_outcomes_comparison.html"))
    ap.add_argument("--use-llm", action="store_true", help="Add LLM-refined column (uses gpt-5 family)")
    ap.add_argument("--llm-model", default="gpt-5", choices=["gpt-5", "gpt-5-nano", "gpt-5-mini"])
    ap.add_argument("--llm-policy", default="auto", choices=["off", "auto", "force"], help="off=never call LLM; auto=only for jumbled; force=refine all")
    ap.add_argument("--llm-cache", default=str(REPORTS_DIR / "llm_cache.json"))
    ap.add_argument("--clear-llm-cache", action="store_true")
    args = ap.parse_args()

    pdf_dir = Path(args.pdf_dir)
    parsed_dir = Path(args.parsed_dir)
    curr_dir = Path(args.curriculum_dir)
    report_path = Path(args.report)

    parsed_dir.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # Map subject → filename and parser config
    inputs = {
        "biology-20": (pdf_dir / "pos_bio_20_30.pdf", ("20-", "Biology")),
        "biology-30": (pdf_dir / "pos_bio_20_30.pdf", ("30-", "Biology")),
        "chemistry-20": (pdf_dir / "pos_chem_20_30.pdf", ("20-", "Chemistry")),
        "chemistry-30": (pdf_dir / "pos_chem_20_30.pdf", ("30-", "Chemistry")),
        "physics-20": (pdf_dir / "pos_phys_20_30.pdf", ("20-", "Physics")),
        "physics-30": (pdf_dir / "pos_phys_20_30.pdf", ("30-", "Physics")),
        # Mathematics
        "mathematics-20-1": (pdf_dir / "mathematics-20-1-standards.pdf", ("MATH20", None)),
        "math-30-1": (pdf_dir / "math10to12.pdf", ("MATH30", None)),
        # ELA and Social (20-1/30-1)
        "english-language-arts-20-1": (pdf_dir / "ela-pos-10-12.pdf", ("ELA", None)),
        "english-language-arts-30-1": (pdf_dir / "ela-pos-10-12.pdf", ("ELA", None)),
        "social-studies-20-1": (pdf_dir / "program-of-study-grade-11.pdf", ("SOCIAL", "20-1")),
        "social-studies-30-1": (pdf_dir / "program-of-study-grade-12.pdf", ("SOCIAL", "30-1")),
    }

    # 1) Extract new outcomes via PyMuPDF
    extracted: Dict[str, Dict[str, dict]] = {}
    for subj_key, (path, cfg) in inputs.items():
        if not path.exists():
            print(f"[skip] {subj_key}: missing PDF: {path}")
            continue
        print(f"[extract] {subj_key} from {path.name}")
        text = extract_text_pymupdf(path)

        if cfg is None:
            raise RuntimeError("Unexpected config None")
        else:
            level_prefix, subject_name = cfg
            if level_prefix == "MATH20":
                # Math 20-1 standards (PyMuPDF text; fallback to fitz-dict lines)
                strands = parse_math_standards(text)
                if not strands:
                    try:
                        strands = parse_math_standards_from_fitz(path)
                    except Exception:
                        strands = {}
                code_map: Dict[str, dict] = {}
                for topic, items in (strands or {}).items():
                    for it in items:
                        code_map[it["code"]] = {"code": it["code"], "description": it.get("description", "")}
                (parsed_dir / "math_20_1_pymupdf.json").write_text(json.dumps({"by_strand": strands}, indent=2, ensure_ascii=False), encoding="utf-8")
                extracted[subj_key] = code_map
            elif level_prefix == "MATH30":
                # Math 30-1 from framework (PyMuPDF text path)
                topics = parse_math_30_from_framework(text)
                if not topics:
                    # Fallback to existing parsed json if present
                    fallback = parsed_dir / "math_30_1.json"
                    if fallback.exists():
                        try:
                            topics = json.loads(fallback.read_text(encoding="utf-8"))
                        except Exception:
                            topics = {}
                code_map: Dict[str, dict] = {}
                for topic, items in (topics or {}).items():
                    for it in items:
                        code_map[it["code"]] = {"code": it["code"], "description": it.get("description", "")}
                (parsed_dir / "math_30_1_pymupdf.json").write_text(json.dumps(topics, indent=2, ensure_ascii=False), encoding="utf-8")
                extracted[subj_key] = code_map
            elif level_prefix == "ELA":
                # Parse ELA general/specific and 20-1/30-1 column descriptors
                ela_base = parse_ela_text(text)
                ela_enriched = parse_ela_descriptors_pymupdf(path, ela_base)

                # Persist enriched once per target key (write a copy per 20-1/30-1)
                out_name = "ela_20_1_pymupdf.json" if subj_key.endswith("20-1") else "ela_30_1_pymupdf.json"
                (parsed_dir / out_name).write_text(json.dumps(ela_enriched, indent=2, ensure_ascii=False), encoding="utf-8")

                # Build comparison map; include descriptors for the relevant strand only
                code_map: Dict[str, dict] = {}
                for it in ela_enriched.get("specific_outcomes", []):
                    c = it.get("code"); title = (it.get("title") or "").strip()
                    if not c:
                        continue
                    desc = title
                    if subj_key.endswith("20-1"):
                        ds = it.get("ela_20_1_descriptors", []) or []
                        if ds:
                            desc = f"{title}\n20-1: " + "; ".join(ds)
                    else:
                        ds = it.get("ela_30_1_descriptors", []) or []
                        if ds:
                            desc = f"{title}\n30-1: " + "; ".join(ds)
                    code_map[c] = {"code": c, "description": desc}
                # Also include general outcomes with titles for completeness
                for it in ela_enriched.get("general_outcomes", []):
                    c = it.get("code"); t = (it.get("title") or "").strip()
                    if c and c not in code_map:
                        code_map[c] = {"code": c, "description": t}
                extracted[subj_key] = code_map
            elif level_prefix == "SOCIAL":
                # Parse Social 20-1 or 30-1 related issues
                level = subject_name or "20-1"
                social_items = parse_social_text(text, level)
                code_map: Dict[str, dict] = {it["code"]: {"code": it["code"], "description": it.get("description", "")} for it in social_items}
                parsed_out_path = parsed_dir / f"social_{level.replace('-', '_')}_pymupdf.json"
                parsed_out_path.write_text(json.dumps(social_items, indent=2, ensure_ascii=False), encoding="utf-8")
                extracted[subj_key] = code_map
            else:
                # Sciences 20/30
                parsed = parse_science(text, level_prefix=level_prefix, subject_name=subject_name)
                code_map: Dict[str, dict] = {}
                for it in parsed.get("general_outcomes", []):
                    c = it.get("code"); d = (it.get("description") or "").strip()
                    if c and (c not in code_map or len(d) > len(code_map[c].get("description", ""))):
                        code_map[c] = {"code": c, "description": d}
                for it in parsed.get("specific_outcomes", []):
                    c = it.get("code"); d = (it.get("description") or "").strip()
                    if c and (c not in code_map or len(d) > len(code_map[c].get("description", ""))):
                        code_map[c] = {"code": c, "description": d}
                parsed_out_path = parsed_dir / f"{subj_key.replace('-', '_')}_pymupdf.json"
                parsed_out_path.write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
                extracted[subj_key] = code_map

    # 2) Load originals
    originals = load_original_curriculum()

    # 3) Build comparisons per subject_key: code -> (orig, new, sim)
    comparisons: Dict[str, Dict[str, Tuple[Optional[dict], Optional[dict], float]]] = {}
    keys = sorted(set(list(originals.keys()) + list(extracted.keys())))
    for subj_key in keys:
        o_map = originals.get(subj_key, {})
        n_map = extracted.get(subj_key, {})
        all_codes = sorted(set(list(o_map.keys()) + list(n_map.keys())))
        rows: Dict[str, Tuple[Optional[dict], Optional[dict], float]] = {}
        for code in all_codes:
            o = o_map.get(code)
            n = n_map.get(code)
            sim = similarity((o or {}).get("description", ""), (n or {}).get("description", "")) if (o and n) else 0.0
            rows[code] = (o, n, sim)
        comparisons[subj_key] = rows

    # 4) Optionally LLM‑refine
    llm_map: Dict[str, Dict[str, str]] = {}
    if args.use_llm and args.llm_policy != "off":
        api_key = _load_openai_key()
        if not api_key:
            print("[warn] OPENAI key not found (.env.local or env var). Skipping LLM refinement.")
        else:
            # Load cache
            cache_path = Path(args.llm_cache)
            cache = {}
            if cache_path.exists() and not args.clear_llm_cache:
                try:
                    cache = json.loads(cache_path.read_text(encoding="utf-8"))
                except Exception:
                    cache = {}
            if args.clear_llm_cache:
                cache = {}

            to_refine: List[Tuple[str, str, str, str, float]] = []
            for subject_key, rows in comparisons.items():
                for code, (orig, new, sim) in rows.items():
                    orig_desc = (orig or {}).get("description", "")
                    new_desc = (new or {}).get("description", "")
                    key_s = f"{subject_key}::{code}"
                    if key_s in cache:
                        continue
                    if args.llm_policy == "force" or _should_llm_refine(subject_key, code, orig_desc, new_desc, sim):
                        to_refine.append((subject_key, code, orig_desc, new_desc, sim))

            if to_refine:
                print(f"[llm] refining {len(to_refine)} entries with {args.llm_model}")
                batch_out = _llm_refine_batch(to_refine, args.llm_model, api_key)
                for (subject_key, code, *_rest) in to_refine:
                    val = batch_out.get((subject_key, code), "")
                    cache[f"{subject_key}::{code}"] = val
                # Persist cache
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

            # Build llm_map from cache for report
            for subject_key, rows in comparisons.items():
                for code in rows.keys():
                    key_s = f"{subject_key}::{code}"
                    if key_s in cache:
                        llm_map.setdefault(subject_key, {})[code] = cache[key_s]

    # 5) Render the side-by-side HTML report
    render_html_report(comparisons, report_path, llm_refined=llm_map)
    print(f"[ok] Wrote report: {report_path}")


if __name__ == "__main__":
    main()
