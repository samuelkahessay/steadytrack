#!/usr/bin/env python3
"""
Verify the consolidation of LLM-refined outcomes.
Checks:
1. Outcome counts match cache
2. Descriptions have proper capitalization (start with "- ")
3. No duplicate codes
4. Structure consistency
"""

import json
from pathlib import Path
from collections import defaultdict

# File mapping
CURRICULUM_FILES = [
    "bio-20.json",
    "bio-30.json",
    "chem-20.json",
    "chem-30.json",
    "phys-20.json",
    "phys-30.json",
    "math-20-1.json",
    "math-30-1.json",
    "ela-20-1.json",
    "ela-30-1.json",
    "social-20-1.json",
    "social-30-1.json"
]

def verify_curriculum_files(curriculum_dir, cache_path):
    """Verify curriculum files against cache."""

    # Load cache
    with open(cache_path, 'r') as f:
        cache = json.load(f)

    cache_count = len(cache)

    # Verification stats
    total_outcomes = 0
    all_codes = []
    issues = []
    file_stats = {}
    total_file_duplicates = 0

    # Check each file
    for filename in CURRICULUM_FILES:
        file_path = curriculum_dir / filename

        if not file_path.exists():
            issues.append(f"❌ {filename} not found")
            continue

        with open(file_path, 'r') as f:
            data = json.load(f)

        file_outcomes = 0
        file_issues = []
        file_codes = []

        for unit in data.get("units", []):
            for outcome in unit.get("outcomes", []):
                code = outcome.get("code", "")
                desc = outcome.get("description", "")

                file_outcomes += 1
                all_codes.append(code)
                file_codes.append(code)

                # Check description format
                if not desc.startswith("- "):
                    file_issues.append(f"  ⚠️  {code}: Description doesn't start with '- '")

                # Check if first letter after "- " is capitalized
                if len(desc) > 2 and desc[2].islower():
                    file_issues.append(f"  ⚠️  {code}: Description not capitalized: {desc[:50]}...")

                # Check required fields
                if not code:
                    file_issues.append(f"  ❌ Missing code in {unit.get('id', 'unknown unit')}")
                if not desc:
                    file_issues.append(f"  ❌ {code}: Missing description")

        # Check for duplicates within this file
        file_code_counts = defaultdict(int)
        for code in file_codes:
            file_code_counts[code] += 1

        file_duplicates = {code: count for code, count in file_code_counts.items() if count > 1}
        if file_duplicates:
            total_file_duplicates += len(file_duplicates)
            file_issues.append(f"\n  ❌ DUPLICATES IN {filename}:")
            for code, count in file_duplicates.items():
                file_issues.append(f"    {code}: {count} occurrences")

        total_outcomes += file_outcomes
        file_stats[filename] = {
            "outcomes": file_outcomes,
            "issues": file_issues
        }

        if file_issues:
            issues.extend([f"\n{filename}:"] + file_issues)

    # Summary
    return {
        "cache_count": cache_count,
        "total_outcomes": total_outcomes,
        "matches": total_outcomes == cache_count,
        "duplicates": total_file_duplicates,
        "issues": issues,
        "file_stats": file_stats
    }

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Verify outcome consolidation")
    parser.add_argument("--cache", default="data/reports/llm_cache.json", help="Path to LLM cache file")
    parser.add_argument("--curriculum-dir", default="data/curriculum", help="Path to curriculum directory")
    parser.add_argument("--report", help="Path to save report")
    args = parser.parse_args()

    base_dir = Path("/Users/skahessay/Desktop/steadytrack")
    cache_path = base_dir / args.cache
    curriculum_dir = base_dir / args.curriculum_dir

    print("🔍 VERIFYING CONSOLIDATION")
    print("=" * 60 + "\n")

    results = verify_curriculum_files(curriculum_dir, cache_path)

    # Print summary
    print(f"Cache outcomes:        {results['cache_count']}")
    print(f"Curriculum outcomes:   {results['total_outcomes']}")
    print(f"Match:                 {'✅ YES' if results['matches'] else '❌ NO'}")
    print(f"Duplicates found:      {results['duplicates']}")
    print()

    # Print file breakdown
    print("FILE BREAKDOWN:")
    print("-" * 60)
    for filename, stats in results['file_stats'].items():
        status = "✅" if not stats['issues'] else "⚠️ "
        print(f"{status} {filename}: {stats['outcomes']} outcomes")
    print()

    # Print issues
    if results['issues']:
        print("ISSUES FOUND:")
        print("-" * 60)
        for issue in results['issues']:
            print(issue)
        print()
        print("❌ VERIFICATION FAILED")
    else:
        print("✅ VERIFICATION PASSED - No issues found!")

    # Generate report
    if args.report:
        report_path = base_dir / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)

        with open(report_path, 'w') as f:
            f.write("CONSOLIDATION VERIFICATION REPORT\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Cache outcomes:        {results['cache_count']}\n")
            f.write(f"Curriculum outcomes:   {results['total_outcomes']}\n")
            f.write(f"Match:                 {'YES' if results['matches'] else 'NO'}\n")
            f.write(f"Duplicates found:      {results['duplicates']}\n\n")

            f.write("FILE BREAKDOWN:\n")
            f.write("-" * 60 + "\n")
            for filename, stats in results['file_stats'].items():
                f.write(f"{filename}: {stats['outcomes']} outcomes\n")
            f.write("\n")

            if results['issues']:
                f.write("ISSUES FOUND:\n")
                f.write("-" * 60 + "\n")
                for issue in results['issues']:
                    f.write(issue + "\n")
            else:
                f.write("✅ NO ISSUES FOUND\n")

        print(f"\n📄 Report saved to {report_path.relative_to(base_dir)}")

if __name__ == "__main__":
    main()
