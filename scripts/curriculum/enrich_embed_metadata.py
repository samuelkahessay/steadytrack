#!/usr/bin/env python3
"""
Enrich curriculum JSON files with provider metadata for embedding.

This script:
1. Parses all curriculum JSON files
2. Identifies embeddable resources (YouTube, Khan Academy videos)
3. Attempts to extract YouTube IDs from Khan Academy video URLs
4. Adds provider, youtubeId, and embeddable fields to resources
5. Flags resources that need manual review

Usage:
    python scripts/curriculum/enrich_embed_metadata.py
"""

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

CURRICULUM_DIR = Path(__file__).parent.parent.parent / "data" / "curriculum"

# Cache for YouTube ID lookups to avoid duplicate fetches
_youtube_id_cache: Dict[str, Optional[str]] = {}


def extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various YouTube URL formats."""
    # Pattern 1: youtube.com/watch?v=ID
    if "youtube.com/watch" in url:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        if "v" in query_params:
            return query_params["v"][0]

    # Pattern 2: youtu.be/ID
    if "youtu.be/" in url:
        parsed = urlparse(url)
        return parsed.path.strip("/").split("/")[0]

    # Pattern 3: youtube.com/embed/ID
    if "youtube.com/embed/" in url:
        parsed = urlparse(url)
        return parsed.path.split("/embed/")[1].split("?")[0]

    return None


def extract_youtube_id_from_ka_page(url: str) -> Optional[str]:
    """
    Extract YouTube ID from Khan Academy video page by fetching and parsing HTML.

    This function:
    1. Checks cache for previously fetched URLs
    2. Fetches the KA page HTML
    3. Parses to find YouTube iframe embed
    4. Extracts and returns the YouTube ID
    5. Implements rate limiting (1s delay) and error handling
    """
    # Check cache first
    if url in _youtube_id_cache:
        return _youtube_id_cache[url]

    # Simple pattern: some KA URLs have YouTube IDs in query params
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    if "v" in query_params:
        youtube_id = query_params["v"][0]
        _youtube_id_cache[url] = youtube_id
        return youtube_id

    try:
        print(f"  Fetching: {url}")

        # Rate limiting - be respectful to KA servers
        time.sleep(1)

        # Fetch the page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        # Method 1: Look for YouTube iframe
        iframe = soup.find('iframe', src=re.compile(r'youtube\.com/embed/'))
        if iframe and iframe.get('src'):
            youtube_url = iframe['src']
            youtube_id = extract_youtube_id(youtube_url)
            if youtube_id:
                print(f"    ✓ Found YouTube ID: {youtube_id}")
                _youtube_id_cache[url] = youtube_id
                return youtube_id

        # Method 2: Look for data-youtube-id attribute
        video_elem = soup.find(attrs={'data-youtube-id': True})
        if video_elem:
            youtube_id = video_elem['data-youtube-id']
            print(f"    ✓ Found YouTube ID (data attr): {youtube_id}")
            _youtube_id_cache[url] = youtube_id
            return youtube_id

        # Method 3: Search for YouTube URLs in script tags
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Look for YouTube embed URLs in JavaScript
                match = re.search(r'youtube\.com/embed/([a-zA-Z0-9_-]+)', script.string)
                if match:
                    youtube_id = match.group(1)
                    print(f"    ✓ Found YouTube ID (script): {youtube_id}")
                    _youtube_id_cache[url] = youtube_id
                    return youtube_id

        # No YouTube ID found
        print(f"    ✗ No YouTube ID found")
        _youtube_id_cache[url] = None
        return None

    except requests.RequestException as e:
        print(f"    ✗ Failed to fetch: {e}")
        _youtube_id_cache[url] = None
        return None
    except Exception as e:
        print(f"    ✗ Error parsing: {e}")
        _youtube_id_cache[url] = None
        return None


def determine_provider(resource: Dict) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Determine provider, YouTube ID, and embeddability for a resource.

    Returns:
        (provider, youtube_id, embeddable)
    """
    url = resource.get("url", "")
    resource_type = resource.get("type", "")

    # Direct YouTube links
    if "youtube.com" in url or "youtu.be" in url:
        youtube_id = extract_youtube_id(url)
        return ("youtube", youtube_id, youtube_id is not None)

    # Khan Academy content
    if "khanacademy.org" in url:
        # Only videos are embeddable (via YouTube)
        if "/v/" in url and resource_type == "video":
            youtube_id = extract_youtube_id_from_ka_page(url)
            if youtube_id:
                # Successfully extracted YouTube ID - treat as YouTube video
                return ("youtube", youtube_id, True)
            else:
                # Failed to extract YouTube ID - mark for review
                return ("khan-academy-video", None, False)
        else:
            # Articles (/a/), exercises (/e/), etc. are not embeddable
            return ("khan-academy-web", None, False)

    # OpenStax - articles/textbook pages (not embeddable due to X-Frame-Options)
    if "openstax.org" in url:
        return ("openstax", None, False)

    # Other providers - default to not embeddable
    return (None, None, False)


def enrich_resource(resource: Dict) -> Dict:
    """Add provider metadata to a resource."""
    # Check if resource already has a YouTube ID (from manual/automated resolution)
    existing_youtube_id = resource.get("youtubeId")

    if existing_youtube_id:
        # Preserve existing YouTube ID and update metadata
        enriched = resource.copy()
        enriched["provider"] = "youtube"
        enriched["youtubeId"] = existing_youtube_id

        # Ensure embed URL is present
        if not enriched.get("embedUrl"):
            origin = "http://localhost:3000"
            enriched["embedUrl"] = (
                f"https://www.youtube-nocookie.com/embed/{existing_youtube_id}"
                f"?enablejsapi=1&origin={origin}&modestbranding=1&rel=0"
            )

        enriched["embeddable"] = True

        # Remove review flags if present
        enriched.pop("needsReview", None)
        enriched.pop("reviewReason", None)

        return enriched

    # Otherwise, determine provider normally
    provider, youtube_id, embeddable = determine_provider(resource)

    enriched = resource.copy()

    if provider:
        enriched["provider"] = provider

    if youtube_id:
        enriched["youtubeId"] = youtube_id
        # If we have a YouTube ID, generate the embed URL
        origin = "http://localhost:3000"  # Update with actual domain
        enriched["embedUrl"] = (
            f"https://www.youtube-nocookie.com/embed/{youtube_id}"
            f"?enablejsapi=1&origin={origin}&modestbranding=1&rel=0"
        )

    enriched["embeddable"] = embeddable

    # Flag resources that need manual review
    if provider == "khan-academy-video" and not youtube_id:
        enriched["needsReview"] = True
        enriched["reviewReason"] = "Khan Academy video - YouTube ID needed"

    return enriched


def enrich_curriculum_file(file_path: Path) -> Dict:
    """Enrich a single curriculum JSON file."""
    print(f"\nProcessing {file_path.name}...")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    stats = {
        "total_resources": 0,
        "embeddable": 0,
        "needs_review": 0,
        "providers": {}
    }

    # Enrich each unit's resources
    for unit in data.get("units", []):
        resources = unit.get("resources", [])
        enriched_resources = []

        for resource in resources:
            enriched = enrich_resource(resource)
            enriched_resources.append(enriched)

            # Update stats
            stats["total_resources"] += 1
            if enriched.get("embeddable"):
                stats["embeddable"] += 1
            if enriched.get("needsReview"):
                stats["needs_review"] += 1

            provider = enriched.get("provider", "unknown")
            stats["providers"][provider] = stats["providers"].get(provider, 0) + 1

        unit["resources"] = enriched_resources

    return data, stats


def main():
    """Main enrichment process."""
    print("=" * 60)
    print("Curriculum Embed Metadata Enrichment")
    print("=" * 60)

    # Find all curriculum JSON files (exclude review file)
    json_files = [
        f for f in CURRICULUM_DIR.glob("*.json")
        if f.name != "resources_needing_review.json"
    ]

    if not json_files:
        print(f"❌ No JSON files found in {CURRICULUM_DIR}")
        return

    print(f"\nFound {len(json_files)} curriculum files")

    total_stats = {
        "files": 0,
        "total_resources": 0,
        "embeddable": 0,
        "needs_review": 0,
        "providers": {}
    }

    resources_needing_review = []

    # Process each file
    for file_path in sorted(json_files):
        enriched_data, stats = enrich_curriculum_file(file_path)

        # Write enriched data back to file
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(enriched_data, f, indent=2, ensure_ascii=False)

        # Collect resources needing review
        for unit in enriched_data.get("units", []):
            for resource in unit.get("resources", []):
                if resource.get("needsReview"):
                    resources_needing_review.append({
                        "file": file_path.name,
                        "unit": unit.get("title"),
                        "resource": resource.get("title"),
                        "url": resource.get("url"),
                        "reason": resource.get("reviewReason")
                    })

        # Update total stats
        total_stats["files"] += 1
        total_stats["total_resources"] += stats["total_resources"]
        total_stats["embeddable"] += stats["embeddable"]
        total_stats["needs_review"] += stats["needs_review"]

        for provider, count in stats["providers"].items():
            total_stats["providers"][provider] = (
                total_stats["providers"].get(provider, 0) + count
            )

        print(f"  ✅ {stats['total_resources']} resources "
              f"({stats['embeddable']} embeddable, "
              f"{stats['needs_review']} need review)")

    # Print summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Files processed: {total_stats['files']}")
    print(f"Total resources: {total_stats['total_resources']}")
    print(f"Embeddable: {total_stats['embeddable']} "
          f"({total_stats['embeddable']/total_stats['total_resources']*100:.1f}%)")
    print(f"Need review: {total_stats['needs_review']}")

    print("\nProvider breakdown:")
    for provider, count in sorted(total_stats["providers"].items()):
        print(f"  {provider}: {count}")

    # Write review list to file
    if resources_needing_review:
        review_file = CURRICULUM_DIR / "resources_needing_review.json"
        with open(review_file, "w", encoding="utf-8") as f:
            json.dump(resources_needing_review, f, indent=2, ensure_ascii=False)

        print(f"\n⚠️  {len(resources_needing_review)} resources need manual review")
        print(f"   Review list saved to: {review_file}")

    print("\n✅ Enrichment complete!")


if __name__ == "__main__":
    main()
