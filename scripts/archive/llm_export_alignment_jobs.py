#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Dict, List

ENH = Path("data/alignment_enhanced")
OUT = Path("data/llm/jobs")


def export_subject(subject: str, limit: int = 0) -> int:
    path = ENH / f"{subject}.json"
    if not path.exists():
        raise SystemExit(f"Enhanced alignment not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    outcomes = data.get("outcomes", [])
    if limit:
        outcomes = outcomes[:limit]
    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{subject}.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for oc in outcomes:
            rec = {
                "subject": subject,
                "code": oc.get("code"),
                "description": oc.get("description"),
                "evidence": oc.get("evidence", []),
                "instructions": (
                    "Rewrite the evidence into a clear, student-friendly explanation that addresses the outcome. "
                    "Produce: (1) a 2–4 sentence summary in plain English; (2) 3 short bullet points; "
                    "Avoid copying noisy fragments. Do not include citation brackets; keep it neutral."
                ),
                "format": {
                    "summary": "string",
                    "bullets": ["string"],
                    "sources": [{"doc_stem": "string", "pages": [0]}],
                },
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return len(outcomes)


def main():
    parser = argparse.ArgumentParser(description="Export LLM jobs for enhanced alignment")
    parser.add_argument("--subject", required=True, choices=["biology", "chemistry", "physics", "math", "english", "social"])
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    n = export_subject(args.subject, args.limit)
    print(f"Wrote {n} jobs to {OUT / (args.subject + '.jsonl')}")


if __name__ == "__main__":
    main()

