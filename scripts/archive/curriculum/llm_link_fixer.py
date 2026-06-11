#!/usr/bin/env python3
"""
LLM-powered link fixer for broken curriculum resources.
Uses GPT to find replacement URLs for broken/outdated links.
"""

import sys
import os
import json
import re
import requests
import urllib.request
import urllib.error
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
DATA_DIR = ROOT_DIR / "data"
CURRICULUM_DIR = DATA_DIR / "curriculum"
CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# Get API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
if not OPENAI_API_KEY:
    env_local = ROOT_DIR / ".env.local"
    if env_local.exists():
        with open(env_local) as f:
            for line in f:
                if "OPENAI" in line and "KEY" in line:
                    OPENAI_API_KEY = line.split('=', 1)[1].strip().strip('"\'')
                    break

if not OPENAI_API_KEY:
    print("❌ OPENAI_API_KEY not found. Please set it in .env.local or environment.")
    sys.exit(1)


@dataclass
class BrokenResource:
    """Context about a broken resource"""
    curriculum_file: str
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    resource_title: str
    resource_url: str
    resource_type: str
    resource_source: str
    difficulty: str
    aligned_outcomes: List[str]
    outcome_descriptions: List[str]
    error_type: str  # 404, 403, timeout, etc.
    status_code: Optional[int]


@dataclass
class ReplacementResource:
    """Replacement URL and metadata"""
    new_url: str
    title: str
    source: str
    confidence: str  # high, medium, low
    reasoning: str


class LLMLinkFixer:
    """Use LLM to find replacement URLs for broken resources"""

    def __init__(self, model: str = "gpt-4o-mini", verify_links: bool = True):
        self.model = model
        self.fallback_model = "gpt-4o"
        self.verify_links = verify_links
        self.cache_file = CACHE_DIR / "llm_link_fixer_cache.json"
        self.cache = self._load_cache()

    def _load_cache(self) -> dict:
        if self.cache_file.exists():
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_cache(self):
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)

    def find_replacement(self, broken: BrokenResource) -> Optional[ReplacementResource]:
        """Use LLM to find a replacement URL for a broken resource"""

        # Check cache first
        cache_key = f"{broken.curriculum_file}:{broken.resource_url}"
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if cached.get("new_url"):
                print(f"   💾 Using cached replacement")
                return ReplacementResource(
                    new_url=cached["new_url"],
                    title=cached["title"],
                    source=cached["source"],
                    confidence=cached["confidence"],
                    reasoning=cached["reasoning"]
                )
            else:
                print(f"   💾 Cache: no replacement found previously")
                return None

        print(f"   🤖 LLM searching for replacement...")

        # Build prompt
        prompt = self._build_replacement_prompt(broken)

        # Try primary model, then fallback
        for model_name in [self.model, self.fallback_model]:
            try:
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model_name,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert at finding replacement URLs for broken educational resources. You help educators maintain up-to-date curriculum links."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "max_completion_tokens": 800,
                    },
                    timeout=30
                )

                if response.status_code != 200:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ LLM API error: {response.status_code}")
                        return None
                    else:
                        print(f"      ⚠ {model_name} failed, trying {self.fallback_model}...")
                        continue

                result = response.json()

                if "choices" not in result or len(result["choices"]) == 0:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ Unexpected API response")
                        return None
                    else:
                        continue

                message = result["choices"][0].get("message", {})

                if message.get("refusal"):
                    if model_name == self.fallback_model:
                        print(f"      ⚠ LLM refused request")
                        return None
                    else:
                        continue

                llm_response = message.get("content", "")

                if not llm_response:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ Empty response")
                        return None
                    else:
                        continue

                # Parse response
                replacement = self._parse_llm_response(llm_response, broken)

                if replacement:
                    # Verify the new URL works (if enabled)
                    if self.verify_links:
                        if not self._verify_url(replacement.new_url):
                            print(f"      ⚠ LLM suggested URL is also broken: {replacement.new_url}")
                            # Cache the failure
                            self.cache[cache_key] = {
                                "broken_url": broken.resource_url,
                                "new_url": None,
                                "reason": "suggested_url_also_broken",
                                "timestamp": datetime.now().isoformat()
                            }
                            self._save_cache()
                            return None

                    print(f"      ✓ Found replacement ({replacement.confidence} confidence)")

                    # Cache the success
                    self.cache[cache_key] = {
                        "broken_url": broken.resource_url,
                        "new_url": replacement.new_url,
                        "title": replacement.title,
                        "source": replacement.source,
                        "confidence": replacement.confidence,
                        "reasoning": replacement.reasoning,
                        "timestamp": datetime.now().isoformat()
                    }
                    self._save_cache()

                    return replacement
                else:
                    print(f"      ⚠ Could not parse replacement from LLM")
                    if model_name == self.fallback_model:
                        return None

            except Exception as e:
                if model_name == self.fallback_model:
                    print(f"      ⚠ LLM error: {str(e)}")
                    return None
                else:
                    print(f"      ⚠ {model_name} error, trying {self.fallback_model}...")
                    continue

        return None

    def _build_replacement_prompt(self, broken: BrokenResource) -> str:
        """Build prompt asking LLM to find a replacement URL"""

        outcomes_text = ""
        if broken.aligned_outcomes and broken.outcome_descriptions:
            outcomes_text = "\n**Learning Outcomes:**\n"
            for code, desc in zip(broken.aligned_outcomes, broken.outcome_descriptions):
                outcomes_text += f"- {code}: {desc}\n"

        error_info = ""
        if broken.status_code == 404:
            error_info = "(The page was removed or moved)"
        elif broken.status_code == 403:
            error_info = "(Access forbidden - may need alternative source)"
        elif broken.error_type == "timeout":
            error_info = "(Server timeout - may be down permanently)"

        prompt = f"""A high school educational resource link is broken and needs replacement.

**Broken Resource:**
- Title: {broken.resource_title}
- URL: {broken.resource_url}
- Type: {broken.resource_type}
- Source: {broken.resource_source}
- Subject: {broken.subject} (Grade {broken.grade})
- Difficulty: {broken.difficulty}
- Error: {broken.error_type} {error_info}
{outcomes_text}

**Your Task:**
Find a FREE replacement URL that covers the same educational content. The replacement should:
1. Be from a reputable educational source
2. Cover the same topic/concept
3. Match the same resource type when possible (or provide best alternative)
4. Be accessible without paywall

**Preferred Sources:**
- Khan Academy, PhET, OpenStax, LibreTexts, MIT OCW, CK-12
- Educational YouTube channels (CrashCourse, Bozeman Science, etc.)
- Wikipedia for reference material
- University/educational institution websites

**Response Format:**
```
NEW_URL: [exact working URL or "NOT_FOUND" if no good replacement exists]
TITLE: [resource title]
SOURCE: [provider name]
CONFIDENCE: [high/medium/low - how confident you are this matches the original]
REASONING: [1-2 sentences explaining why this is a good replacement]
```

**Example:**
```
NEW_URL: https://www.khanacademy.org/science/biology/ecology/population-genetics/v/hardy-weinberg-principle
TITLE: Hardy-Weinberg Principle
SOURCE: Khan Academy
CONFIDENCE: high
REASONING: Khan Academy video covering the same Hardy-Weinberg principle content as the broken OpenStax link, with clear explanations suitable for Grade 12 biology.
```

**Important:**
- Only suggest URLs you are confident exist and work
- If you cannot find a good replacement, respond with "NEW_URL: NOT_FOUND"
- Maintain similar difficulty level
- Prefer the same provider if they have updated their URLs

Your recommendation:"""

        return prompt

    def _parse_llm_response(self, response: str, broken: BrokenResource) -> Optional[ReplacementResource]:
        """Parse LLM response into ReplacementResource"""

        # Extract fields
        url_match = re.search(r'NEW_URL:\s*(\S+)', response, re.IGNORECASE)
        title_match = re.search(r'TITLE:\s*([^\n]+)', response, re.IGNORECASE)
        source_match = re.search(r'SOURCE:\s*([^\n]+)', response, re.IGNORECASE)
        confidence_match = re.search(r'CONFIDENCE:\s*([^\n]+)', response, re.IGNORECASE)
        reasoning_match = re.search(r'REASONING:\s*([^\n]+(?:\n[^\n]+)?)', response, re.IGNORECASE)

        if not url_match:
            return None

        new_url = url_match.group(1).strip()

        # Check if LLM said not found
        if new_url.upper() == "NOT_FOUND" or "not_found" in new_url.lower():
            return None

        # Validate URL format
        if not re.match(r'^https?://', new_url):
            return None

        title = title_match.group(1).strip() if title_match else broken.resource_title
        source = source_match.group(1).strip() if source_match else broken.resource_source
        confidence = confidence_match.group(1).strip().lower() if confidence_match else "medium"
        reasoning = reasoning_match.group(1).strip() if reasoning_match else "Replacement suggested by LLM"

        return ReplacementResource(
            new_url=new_url,
            title=title,
            source=source,
            confidence=confidence,
            reasoning=reasoning
        )

    def _verify_url(self, url: str) -> bool:
        """Verify that a URL is accessible"""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return 200 <= resp.getcode() < 400
        except Exception:
            return False


def load_broken_resources_from_report(report_path: Path) -> List[BrokenResource]:
    """Load broken resources from health check report"""

    with open(report_path, 'r') as f:
        report = json.load(f)

    broken_resources = []

    for file_report in report:
        curriculum_file = Path(file_report['file']).name
        subject = file_report['subject']
        grade = file_report['grade']
        curriculum_path = CURRICULUM_DIR / curriculum_file

        # Load curriculum to get full resource context
        with open(curriculum_path, 'r') as f:
            curriculum = json.load(f)

        # Map outcome codes to descriptions
        outcome_map = {}
        for unit in curriculum.get('units', []):
            for outcome in unit.get('outcomes', []):
                if isinstance(outcome, dict):
                    outcome_map[outcome.get('code')] = outcome.get('description', '')

        for unit_report in file_report['units']:
            unit_id = unit_report['unit_id']

            # Find unit in curriculum
            unit = None
            for u in curriculum.get('units', []):
                if u.get('id') == unit_id:
                    unit = u
                    break

            if not unit:
                continue

            unit_title = unit.get('title', unit_id)

            # Process failed link checks
            for link_check in unit_report.get('link_checks', []):
                if link_check['ok']:
                    continue

                # Find the resource in the unit
                broken_url = link_check['url']
                resource = None
                for r in unit.get('resources', []):
                    if r.get('url') == broken_url:
                        resource = r
                        break

                if not resource:
                    continue

                # Get aligned outcome descriptions
                aligned_codes = resource.get('alignedOutcomes', [])
                aligned_descriptions = [outcome_map.get(code, '') for code in aligned_codes]

                # Determine error type
                error_type = link_check.get('error', 'unknown')
                status_code = link_check.get('status')

                broken_resources.append(BrokenResource(
                    curriculum_file=curriculum_file,
                    subject=subject,
                    grade=grade,
                    unit_id=unit_id,
                    unit_title=unit_title,
                    resource_title=resource.get('title', ''),
                    resource_url=broken_url,
                    resource_type=resource.get('type', 'article'),
                    resource_source=resource.get('source', ''),
                    difficulty=resource.get('difficulty', 'intermediate'),
                    aligned_outcomes=aligned_codes,
                    outcome_descriptions=aligned_descriptions,
                    error_type=error_type,
                    status_code=status_code
                ))

    return broken_resources


def update_resource_url(
    curriculum_file: str,
    unit_id: str,
    old_url: str,
    new_url: str,
    new_title: str,
    new_source: str
) -> bool:
    """Update a resource URL in the curriculum file"""

    curriculum_path = CURRICULUM_DIR / curriculum_file

    with open(curriculum_path, 'r') as f:
        curriculum = json.load(f)

    # Find unit
    unit = None
    for u in curriculum.get('units', []):
        if u.get('id') == unit_id:
            unit = u
            break

    if not unit:
        return False

    # Find and update resource
    updated = False
    for resource in unit.get('resources', []):
        if resource.get('url') == old_url:
            resource['url'] = new_url
            resource['title'] = new_title
            resource['source'] = new_source
            updated = True
            break

    if updated:
        # Save curriculum
        with open(curriculum_path, 'w') as f:
            json.dump(curriculum, f, indent=2, ensure_ascii=False)
            f.write('\n')

    return updated


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Fix broken curriculum resource links using LLM")
    parser.add_argument("--report", required=True, help="Path to health check report JSON")
    parser.add_argument("--dry-run", action="store_true", help="Don't update files, just show what would be fixed")
    parser.add_argument("--no-verify", action="store_true", help="Don't verify replacement URLs before applying")
    parser.add_argument("--limit", type=int, help="Limit number of resources to process (for testing)")
    parser.add_argument("--output", help="Save detailed results to JSON file")

    args = parser.parse_args()

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║                                                                ║")
    print("║   🔧 LLM Link Fixer - Repair Broken Resources                ║")
    print("║                                                                ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print("")

    report_path = Path(args.report)
    if not report_path.exists():
        print(f"❌ Report not found: {report_path}")
        sys.exit(1)

    print("📊 Loading broken resources from health report...")
    broken_resources = load_broken_resources_from_report(report_path)

    if not broken_resources:
        print("✅ No broken resources found!")
        return

    print(f"   Found {len(broken_resources)} broken resources\n")

    # Apply limit if specified
    if args.limit:
        broken_resources = broken_resources[:args.limit]
        print(f"   Limited to first {args.limit} resources\n")

    # Group by domain
    from collections import Counter
    domains = Counter(r.resource_url.split('/')[2] for r in broken_resources)
    print("   Top broken domains:")
    for domain, count in domains.most_common(5):
        print(f"      • {domain}: {count}")

    print("\n" + "="*64)
    print("")

    # Initialize fixer
    fixer = LLMLinkFixer(verify_links=not args.no_verify)

    results = {
        "fixed": [],
        "not_found": [],
        "failed": []
    }

    # Process each broken resource
    for idx, broken in enumerate(broken_resources, 1):
        print(f"[{idx}/{len(broken_resources)}] {broken.subject} - {broken.resource_title[:50]}")
        print(f"   Broken URL: {broken.resource_url}")
        print(f"   Error: {broken.error_type} (status={broken.status_code})")

        # Find replacement
        replacement = fixer.find_replacement(broken)

        if replacement:
            print(f"   ✅ Replacement found: {replacement.new_url}")
            print(f"      Confidence: {replacement.confidence}")
            print(f"      Reasoning: {replacement.reasoning}")

            if not args.dry_run:
                # Update curriculum file
                success = update_resource_url(
                    broken.curriculum_file,
                    broken.unit_id,
                    broken.resource_url,
                    replacement.new_url,
                    replacement.title,
                    replacement.source
                )
                if success:
                    print(f"      💾 Updated {broken.curriculum_file}")
                    results["fixed"].append({
                        "file": broken.curriculum_file,
                        "unit": broken.unit_id,
                        "old_url": broken.resource_url,
                        "new_url": replacement.new_url,
                        "confidence": replacement.confidence
                    })
                else:
                    print(f"      ⚠ Failed to update curriculum file")
                    results["failed"].append({
                        "file": broken.curriculum_file,
                        "url": broken.resource_url,
                        "reason": "update_failed"
                    })
            else:
                print(f"      🔍 [DRY RUN] Would update {broken.curriculum_file}")
                results["fixed"].append({
                    "file": broken.curriculum_file,
                    "unit": broken.unit_id,
                    "old_url": broken.resource_url,
                    "new_url": replacement.new_url,
                    "confidence": replacement.confidence
                })
        else:
            print(f"   ❌ No replacement found")
            results["not_found"].append({
                "file": broken.curriculum_file,
                "url": broken.resource_url,
                "title": broken.resource_title
            })

        print("")

    # Summary
    print("="*64)
    print("\n✨ Summary:")
    print(f"   Total broken: {len(broken_resources)}")
    print(f"   Fixed: {len(results['fixed'])}")
    print(f"   Not found: {len(results['not_found'])}")
    print(f"   Failed: {len(results['failed'])}")

    if args.dry_run:
        print("\n   🔍 DRY RUN - No files were modified")
        print("   Remove --dry-run to apply changes")

    # Save detailed results
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n📄 Detailed results saved to: {output_path}")

    print("")


if __name__ == "__main__":
    main()
