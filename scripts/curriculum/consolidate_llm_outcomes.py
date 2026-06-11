#!/usr/bin/env python3
"""
Consolidate LLM-refined outcomes into curriculum files.

This script:
1. Loads the LLM cache (data/reports/llm_cache.json)
2. Updates existing outcomes in curriculum files with refined descriptions
3. Adds missing outcomes to appropriate units
4. Removes duplicate outcomes (social studies)
5. Generates a consolidation report

Usage:
    python3 scripts/curriculum/consolidate_llm_outcomes.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set

# Paths
ROOT = Path(__file__).resolve().parents[2]
CACHE_PATH = ROOT / "data" / "reports" / "llm_cache.json"
CURRICULUM_DIR = ROOT / "data" / "curriculum"
REPORT_PATH = ROOT / "data" / "reports" / "consolidation_report.txt"

# Mapping from cache prefix to curriculum file
CURRICULUM_FILE_MAP = {
    "biology-20": "bio-20.json",
    "biology-30": "bio-30.json",
    "chemistry-20": "chem-20.json",
    "chemistry-30": "chem-30.json",
    "physics-20": "phys-20.json",
    "physics-30": "phys-30.json",
    "mathematics-20-1": "math-20-1.json",
    "math-30-1": "math-30-1.json",
    "english-language-arts-20-1": "ela-20-1.json",
    "english-language-arts-30-1": "ela-30-1.json",
    "social-studies-20-1": "social-20-1.json",
    "social-studies-30-1": "social-30-1.json",
}


def load_llm_cache() -> Dict[str, str]:
    """Load LLM cache from JSON file."""
    with open(CACHE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_curriculum_file(filename: str) -> dict:
    """Load curriculum JSON file."""
    path = CURRICULUM_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_curriculum_file(filename: str, data: dict) -> None:
    """Save curriculum JSON file with proper formatting."""
    path = CURRICULUM_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")  # Add trailing newline


def infer_unit_from_code(code: str, units: List[dict]) -> Optional[str]:
    """
    Infer which unit an outcome belongs to based on its code.

    Examples:
    - 20-A1.1k → Unit with outcomes starting with 20-A
    - 30-D2.3s → Unit with outcomes starting with 30-D
    """
    # Extract the unit letter/pattern (e.g., "20-A", "30-D")
    # Handle codes like "20-A1.1k" → "20-A"
    if "-" in code:
        parts = code.split("-")
        if len(parts) >= 2:
            # Get level (e.g., "20" or "30")
            level = parts[0]
            # Get unit letter (first char after level)
            if parts[1] and parts[1][0].isalpha():
                unit_letter = parts[1][0]
                prefix = f"{level}-{unit_letter}"

                # Find unit with outcomes matching this prefix
                for unit in units:
                    for outcome in unit.get("outcomes", []):
                        outcome_code = outcome.get("code", "")
                        if outcome_code.startswith(prefix):
                            return unit["id"]

    # Fallback: return first unit's ID
    return units[0]["id"] if units else None


def infer_category_from_code(code: str) -> Optional[str]:
    """
    Infer outcome category from code suffix.

    Examples:
    - 20-A1.1k → "knowledge"
    - 20-A1.1s → "skills"
    - 20-A1.1sts → "sts"
    """
    code_lower = code.lower()
    if code_lower.endswith("sts"):
        return "sts"
    elif code_lower.endswith("s"):
        return "skills"
    elif code_lower.endswith("k"):
        return "knowledge"
    return None


def infer_parent_from_code(code: str) -> Optional[str]:
    """
    Infer parent outcome code from specific outcome code.

    Examples:
    - 20-A1.1k → 20-A1
    - 20-A1.2s → 20-A1
    - 30-D2.3sts → 30-D2
    """
    # Remove category suffix (k, s, sts)
    code_no_suffix = code.rstrip("ksts")

    # Find the parent (remove the .X part)
    if "." in code_no_suffix:
        return code_no_suffix.split(".")[0]

    return None


def get_outcome_type(code: str) -> str:
    """
    Determine if outcome is general or specific.
    General outcomes have no suffix: 20-A1, 30-D2
    Specific outcomes have suffixes: 20-A1.1k, 30-D2.3s
    """
    # General outcomes are like "20-A1" or "30-D2" (no period)
    if "." not in code:
        return "general"
    return "specific"


def consolidate_subject(
    subject_key: str,
    filename: str,
    cache_outcomes: Dict[str, str],
    dry_run: bool = False
) -> Dict[str, any]:
    """
    Consolidate outcomes for a single subject.

    Returns:
        Dictionary with consolidation statistics
    """
    print(f"\n{'='*60}")
    print(f"Processing: {filename} ({subject_key})")
    print(f"{'='*60}")

    # Load curriculum file
    curriculum = load_curriculum_file(filename)
    units = curriculum.get("units", [])

    # Track statistics
    stats = {
        "subject": subject_key,
        "filename": filename,
        "updated": 0,
        "added": 0,
        "duplicates_removed": 0,
        "total_before": 0,
        "unique_before": 0,
        "existing_after": 0,
        "cache_count": len(cache_outcomes),
    }

    # Count total outcomes and build set of existing outcome codes
    total_outcomes_before = 0
    existing_codes: Set[str] = set()
    for unit in units:
        for outcome in unit.get("outcomes", []):
            total_outcomes_before += 1
            code = outcome.get("code", "")
            if code in existing_codes:
                # Track duplicates
                stats["duplicates_removed"] += 1
                print(f"  ⚠️  Duplicate found: {code}")
            existing_codes.add(code)

    stats["total_before"] = total_outcomes_before
    stats["unique_before"] = len(existing_codes)

    # Remove duplicates from curriculum (globally across all units)
    global_seen = set()
    for unit in units:
        unique_outcomes = []
        for outcome in unit.get("outcomes", []):
            code = outcome.get("code", "")
            if code not in global_seen:
                global_seen.add(code)
                unique_outcomes.append(outcome)
        unit["outcomes"] = unique_outcomes

    # Update existing outcomes with refined descriptions
    for unit in units:
        for outcome in unit.get("outcomes", []):
            code = outcome.get("code", "")
            if code in cache_outcomes:
                old_desc = outcome.get("description", "")
                new_desc = cache_outcomes[code]

                if old_desc != new_desc:
                    outcome["description"] = new_desc
                    stats["updated"] += 1
                    print(f"  ✏️  Updated: {code}")

    # Add missing outcomes
    for code, description in cache_outcomes.items():
        if code not in existing_codes:
            # Determine which unit to add to
            unit_id = infer_unit_from_code(code, units)

            if unit_id:
                # Find the unit
                target_unit = None
                for unit in units:
                    if unit["id"] == unit_id:
                        target_unit = unit
                        break

                if target_unit:
                    # Create new outcome
                    new_outcome = {
                        "code": code,
                        "description": description,
                    }

                    # Add type/category based on code
                    outcome_type = get_outcome_type(code)
                    if outcome_type == "general":
                        new_outcome["type"] = "general"
                    else:
                        # Specific outcome - add category and parent
                        category = infer_category_from_code(code)
                        parent = infer_parent_from_code(code)

                        if category:
                            new_outcome["category"] = category
                        if parent:
                            new_outcome["parent"] = parent

                    # Add to unit
                    target_unit["outcomes"].append(new_outcome)
                    stats["added"] += 1
                    print(f"  ➕ Added: {code} → {unit_id}")
                else:
                    print(f"  ❌ Could not find unit: {unit_id} for {code}")
            else:
                print(f"  ❌ Could not infer unit for: {code}")

    # Count final outcomes
    final_count = sum(len(unit.get("outcomes", [])) for unit in units)
    stats["existing_after"] = final_count

    # Save updated curriculum file
    if not dry_run:
        save_curriculum_file(filename, curriculum)
        print(f"\n  💾 Saved: {filename}")
    else:
        print(f"\n  🔍 Dry run - not saving")

    # Print summary
    print(f"\n  Summary:")
    print(f"    Cache outcomes:       {stats['cache_count']}")
    print(f"    Before (total):       {stats['total_before']}")
    print(f"    Before (unique):      {stats['unique_before']}")
    print(f"    Duplicates removed:   {stats['duplicates_removed']}")
    print(f"    Updated:              {stats['updated']}")
    print(f"    Added:                {stats['added']}")
    print(f"    After:                {stats['existing_after']}")

    # Check if we reached target
    if stats['existing_after'] == stats['cache_count']:
        print(f"    ✅ Complete match!")
    else:
        diff = stats['cache_count'] - stats['existing_after']
        print(f"    ⚠️  Gap: {diff} outcomes")

    return stats


def main():
    parser = argparse.ArgumentParser(description="Consolidate LLM-refined outcomes")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without saving changes"
    )
    args = parser.parse_args()

    print("="*60)
    print("LLM Outcome Consolidation Script")
    print("="*60)

    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be saved")

    # Load LLM cache
    print(f"\nLoading LLM cache from: {CACHE_PATH}")
    full_cache = load_llm_cache()
    print(f"✅ Loaded {len(full_cache)} outcomes from cache")

    # Group cache outcomes by subject
    cache_by_subject = defaultdict(dict)
    for key, description in full_cache.items():
        if "::" in key:
            subject, code = key.split("::", 1)
            cache_by_subject[subject][code] = description

    # Process each subject
    all_stats = []
    for subject_key, filename in CURRICULUM_FILE_MAP.items():
        if subject_key in cache_by_subject:
            stats = consolidate_subject(
                subject_key,
                filename,
                cache_by_subject[subject_key],
                dry_run=args.dry_run
            )
            all_stats.append(stats)
        else:
            print(f"\n⚠️  No cache outcomes found for: {subject_key}")

    # Generate summary report
    print(f"\n{'='*60}")
    print("CONSOLIDATION SUMMARY")
    print(f"{'='*60}\n")

    total_updated = sum(s["updated"] for s in all_stats)
    total_added = sum(s["added"] for s in all_stats)
    total_duplicates = sum(s["duplicates_removed"] for s in all_stats)
    total_before_total = sum(s["total_before"] for s in all_stats)
    total_before_unique = sum(s["unique_before"] for s in all_stats)
    total_after = sum(s["existing_after"] for s in all_stats)
    total_cache = sum(s["cache_count"] for s in all_stats)

    print(f"Total cache outcomes:        {total_cache}")
    print(f"Total before (with dupes):   {total_before_total}")
    print(f"Total before (unique):       {total_before_unique}")
    print(f"  Duplicates removed:        {total_duplicates}")
    print(f"  Descriptions updated:      {total_updated}")
    print(f"  New outcomes added:        {total_added}")
    print(f"Total after consolidation:   {total_after}")

    if total_after == total_cache:
        print(f"\n✅ SUCCESS: All cache outcomes consolidated!")
    else:
        gap = total_cache - total_after
        print(f"\n⚠️  Gap: {gap} outcomes not consolidated")
        print(f"   Coverage: {total_after}/{total_cache} ({100*total_after/total_cache:.1f}%)")

    # Save report
    if not args.dry_run:
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            f.write("LLM OUTCOME CONSOLIDATION REPORT\n")
            f.write("="*60 + "\n\n")
            f.write(f"Total cache outcomes:        {total_cache}\n")
            f.write(f"Total before (with dupes):   {total_before_total}\n")
            f.write(f"Total before (unique):       {total_before_unique}\n")
            f.write(f"  Duplicates removed:        {total_duplicates}\n")
            f.write(f"  Descriptions updated:      {total_updated}\n")
            f.write(f"  New outcomes added:        {total_added}\n")
            f.write(f"Total after consolidation:   {total_after}\n\n")

            f.write("BY SUBJECT:\n")
            f.write("-"*60 + "\n")
            for stats in all_stats:
                f.write(f"\n{stats['subject']} ({stats['filename']}):\n")
                f.write(f"  Cache:         {stats['cache_count']}\n")
                f.write(f"  Before (total): {stats['total_before']}\n")
                f.write(f"  Before (unique): {stats['unique_before']}\n")
                f.write(f"  Duplicates:    {stats['duplicates_removed']}\n")
                f.write(f"  Updated:       {stats['updated']}\n")
                f.write(f"  Added:         {stats['added']}\n")
                f.write(f"  After:         {stats['existing_after']}\n")

                if stats['existing_after'] == stats['cache_count']:
                    f.write(f"  Status:        ✅ Complete\n")
                else:
                    gap = stats['cache_count'] - stats['existing_after']
                    f.write(f"  Status:        ⚠️  Gap: {gap}\n")

        print(f"\n📄 Report saved to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
