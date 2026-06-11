#!/usr/bin/env python3
import re
import json
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError as e:
    sys.stderr.write("pdfplumber is required. Install with: python3 -m pip install pdfplumber\n")
    raise


ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "data" / "sources" / "alberta" / "pdfs"
TEXT_DIR = ROOT / "data" / "sources" / "alberta" / "text"
PARSED_DIR = ROOT / "data" / "sources" / "alberta" / "parsed"


def pdf_to_text(pdf_path: Path) -> str:
    with pdfplumber.open(str(pdf_path)) as pdf:
        texts = []
        for page in pdf.pages:
            # Keep layout reasonably intact
            texts.append(page.extract_text(x_tolerance=2, y_tolerance=2) or "")
    return "\n\n".join(texts)


def save_text(name: str, text: str):
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    (TEXT_DIR / f"{name}.txt").write_text(text, encoding="utf-8")


def _group_words_to_lines(words, x_bounds=None, y_tol=3):
    # Optionally filter words by x bounds (x0..x1)
    if x_bounds is not None:
        x0b, x1b = x_bounds
        words = [w for w in words if (w["x0"] + w["x1"]) / 2 >= x0b and (w["x0"] + w["x1"]) / 2 <= x1b]
    # Group words by y (top) with tolerance
    rows = {}
    for w in words:
        key = round(w["top"] / y_tol) * y_tol
        rows.setdefault(key, []).append(w)
    lines = []
    for y in sorted(rows.keys()):
        ws = sorted(rows[y], key=lambda d: d["x0"])  # left to right
        text = ""; last_x1 = None
        for w in ws:
            t = w["text"].strip()
            if not t:
                continue
            if text and last_x1 is not None and w["x0"] - last_x1 > 2.0:
                text += " " + t
            elif not text:
                text = t
            else:
                # small gap, merge without extra space when punctuation
                if t in [".", ",", ";", ":", ")", "]"]:
                    text += t
                else:
                    text += " " + t
            last_x1 = w["x1"]
        if text:
            lines.append((y, ws[0]["x0"], text))
    return lines


def _detect_ela_column_bounds(pdf):
    """Estimate x-bounds for middle (20-1) column by clustering bullet lines."""
    import statistics
    mids = []
    for page in pdf.pages[:30]:
        words = page.extract_words(extra_attrs=["x0", "x1", "top", "bottom"]) or []
        lines = _group_words_to_lines(words)
        xs = [x0 for (y, x0, text) in lines if re.match(r"^[a-z]\.\s*", text)]
        if len(xs) < 6:
            continue
        xs.sort()
        n = len(xs)
        g1 = xs[: n // 3]
        g2 = xs[n // 3 : 2 * n // 3]
        g3 = xs[2 * n // 3 :]
        m1 = statistics.median(g1)
        m2 = statistics.median(g2)
        m3 = statistics.median(g3)
        mids.append((m1, m2, m3))
    if not mids:
        return None
    m1 = statistics.median([t[0] for t in mids])
    m2 = statistics.median([t[1] for t in mids])
    m3 = statistics.median([t[2] for t in mids])
    left_bound = (m1 + m2) / 2
    right_bound = (m2 + m3) / 2
    return (left_bound, right_bound)


def parse_ela_pdf(pdf_path: Path):
    """Parse ELA 10–12 POS and extract:
    - general outcomes (1..5) titles
    - specific outcomes (x.y.z) titles
    - 20-1 descriptors (lettered a., b., c. in ELA 20-1 column)
    """
    data = {
        "general_outcomes": [],
        "specific_outcomes": [],
    }
    # For quick lookup by code
    spec_index = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        col_bounds = _detect_ela_column_bounds(pdf)

        # Track headings with y positions per page
        current_code = None
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["x0", "x1", "top", "bottom"]) or []
            # Use text extraction for headings (more reliable on this PDF)
            text_lines = (page.extract_text(x_tolerance=2, y_tolerance=2) or "").splitlines()

            # Detect General Outcome lines and specific code headings (sequentially)
            for text in text_lines:
                mgo = re.match(r"^General Outcome\s+(\d)\b\s*(.*)", text)
                if mgo:
                    num = mgo.group(1)
                    title = mgo.group(2).strip()
                    data_go = {"code": num, "title": title or ""}
                    if not any(g["code"] == num for g in data["general_outcomes"]):
                        data["general_outcomes"].append(data_go)
                    else:
                        for g in data["general_outcomes"]:
                            if g["code"] == num and not g.get("title"):
                                g["title"] = title

                # Specific outcome titles; strip trailing (continued)
                m3 = re.match(r"^(\d+\.\d+\.\d+)\s+(.+)", text)
                if m3:
                    code = m3.group(1)
                    title = m3.group(2).strip()
                    title = re.sub(r"\s*\(continued\)\s*$", "", title)
                    current_code = code
                    if code not in spec_index:
                        entry = {"code": code, "title": title, "ela_20_1_descriptors": []}
                        spec_index[code] = entry
                        data["specific_outcomes"].append(entry)
                    else:
                        if len(title) > len(spec_index[code]["title"]):
                            spec_index[code]["title"] = title

            # Extract 20-1 column lines and map to the nearest preceding heading by y
            if col_bounds is not None:
                col_lines = _group_words_to_lines(words, x_bounds=col_bounds)
                # Accumulate descriptors grouped by bullets a., b., c. and assign to current_code
                last_bullet = None
                for y, x0, text in col_lines:
                    if text in ("ELA 10-1", "ELA 20-1", "ELA 30-1"):
                        continue
                    mb = re.match(r"^([a-z])\.(\s+)?(.*)", text)
                    if mb:
                        last_bullet = mb.group(1)
                        content = mb.group(3).strip()
                        code = current_code
                        if code and code in spec_index and content:
                            spec_index[code]["ela_20_1_descriptors"].append(f"{last_bullet}. {content}")
                        continue
                    if last_bullet and text:
                        code = current_code
                        if code and code in spec_index and spec_index[code]["ela_20_1_descriptors"]:
                            prev = spec_index[code]["ela_20_1_descriptors"][-1]
                            if prev.endswith("-"):
                                spec_index[code]["ela_20_1_descriptors"][-1] = prev[:-1] + text
                            else:
                                spec_index[code]["ela_20_1_descriptors"][-1] = prev + " " + text

    # Replace/ensure General Outcome titles with official canonical wording
    go_canon = {
        "1": "Explore thoughts, ideas, feelings and experiences",
        "2": "Comprehend and respond personally and critically to texts",
        "3": "Manage ideas and information",
        "4": "Create oral, print, visual and multimedia texts, and enhance clarity and artistry",
        "5": "Respect, support and collaborate with others",
    }
    data["general_outcomes"] = [{"code": k, "title": v} for k, v in sorted(go_canon.items(), key=lambda kv: int(kv[0]))]
    return data


def parse_science(text: str, level_prefix: str = "20-", subject_name: str = ""):
    # Accept hyphen '-' or en-dash '–' between level and unit
    dash = r"[-–]"
    # Specific outcome codes like 20–A1.1k, 20–A1.2s, 20–A1.3sts (or 30–... for grade 12)
    spec_pat = re.compile(rf"\b({re.escape(level_prefix[:-1])}{dash}[A-D]\d\.(\d+)(k|s|sts))\b[.:]?\s*(.*)")

    lines = [ln.strip() for ln in text.splitlines()]

    generals = []
    specifics = []

    current_unit = None  # 'A'..'D'
    current_level = None  # '20' or '30'
    last_general_code = None

    # Pending specific outcome description accumulation
    pending_desc = None
    pending_code = None
    pending_kind = None

    # Pending general description accumulation
    collecting_gen_desc = False
    gen_desc_buf = []

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
            "category": {'k': 'knowledge', 's': 'skills', 'sts': 'sts'}.get(pending_kind, pending_kind),
            "description": desc,
            "general_parent": last_general_code,
        })
        pending_code, pending_desc, pending_kind = None, None, None

    def flush_pending_general():
        nonlocal gen_desc_buf, collecting_gen_desc, last_general_code
        if last_general_code and gen_desc_buf:
            generals.append({
                "code": last_general_code,
                "description": " ".join(gen_desc_buf).strip(),
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
            # Very lightweight detection: presence of e.g., "Biology 20" on the line
            if re.search(rf"\b{re.escape(subject_name)}\s+20\b", ln):
                current_level = "20"
            elif re.search(rf"\b{re.escape(subject_name)}\s+30\b", ln):
                current_level = "30"

        # Detect Unit letter
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
            # Example: "General Outcome 1"
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

        # If the next line after General Outcome is the description (starts with Students will ...), capture until a "Specific Outcomes" header.
        if collecting_gen_desc:
            # Terminate description on section headers or skill blocks or codes
            if (ln.startswith("Specific Outcomes") or ln.endswith("Outcomes") or
                re.match(r"^(Initiating and Planning|Performing and Recording|Analyzing and Interpreting|Communication and Teamwork)\b", ln) or
                re.search(spec_pat, ln) or
                ln.strip().endswith(":")):  # e.g., "Students will:"
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

        # If we're currently accumulating a specific outcome description, append text
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


def parse_math_standards(text: str):
    # Build strand/topic-based codes: A#, T#, RF# based on order in the standards document.
    lines = [ln.strip() for ln in text.splitlines()]

    topic_alias = {
        'Algebra and Number': 'A',
        'Trigonometry': 'T',
        'Relations and Functions': 'RF',
    }

    by_strand = {k: [] for k in topic_alias}
    counters = {k: 0 for k in topic_alias}

    current_topic = None
    collecting = False
    buf = []
    current_official_no = None

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
            # Remove leaders like "...... 5" and trailing markers like "Notes"
            t = re.sub(r"\s[\.…·•]{3,}.*$", "", t)
            t = re.sub(r"\s+Notes$", "", t)
            if t in topic_alias:
                current_topic = t
            else:
                current_topic = None
            continue

        # Detect start of a Specific Outcome block
        if ln == "Specific Outcome":
            # The actual SO description is on the next lines starting with like "2. Solve problems that involve ..."
            flush()
            collecting = True
            buf = []
            current_official_no = None
            continue

        if collecting:
            # Stop conditions: new section or indicators
            if ln.startswith("Notes") or ln.startswith("Achievement Indicators") or ln.startswith("(continued)") or ln.startswith("Specific Outcome"):
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


def parse_math_30_from_framework(text: str):
    # Extract Mathematics 30-1 section from the 10–12 framework and build topic-based outcomes
    lines = [ln.strip() for ln in text.splitlines()]

    # Find the window of lines for Mathematics 30-1 — anchor on footer/header line
    start_marker_idx = None
    end_idx = None
    for i, ln in enumerate(lines):
        if start_marker_idx is None and re.search(r"Mathematics\s*30-1.*Mathematics\s*\(10[–-]12\)|Mathematics\s*\(10[–-]12\).*Mathematics\s*30-1", ln):
            start_marker_idx = i
        # End when a new course section begins
        if start_marker_idx is not None and re.match(r"^MATHEMATICS\s+20-2\b", ln):
            end_idx = i
            break
    if start_marker_idx is None:
        return {}
    if end_idx is None:
        end_idx = len(lines)

    # Seek the first topic header after the start marker
    start_idx = start_marker_idx
    for i in range(start_marker_idx, end_idx):
        if lines[i] in ("Relations and Functions", "Permutations, Combinations and Binomial Theorem"):
            start_idx = i
            break

    topic_alias = {
        'Relations and Functions': 'RF',
        'Permutations, Combinations and Binomial Theorem': 'PCB',
        # Trigonometry is not a labeled 30-1 topic section in this framework excerpt
    }

    by_topic = {k: [] for k in topic_alias}
    counters = {k: 0 for k in topic_alias}

    current_topic = None
    collecting = False
    buf = []
    current_official_no = None

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

    # Iterate within window
    for ln in lines[start_idx:end_idx]:
        if not ln:
            if collecting and buf:
                buf.append("")
            continue

        if ln in topic_alias:
            flush()
            current_topic = ln
            continue

        # Detect the start of the specific outcomes list by a numbered line
        m = re.match(r"^(\d+)\.\s*(.*)", ln)
        if m and current_topic in topic_alias:
            # New specific outcome under the current topic
            flush()
            collecting = True
            current_official_no = int(m.group(1))
            # First description line after the number
            first = m.group(2).strip()
            if first:
                buf = [first]
            else:
                buf = []
            continue

        if collecting:
            # Stop conditions: next topic header or bracket-only lines
            if ln in topic_alias or ln.startswith("General Outcome"):
                flush()
                continue
            if re.fullmatch(r"\[[A-Z,\s\d\.\-–]+\]", ln) or ln.startswith("[ICT:"):
                # Skip process tags / ICT references
                continue
            buf.append(ln)

    flush()

    # Remove empty topics
    by_topic = {k: v for k, v in by_topic.items() if v}
    return by_topic


def parse_social(text: str, level: str = "20-1"):
    # Capture Related Issues and map to e.g., 20-1.1 ... 20-1.4 or 30-1.1 ... using the guiding question line
    lines = [ln.strip() for ln in text.splitlines()]
    issues = []
    next_is_desc_for = None
    for ln in lines:
        if not ln:
            continue
        m = re.match(r"^Related Issue\s+(\d)\b", ln)
        if m:
            next_is_desc_for = int(m.group(1))
            continue
        if next_is_desc_for is not None:
            # The next non-empty line after 'Related Issue X' is the guiding question
            code = f"{level}.{next_is_desc_for}"
            issues.append({"code": code, "description": ln})
            next_is_desc_for = None
    # Deduplicate by code, keep the longest description
    best = {}
    for item in issues:
        c = item['code']
        if c not in best or len(item['description']) > len(best[c]['description']):
            best[c] = item
    return [best[k] for k in sorted(best.keys())]


def main():
    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)

    inputs = {
        "biology": PDF_DIR / "pos_bio_20_30.pdf",
        "chemistry": PDF_DIR / "pos_chem_20_30.pdf",
        "physics": PDF_DIR / "pos_phys_20_30.pdf",
        "science": PDF_DIR / "pos_science_20_30.pdf",
        "math_framework": PDF_DIR / "math10to12.pdf",
        "math_20_1_standards": PDF_DIR / "mathematics-20-1-standards.pdf",
        "social_20_1": PDF_DIR / "program-of-study-grade-11.pdf",
        # Optional/additional inputs for 30-level
        "math_30_1_standards": PDF_DIR / "mathematics-30-1-standards.pdf",
        "social_30_1": PDF_DIR / "program-of-study-grade-12.pdf",
        "ela": PDF_DIR / "ela-pos-10-12.pdf",
    }

    # Process sciences
    for name in ["biology", "chemistry", "physics", "science"]:
        p = inputs[name]
        if not p.exists():
            print(f"Skipping {name}: {p.name} not found in {PDF_DIR}")
            continue
        text = pdf_to_text(p)
        save_text(name, text)
        subj = name.capitalize() if name != 'science' else 'Science'
        # 20-level
        parsed20 = parse_science(text, "20-", subject_name=subj)
        (PARSED_DIR / f"{name}.json").write_text(json.dumps(parsed20, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Parsed {name} 20-level: {len(parsed20['general_outcomes'])} general, {len(parsed20['specific_outcomes'])} specific outcomes")
        # 30-level
        parsed30 = parse_science(text, "30-", subject_name=subj)
        (PARSED_DIR / f"{name}_30.json").write_text(json.dumps(parsed30, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Parsed {name} 30-level: {len(parsed30['general_outcomes'])} general, {len(parsed30['specific_outcomes'])} specific outcomes")

    # Process Math 20-1 standards
    mstd = inputs["math_20_1_standards"]
    if mstd.exists():
        text = pdf_to_text(mstd)
        save_text("math_20_1_standards", text)
        parsed = parse_math_standards(text)
        (PARSED_DIR / "math_20_1.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
        total = sum(len(v) for v in parsed.values())
        print(f"Parsed Math 20-1: {total} outcomes across {len(parsed)} strands")
    else:
        print("Skipping Math 20-1 standards: file missing")

    # Process Math 30-1: prefer standards doc if available; otherwise fall back to framework extraction
    mstd30 = inputs.get("math_30_1_standards")
    if mstd30 and mstd30.exists():
        text = pdf_to_text(mstd30)
        save_text("math_30_1_standards", text)
        parsed = parse_math_standards(text)
        (PARSED_DIR / "math_30_1.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
        total = sum(len(v) for v in parsed.values())
        print(f"Parsed Math 30-1 (standards): {total} outcomes across {len(parsed)} strands")
    else:
        # fallback: extract from 10–12 framework if present
        fw = inputs.get("math_framework")
        if fw and fw.exists():
            text = pdf_to_text(fw)
            # reuse saved text if exists
            save_text("math_framework", text)
            parsed_fw = parse_math_30_from_framework(text)
            if parsed_fw:
                (PARSED_DIR / "math_30_1.json").write_text(json.dumps(parsed_fw, indent=2, ensure_ascii=False), encoding="utf-8")
                total = sum(len(v) for v in parsed_fw.values())
                print(f"Parsed Math 30-1 (framework): {total} outcomes across {len(parsed_fw)} topics")
            else:
                print("Math 30-1 framework parsing yielded no topics; ensure the framework PDF is present and readable")
        else:
            print("Skipping Math 30-1: neither standards nor framework file available")

    # Process Social 20-1 key/related issues
    soc = inputs["social_20_1"]
    if soc.exists():
        text = pdf_to_text(soc)
        save_text("social_20_1", text)
        parsed = parse_social(text, level="20-1")
        (PARSED_DIR / "social_20_1.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Parsed Social 20-1: {len(parsed)} key/related issues captured")
    else:
        print("Skipping Social 20-1: file missing")

    # Process Social 30-1 if available (optional)
    soc30 = inputs.get("social_30_1")
    if soc30 and soc30.exists():
        text = pdf_to_text(soc30)
        save_text("social_30_1", text)
        parsed = parse_social(text, level="30-1")
        (PARSED_DIR / "social_30_1.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Parsed Social 30-1: {len(parsed)} key/related issues captured")
    else:
        print("Skipping Social 30-1: file missing")

    # Process ELA 20-1
    ela = inputs["ela"]
    if ela.exists():
        parsed = parse_ela_pdf(ela)
        (PARSED_DIR / "ela_20_1.json").write_text(json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Parsed ELA 20-1: {len(parsed['specific_outcomes'])} specific outcomes across {len(parsed['general_outcomes'])} general categories")
    else:
        print("Skipping ELA 20-1: file missing")

    print("Done.")


if __name__ == "__main__":
    main()
