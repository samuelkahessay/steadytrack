#!/usr/bin/env python3
"""
Check Khan Academy links for true "Not Found" pages using robust signals.

Background:
- Some Khan Academy routes return HTTP 200 even when content is missing.
- The previous approach looked for the substring "404" anywhere in HTML,
  which produced false positives (e.g., IDs or hashes containing "404") and
  missed some real 404s rendered client-side.

Approach (updated):
- Fetch the page (follow redirects) with a real user agent.
- Parse HTML and extract only visible text (exclude script/style/noscript).
- Determine not-found using strong phrases (e.g., "page not found", "we couldn't
  find that page") in visible text or page title, with word boundaries.
- Consider meta tags as positive validity hints (e.g., og:type, og:title).
- Never flag a page as 404 based solely on a bare "404" substring.

Usage:
  python3 scripts/curriculum/check_khan_404s.py
  python3 scripts/curriculum/check_khan_404s.py --subjects math,bio
  python3 scripts/curriculum/check_khan_404s.py --output broken_links.json
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library not found. Install with: pip install requests")
    sys.exit(1)

# Optional: use BeautifulSoup if available for more accurate visible text extraction
try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    BeautifulSoup = None  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
CURRICULUM_DIR = ROOT / "data" / "curriculum"


def is_khan_academy_url(url: str) -> bool:
    """Check if a URL is a Khan Academy URL."""
    if not url:
        return False
    domain = urlparse(url).netloc.lower()
    return "khanacademy.org" in domain


def _extract_visible_text(html: str) -> str:
    """Extract visible text from HTML (exclude script/style/noscript). Lowercased."""
    # Prefer BeautifulSoup when available for better accuracy
    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = " ".join(soup.stripped_strings)
            return re.sub(r"\s+", " ", text).strip().lower()
        except Exception:
            pass

    # Fallback: regex-based crude stripping
    no_script = re.sub(r"<(script|style|noscript)[\s\S]*?>[\s\S]*?<\/\\1>", " ", html, flags=re.IGNORECASE)
    no_tags = re.sub(r"<[^>]+>", " ", no_script)
    return re.sub(r"\s+", " ", no_tags).strip().lower()


def _extract_title(html: str) -> Optional[str]:
    m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    # Collapse whitespace and strip
    title = re.sub(r"\s+", " ", m.group(1)).strip()
    return title


def _meta_value(soup: Any, prop: str) -> Optional[str]:  # soup is Optional[BeautifulSoup]
    if soup is None:
        return None
    try:
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    except Exception:
        return None
    return None


def _looks_like_valid_content(html: str) -> bool:
    """Heuristics indicating the page is a real content page (not a 404 shell)."""
    soup = None
    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(html, "html.parser")
        except Exception:
            soup = None

    # Strong positive signals: presence of Open Graph meta describing a specific resource
    og_type = _meta_value(soup, "og:type") if soup else None
    og_title = _meta_value(soup, "og:title") if soup else None
    og_url = _meta_value(soup, "og:url") if soup else None

    # Many valid KA content pages include an og:type (e.g., video.other, article, website)
    if og_type:
        # Treat any explicit og:type as a positive validity hint
        return True

    # Fallback: specific meta for deep links often present on valid pages
    if soup is not None:
        for prop in ("al:ios:url", "al:android:url", "twitter:player"):
            if _meta_value(soup, prop):
                return True

    # If title exists and is non-generic, that's a weak positive hint
    title = _extract_title(html)
    if title and title.lower() not in {"khan academy", "page not found", "not found", "404"}:
        # Avoid returning True just because the title is non-generic on error pages that still SSR a title
        return True

    return False


def _looks_like_not_found(html: str) -> Optional[str]:
    """
    Returns a short reason string if the page looks like a Not Found page, else None.
    Uses visible text and title with word boundaries; ignores bare numeric '404'.
    """
    text = _extract_visible_text(html)

    # Strong phrases indicating a not-found page
    phrase_patterns = [
        r"\bpage not found\b",
        r"\bthis page (doesn't|does not) exist\b",
        r"\bwe couldn['’]t find that page\b",
        r"\boops!\b[^\n]{0,80}?\bfind (that|this) page\b",
    ]
    for pat in phrase_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            start = max(0, m.start() - 60)
            end = min(len(text), m.end() + 120)
            return text[start:end].strip()

    # Title check as a fallback
    title = _extract_title(html)
    if title and re.search(r"\b(page not found|not found|404)\b", title, flags=re.IGNORECASE):
        return f"Title: {title}"

    return None


def check_khan_page(url: str, timeout: int = 10) -> Dict[str, Any]:
    """
    Fetch a Khan Academy page and check if it's a "Not Found" page.

    Returns:
        Dict with 'url', 'is_404', 'error', 'response_time_ms', 'content_preview'
    """
    result = {
        "url": url,
        "is_404": False,
        "error": None,
        "response_time_ms": None,
        "content_preview": None,
        "http_status": None
    }

    start_time = time.time()

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        response = requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
        elapsed_ms = int((time.time() - start_time) * 1000)
        result["response_time_ms"] = elapsed_ms
        result["http_status"] = response.status_code

        html = response.text

        # 1) Honor real HTTP 4xx/410 when present
        if response.status_code in {404, 410}:
            result["is_404"] = True
            reason = _extract_title(html) or "HTTP status indicates not found"
            result["content_preview"] = f"{reason}"
            return result

        # 2) Heuristic: visible text/title phrases indicating not found
        nf_reason = _looks_like_not_found(html)
        if nf_reason:
            result["is_404"] = True
            result["content_preview"] = nf_reason[:200]
            return result

        # 3) Positive validity hints (meta tags/title) – if present, treat as valid
        if _looks_like_valid_content(html):
            result["is_404"] = False
            return result

        # 4) Fallback: if we cannot confidently determine, default to valid
        #    to avoid false positives. Caller can manually review ambiguous cases.
        result["is_404"] = False

    except requests.RequestException as e:
        result["error"] = str(e)
        result["response_time_ms"] = int((time.time() - start_time) * 1000)

    return result


def get_curriculum_files(subject_filter: Optional[List[str]] = None) -> List[Path]:
    """Get all curriculum JSON files, optionally filtered by subject."""
    files = []
    for p in CURRICULUM_DIR.glob("*.json"):
        name = p.name

        # Skip non-curriculum files
        if name in ["youtube_id_mappings.json", "resources_needing_review.json"]:
            continue

        # Filter by subject if specified
        if subject_filter:
            if not any(name.startswith(s) for s in subject_filter):
                continue

        files.append(p)

    files.sort()
    return files


def extract_khan_urls(curriculum_file: Path) -> List[Dict[str, Any]]:
    """
    Extract all Khan Academy URLs from a curriculum file.

    Returns list of dicts with 'url', 'file', 'unit_id', 'resource_title'
    """
    with open(curriculum_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    urls = []
    subject = data.get("subject", curriculum_file.stem)

    for unit in data.get("units", []):
        unit_id = unit.get("id", "unknown")

        for resource in unit.get("resources", []):
            url = resource.get("url", "")
            if is_khan_academy_url(url):
                urls.append({
                    "url": url,
                    "file": str(curriculum_file.name),
                    "subject": subject,
                    "unit_id": unit_id,
                    "resource_title": resource.get("title", "Untitled"),
                    "resource_type": resource.get("type", "unknown")
                })

    return urls


def main():
    parser = argparse.ArgumentParser(
        description="Check Khan Academy links for 'Not Found' pages"
    )
    parser.add_argument(
        "--subjects",
        help="Comma-separated subject prefixes (e.g., math,bio,chem)"
    )
    parser.add_argument(
        "--output",
        help="Output file for results (JSON format)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay between requests in seconds (default: 0.5)"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=10,
        help="Request timeout in seconds (default: 10)"
    )

    args = parser.parse_args()

    # Parse subject filter
    subject_filter = None
    if args.subjects:
        subject_filter = [s.strip() for s in args.subjects.split(",") if s.strip()]

    # Get curriculum files
    files = get_curriculum_files(subject_filter=subject_filter)
    if not files:
        print("No curriculum files found matching filters.")
        sys.exit(1)

    print(f"Scanning {len(files)} curriculum file(s) for Khan Academy links...")

    # Extract all Khan Academy URLs
    all_urls = []
    for f in files:
        urls = extract_khan_urls(f)
        all_urls.extend(urls)

    # Deduplicate URLs while keeping metadata
    seen_urls = {}
    for item in all_urls:
        url = item["url"]
        if url not in seen_urls:
            seen_urls[url] = item
        else:
            # URL appears in multiple places - note this
            if "also_in" not in seen_urls[url]:
                seen_urls[url]["also_in"] = []
            seen_urls[url]["also_in"].append({
                "file": item["file"],
                "unit_id": item["unit_id"],
                "subject": item["subject"]
            })

    unique_urls = list(seen_urls.values())

    print(f"Found {len(unique_urls)} unique Khan Academy URL(s) to check")
    print(f"(Total occurrences across all files: {len(all_urls)})")
    print()

    # Check each URL
    results = []
    broken_links = []

    for i, item in enumerate(unique_urls, 1):
        url = item["url"]
        print(f"[{i}/{len(unique_urls)}] Checking: {url[:80]}...")

        result = check_khan_page(url, timeout=args.timeout)
        result.update(item)  # Add metadata
        results.append(result)

        if result["is_404"]:
            broken_links.append(result)
            print(f"  ❌ NOT FOUND!")
            if result["content_preview"]:
                print(f"     Preview: {result['content_preview'][:100]}")
        elif result["error"]:
            print(f"  ⚠️  ERROR: {result['error']}")
        else:
            print(f"  ✓ OK ({result['response_time_ms']}ms)")

        # Rate limiting
        if i < len(unique_urls):
            time.sleep(args.delay)

    print()
    print("=" * 80)
    print(f"Summary:")
    print(f"  Total URLs checked: {len(results)}")
    print(f"  Broken links (404): {len(broken_links)}")
    print(f"  Errors: {sum(1 for r in results if r['error'])}")
    print(f"  Valid links: {sum(1 for r in results if not r['is_404'] and not r['error'])}")

    # Print broken links
    if broken_links:
        print()
        print("Broken links:")
        for link in broken_links:
            print(f"\n  File: {link['file']}")
            print(f"  Subject: {link['subject']}")
            print(f"  Unit: {link['unit_id']}")
            print(f"  Title: {link['resource_title']}")
            print(f"  URL: {link['url']}")
            if "also_in" in link:
                print(f"  Also appears in: {len(link['also_in'])} other location(s)")

    # Save results to file if requested
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        output_data = {
            "summary": {
                "total_checked": len(results),
                "broken_count": len(broken_links),
                "error_count": sum(1 for r in results if r["error"]),
                "valid_count": sum(1 for r in results if not r["is_404"] and not r["error"])
            },
            "broken_links": broken_links,
            "all_results": results
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)

        print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()
