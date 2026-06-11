#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Dict

ENH = Path("data/alignment_enhanced")
LLM = Path("data/llm/results")
OUT = Path("data/alignment_llm_merged")


def merge_subject(subject: str):
    enh_p = ENH / f"{subject}.json"
    res_p = LLM / f"{subject}.jsonl"
    if not enh_p.exists() or not res_p.exists():
        raise SystemExit("Missing inputs; run exporter + runner first")
    enh = json.loads(enh_p.read_text(encoding="utf-8"))
    outcomes = enh.get("outcomes", [])
    # map results by code
    results: Dict[str, Dict] = {}
    for line in res_p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        code = str(r.get("code"))
        results[code] = r
    # merge
    for oc in outcomes:
        code = str(oc.get("code"))
        r = results.get(code)
        if not r:
            continue
        oc.setdefault("ai", {})
        for key in ("summary", "bullets", "sources"):
            if key in r:
                oc["ai"][key] = r[key]
    OUT.mkdir(parents=True, exist_ok=True)
    out_p = OUT / f"{subject}.json"
    out_p.write_text(json.dumps({"subject": subject, "outcomes": outcomes}, indent=2), encoding="utf-8")
    print(f"Wrote {out_p}")


def main():
    parser = argparse.ArgumentParser(description="Merge LLM results into enhanced alignment")
    parser.add_argument("--subject", required=True, choices=["biology", "chemistry", "physics", "math", "english", "social"])
    args = parser.parse_args()
    merge_subject(args.subject)


if __name__ == "__main__":
    main()

