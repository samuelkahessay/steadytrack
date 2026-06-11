#!/usr/bin/env python3
"""
Automated YouTube ID Resolver for Khan Academy Videos

Uses Playwright to automatically extract YouTube IDs from Khan Academy video pages.

Usage:
    python scripts/curriculum/automated_youtube_id_resolver.py

    # Or to just apply existing mappings:
    python scripts/curriculum/automated_youtube_id_resolver.py --apply
"""

import json
import re
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

CURRICULUM_DIR = Path(__file__).parent.parent.parent / "data" / "curriculum"
REVIEW_FILE = CURRICULUM_DIR / "resources_needing_review.json"
MAPPINGS_FILE = CURRICULUM_DIR / "youtube_id_mappings.json"


def extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    # Direct ID (11 characters)
    if len(url) == 11 and re.match(r'^[A-Za-z0-9_-]+$', url):
        return url

    # youtube.com/watch?v=ID
    if "youtube.com/watch" in url or "youtube-nocookie.com/watch" in url:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        if "v" in query_params:
            return query_params["v"][0]

    # youtu.be/ID
    if "youtu.be/" in url:
        parsed = urlparse(url)
        return parsed.path.strip("/").split("/")[0].split("?")[0]

    # youtube.com/embed/ID
    if "youtube.com/embed/" in url or "youtube-nocookie.com/embed/" in url:
        parsed = urlparse(url)
        path_parts = parsed.path.split("/embed/")
        if len(path_parts) > 1:
            # Remove trailing slash and query params
            video_id = path_parts[1].split("?")[0].rstrip("/")
            return video_id

    return None


def load_existing_mappings() -> Dict[str, str]:
    """Load existing YouTube ID mappings if available."""
    if MAPPINGS_FILE.exists():
        with open(MAPPINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_mappings(mappings: Dict[str, str]):
    """Save YouTube ID mappings to file."""
    with open(MAPPINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(mappings, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {len(mappings)} mappings to {MAPPINGS_FILE.name}")


def extract_youtube_id_from_ka_page(page, url: str) -> Optional[str]:
    """
    Extract YouTube ID from Khan Academy page using Playwright.

    Tries multiple methods:
    1. Wait for YouTube iframe to load
    2. Extract src attribute
    3. Parse YouTube ID from embed URL
    """
    try:
        # Navigate to page
        print(f"  Loading: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=15000)

        # Wait for video player to load (try multiple selectors)
        selectors = [
            'iframe[src*="youtube.com/embed"]',
            'iframe[src*="youtube-nocookie.com/embed"]',
            'div[data-youtube-id]',
        ]

        youtube_id = None

        # Try to find YouTube iframe
        for selector in selectors:
            try:
                element = page.wait_for_selector(selector, timeout=5000)

                if 'iframe' in selector:
                    # Extract from iframe src
                    src = element.get_attribute('src')
                    if src:
                        youtube_id = extract_youtube_id(src)
                        if youtube_id:
                            print(f"  ✓ Found YouTube ID: {youtube_id} (iframe src)")
                            return youtube_id
                else:
                    # Extract from data attribute
                    youtube_id = element.get_attribute('data-youtube-id')
                    if youtube_id:
                        print(f"  ✓ Found YouTube ID: {youtube_id} (data attr)")
                        return youtube_id

            except PlaywrightTimeout:
                continue

        # Fallback: Search page content for YouTube URLs
        content = page.content()

        # Look for YouTube embed URLs in HTML
        matches = re.findall(r'youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})', content)
        if matches:
            youtube_id = matches[0]
            print(f"  ✓ Found YouTube ID: {youtube_id} (HTML content)")
            return youtube_id

        # Look for YouTube IDs in JSON data
        matches = re.findall(r'"youtubeId"\s*:\s*"([A-Za-z0-9_-]{11})"', content)
        if matches:
            youtube_id = matches[0]
            print(f"  ✓ Found YouTube ID: {youtube_id} (JSON data)")
            return youtube_id

        print(f"  ✗ No YouTube ID found")
        return None

    except PlaywrightTimeout:
        print(f"  ✗ Timeout loading page")
        return None
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def collect_youtube_ids():
    """Automatically collect YouTube IDs from all Khan Academy videos."""
    print("=" * 80)
    print("Automated YouTube ID Collection")
    print("=" * 80)

    # Load review data
    if not REVIEW_FILE.exists():
        print(f"❌ Review file not found: {REVIEW_FILE}")
        return

    with open(REVIEW_FILE, 'r', encoding='utf-8') as f:
        review_data = json.load(f)

    # Filter for Khan Academy videos only
    ka_videos = [
        item for item in review_data
        if 'khanacademy.org' in item['url'] and
           item['reason'] == 'Khan Academy video - YouTube ID needed'
    ]

    total = len(ka_videos)
    print(f"\nFound {total} Khan Academy videos needing YouTube IDs\n")

    # Load existing mappings
    mappings = load_existing_mappings()
    initial_count = len(mappings)

    if mappings:
        print(f"Found {len(mappings)} existing mappings")
        already_mapped = sum(1 for item in ka_videos if item['url'] in mappings)
        print(f"Progress: {already_mapped}/{total} videos already mapped\n")

    # Launch browser
    print("Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Set user agent to avoid bot detection
        page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })

        success_count = 0
        failed_urls = []

        # Process each video
        for i, item in enumerate(ka_videos, 1):
            url = item['url']

            # Skip if already mapped
            if url in mappings:
                print(f"[{i}/{total}] ⏭️  Skipping (already mapped): {item['resource']}")
                continue

            print(f"\n[{i}/{total}] {item['resource']}")
            print(f"  File: {item['file']} / Unit: {item['unit']}")

            youtube_id = extract_youtube_id_from_ka_page(page, url)

            if youtube_id:
                mappings[url] = youtube_id
                success_count += 1
            else:
                failed_urls.append({'url': url, 'title': item['resource']})

            # Auto-save every 5 videos
            if i % 5 == 0:
                save_mappings(mappings)

        browser.close()

    # Final save
    save_mappings(mappings)

    # Summary
    print("\n" + "=" * 80)
    print("Collection Complete!")
    print("=" * 80)
    print(f"✅ Successfully extracted: {success_count} YouTube IDs")
    print(f"📊 Total mappings: {len(mappings)} (added {len(mappings) - initial_count} new)")

    if failed_urls:
        print(f"\n⚠️  Failed to extract {len(failed_urls)} videos:")
        for item in failed_urls:
            print(f"  - {item['title']}")
            print(f"    {item['url']}")

    print("\n" + "=" * 80)


def apply_mappings_to_curriculum():
    """Apply YouTube ID mappings to curriculum files."""
    print("\n" + "=" * 80)
    print("Applying YouTube ID Mappings to Curriculum Files")
    print("=" * 80)

    mappings = load_existing_mappings()

    if not mappings:
        print("❌ No mappings found. Please run collection first.")
        return

    print(f"\nFound {len(mappings)} YouTube ID mappings")

    # Load review data to get file/unit/resource info
    with open(REVIEW_FILE, 'r', encoding='utf-8') as f:
        review_data = json.load(f)

    # Create URL to info mapping
    url_to_info = {
        item['url']: {
            'file': item['file'],
            'unit': item['unit'],
            'resource': item['resource']
        }
        for item in review_data
    }

    updated_count = 0

    # Update each curriculum file
    for url, youtube_id in mappings.items():
        if url not in url_to_info:
            print(f"⚠️  URL not in review data: {url}")
            continue

        info = url_to_info[url]
        file_path = CURRICULUM_DIR / info['file']

        # Load curriculum file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Find and update the resource
        updated = False
        for unit in data.get('units', []):
            if unit['title'] == info['unit']:
                for resource in unit.get('resources', []):
                    if resource.get('url') == url:
                        # Update resource metadata
                        resource['provider'] = 'youtube'
                        resource['youtubeId'] = youtube_id

                        # Generate embed URL
                        origin = "http://localhost:3000"
                        resource['embedUrl'] = (
                            f"https://www.youtube-nocookie.com/embed/{youtube_id}"
                            f"?enablejsapi=1&origin={origin}&modestbranding=1&rel=0"
                        )
                        resource['embeddable'] = True

                        # Remove review flags
                        resource.pop('needsReview', None)
                        resource.pop('reviewReason', None)

                        updated = True
                        break

            if updated:
                break

        if updated:
            # Save updated curriculum file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            updated_count += 1
            print(f"✅ {info['file']}: {info['resource']}")
        else:
            print(f"❌ Not found: {info['file']} / {info['resource']}")

    print(f"\n{'=' * 80}")
    print(f"✅ Updated {updated_count} resources in curriculum files")
    print(f"{'=' * 80}")

    # Re-run enrichment to update resources_needing_review.json
    print("\nRe-generating resources_needing_review.json...")
    import subprocess
    venv_python = Path(__file__).parent.parent.parent / "scripts" / ".venv" / "bin" / "python"
    enrich_script = Path(__file__).parent / "enrich_embed_metadata.py"

    result = subprocess.run(
        [str(venv_python), str(enrich_script)],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("✅ Successfully updated resources_needing_review.json")
    else:
        print("⚠️  Warning: Failed to regenerate review file")
        print(result.stderr)


def main():
    """Main execution flow."""
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--apply':
        # Just apply existing mappings
        apply_mappings_to_curriculum()
    else:
        # Collect YouTube IDs then apply
        collect_youtube_ids()

        print("\n" + "=" * 80)
        apply_input = input("Apply mappings to curriculum files now? (y/n): ").strip().lower()
        if apply_input == 'y':
            apply_mappings_to_curriculum()
        else:
            print("\nTo apply mappings later, run:")
            print("  python scripts/curriculum/automated_youtube_id_resolver.py --apply")


if __name__ == "__main__":
    main()
