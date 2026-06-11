#!/usr/bin/env python3
"""
Enhance outcome alignment using 'Table of Correlations' page mappings.

Inputs:
  - data/alignment/correlations/<doc-stem>.json
  - data/clean/<doc-stem>/clean_chunks.jsonl
  - data/sources/alberta/parsed/*.json (outcomes)

Output:
  - data/alignment_enhanced/<subject>.json

Strategy:
  - For each outcome code, find correlation entries whose code matches or startswith the outcome code
    (e.g., 2.2.1 matches 2.2.1.a/b/c; 30-A1 matches 30-A1.1k)
  - Gather pages and select cleaned chunks from those pages
  - Produce concise snippets from those chunks to attach as evidence
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ALBERTA_PARSED = Path("data/sources/alberta/parsed")
CLEAN = Path("data/clean")
CORR = Path("data/alignment/correlations")
OUT = Path("data/alignment_enhanced")


def subject_from_stem(stem: str) -> str:
    s = stem.lower()
    if s.startswith("english"): return "english"
    if s.startswith("social"): return "social"
    if s.startswith("biology"): return "biology"
    if s.startswith("chemistry"): return "chemistry"
    if s.startswith("physics"): return "physics"
    if s.startswith("math"): return "math"
    return "general"


def load_outcomes(subject: str) -> List[Dict[str, str]]:
    files = list(ALBERTA_PARSED.glob("*.json"))
    out: List[Dict[str, str]] = []
    aliases = {
        "english": ["english", "ela"],
        "math": ["math", "mathematics"],
        "biology": ["biology"],
        "chemistry": ["chemistry"],
        "physics": ["physics"],
        "social": ["social"],
    }
    pref = aliases.get(subject, [subject])
    for f in files:
        name = f.stem
        if subject == "social":
            if not name.startswith("social"): continue
            data = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    out.append({"code": item.get("code", name), "description": item.get("description", "")})
            else:
                for arr in ("general_outcomes", "specific_outcomes"):
                    for item in data.get(arr, []):
                        out.append({"code": item.get("code", name), "description": item.get("description", "")})
            continue
        if not any(name.startswith(p) for p in pref):
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            any_list = False
            for arr in ("general_outcomes", "specific_outcomes"):
                if arr in data:
                    any_list = True
                    for item in data.get(arr, []):
                        desc = item.get("description") or item.get("title") or ""
                        out.append({"code": item.get("code", name), "description": desc})
            if not any_list:
                for k, v in data.items():
                    if isinstance(v, list):
                        for item in v:
                            if isinstance(item, dict):
                                desc = item.get("description") or item.get("title") or ""
                                out.append({"code": item.get("code", f"{name}:{k}"), "description": desc})
    return out


def load_correlations_for_subject(subject: str) -> Dict[str, Dict[str, List[int]]]:
    # return {doc_stem: { code: [pages] }}
    acc: Dict[str, Dict[str, List[int]]] = {}
    for p in CORR.glob("*.json"):
        stem = p.stem
        if subject_from_stem(stem) != subject:
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        code_pages: Dict[str, List[int]] = {}
        for item in data:
            code = str(item.get("code", "")).strip()
            if not code:
                continue
            pages = item.get("pages", []) or []
            code_pages[code] = list(sorted(set(int(x) for x in pages if isinstance(x, int))))
        acc[stem] = code_pages
    return acc


def load_clean_chunks(stem: str) -> List[Dict]:
    path = CLEAN / stem / "clean_chunks.jsonl"
    if not path.exists():
        return []
    items = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        items.append(json.loads(line))
    return items


def top_snippets(text: str, k: int = 2) -> List[str]:
    sents = re.split(r"(?<=[.!?])\s+|\n{2,}", text)
    # prefer longer sentences
    scored = [(len(s), s.strip()) for s in sents if len(s.strip()) >= 60]
    scored.sort(reverse=True)
    return [s for _, s in scored[:k]]


def enhance(subject: str) -> Dict:
    outcomes = load_outcomes(subject)
    corr = load_correlations_for_subject(subject)
    # Preload chunks per doc
    chunks_by_doc = {stem: load_clean_chunks(stem) for stem in corr.keys()}

    results = []
    for oc in outcomes:
        code = str(oc.get("code"))
        desc = oc.get("description", "")
        oc_entry = {"code": code, "description": desc, "evidence": []}
        # For each doc, find correlation codes that match
        for stem, code_pages in corr.items():
            # candidates: exact or startswith
            pages: List[int] = []
            for c, pgs in code_pages.items():
                if c == code or c.startswith(f"{code}."):
                    pages.extend(pgs)
                # biology style: 30-A1 matches 30-A1.1k
                if code.endswith("-A1") and c.startswith(code):
                    pages.extend(pgs)
            pages = sorted(set(pages))
            if not pages:
                continue
            # pick chunks that overlap these pages
            chs = chunks_by_doc.get(stem, [])
            hits = [ch for ch in chs if any(pg in pages for pg in ch.get("pages", []))]
            # Build snippet evidence
            for ch in hits[:8]:
                txt = ch.get("text", "")
                snips = top_snippets(txt, k=2)
                oc_entry["evidence"].append({
                    "doc_stem": stem,
                    "heading": ch.get("heading"),
                    "pages": ch.get("pages", []),
                    "snippets": snips if snips else [txt[:280] + ("…" if len(txt) > 280 else "")],
                })
        if oc_entry["evidence"]:
            results.append(oc_entry)

    return {"subject": subject, "outcomes": results}


def main():
    parser = argparse.ArgumentParser(description="Enhance alignment using correlation pages")
    parser.add_argument("--subject", required=True, choices=["biology", "chemistry", "physics", "math", "english", "social"])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    res = enhance(args.subject)
    (OUT / f"{args.subject}.json").write_text(json.dumps(res, indent=2), encoding="utf-8")
    print(f"Wrote {OUT / (args.subject + '.json')}")


if __name__ == "__main__":
    main()

