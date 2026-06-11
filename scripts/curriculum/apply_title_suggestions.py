#!/usr/bin/env python3
"""
Apply suggested titles from a previous validator report to curriculum files.

Usage:
  python3 scripts/curriculum/apply_title_suggestions.py \
      --report out/title_audit_fixed.json --write

Notes:
- Matches resources by URL within each file. If multiple matches exist, all are updated.
- Only applies when `suggested_title` exists and differs from current title.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[2]


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def apply_report(report_path: Path, write: bool = False) -> Dict[str, int]:
    rep = load_json(report_path)
    applied = 0
    considered = 0
    files_changed = 0

    for file_entry in rep:
        file_rel = file_entry.get("file")
        if not file_rel:
            continue
        file_path = ROOT / file_rel
        if not file_path.exists():
            continue
        data = load_json(file_path)
        changed = False

        units = data.get("units", []) or []
        # Build URL -> (unit_index, resource_index) mapping for faster updates
        url_positions = {}
        for ui, unit in enumerate(units):
            for ri, res in enumerate(unit.get("resources", []) or []):
                u = (res.get("url") or "").strip()
                if u:
                    url_positions.setdefault(u, []).append((ui, ri))

        for unit_entry in file_entry.get("units", []) or []:
            for res in unit_entry.get("resources", []) or []:
                sugg = res.get("suggested_title")
                url = (res.get("url") or "").strip()
                if not sugg or not url:
                    continue
                positions = url_positions.get(url, [])
                for (ui, ri) in positions:
                    considered += 1
                    current = units[ui]["resources"][ri].get("title") or ""
                    if current != sugg:
                        units[ui]["resources"][ri]["title"] = sugg
                        applied += 1
                        changed = True

        if changed and write:
            save_json(file_path, data)
            files_changed += 1

    return {"applied": applied, "considered": considered, "files_changed": files_changed}


def main():
    parser = argparse.ArgumentParser(description="Apply suggested titles from a validator report")
    parser.add_argument("--report", required=True, help="Path to validator JSON report with suggestions")
    parser.add_argument("--write", action="store_true", help="Write changes to curriculum files")
    args = parser.parse_args()

    res = apply_report(Path(args.report), write=args.write)
    print(f"Suggestions considered: {res['considered']}")
    print(f"Titles applied: {res['applied']}")
    print(f"Files changed: {res['files_changed']}")


if __name__ == "__main__":
    main()

