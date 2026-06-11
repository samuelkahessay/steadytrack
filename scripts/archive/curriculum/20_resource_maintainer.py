#!/usr/bin/env python3
"""
Maintain and improve learning resources for Grade 11 (20-level) subjects.

Capabilities:
- Scan all 20-level curriculum JSONs in data/curriculum
- Normalize resource entries (type, difficulty, source inference, titles/URLs)
- Validate alignedOutcomes against unit outcomes and fix/remove invalid codes
- Deduplicate resources within a unit by URL
- Sort resources by type and difficulty for consistency
- Optionally check links (HEAD/GET with minimal data) and record results
- Output a summary report (stdout and optional JSON/Markdown)

Usage examples:
  python3 scripts/curriculum/20_resource_maintainer.py --dry-run
  python3 scripts/curriculum/20_resource_maintainer.py --write --check-links --report out/20_report.json
  python3 scripts/curriculum/20_resource_maintainer.py --subjects bio,chem,phys --write

Notes:
- Network access may be restricted in some environments. When --check-links
  is used without network, the script will gracefully skip online checks
  and still perform offline validations.
- The script avoids adding brand-new external links; it focuses on improving
  and validating existing resources. You can extend PROVIDER_RULES or add a
  curated catalog if desired.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
CURRICULUM_DIR = ROOT / "data" / "curriculum"


# Accepted resource types in this repository
ALLOWED_TYPES = {
    "video",
    "article",
    "practice",
    "reference",
    "virtual-lab",
    "simulation",
    "interactive",
}

# Map common synonyms to allowed types
TYPE_SYNONYMS = {
    "sim": "simulation",
    "lab": "virtual-lab",
    "virtual_lab": "virtual-lab",
    "reference/guide": "reference",
    "exercise": "practice",
    "quiz": "practice",
    "read": "article",
}

# Difficulty normalization
DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"]


def difficulty_rank(value: str) -> int:
    v = (value or "").strip().lower()
    return DIFFICULTY_ORDER.index(v) if v in DIFFICULTY_ORDER else len(DIFFICULTY_ORDER)


def normalize_type(value: str) -> str:
    if not value:
        return ""
    v = value.strip().lower()
    v = TYPE_SYNONYMS.get(v, v)
    # unify hyphens for compound types
    v = v.replace("_", "-")
    return v


def normalize_title(value: str) -> str:
    if not value:
        return ""
    # Trim whitespace and normalize spaces/hyphens
    v = value.strip()
    v = re.sub(r"\s+", " ", v)
    v = v.replace("–", "-")
    return v


def normalize_url(value: str) -> str:
    if not value:
        return ""
    v = value.strip()
    v = v.replace(" ", "%20")  # avoid raw spaces in URLs
    # No scheme? do not guess; leave as-is but mark invalid later
    return v


def infer_source_from_url(url: str) -> Optional[str]:
    if not url:
        return None
    domain = re.sub(r"^https?://", "", url).split("/")[0].lower()
    if "khanacademy.org" in domain:
        return "Khan Academy"
    if "openstax.org" in domain:
        return "OpenStax"
    if "phet.colorado.edu" in domain or "phet" in domain:
        return "PhET"
    if "libretexts.org" in domain:
        return "LibreTexts"
    if "owl.purdue.edu" in domain or "purdue.edu" in domain:
        return "Purdue OWL"
    if "chemcollective.org" in domain:
        return "ChemCollective"
    if "alberta.ca" in domain or "education.alberta.ca" in domain:
        return "Alberta Education"
    return domain


def infer_type_from_url(url: str, current_type: str) -> Optional[str]:
    if not url:
        return None
    u = url.lower()
    if "khanacademy.org" in u:
        if "/e/" in u:
            return "practice"
        if "/v/" in u or "/video" in u:
            return "video"
        return current_type or "article"  # default
    if "openstax.org" in u:
        return "article"
    if "phet.colorado.edu" in u:
        return "simulation"
    if "chemcollective.org" in u and "/vlab/" in u:
        return "virtual-lab"
    return current_type or None


def validate_url_format(url: str) -> bool:
    return bool(re.match(r"^https?://", url or ""))


@dataclass
class LinkCheckResult:
    url: str
    ok: bool
    status: Optional[int] = None
    final_url: Optional[str] = None
    error: Optional[str] = None
    redirected: bool = False
    elapsed_ms: Optional[int] = None


def _head_request(url: str, timeout: float = 6.0) -> Tuple[Optional[int], Optional[str]]:
    """Minimal HEAD request using urllib; follow redirects implicitly.
    Some servers do not support HEAD; use GET fallback in check_link().
    Returns (status_code, final_url) or (None, None) on failure.
    """
    import urllib.request

    class HeadRequest(urllib.request.Request):
        def get_method(self):
            return "HEAD"

    req = HeadRequest(url, headers={
        "User-Agent": "SteadyTrackLinkBot/1.0 (+check)"
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.getcode(), resp.geturl()
    except Exception:
        return None, None


def _get_minimal_request(url: str, timeout: float = 8.0) -> Tuple[Optional[int], Optional[str]]:
    import urllib.request
    req = urllib.request.Request(url, headers={
        "User-Agent": "SteadyTrackLinkBot/1.0 (+check)",
        "Range": "bytes=0-0",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.getcode(), resp.geturl()
    except Exception as e:
        # Some servers may not support Range; try without Range as a last resort
        try:
            req2 = urllib.request.Request(url, headers={
                "User-Agent": "SteadyTrackLinkBot/1.0 (+check)"
            })
            with urllib.request.urlopen(req2, timeout=timeout) as resp2:
                return resp2.getcode(), resp2.geturl()
        except Exception:
            return None, None


def check_link(url: str, timeout: float = 10.0) -> LinkCheckResult:
    start = time.time()
    status, final_url = _head_request(url, timeout=max(2.0, timeout * 0.6))
    if status is None:
        status, final_url = _get_minimal_request(url, timeout=timeout)
    elapsed = int((time.time() - start) * 1000)
    if status is None:
        return LinkCheckResult(url=url, ok=False, status=None, final_url=None, error="request_failed", elapsed_ms=elapsed)
    ok = 200 <= status < 400
    return LinkCheckResult(url=url, ok=ok, status=status, final_url=final_url, redirected=(final_url and final_url != url), elapsed_ms=elapsed)


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def get_20_level_files(subject_filter: Optional[List[str]] = None) -> List[Path]:
    files = []
    for p in CURRICULUM_DIR.glob("*.json"):
        name = p.name
        if name.endswith("-20.json") or name.endswith("-20-1.json") or name.endswith("20.json"):
            if subject_filter:
                # filter by prefix (bio, chem, phys, math, ela, social)
                if not any(name.startswith(s) for s in subject_filter):
                    continue
            files.append(p)
    # Prioritize consistent order
    files.sort()
    return files


def collect_unit_outcome_codes(unit: Dict[str, Any]) -> List[str]:
    codes = []
    for o in unit.get("outcomes", []) or []:
        if isinstance(o, dict) and "code" in o:
            codes.append(o["code"])
        elif isinstance(o, str):
            code = o.split(":")[0].strip()
            if code:
                codes.append(code)
    return codes


@dataclass
class ResourceFix:
    normalized: bool = False
    type_inferred: bool = False
    source_added: bool = False
    difficulty_inferred: bool = False
    url_invalid: bool = False
    aligned_fixed: bool = False


def normalize_resource(resource: Dict[str, Any]) -> ResourceFix:
    fix = ResourceFix()

    title = resource.get("title", "")
    url = resource.get("url", "")
    rtype = resource.get("type", "")
    diff = resource.get("difficulty", "")

    norm_title = normalize_title(title)
    norm_url = normalize_url(url)
    norm_type = normalize_type(rtype)

    if norm_title != title:
        resource["title"] = norm_title
        fix.normalized = True
    if norm_url != url:
        resource["url"] = norm_url
        fix.normalized = True
    if norm_type and norm_type != rtype:
        resource["type"] = norm_type
        fix.normalized = True

    # Infer missing or invalid type
    if not norm_type or norm_type not in ALLOWED_TYPES:
        inferred = infer_type_from_url(norm_url, norm_type)
        if inferred:
            resource["type"] = inferred
            fix.type_inferred = True
        elif norm_type and norm_type not in ALLOWED_TYPES:
            # fallback to reference for unknown types
            resource["type"] = "reference"
            fix.type_inferred = True

    # Infer source provider
    if "source" not in resource or not resource.get("source"):
        src = infer_source_from_url(norm_url)
        if src:
            resource["source"] = src
            fix.source_added = True

    # Validate difficulty
    if diff and diff.strip().lower() not in DIFFICULTY_ORDER:
        # remove unknown difficulty; we'll re-infer below
        resource.pop("difficulty", None)
        diff = ""
        fix.normalized = True
    if not diff:
        # heuristic inference based on provider path; conservative default
        if "khanacademy.org" in (norm_url or ""):
            if "/e/" in norm_url:
                resource["difficulty"] = "intermediate"
                fix.difficulty_inferred = True
            elif "/v/" in norm_url or "/video" in norm_url:
                resource["difficulty"] = "beginner"
                fix.difficulty_inferred = True
            else:
                resource["difficulty"] = "intermediate"
                fix.difficulty_inferred = True
        elif "openstax.org" in (norm_url or ""):
            resource["difficulty"] = "intermediate"
            fix.difficulty_inferred = True
        elif "phet.colorado.edu" in (norm_url or ""):
            resource["difficulty"] = "beginner"
            fix.difficulty_inferred = True

    # URL format validation (offline)
    if not validate_url_format(norm_url):
        fix.url_invalid = True

    return fix


@dataclass
class UnitReport:
    unit_id: str
    total: int = 0
    deduped: int = 0
    normalized: int = 0
    type_inferred: int = 0
    source_added: int = 0
    difficulty_inferred: int = 0
    aligned_fixed: int = 0
    url_invalid_count: int = 0
    link_checks: List[LinkCheckResult] = field(default_factory=list)


@dataclass
class FileReport:
    file: str
    subject: str
    grade: int
    units: List[UnitReport] = field(default_factory=list)

    def summary(self) -> Dict[str, Any]:
        return {
            "file": self.file,
            "subject": self.subject,
            "grade": self.grade,
            "units": [
                {
                    "unit_id": u.unit_id,
                    "total": u.total,
                    "deduped": u.deduped,
                    "normalized": u.normalized,
                    "type_inferred": u.type_inferred,
                    "source_added": u.source_added,
                    "difficulty_inferred": u.difficulty_inferred,
                    "aligned_fixed": u.aligned_fixed,
                    "url_invalid_count": u.url_invalid_count,
                    "link_checks": [
                        {
                            "url": lc.url,
                            "ok": lc.ok,
                            "status": lc.status,
                            "final_url": lc.final_url,
                            "redirected": lc.redirected,
                            "elapsed_ms": lc.elapsed_ms,
                            "error": lc.error,
                        }
                        for lc in u.link_checks
                    ],
                }
                for u in self.units
            ],
        }


def fix_aligned_outcomes(resource: Dict[str, Any], valid_codes: List[str]) -> bool:
    changed = False
    ao = resource.get("alignedOutcomes")
    if not ao:
        return changed
    if not isinstance(ao, list):
        resource["alignedOutcomes"] = []
        return True
    filtered = []
    for c in ao:
        if isinstance(c, str) and c in valid_codes:
            filtered.append(c)
    if filtered != ao:
        resource["alignedOutcomes"] = filtered
        changed = True
    return changed


def sort_resources(resources: List[Dict[str, Any]]) -> None:
    def type_rank(t: str) -> int:
        order = ["video", "article", "practice", "simulation", "virtual-lab", "interactive", "reference"]
        try:
            return order.index(t)
        except ValueError:
            return len(order)

    resources.sort(key=lambda r: (
        type_rank((r.get("type") or "").lower()),
        difficulty_rank((r.get("difficulty") or "").lower()),
        (r.get("title") or "").lower(),
    ))


def process_file(path: Path, check_links: bool = False, apply_redirects: bool = False) -> Tuple[Dict[str, Any], FileReport, bool]:
    data = load_json(path)
    subject = data.get("subject", path.stem)
    grade = data.get("grade", 11)
    frep = FileReport(file=str(path.relative_to(ROOT)), subject=subject, grade=grade)
    changed = False

    for unit in data.get("units", []) or []:
        urep = UnitReport(unit_id=unit.get("id", unit.get("title", "unit")))
        resources = unit.get("resources", []) or []
        urep.total = len(resources)
        valid_codes = collect_unit_outcome_codes(unit)

        # Deduplicate by URL (first occurrence wins)
        seen = set()
        deduped_resources = []
        for r in resources:
            url = (r.get("url") or "").strip()
            key = url.lower()
            if key and key not in seen:
                seen.add(key)
                deduped_resources.append(r)
            else:
                urep.deduped += 1
                changed = True
        if len(deduped_resources) != len(resources):
            unit["resources"] = deduped_resources
            resources = deduped_resources

        # Normalize and validate each resource
        for r in resources:
            fix = normalize_resource(r)
            if fix.normalized:
                urep.normalized += 1
                changed = True
            if fix.type_inferred:
                urep.type_inferred += 1
                changed = True
            if fix.source_added:
                urep.source_added += 1
                changed = True
            if fix.difficulty_inferred:
                urep.difficulty_inferred += 1
                changed = True
            if fix.url_invalid:
                urep.url_invalid_count += 1

            # Ensure type is allowed
            rtype = (r.get("type") or "").lower()
            if rtype not in ALLOWED_TYPES:
                r["type"] = "reference"
                changed = True

            # Fix aligned outcomes to only valid codes
            if fix_aligned_outcomes(r, valid_codes):
                urep.aligned_fixed += 1
                changed = True

        # Sort resources for consistency
        sort_resources(resources)

        # Optional link checks
        if check_links:
            for r in resources:
                url = r.get("url")
                if not url or not validate_url_format(url):
                    urep.link_checks.append(LinkCheckResult(url=url or "", ok=False, error="invalid_format"))
                    continue
                try:
                    res = check_link(url)
                except Exception as e:
                    res = LinkCheckResult(url=url, ok=False, error=str(e))
                urep.link_checks.append(res)
                # Optionally update URL on permanent redirects
                if apply_redirects and res.redirected and res.final_url and res.status in (301, 308):
                    r["url"] = res.final_url
                    changed = True

        frep.units.append(urep)

    return data, frep, changed


def print_summary(reports: List[FileReport]) -> None:
    total_files = len(reports)
    total_units = sum(len(fr.units) for fr in reports)
    total_resources = sum(u.total for fr in reports for u in fr.units)
    total_deduped = sum(u.deduped for fr in reports for u in fr.units)
    total_norm = sum(u.normalized for fr in reports for u in fr.units)
    total_type_inf = sum(u.type_inferred for fr in reports for u in fr.units)
    total_src = sum(u.source_added for fr in reports for u in fr.units)
    total_diff_inf = sum(u.difficulty_inferred for fr in reports for u in fr.units)
    total_aligned = sum(u.aligned_fixed for fr in reports for u in fr.units)
    total_invalid = sum(u.url_invalid_count for fr in reports for u in fr.units)
    total_checks = sum(len(u.link_checks) for fr in reports for u in fr.units)
    total_bad = sum(1 for fr in reports for u in fr.units for lc in u.link_checks if not lc.ok)

    print(f"Processed files: {total_files}, units: {total_units}, resources: {total_resources}")
    print(f"- Deduplicated: {total_deduped}")
    print(f"- Normalized: {total_norm} (type inferred: {total_type_inf}, source added: {total_src}, difficulty inferred: {total_diff_inf})")
    print(f"- Aligned outcomes fixed: {total_aligned}")
    print(f"- URLs with invalid format: {total_invalid}")
    if total_checks:
        print(f"- Link checks: {total_checks} (failures: {total_bad})")


def main():
    parser = argparse.ArgumentParser(description="Maintain 20-level curriculum resources")
    parser.add_argument("--subjects", help="Comma-separated subject prefixes (bio,chem,phys,math,ela,social)")
    parser.add_argument("--write", action="store_true", help="Write normalized data back to files")
    parser.add_argument("--dry-run", action="store_true", help="Do not write changes (default)")
    parser.add_argument("--check-links", action="store_true", help="Check links online (may require network access)")
    parser.add_argument("--apply-redirects", action="store_true", help="Apply permanent redirect URLs when checking links")
    parser.add_argument("--report", help="Path to write JSON report (and .md if endswith .md)")

    args = parser.parse_args()

    subject_filter = None
    if args.subjects:
        subject_filter = [s.strip() for s in args.subjects.split(",") if s.strip()]

    files = get_20_level_files(subject_filter)
    if not files:
        print("No 20-level curriculum files found.")
        sys.exit(1)

    reports: List[FileReport] = []
    any_changed = False

    for f in files:
        data, frep, changed = process_file(
            f, check_links=args.check_links, apply_redirects=args.apply_redirects
        )
        reports.append(frep)
        if changed:
            any_changed = True
            if args.write and not args.dry_run:
                save_json(f, data)

    print_summary(reports)

    # Optional report output
    if args.report:
        out_path = Path(args.report)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        payload = [r.summary() for r in reports]
        # JSON report
        if out_path.suffix.lower() == ".json":
            out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        elif out_path.suffix.lower() == ".md":
            lines = ["# Grade 11 (20-level) Resource Maintenance Report", ""]
            for fr in reports:
                lines.append(f"## {fr.subject} — {fr.file}")
                for u in fr.units:
                    lines.append(f"- Unit `{u.unit_id}`: total={u.total}, deduped={u.deduped}, normalized={u.normalized}, aligned_fixed={u.aligned_fixed}, invalid_urls={u.url_invalid_count}")
                    bad = [lc for lc in u.link_checks if not lc.ok]
                    if bad:
                        lines.append(f"  - Broken/failed links: {len(bad)}")
                        for lc in bad[:10]:  # cap details
                            lines.append(f"    - {lc.url} (status={lc.status}, err={lc.error})")
                lines.append("")
            out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        else:
            # default to JSON if unknown extension
            out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if any_changed and not args.write:
        print("\nChanges were detected. Re-run with --write to apply updates.")


if __name__ == "__main__":
    main()

