#!/usr/bin/env python3
"""
Validate that each resource's title reasonably matches the destination URL/page title
for both Grade 11 (20-level) and Grade 12 (30-level) curriculum files.

Features
- Scans data/curriculum for all 20- and 30-level JSONs
- Validates resource.title against:
  - URL slug (e.g., 'what-is-globalization')
  - Page <title> text (fetched via HTTP)
- Optional: infers provider type hints for Khan Academy (/a/=article, /v/=video, /e/=practice)
- Outputs a report and (optionally) fixes titles in-place when confident

Usage
  python3 scripts/curriculum/resource_title_validator.py --dry-run
  python3 scripts/curriculum/resource_title_validator.py --write --report out/title_audit_20_30.json
  python3 scripts/curriculum/resource_title_validator.py --levels 20,30 --subjects bio,chem --write

Notes
- Network is required to fetch page titles. If unreachable, falls back to slug-only checks.
- "Fix" mode is conservative: updates title only when high-confidence match with page title.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from html import unescape as html_unescape
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
CURRICULUM_DIR = ROOT / "data" / "curriculum"


def find_curriculum_files(levels: List[str], subjects: Optional[List[str]]) -> List[Path]:
    files: List[Path] = []
    for p in CURRICULUM_DIR.glob("*.json"):
        name = p.name
        if not any(name.endswith(f"-{lvl}.json") or name.endswith(f"-{lvl}-1.json") or name.endswith(f"{lvl}.json") for lvl in levels):
            continue
        if subjects and not any(name.startswith(s) for s in subjects):
            continue
        files.append(p)
    return sorted(files)


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def tokenize(text: str) -> List[str]:
    t = (text or "").lower()
    # Remove trailing site qualifiers, common separators, edition markers
    t = re.sub(r"\s*[|\-–]\s*(khan academy|openstax|libretexts).*?$", "", t)
    # Keep words only, drop numbers/edition markers
    words = re.findall(r"[a-z]+", t)
    # Droplist of weak tokens
    stop = {"the", "a", "an", "and", "of", "to", "for", "in", "on"}
    return [w for w in words if w not in stop]


def slug_tokens_from_url(url: str) -> List[str]:
    u = url.split("?")[0].strip("/")
    parts = u.split("/")
    # Last non-empty segment is often the most descriptive
    seg = ""
    for s in reversed(parts):
        if s:
            seg = s
            break
    seg = seg.replace("%20", "-")
    # Convert hyphen/underscore-separated to words, drop obvious ids
    seg = re.sub(r"[\-_/]+", " ", seg)
    seg = re.sub(r"\b(2e|ap|beta|overview)\b", " ", seg)
    return tokenize(seg)


def jaccard(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def fetch_page_title(url: str, timeout: float = 10.0) -> Optional[str]:
    # Minimal GET with a UA; Khan/OpenStax return page titles server-side
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "SteadyTrackTitleBot/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            raw = resp.read(4096 * 3).decode(charset, errors="ignore")  # read first chunk
    except Exception:
        return None
    m = re.search(r"<\s*title\s*>\s*(.*?)\s*<\s*/\s*title\s*>", raw, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    title = html_unescape(m.group(1))
    # Strip common suffixes like "| Khan Academy" or section codes after |
    title = re.split(r"\s*\|\s*", title)[0].strip()
    return title


def provider_from_url(url: str) -> str:
    d = re.sub(r"^https?://", "", url).split("/")[0].lower()
    if "khanacademy.org" in d:
        return "Khan Academy"
    if "openstax.org" in d:
        return "OpenStax"
    if "libretexts.org" in d:
        return "LibreTexts"
    return d


def infer_type_from_khan_url(url: str) -> Optional[str]:
    u = url.lower()
    if "/e/" in u:
        return "practice"
    if "/v/" in u or "/video" in u:
        return "video"
    if "/a/" in u:
        return "article"
    return None


def title_case_from_words(words: List[str]) -> str:
    if not words:
        return ""
    # Capitalize first letter of each word except short stopwords inside
    stop = {"and", "or", "of", "the", "a", "an", "to", "in", "on"}
    out = []
    for i, w in enumerate(words):
        if i > 0 and w in stop:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def clean_provider_noise(title: str, provider: str) -> str:
    t = (title or "").strip()
    if not t:
        return t
    # Remove provider suffix/prefix
    t = re.sub(r"\s*[|\-–]\s*(Khan Academy|OpenStax|LibreTexts).*?$", "", t, flags=re.I)
    t = re.sub(r"^(Khan Academy|OpenStax|LibreTexts)\s*[:|\-–]\s*", "", t, flags=re.I)
    # Remove trailing edition/grade markers like (AP) or 2e if present
    t = re.sub(r"\b(AP|2e)\b", "", t)
    return re.sub(r"\s+", " ", t).strip()


def derive_nice_title(provider: str, page_title: Optional[str], url: str) -> Optional[str]:
    # Prefer cleaned page title if it contains meaningful words and is not generic
    cleaned = clean_provider_noise(page_title or "", provider)
    page_words = tokenize(cleaned)
    if cleaned and page_words and cleaned.lower() not in {"khan academy", "openstax", "libretexts"} and len(page_words) >= 2:
        return title_case_from_words(page_words[:8])
    # Fall back to slug-derived title
    slug_words = slug_tokens_from_url(url)
    if slug_words:
        return title_case_from_words(slug_words[:8])
    return None


@dataclass
class ResourceCheck:
    unit_id: str
    title: str
    url: str
    provider: str
    page_title: Optional[str]
    title_tokens: List[str]
    slug_tokens: List[str]
    page_tokens: List[str]
    sim_title_slug: float
    sim_title_page: float
    subset_page: bool
    type_hint_ok: Optional[bool] = None
    suggested_title: Optional[str] = None
    updated: bool = False


def check_resource(unit_id: str, resource: Dict[str, Any], fetch: bool = True) -> ResourceCheck:
    title = resource.get("title") or ""
    url = resource.get("url") or ""
    provider = provider_from_url(url)
    page_title = fetch_page_title(url) if fetch and url.startswith("http") else None

    title_tokens = tokenize(title)
    slug_tokens = slug_tokens_from_url(url)
    page_tokens = tokenize(page_title or "")

    sim_slug = jaccard(title_tokens, slug_tokens)
    sim_page = jaccard(title_tokens, page_tokens)
    subset_page = bool(set(title_tokens) <= set(page_tokens) and page_tokens)

    # Khan Academy type hint consistency
    type_hint_ok = None
    if provider == "Khan Academy":
        infer_t = infer_type_from_khan_url(url)
        if infer_t:
            type_hint_ok = (infer_t == (resource.get("type") or "").lower())

    rc = ResourceCheck(
        unit_id=unit_id,
        title=title,
        url=url,
        provider=provider,
        page_title=page_title,
        title_tokens=title_tokens,
        slug_tokens=slug_tokens,
        page_tokens=page_tokens,
        sim_title_slug=sim_slug,
        sim_title_page=sim_page,
        subset_page=subset_page,
        type_hint_ok=type_hint_ok,
    )

    # Suggest a user-facing title (cleaned) when our title looks off-topic
    nice = derive_nice_title(provider, page_title, url)
    if nice:
        nice_tokens = tokenize(nice)
        # If current title poorly matches both slug and page (general vibe off), and nice aligns with slug/page, suggest nice
        if (sim_page < 0.35 and sim_slug < 0.35) and (
            jaccard(nice_tokens, slug_tokens) >= 0.5 or jaccard(nice_tokens, page_tokens) >= 0.5
        ):
            rc.suggested_title = nice
        # Or if the current title contains provider/format noise, suggest cleaned nice variant
        elif clean_provider_noise(title, provider) != title and jaccard(nice_tokens, slug_tokens) >= 0.4:
            rc.suggested_title = nice
    return rc


def main():
    parser = argparse.ArgumentParser(description="Validate resource titles against URLs and page titles for 20/30-level curriculum")
    parser.add_argument("--levels", default="20,30", help="Comma-separated levels to include (default: 20,30)")
    parser.add_argument("--subjects", help="Comma-separated subject prefixes to filter (bio,chem,phys,math,ela,social)")
    parser.add_argument("--write", action="store_true", help="Apply confident title updates in-place")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--no-fetch", action="store_true", help="Skip HTTP fetch; use slug-only checks")
    parser.add_argument("--report", help="Path to write JSON report")
    args = parser.parse_args()

    levels = [lv.strip() for lv in args.levels.split(",") if lv.strip()]
    subjects = [s.strip() for s in args.subjects.split(",")] if args.subjects else None

    files = find_curriculum_files(levels, subjects)
    if not files:
        print("No curriculum files found for given filters.")
        sys.exit(1)

    total = 0
    issues = 0
    fixes = 0
    report: List[Dict[str, Any]] = []

    for path in files:
        data = load_json(path)
        subject = data.get("subject", path.stem)
        file_rep = {"file": str(path.relative_to(ROOT)), "subject": subject, "units": []}
        changed = False

        for unit in data.get("units", []) or []:
            unit_id = unit.get("id") or unit.get("title") or "unit"
            unit_rep = {"unit_id": unit_id, "resources": []}
            for res in unit.get("resources", []) or []:
                url = res.get("url") or ""
                if not url.startswith("http"):
                    continue
                total += 1
                rc = check_resource(unit_id, res, fetch=(not args.no_fetch))

                ok = False
                # Decide OK: either good page-title match, or decent slug match
                if rc.page_title and (rc.sim_title_page >= 0.35 or rc.subset_page):
                    ok = True
                elif rc.sim_title_slug >= 0.3:
                    ok = True
                else:
                    # Accept if cleaned current title aligns reasonably with slug/page
                    cleaned_cur = clean_provider_noise(rc.title, rc.provider)
                    cur_tokens = tokenize(cleaned_cur)
                    if jaccard(cur_tokens, rc.slug_tokens) >= 0.35 or jaccard(cur_tokens, rc.page_tokens) >= 0.35:
                        ok = True

                # If resource has no title and we can derive a nice title, set it (when writing)
                if args.write and not args.dry_run and not (res.get("title") or ""):
                    fallback = derive_nice_title(provider, rc.page_title, url)
                    if fallback:
                        res["title"] = fallback
                        changed = True
                        fixes += 1

                rec = {
                    "title": rc.title,
                    "url": rc.url,
                    "provider": rc.provider,
                    "page_title": rc.page_title,
                    "sim_title_slug": round(rc.sim_title_slug, 3),
                    "sim_title_page": round(rc.sim_title_page, 3),
                    "subset_page": rc.subset_page,
                    "type_hint_ok": rc.type_hint_ok,
                    "suggested_title": rc.suggested_title,
                    "ok": ok,
                }
                unit_rep["resources"].append(rec)

                if not ok:
                    issues += 1
                    # Apply fix only if we have a high-confidence suggested title
                    if args.write and rc.suggested_title and not args.dry_run:
                        res["title"] = rc.suggested_title
                        changed = True
                        fixes += 1

            file_rep["units"].append(unit_rep)

        report.append(file_rep)
        if changed and args.write and not args.dry_run:
            save_json(path, data)

    print(f"Checked resources: {total}")
    print(f"Potential title issues: {issues}")
    if args.write:
        print(f"Titles updated: {fixes}")

    if args.report:
        out = Path(args.report)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Report written to: {out}")


if __name__ == "__main__":
    main()
