#!/usr/bin/env python3
"""
Update alignment files with LLM-refined outcome descriptions.
"""

import json
import sys
from pathlib import Path

# Subject mapping: alignment file name -> cache prefix(es)
SUBJECT_MAPPING = {
    "biology": ["biology-20", "biology-30"],
    "chemistry": ["chemistry-20", "chemistry-30"],
    "physics": ["physics-20", "physics-30"],
    "english": ["english-language-arts-20-1", "english-language-arts-30-1"],
    "math": ["mathematics-20-1", "math-30-1"],
    "social": ["social-studies-20-1", "social-studies-30-1"]
}

def load_llm_cache(cache_path):
    """Load LLM-refined outcomes from cache."""
    with open(cache_path, 'r') as f:
        return json.load(f)

def update_alignment_file(alignment_path, cache, subject_prefixes):
    """Update alignment file with LLM-refined descriptions."""
    with open(alignment_path, 'r') as f:
        data = json.load(f)

    stats = {
        "total_outcomes": 0,
        "updated": 0,
        "not_found": 0,
        "not_found_codes": []
    }

    # Build a lookup map from cache
    cache_map = {}
    for key, value in cache.items():
        # Key format: "biology-20::20-A1.1k"
        if '::' in key:
            _, code = key.split('::', 1)
            cache_map[code] = value

    # Update outcomes
    for outcome in data.get("outcomes", []):
        stats["total_outcomes"] += 1
        code = outcome.get("code", "")

        if code in cache_map:
            # Update description
            old_desc = outcome.get("description", "")
            new_desc = cache_map[code]

            if old_desc != new_desc:
                outcome["description"] = new_desc
                stats["updated"] += 1
        else:
            stats["not_found"] += 1
            stats["not_found_codes"].append(code)

    return data, stats

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update alignment files with LLM-refined descriptions")
    parser.add_argument("--cache", default="data/reports/llm_cache.json", help="Path to LLM cache file")
    parser.add_argument("--alignment-dir", default="data/alignment_llm_merged", help="Path to alignment directory")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without saving")
    parser.add_argument("--report", help="Path to save report")
    args = parser.parse_args()

    base_dir = Path("/Users/skahessay/Desktop/steadytrack")
    cache_path = base_dir / args.cache
    alignment_dir = base_dir / args.alignment_dir

    # Load cache
    print(f"📖 Loading LLM cache from {cache_path.relative_to(base_dir)}...")
    cache = load_llm_cache(cache_path)
    print(f"   Found {len(cache)} refined outcomes\n")

    # Process each alignment file
    all_stats = {}
    total_outcomes = 0
    total_updated = 0
    total_not_found = 0

    for subject, prefixes in SUBJECT_MAPPING.items():
        alignment_file = alignment_dir / f"{subject}.json"

        if not alignment_file.exists():
            print(f"⚠️  {subject}.json not found, skipping...")
            continue

        print(f"🔍 Processing {subject}.json...")
        updated_data, stats = update_alignment_file(alignment_file, cache, prefixes)
        all_stats[subject] = stats

        total_outcomes += stats["total_outcomes"]
        total_updated += stats["updated"]
        total_not_found += stats["not_found"]

        # Save updated file
        if not args.dry_run:
            with open(alignment_file, 'w') as f:
                json.dump(updated_data, f, indent=2, ensure_ascii=False)
            print(f"   💾 Saved: {alignment_file.relative_to(base_dir)}")

        print(f"   Outcomes: {stats['total_outcomes']}")
        print(f"   Updated:  {stats['updated']}")
        print(f"   Not found: {stats['not_found']}")
        if stats["not_found_codes"]:
            print(f"   Missing codes: {', '.join(stats['not_found_codes'][:5])}")
            if len(stats["not_found_codes"]) > 5:
                print(f"                  ... and {len(stats['not_found_codes']) - 5} more")
        print()

    # Print summary
    print("=" * 60)
    print("ALIGNMENT FILE UPDATE SUMMARY")
    print("=" * 60)
    print(f"Total outcomes:    {total_outcomes}")
    print(f"Updated:           {total_updated}")
    print(f"Not found:         {total_not_found}")
    print()

    if args.dry_run:
        print("🔍 DRY RUN - No files were modified")
    else:
        print("✅ SUCCESS: Alignment files updated with LLM-refined descriptions!")

    # Generate report if requested
    if args.report and not args.dry_run:
        report_path = base_dir / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)

        with open(report_path, 'w') as f:
            f.write("ALIGNMENT FILE UPDATE REPORT\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Total outcomes:    {total_outcomes}\n")
            f.write(f"Updated:           {total_updated}\n")
            f.write(f"Not found:         {total_not_found}\n\n")
            f.write("BY SUBJECT:\n")
            f.write("-" * 60 + "\n\n")

            for subject, stats in all_stats.items():
                f.write(f"{subject}.json:\n")
                f.write(f"  Outcomes:  {stats['total_outcomes']}\n")
                f.write(f"  Updated:   {stats['updated']}\n")
                f.write(f"  Not found: {stats['not_found']}\n")
                if stats["not_found_codes"]:
                    f.write(f"  Missing:   {', '.join(stats['not_found_codes'])}\n")
                f.write("\n")

        print(f"📄 Report saved to {report_path.relative_to(base_dir)}")

if __name__ == "__main__":
    main()
