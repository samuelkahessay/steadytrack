#!/usr/bin/env python3
"""
Scrape Official Alberta Curriculum Outcomes

Extracts learning outcomes from curriculum.learnalberta.ca for all high school courses.

Usage:
    python scripts/curriculum/scrape_alberta_curriculum.py

    # Or for a specific course:
    python scripts/curriculum/scrape_alberta_curriculum.py --course MAT3791
"""

import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "curriculum" / "alberta-official"

# Course URLs to scrape
COURSES = {
    # Math
    "MAT2791": {
        "name": "Math 20-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/MAT_HS/MAT2791",
        "grade": 11
    },
    "MAT3791": {
        "name": "Math 30-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/MAT_HS/MAT3791",
        "grade": 12
    },
    # Biology
    "SCI2041": {
        "name": "Biology 20",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI2041",
        "grade": 11
    },
    "SCI3041": {
        "name": "Biology 30",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI3041",
        "grade": 12
    },
    # Chemistry
    "SCI2031": {
        "name": "Chemistry 20",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI2031",
        "grade": 11
    },
    "SCI3031": {
        "name": "Chemistry 30",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI3031",
        "grade": 12
    },
    # Physics
    "SCI2021": {
        "name": "Physics 20",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI2021",
        "grade": 11
    },
    "SCI3021": {
        "name": "Physics 30",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SCI_HS/SCI3021",
        "grade": 12
    },
    # English Language Arts
    "ENG2791": {
        "name": "ELA 20-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/ENG_HS/ENG2791",
        "grade": 11
    },
    "ENG3791": {
        "name": "ELA 30-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/ENG_HS/ENG3791",
        "grade": 12
    },
    # Social Studies
    "SOC2791": {
        "name": "Social 20-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SOC_HS/SOC2791",
        "grade": 11
    },
    "SOC3791": {
        "name": "Social 30-1",
        "url": "https://curriculum.learnalberta.ca/curriculum/en/pos/SOC_HS/SOC3791",
        "grade": 12
    },
}


def scrape_course_outcomes(page: Page, url: str, course_code: str) -> Dict:
    """
    Scrape outcomes from a curriculum page.

    Returns dict with structure:
    {
        "course": "Math 30-1",
        "courseCode": "MAT3791",
        "outcomes": [...]
    }
    """
    print(f"  Navigating to: {url}")

    try:
        page.goto(url, wait_until="networkidle", timeout=30000)

        # Wait for content to load
        page.wait_for_selector('body', timeout=10000)

        # Extract page title
        title = page.title()
        print(f"  Page title: {title}")

        # Try to find outcomes/competencies
        # The structure varies by course, so we'll try multiple selectors

        outcomes = []

        # Method 1: Look for specific outcome containers
        outcome_elements = page.query_selector_all('[data-outcome], .outcome, .competency, .learning-outcome')

        if outcome_elements:
            print(f"  Found {len(outcome_elements)} outcome elements")

            for elem in outcome_elements:
                code = elem.query_selector('.outcome-code, .code')
                description = elem.query_selector('.outcome-description, .description, .text')

                if code and description:
                    outcomes.append({
                        "code": code.inner_text().strip(),
                        "description": description.inner_text().strip()
                    })

        # Method 2: Try to extract from table structures
        if not outcomes:
            rows = page.query_selector_all('table tr, .outcome-row')
            print(f"  Trying table structure... found {len(rows)} rows")

            for row in rows:
                cells = row.query_selector_all('td, .cell')
                if len(cells) >= 2:
                    # Assume first cell is code, second is description
                    code_text = cells[0].inner_text().strip()
                    desc_text = cells[1].inner_text().strip()

                    if code_text and desc_text and len(code_text) < 20:
                        outcomes.append({
                            "code": code_text,
                            "description": desc_text
                        })

        # Always save raw HTML for inspection
        print("  Saving page HTML for inspection...")
        html = page.content()
        debug_file = OUTPUT_DIR / f"{course_code}_debug.html"
        debug_file.write_text(html, encoding='utf-8')
        print(f"  HTML saved to: {debug_file}")

        if not outcomes:
            print("  ⚠️  Could not find outcomes automatically")

        return {
            "course": COURSES[course_code]["name"],
            "courseCode": course_code,
            "url": url,
            "pageTitle": title,
            "outcomes": outcomes,
            "outcomeCount": len(outcomes)
        }

    except PlaywrightTimeout as e:
        print(f"  ✗ Timeout: {e}")
        return {
            "course": COURSES[course_code]["name"],
            "courseCode": course_code,
            "url": url,
            "error": f"Timeout: {str(e)}",
            "outcomes": []
        }
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return {
            "course": COURSES[course_code]["name"],
            "courseCode": course_code,
            "url": url,
            "error": str(e),
            "outcomes": []
        }


def main():
    parser = argparse.ArgumentParser(description="Scrape Alberta curriculum outcomes")
    parser.add_argument(
        "--course",
        help="Specific course code to scrape (e.g., MAT3791). If not provided, scrapes all courses."
    )
    args = parser.parse_args()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("Alberta Curriculum Scraper")
    print("=" * 80)

    # Filter courses if specific course requested
    courses_to_scrape = COURSES
    if args.course:
        if args.course not in COURSES:
            print(f"❌ Unknown course code: {args.course}")
            print(f"Available courses: {', '.join(COURSES.keys())}")
            return
        courses_to_scrape = {args.course: COURSES[args.course]}

    print(f"\nScraping {len(courses_to_scrape)} course(s)...\n")

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Set user agent to avoid bot detection
        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        for course_code, course_info in courses_to_scrape.items():
            print(f"\n[{course_code}] {course_info['name']} (Grade {course_info['grade']})")
            print("-" * 80)

            result = scrape_course_outcomes(page, course_info["url"], course_code)
            results.append(result)

            # Save individual course file
            output_file = OUTPUT_DIR / f"{course_code.lower()}-outcomes.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"  ✓ Saved to: {output_file}")
            print(f"  Outcomes found: {result['outcomeCount']}")

        browser.close()

    # Save summary
    summary_file = OUTPUT_DIR / "scrape_summary.json"
    summary = {
        "totalCourses": len(results),
        "totalOutcomes": sum(r["outcomeCount"] for r in results),
        "courses": results
    }

    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 80)
    print("Summary")
    print("=" * 80)
    print(f"Courses scraped: {len(results)}")
    print(f"Total outcomes: {summary['totalOutcomes']}")
    print(f"\nSummary saved to: {summary_file}")

    # Show courses that had no outcomes
    failed = [r for r in results if r["outcomeCount"] == 0]
    if failed:
        print(f"\n⚠️  {len(failed)} course(s) had no outcomes extracted:")
        for r in failed:
            print(f"  - {r['course']} ({r['courseCode']})")
            if "error" in r:
                print(f"    Error: {r['error']}")

    print("\n✅ Scraping complete!")


if __name__ == "__main__":
    main()
