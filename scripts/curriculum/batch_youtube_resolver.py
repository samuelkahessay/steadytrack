#!/usr/bin/env python3
"""
Batch YouTube ID Resolver - Fast version with aggressive timeouts
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

CURRICULUM_DIR = Path(__file__).parent.parent.parent / "data" / "curriculum"
REVIEW_FILE = CURRICULUM_DIR / "resources_needing_review.json"
MAPPINGS_FILE = CURRICULUM_DIR / "youtube_id_mappings.json"

BATCH_SIZE = 5
PAGE_TIMEOUT = 12000  # 12 seconds
SELECTOR_TIMEOUT = 6000  # 6 seconds


def extract_youtube_id(url: str) -> str:
    """Extract YouTube ID from embed URL."""
    if "youtube.com/embed/" in url or "youtube-nocookie.com/embed/" in url:
        parsed = urlparse(url)
        path_parts = parsed.path.split("/embed/")
        if len(path_parts) > 1:
            return path_parts[1].split("?")[0].rstrip("/")

    if "youtube.com/watch" in url or "youtube-nocookie.com/watch" in url:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        if "v" in query_params:
            return query_params["v"][0]

    return None


def quick_extract(page, url: str) -> str:
    """Quickly extract YouTube ID with aggressive timeouts."""
    try:
        page.goto(url, wait_until="commit", timeout=PAGE_TIMEOUT)

        # Try iframe first (fastest)
        try:
            iframe = page.wait_for_selector('iframe[src*="youtube"]', timeout=SELECTOR_TIMEOUT)
            src = iframe.get_attribute('src')
            if src:
                youtube_id = extract_youtube_id(src)
                if youtube_id:
                    return youtube_id
        except PlaywrightTimeout:
            pass

        # Fallback: search page source
        content = page.content()
        match = re.search(r'youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})', content)
        if match:
            return match.group(1)

        match = re.search(r'"youtubeId"\s*:\s*"([A-Za-z0-9_-]{11})"', content)
        if match:
            return match.group(1)

        return None

    except Exception:
        return None


def main():
    # Load review data
    with open(REVIEW_FILE, 'r') as f:
        review_data = json.load(f)

    ka_videos = [
        item for item in review_data
        if 'khanacademy.org' in item['url']
    ]

    # Load existing mappings
    mappings = {}
    if MAPPINGS_FILE.exists():
        with open(MAPPINGS_FILE, 'r') as f:
            mappings = json.load(f)

    # Filter unmapped videos
    unmapped = [v for v in ka_videos if v['url'] not in mappings]

    print(f"Total KA videos: {len(ka_videos)}")
    print(f"Already mapped: {len(mappings)}")
    print(f"Remaining: {len(unmapped)}\n")

    if not unmapped:
        print("✅ All videos already mapped!")
        return

    # Process in batches
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(PAGE_TIMEOUT)

        for i, video in enumerate(unmapped):
            url = video['url']
            title = video['resource']

            print(f"[{i+1}/{len(unmapped)}] {title[:50]}...")

            youtube_id = quick_extract(page, url)

            if youtube_id:
                mappings[url] = youtube_id
                print(f"  ✓ {youtube_id}")
            else:
                print(f"  ✗ Failed")

            # Save every 5 videos
            if (i + 1) % BATCH_SIZE == 0:
                with open(MAPPINGS_FILE, 'w') as f:
                    json.dump(mappings, f, indent=2)
                print(f"\n💾 Saved {len(mappings)} mappings\n")

        browser.close()

    # Final save
    with open(MAPPINGS_FILE, 'w') as f:
        json.dump(mappings, f, indent=2)

    print(f"\n✅ Complete! Total mappings: {len(mappings)}")


if __name__ == "__main__":
    main()
