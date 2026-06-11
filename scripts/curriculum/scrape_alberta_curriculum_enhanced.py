#!/usr/bin/env python3
"""
Enhanced Alberta Curriculum Scraper

Scrapes learning outcomes from curriculum.learnalberta.ca with:
- Automatic section expansion
- Verbose logging (tail-friendly)
- Progress indicators
- Comprehensive outcome extraction

Usage:
    python scripts/curriculum/scrape_alberta_curriculum_enhanced.py

    # Or for a specific course:
    python scripts/curriculum/scrape_alberta_curriculum_enhanced.py --course MAT3791

    # Tail the log in another terminal:
    tail -f /tmp/alberta_scraper.log
"""

import json
import argparse
import time
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "curriculum" / "alberta-official"
LOG_FILE = Path("/tmp/alberta_scraper.log")

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


def log(message: str, level: str = "INFO"):
    """Log message to both stdout and log file with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] [{level}] {message}"

    print(formatted, flush=True)

    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(formatted + '\n')


def scrape_course_enhanced(page: Page, url: str, course_code: str) -> Dict:
    """
    Enhanced scraping with section expansion and verbose logging.
    """
    course_name = COURSES[course_code]["name"]
    course_start = time.time()

    log(f"Course: {course_name} ({course_code})")
    log(f"└─ Navigating to: {url}")

    try:
        # Navigate to page
        page.goto(url, wait_until="networkidle", timeout=30000)
        load_time = time.time() - course_start
        log(f"└─ Page loaded ({load_time:.1f}s)")

        # Wait for Angular to render
        log(f"└─ Waiting for content to render...")
        time.sleep(2)

        # Find all expandable sections
        log(f"└─ Finding expandable sections...")
        expand_buttons = page.query_selector_all('[role="button"].details--header')
        section_count = len(expand_buttons)
        log(f"└─ Found {section_count} expandable sections")

        # Expand all sections
        log(f"└─ Expanding all sections...")
        expanded_count = 0
        for i, button in enumerate(expand_buttons, 1):
            try:
                # Get section title if available
                title_elem = button.query_selector('h2, h3, h4')
                section_title = title_elem.inner_text().strip() if title_elem else f"Section {i}"

                log(f"└─ [{i}/{section_count}] Expanding '{section_title[:50]}'...")

                # Click to expand
                button.click()
                time.sleep(0.3)  # Wait for animation
                expanded_count += 1

            except Exception as e:
                log(f"└─ ⚠️  Failed to expand section {i}: {e}", "WARN")
                continue

        log(f"└─ Successfully expanded {expanded_count}/{section_count} sections")

        # Scroll to bottom to trigger lazy loading
        log(f"└─ Scrolling to trigger lazy loading...")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

        # Scroll back to top
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(1)

        # Extract all text content
        log(f"└─ Extracting content...")
        full_html = page.content()

        # Save full expanded HTML for analysis
        expanded_html_file = OUTPUT_DIR / f"{course_code}_expanded.html"
        expanded_html_file.write_text(full_html, encoding='utf-8')
        log(f"└─ Saved expanded HTML: {expanded_html_file.name}")

        # Extract outcomes
        log(f"└─ Parsing outcomes...")
        outcomes = extract_outcomes_from_html(full_html, course_code)

        # Extract organizing ideas/strands
        log(f"└─ Parsing organizing ideas/strands...")
        strands = extract_strands_from_html(full_html)

        total_time = time.time() - course_start
        log(f"└─ Found {len(outcomes)} outcomes, {len(strands)} strands")
        log(f"└─ Course complete ({total_time:.1f}s)")

        return {
            "course": course_name,
            "courseCode": course_code,
            "url": url,
            "scrapedAt": datetime.now().isoformat(),
            "sectionsExpanded": expanded_count,
            "outcomes": outcomes,
            "strands": strands,
            "outcomeCount": len(outcomes),
            "strandCount": len(strands),
            "processingTime": round(total_time, 2)
        }

    except PlaywrightTimeout as e:
        log(f"└─ ✗ Timeout: {e}", "ERROR")
        return {
            "course": course_name,
            "courseCode": course_code,
            "url": url,
            "error": f"Timeout: {str(e)}",
            "outcomes": [],
            "strands": []
        }
    except Exception as e:
        log(f"└─ ✗ Error: {e}", "ERROR")
        return {
            "course": course_name,
            "courseCode": course_code,
            "url": url,
            "error": str(e),
            "outcomes": [],
            "strands": []
        }


def extract_outcomes_from_html(html: str, course_code: str) -> List[Dict]:
    """
    Extract learning outcomes from HTML.

    Looks for patterns like:
    - "General Outcome:"
    - "Specific Outcome:"
    - Outcome codes (RF.1, RF.2, etc.)
    """
    from bs4 import BeautifulSoup

    outcomes = []
    soup = BeautifulSoup(html, 'html.parser')

    # Look for outcome text patterns
    # This is a simplified extraction - may need refinement based on actual HTML structure
    text = soup.get_text()

    # Search for common outcome patterns
    import re

    # Pattern 1: "General Outcome: <description>"
    general_outcomes = re.findall(r'General Outcome[:\s]+([^\n]+)', text, re.IGNORECASE)
    for i, desc in enumerate(general_outcomes, 1):
        outcomes.append({
            "type": "general",
            "code": f"GO{i}",
            "description": desc.strip()
        })

    # Pattern 2: "Specific Outcome: <description>"
    specific_outcomes = re.findall(r'Specific Outcome[:\s]+([^\n]+)', text, re.IGNORECASE)
    for i, desc in enumerate(specific_outcomes, 1):
        outcomes.append({
            "type": "specific",
            "code": f"SO{i}",
            "description": desc.strip()
        })

    # Pattern 3: Look for outcome codes like "RF.1", "30-1.RF.1", etc.
    code_patterns = [
        r'\b([A-Z]{1,3}\.?\d+\.?\d*)\s*[:\-]\s*([^\n.]+)',  # RF.1: Description or RF1 - Description
        r'\b(\d+-\d+\.[A-Z]{1,3}\.\d+)\s*[:\-]\s*([^\n.]+)',  # 30-1.RF.1: Description
    ]

    for pattern in code_patterns:
        matches = re.findall(pattern, text)
        for code, desc in matches:
            # Filter out false positives
            if len(desc) > 20 and len(desc) < 500:
                outcomes.append({
                    "type": "coded",
                    "code": code.strip(),
                    "description": desc.strip()
                })

    return outcomes


def extract_strands_from_html(html: str) -> List[str]:
    """
    Extract organizing ideas/strands (e.g., Relations and Functions, Number, etc.)
    """
    from bs4 import BeautifulSoup
    import re

    strands = []
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text()

    # Common strand keywords
    strand_keywords = [
        'Relations and Functions',
        'Number',
        'Algebra',
        'Shape and Space',
        'Statistics and Probability',
        'Patterns and Relations',
        'Permutations and Combinations',
        'Exponential and Logarithmic Functions',
        'Polynomial Functions',
        'Trigonometry',
        'Rational Functions',
    ]

    for keyword in strand_keywords:
        if keyword in text:
            strands.append(keyword)

    return list(set(strands))  # Remove duplicates


def main():
    parser = argparse.ArgumentParser(description="Enhanced Alberta curriculum scraper")
    parser.add_argument(
        "--course",
        help="Specific course code to scrape (e.g., MAT3791)"
    )
    args = parser.parse_args()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear/create log file
    LOG_FILE.write_text(f"=== Alberta Curriculum Scraper Started ===\n", encoding='utf-8')

    log("="* 80)
    log("Enhanced Alberta Curriculum Scraper")
    log("="* 80)

    # Filter courses
    courses_to_scrape = COURSES
    if args.course:
        if args.course not in COURSES:
            log(f"❌ Unknown course code: {args.course}", "ERROR")
            log(f"Available courses: {', '.join(COURSES.keys())}")
            return
        courses_to_scrape = {args.course: COURSES[args.course]}

    log(f"Scraping {len(courses_to_scrape)} course(s)...")
    log("")

    results = []
    overall_start = time.time()

    with sync_playwright() as p:
        log("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Set user agent
        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        log("Browser ready")
        log("")

        for i, (course_code, course_info) in enumerate(courses_to_scrape.items(), 1):
            log(f"[{i}/{len(courses_to_scrape)}] Starting {course_info['name']}")
            log("-" * 80)

            result = scrape_course_enhanced(page, course_info["url"], course_code)
            results.append(result)

            # Save individual course file
            output_file = OUTPUT_DIR / f"{course_code.lower()}-outcomes.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            log(f"└─ Saved: {output_file.name}")
            log("")

        browser.close()

    # Save summary
    overall_time = time.time() - overall_start
    summary = {
        "scrapedAt": datetime.now().isoformat(),
        "totalCourses": len(results),
        "totalOutcomes": sum(r["outcomeCount"] for r in results),
        "totalStrands": sum(r.get("strandCount", 0) for r in results),
        "totalTime": round(overall_time, 2),
        "courses": results
    }

    summary_file = OUTPUT_DIR / "scrape_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    log("=" * 80)
    log("Scraping Complete!")
    log("=" * 80)
    log(f"Courses scraped: {len(results)}")
    log(f"Total outcomes: {summary['totalOutcomes']}")
    log(f"Total strands: {summary['totalStrands']}")
    log(f"Total time: {overall_time:.1f}s ({overall_time/60:.1f}m)")
    log(f"Summary: {summary_file}")

    # Show courses with few/no outcomes
    low_outcomes = [r for r in results if r["outcomeCount"] < 5]
    if low_outcomes:
        log("")
        log(f"⚠️  {len(low_outcomes)} course(s) with < 5 outcomes (may need manual review):")
        for r in low_outcomes:
            log(f"  - {r['course']} ({r['courseCode']}): {r['outcomeCount']} outcomes")

    log("")
    log("✅ Done! Check output files in data/curriculum/alberta-official/")
    log(f"   Log file: {LOG_FILE}")


if __name__ == "__main__":
    main()
