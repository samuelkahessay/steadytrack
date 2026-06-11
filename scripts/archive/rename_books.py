#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Optional


BOOKS_DIR = Path("data/sources/books")
MAP_PATH = BOOKS_DIR / "rename_map.json"


def detect_series(name: str) -> Optional[str]:
    n = name.lower()
    if "snap" in n or "student notes and problems" in n:
        return "snap"
    if "problem solved" in n:
        return "problem-solved"
    if "iwrite" in n:
        return "iwrite"
    if re.search(r"\bthe key\b|\bkey study guide\b|\bkey\b", n):
        return "key"
    return None


def detect_type(name: str, series: Optional[str]) -> Optional[str]:
    n = name.lower()
    if series == "snap":
        if "solution manual" in n:
            return "solution-manual"
        if "workbook" in n:
            return "workbook"
        # generic SNAP content
        return "notes"
    if series == "key":
        if "study guide" in n:
            return "study-guide"
    return None


SUBJECT_MAP = {
    "biology": "biology",
    "chemistry": "chemistry",
    "physics": "physics",
    "mathematics": "math",
    "math": "math",
    "english": "english",
    "social studies": "social-studies",
    "social": "social-studies",  # fallback
}


def detect_subject(name: str) -> Optional[str]:
    n = name.lower()
    # check multi-word first
    if "social studies" in n:
        return SUBJECT_MAP["social studies"]
    for key, norm in SUBJECT_MAP.items():
        if key in ("social studies",):
            continue
        if re.search(rf"\b{re.escape(key)}\b", n):
            return norm
    return None


LEVEL_PAT = re.compile(r"\b(10|11|12|20-1|20-2|30-1|30-2|20|30|31)\b")


def detect_level(name: str) -> Optional[str]:
    n = name.lower().replace("_", " ")
    m = LEVEL_PAT.search(n)
    if m:
        return m.group(1)
    return None


def detect_year(name: str) -> Optional[str]:
    years = re.findall(r"\b(20\d{2})\b", name)
    if years:
        # prefer the first year appearance for brevity
        return years[0]
    return None


def detect_hash(name: str) -> Optional[str]:
    m = re.search(r"([a-f0-9]{32})", name)
    if m:
        return m.group(1)[:8]
    return None


def simplify_filename(p: Path, existing_targets: set[str]) -> str:
    original = p.name
    series = detect_series(original) or "misc"
    subj = detect_subject(original) or "general"
    level = detect_level(original)
    typ = detect_type(original, series)  # optional
    year = detect_year(original)
    short_hash = detect_hash(original)

    parts = [subj]
    if level:
        parts.append(level)
    parts.append(series)
    if typ and series in {"snap", "problem-solved"}:
        parts.append(typ)

    base = "-".join(parts)
    candidate = f"{base}.pdf"

    # Disambiguate if collision
    def unique(name: str) -> str:
        if name not in existing_targets and not (BOOKS_DIR / name).exists():
            return name
        # try with year
        if year:
            with_year = f"{base}-{year}.pdf"
            if with_year not in existing_targets and not (BOOKS_DIR / with_year).exists():
                return with_year
        # fallback to hash
        if short_hash:
            with_hash = f"{base}-{short_hash}.pdf"
            if with_hash not in existing_targets and not (BOOKS_DIR / with_hash).exists():
                return with_hash
        # numeric suffix as last resort
        i = 2
        while True:
            alt = f"{base}-{i}.pdf"
            if alt not in existing_targets and not (BOOKS_DIR / alt).exists():
                return alt
            i += 1

    return unique(candidate)


def main():
    parser = argparse.ArgumentParser(description="Simplify PDF filenames in data/sources/books")
    parser.add_argument("--apply", action="store_true", help="Apply renames (default is dry-run)")
    args = parser.parse_args()

    if not BOOKS_DIR.exists():
        raise SystemExit(f"Directory not found: {BOOKS_DIR}")

    pdfs = sorted([p for p in BOOKS_DIR.iterdir() if p.suffix.lower() == ".pdf" and p.is_file()])
    if not pdfs:
        print("No PDFs found.")
        return

    existing_targets: set[str] = set()
    mapping: dict[str, str] = {}

    for p in pdfs:
        target_name = simplify_filename(p, existing_targets)
        existing_targets.add(target_name)
        mapping[p.name] = target_name

    # Print mapping for visibility
    width = max(len(k) for k in mapping)
    print("Planned renames:\n")
    for src, dst in mapping.items():
        print(f"{src:<{width}}  ->  {dst}")

    # Persist mapping
    try:
        MAP_PATH.write_text(json.dumps(mapping, indent=2), encoding="utf-8")
        print(f"\nSaved mapping to {MAP_PATH}")
    except Exception as e:
        print(f"Warning: could not save mapping: {e}")

    if not args.apply:
        print("\nDry-run complete. Re-run with --apply to perform renames.")
        return

    # Apply renames
    for src, dst in mapping.items():
        src_path = BOOKS_DIR / src
        dst_path = BOOKS_DIR / dst
        if src_path == dst_path:
            continue
        src_path.rename(dst_path)

    print("\nRenames applied.")


if __name__ == "__main__":
    main()
