#!/usr/bin/env python3
"""
Flag resources whose titles/URLs do not appear to correlate with their aligned outcomes.

This script DOES NOT modify any curriculum files. It only generates a report.

Heuristics (conservative to reduce false positives):
- Tokenize resource title + URL slug (provider noise removed) and compare with outcome text (description/title) tokens.
- Accept if any aligned outcome has token overlap above a similarity threshold (default 0.30 Jaccard).
- Also accept if resource tokens align reasonably with the unit topics (threshold 0.30) to avoid strict flags.
- Otherwise, flag as a potential mismatch.

Output: Markdown report at out/outcome_resource_mismatches.md and optional JSON at out/outcome_resource_mismatches.json

Usage:
  python3 scripts/curriculum/flag_outcome_resource_mismatches.py --report-md out/outcome_resource_mismatches.md --report-json out/outcome_resource_mismatches.json
  # Filter by levels or subjects
  python3 scripts/curriculum/flag_outcome_resource_mismatches.py --levels 20,30 --subjects bio,chem
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
CURRICULUM_DIR = ROOT / "data" / "curriculum"


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_files(levels: List[str], subjects: Optional[List[str]]) -> List[Path]:
    files: List[Path] = []
    for p in CURRICULUM_DIR.glob("*.json"):
        name = p.name
        if not any(name.endswith(f"-{lv}.json") or name.endswith(f"-{lv}-1.json") or name.endswith(f"{lv}.json") for lv in levels):
            continue
        if subjects and not any(name.startswith(s) for s in subjects):
            continue
        files.append(p)
    return sorted(files)


def tokenize(text: str) -> List[str]:
    t = (text or "").lower()
    # Remove provider/site suffixes: | Khan Academy, | OpenStax, etc.
    t = re.sub(r"\s*[|\-–]\s*(khan academy|openstax|libretexts).*?$", "", t)
    words = re.findall(r"[a-z]+", t)
    stop = {"the", "a", "an", "and", "of", "to", "for", "in", "on", "vs"}
    return [w for w in words if w not in stop]


def slug_tokens(url: str) -> List[str]:
    u = url.split("?")[0].strip("/")
    seg = ""
    for s in reversed(u.split("/")):
        if s:
            seg = s
            break
    seg = seg.replace("%20", "-")
    seg = re.sub(r"[\-_/]+", " ", seg)
    seg = re.sub(r"\b(2e|ap|beta|overview)\b", " ", seg)
    return tokenize(seg)


def jaccard(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def outcome_text_tokens(outcome: Dict[str, Any]) -> List[str]:
    text = outcome.get("description") or outcome.get("title") or ""
    return tokenize(text)


def best_outcome_similarity(resource_tokens: List[str], outcomes: List[Dict[str, Any]], aligned_codes: List[str]) -> float:
    best = 0.0
    oc_by_code = {o.get("code"): o for o in outcomes}
    for c in aligned_codes:
        o = oc_by_code.get(c)
        if not o:
            continue
        ot = outcome_text_tokens(o)
        s = jaccard(resource_tokens, ot)
        if s > best:
            best = s
    return best


def tokens_from_topics(topics: List[str]) -> List[str]:
    toks: List[str] = []
    for t in topics or []:
        toks.extend(tokenize(t))
    # Deduplicate but keep as list for jaccard simplicity
    return list(dict.fromkeys(toks))


def main():
    parser = argparse.ArgumentParser(description="Flag outcome-resource correlation issues")
    parser.add_argument("--levels", default="20,30", help="Comma-separated levels to include (default: 20,30)")
    parser.add_argument("--subjects", help="Comma-separated subject prefixes (bio,chem,phys,math,ela,social)")
    parser.add_argument("--threshold", type=float, default=0.15, help="Jaccard threshold for outcome match (default: 0.15)")
    parser.add_argument("--topic-threshold", type=float, default=0.20, help="Jaccard threshold for unit topics fallback (default: 0.20)")
    parser.add_argument("--report-md", default=str(ROOT / "out" / "outcome_resource_mismatches.md"))
    parser.add_argument("--report-json", default=str(ROOT / "out" / "outcome_resource_mismatches.json"))
    args = parser.parse_args()

    levels = [lv.strip() for lv in args.levels.split(",") if lv.strip()]
    subjects = [s.strip() for s in args.subjects.split(",")] if args.subjects else None

    files = find_files(levels, subjects)
    out_md = Path(args.report_md)
    out_json = Path(args.report_json)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)

    flagged: List[Dict[str, Any]] = []
    total_resources = 0

    for f in files:
        data = load_json(f)
        file_rel = str(f.relative_to(ROOT))
        for unit in data.get("units", []) or []:
            unit_id = unit.get("id") or unit.get("title") or "unit"
            outcomes = unit.get("outcomes", []) or []
            topics = unit.get("topics", []) or []
            topic_tokens = tokens_from_topics(topics)
            unit_title_tokens = tokenize(unit.get("title") or "")
            for res in unit.get("resources", []) or []:
                url = (res.get("url") or "").strip()
                if not url:
                    continue
                total_resources += 1
                title = res.get("title") or ""
                aligned = res.get("alignedOutcomes") or []
                # Build resource token set from title + URL slug
                rt = tokenize(title)
                rt_slug = slug_tokens(url)
                res_tokens = list(dict.fromkeys(rt + rt_slug))

                best_out_sim = best_outcome_similarity(res_tokens, outcomes, aligned)
                # Token overlap with aligned outcomes (merged) — a single meaningful overlap is acceptable
                merged_out_tokens: List[str] = []
                if aligned:
                    oc_by_code = {o.get("code"): o for o in outcomes}
                    for c in aligned:
                        o = oc_by_code.get(c)
                        if o:
                            merged_out_tokens.extend(outcome_text_tokens(o))
                merged_out_set = set(merged_out_tokens)
                res_set = set(res_tokens)
                outcome_overlap = len(res_set & merged_out_set)

                # Fallback to topic correlation to avoid strict flags
                topic_sim = jaccard(res_tokens, topic_tokens)
                unit_title_sim = jaccard(res_tokens, unit_title_tokens)
                topic_overlap = len(res_set & set(topic_tokens))
                unit_title_overlap = len(res_set & set(unit_title_tokens))

                if not aligned:
                    # If nothing aligned, flag (resource should have aligned outcomes)
                    do_flag = True
                else:
                    do_flag = (
                        best_out_sim < args.threshold and
                        topic_sim < args.topic_threshold and
                        unit_title_sim < 0.20 and
                        outcome_overlap == 0 and
                        topic_overlap == 0 and
                        unit_title_overlap == 0
                    )

                if do_flag:
                    flagged.append({
                        "file": file_rel,
                        "unit_id": unit_id,
                        "resource": {
                            "title": title,
                            "url": url,
                            "alignedOutcomes": aligned,
                        },
                        "scores": {
                            "bestOutcomeSim": round(best_out_sim, 3),
                            "topicSim": round(topic_sim, 3),
                            "unitTitleSim": round(unit_title_sim, 3),
                            "outcomeOverlap": outcome_overlap,
                            "topicOverlap": topic_overlap,
                            "unitTitleOverlap": unit_title_overlap,
                        }
                    })

    # Write Markdown report
    lines: List[str] = []
    lines.append("# Outcome–Resource Correlation Flags")
    lines.append("")
    lines.append(f"Total resources scanned: {total_resources}")
    lines.append(f"Potential mismatches: {len(flagged)}")
    lines.append("")
    current_file = None
    current_unit = None
    for item in flagged:
        if item["file"] != current_file:
            lines.append(f"## {item['file']}")
            current_file = item["file"]
            current_unit = None
        if item["unit_id"] != current_unit:
            lines.append(f"- Unit `{item['unit_id']}`")
            current_unit = item["unit_id"]
        r = item["resource"]
        s = item["scores"]
        lines.append(f"  - Title: {r['title']}")
        lines.append(f"    - URL: {r['url']}")
        lines.append(f"    - Aligned outcomes: {', '.join(r.get('alignedOutcomes') or [])}")
        lines.append(f"    - Scores: outcomeSim={s['bestOutcomeSim']} topicSim={s['topicSim']}")
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Write JSON as well
    out_json.write_text(json.dumps({
        "total": total_resources,
        "flagged": flagged,
    }, indent=2), encoding="utf-8")

    print(f"Scanned resources: {total_resources}")
    print(f"Flagged potential mismatches: {len(flagged)}")
    print(f"Markdown report: {out_md}")
    print(f"JSON report: {out_json}")


if __name__ == "__main__":
    main()
