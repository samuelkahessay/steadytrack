#!/usr/bin/env python3
"""
Async LLM-powered link fixer for broken curriculum resources.
Uses GPT-4o to find replacement URLs with multi-candidate approach and aggressive fallbacks.

Features:
- Multi-candidate approach (requests 3-5 replacements)
- Concurrent processing (15 links at a time)
- Aggressive fallback strategies
- Checkpoint/resume support
- URL verification before applying

Usage:
    scripts/.venv/bin/python scripts/curriculum/llm_link_fixer_async.py \\
        --report out/health_report.json \\
        --dry-run \\
        --limit 10

    scripts/.venv/bin/python scripts/curriculum/llm_link_fixer_async.py \\
        --report out/health_report.json \\
        --output out/link_fixes.json
"""

import sys
import json
import asyncio
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

# Import shared utilities
from llm_utils import (
    get_async_client,
    async_retry_with_backoff,
    CheckpointManager,
    verify_url_async,
    verify_urls_batch,
    format_duration,
    infer_resource_type_from_url,
    infer_source_from_url,
    setup_logging,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    CONCURRENT_REQUESTS,
    DATA_DIR,
    CACHE_DIR,
    ROOT_DIR,
    logger
)

from openai import RateLimitError, APIError, APIConnectionError, APITimeoutError

# Paths
CURRICULUM_DIR = DATA_DIR / "curriculum"

# Initialize async client
async_client = get_async_client()


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
    error_type: str
    status_code: Optional[int]


@dataclass
class ReplacementCandidate:
    """A candidate replacement URL"""
    url: str
    title: str
    source: str
    resource_type: str
    confidence: str  # high, medium, low
    reasoning: str
    is_verified: bool = False


class AsyncLLMLinkFixer:
    """Async LLM-powered link fixer with multi-candidate approach"""

    def __init__(
        self,
        model: str = PRIMARY_MODEL,
        verify_links: bool = True,
        num_candidates: int = 5,
        concurrency: int = CONCURRENT_REQUESTS
    ):
        self.model = model
        self.fallback_model = FALLBACK_MODEL
        self.verify_links = verify_links
        self.num_candidates = num_candidates
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.cache_file = CACHE_DIR / "llm_link_fixer_cache_async.json"
        self.cache = self._load_cache()

    def _load_cache(self) -> dict:
        if self.cache_file.exists():
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_cache(self):
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)

    @async_retry_with_backoff()
    async def find_replacement_candidates(
        self,
        broken: BrokenResource,
        strategy: str = "exact"
    ) -> List[ReplacementCandidate]:
        """
        Find replacement candidates using LLM.

        Args:
            broken: Broken resource context
            strategy: "exact" (same resource), "equivalent" (same topic), or "any" (any relevant)

        Returns:
            List of replacement candidates
        """
        # Check cache
        cache_key = f"{broken.curriculum_file}:{broken.resource_url}:{strategy}"
        if cache_key in self.cache:
            logger.info(f"   💾 Using cached candidates ({strategy})")
            return self._parse_cached_candidates(self.cache[cache_key])

        # Build prompt based on strategy
        prompt = self._build_prompt(broken, strategy)

        # Try primary model, then fallback
        for model_name in [self.model, self.fallback_model]:
            try:
                async with self.semaphore:
                    response = await async_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are an expert at finding replacement URLs for broken educational resources. "
                                          "You help educators maintain up-to-date curriculum links."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        temperature=1.0,
                        max_completion_tokens=1200,
                        timeout=30
                    )

                # Check for refusal
                message = response.choices[0].message
                if hasattr(message, 'refusal') and message.refusal:
                    if model_name == self.fallback_model:
                        logger.error(f"LLM refused request: {message.refusal}")
                        return []
                    else:
                        continue

                llm_response = message.content

                if not llm_response:
                    if model_name == self.fallback_model:
                        return []
                    else:
                        continue

                # Parse response
                candidates = self._parse_llm_response(llm_response, broken)

                if candidates:
                    # Cache the results
                    self.cache[cache_key] = {
                        "broken_url": broken.resource_url,
                        "strategy": strategy,
                        "candidates": [
                            {
                                "url": c.url,
                                "title": c.title,
                                "source": c.source,
                                "type": c.resource_type,
                                "confidence": c.confidence,
                                "reasoning": c.reasoning
                            }
                            for c in candidates
                        ],
                        "timestamp": datetime.now().isoformat()
                    }
                    self._save_cache()
                    return candidates

            except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
                if model_name == self.fallback_model:
                    logger.error(f"LLM error: {e}")
                    return []
                else:
                    logger.warning(f"{model_name} failed, trying {self.fallback_model}...")
                    continue
            except Exception as e:
                if model_name == self.fallback_model:
                    logger.error(f"Unexpected error: {e}")
                    return []
                else:
                    continue

        return []

    def _build_prompt(self, broken: BrokenResource, strategy: str) -> str:
        """Build prompt based on strategy"""

        outcomes_text = ""
        if broken.aligned_outcomes and broken.outcome_descriptions:
            outcomes_text = "\n**Learning Outcomes:**\n"
            for code, desc in zip(broken.aligned_outcomes[:3], broken.outcome_descriptions[:3]):
                outcomes_text += f"- {code}: {desc}\n"

        if strategy == "exact":
            task_description = f"""Find {self.num_candidates} FREE replacement URLs for this broken educational resource.
The replacements should cover the SAME content as the original."""

        elif strategy == "equivalent":
            task_description = f"""The exact resource is unavailable. Find {self.num_candidates} FREE alternative resources
that cover the SAME TOPIC/CONCEPT, even if from a different provider."""

        else:  # "any"
            task_description = f"""Find {self.num_candidates} FREE educational resources that help students master these learning outcomes.
Ignore the broken resource - just focus on the learning goals."""

        prompt = f"""A high school educational resource link is broken and needs {self.num_candidates} replacement candidates.

**Broken Resource:**
- Title: {broken.resource_title}
- URL: {broken.resource_url}
- Type: {broken.resource_type}
- Source: {broken.resource_source}
- Subject: {broken.subject} (Grade {broken.grade})
- Difficulty: {broken.difficulty}
{outcomes_text}

**Your Task:**
{task_description}

**Requirements:**
1. Provide EXACTLY {self.num_candidates} candidates
2. All must be FREE and accessible
3. From reputable sources (Khan Academy, PhET, OpenStax, LibreTexts, MIT OCW, CK-12, educational YouTube)
4. Mix different resource types when possible (video, article, simulation, practice)
5. Only suggest URLs you are CONFIDENT exist

**Response Format:**
For each candidate, provide:

```
CANDIDATE 1:
URL: [exact working URL]
TITLE: [clear descriptive title]
SOURCE: [provider name]
TYPE: [video/article/simulation/practice/reference]
CONFIDENCE: [high/medium/low]
REASONING: [1 sentence why this matches]

CANDIDATE 2:
...
```

**Important:**
- Provide {self.num_candidates} candidates, ranked best to worst
- Only suggest URLs that actually exist
- If unsure, mark confidence as "low"

Your {self.num_candidates} candidates:"""

        return prompt

    def _parse_llm_response(self, response: str, broken: BrokenResource) -> List[ReplacementCandidate]:
        """Parse LLM response into candidates"""
        candidates = []

        # Split by "CANDIDATE" markers
        blocks = re.split(r'CANDIDATE \d+:', response)

        for block in blocks[1:]:  # Skip first empty split
            # Extract fields
            url_match = re.search(r'URL:\s*(https?://[^\s\n]+)', block, re.IGNORECASE)
            title_match = re.search(r'TITLE:\s*([^\n]+)', block, re.IGNORECASE)
            source_match = re.search(r'SOURCE:\s*([^\n]+)', block, re.IGNORECASE)
            type_match = re.search(r'TYPE:\s*([^\n]+)', block, re.IGNORECASE)
            confidence_match = re.search(r'CONFIDENCE:\s*([^\n]+)', block, re.IGNORECASE)
            reasoning_match = re.search(r'REASONING:\s*([^\n]+(?:\n[^\n]+)?)', block, re.IGNORECASE)

            if not url_match:
                continue

            url = url_match.group(1).strip()
            title = title_match.group(1).strip() if title_match else broken.resource_title
            source = source_match.group(1).strip() if source_match else infer_source_from_url(url)
            resource_type = type_match.group(1).strip().lower() if type_match else infer_resource_type_from_url(url) or "article"
            confidence = confidence_match.group(1).strip().lower() if confidence_match else "medium"
            reasoning = reasoning_match.group(1).strip() if reasoning_match else "LLM suggested replacement"

            # Validate URL format
            if not re.match(r'^https?://', url):
                continue

            # Normalize type
            if "video" in resource_type:
                resource_type = "video"
            elif "simulation" in resource_type or "sim" in resource_type:
                resource_type = "simulation"
            elif "practice" in resource_type or "exercise" in resource_type:
                resource_type = "practice"
            elif "reference" in resource_type:
                resource_type = "reference"
            elif "article" in resource_type or "read" in resource_type:
                resource_type = "article"

            candidates.append(ReplacementCandidate(
                url=url,
                title=title,
                source=source,
                resource_type=resource_type,
                confidence=confidence,
                reasoning=reasoning
            ))

        return candidates

    def _parse_cached_candidates(self, cached_data: dict) -> List[ReplacementCandidate]:
        """Reconstruct candidates from cache"""
        return [
            ReplacementCandidate(
                url=c["url"],
                title=c["title"],
                source=c["source"],
                resource_type=c["type"],
                confidence=c["confidence"],
                reasoning=c["reasoning"]
            )
            for c in cached_data.get("candidates", [])
        ]

    async def find_best_replacement(self, broken: BrokenResource) -> Optional[ReplacementCandidate]:
        """
        Find best working replacement using multi-stage strategy.

        Strategy:
        1. Request exact replacements, verify all candidates
        2. If none work, request equivalent resources
        3. If still none, request any relevant resources
        4. Return best working candidate by confidence

        Returns:
            Best working replacement candidate, or None
        """
        strategies = [
            ("exact", "exact replacement"),
            ("equivalent", "equivalent resource"),
            ("any", "any relevant resource")
        ]

        for strategy, desc in strategies:
            logger.info(f"   🔍 Trying strategy: {desc}")

            # Get candidates
            candidates = await self.find_replacement_candidates(broken, strategy=strategy)

            if not candidates:
                logger.info(f"      No candidates from {desc}")
                continue

            # Verify all candidates concurrently
            if self.verify_links:
                urls_to_verify = [c.url for c in candidates]
                verification_results = await verify_urls_batch(urls_to_verify, self.semaphore)

                # Mark verified candidates
                for candidate in candidates:
                    candidate.is_verified = verification_results.get(candidate.url, False)

                # Filter to verified candidates
                verified_candidates = [c for c in candidates if c.is_verified]

                if not verified_candidates:
                    logger.info(f"      All {len(candidates)} candidates failed verification")
                    continue

                logger.info(f"      {len(verified_candidates)}/{len(candidates)} candidates verified")

                # Return best verified candidate (by confidence: high > medium > low)
                confidence_order = {"high": 3, "medium": 2, "low": 1}
                best = max(
                    verified_candidates,
                    key=lambda c: confidence_order.get(c.confidence, 0)
                )
                return best
            else:
                # No verification - return first candidate
                return candidates[0]

        # All strategies exhausted
        return None


async def process_broken_resource(
    broken: BrokenResource,
    fixer: AsyncLLMLinkFixer,
    dry_run: bool = True
) -> Optional[Dict[str, Any]]:
    """Process a single broken resource"""
    logger.info(f"Processing: {broken.resource_title[:50]}")
    logger.info(f"   Broken URL: {broken.resource_url}")
    logger.info(f"   Error: {broken.error_type} (status={broken.status_code})")

    # Find replacement
    replacement = await fixer.find_best_replacement(broken)

    if replacement:
        logger.info(f"   ✅ Found: {replacement.url}")
        logger.info(f"      Title: {replacement.title}")
        logger.info(f"      Source: {replacement.source}")
        logger.info(f"      Confidence: {replacement.confidence}")
        logger.info(f"      Reasoning: {replacement.reasoning}")

        if not dry_run:
            # Update curriculum file
            success = update_resource_url(
                broken.curriculum_file,
                broken.unit_id,
                broken.resource_url,
                replacement.url,
                replacement.title,
                replacement.source
            )
            if success:
                logger.info(f"      💾 Updated {broken.curriculum_file}")
            else:
                logger.error(f"      ⚠ Failed to update curriculum file")
                return None

        return {
            "file": broken.curriculum_file,
            "unit": broken.unit_id,
            "old_url": broken.resource_url,
            "new_url": replacement.url,
            "new_title": replacement.title,
            "new_source": replacement.source,
            "confidence": replacement.confidence,
            "reasoning": replacement.reasoning
        }
    else:
        logger.error(f"   ❌ No working replacement found")
        return None


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

        # Load curriculum
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

            # Find unit
            unit = next((u for u in curriculum.get('units', []) if u.get('id') == unit_id), None)
            if not unit:
                continue

            unit_title = unit.get('title', unit_id)

            # Process failed link checks
            for link_check in unit_report.get('link_checks', []):
                if link_check['ok']:
                    continue

                broken_url = link_check['url']
                resource = next((r for r in unit.get('resources', []) if r.get('url') == broken_url), None)

                if not resource:
                    continue

                aligned_codes = resource.get('alignedOutcomes', [])
                aligned_descriptions = [outcome_map.get(code, '') for code in aligned_codes]

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
    """Update a resource URL in curriculum file"""
    curriculum_path = CURRICULUM_DIR / curriculum_file

    with open(curriculum_path, 'r') as f:
        curriculum = json.load(f)

    # Find unit
    unit = next((u for u in curriculum.get('units', []) if u.get('id') == unit_id), None)
    if not unit:
        return False

    # Find and update resource
    for resource in unit.get('resources', []):
        if resource.get('url') == old_url:
            resource['url'] = new_url
            resource['title'] = new_title
            resource['source'] = new_source

            # Save
            with open(curriculum_path, 'w') as f:
                json.dump(curriculum, f, indent=2, ensure_ascii=False)
                f.write('\n')

            return True

    return False


async def main_async(
    report_path: Path,
    dry_run: bool = True,
    limit: Optional[int] = None,
    output_path: Optional[Path] = None,
    resume: bool = False
):
    """Main async processing function"""
    start_time = datetime.now()

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║   🔧 Async LLM Link Fixer - Repair Broken Resources          ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print("")

    # Load broken resources
    print("📊 Loading broken resources from health report...")
    broken_resources = load_broken_resources_from_report(report_path)

    if not broken_resources:
        print("✅ No broken resources found!")
        return

    print(f"   Found {len(broken_resources)} broken resources\n")

    # Apply limit
    if limit:
        broken_resources = broken_resources[:limit]
        print(f"   Limited to first {limit} resources\n")

    # Initialize fixer
    fixer = AsyncLLMLinkFixer(
        model=PRIMARY_MODEL,
        verify_links=True,
        num_candidates=5,
        concurrency=CONCURRENT_REQUESTS
    )

    # Checkpoint manager
    checkpoint = CheckpointManager(DATA_DIR / "checkpoint_link_fixer.json", interval=25)

    # Resume from checkpoint
    start_index = 0
    results = {"fixed": [], "not_found": [], "failed": []}

    if resume and checkpoint.exists():
        checkpoint_data = checkpoint.load()
        if checkpoint_data:
            start_index = checkpoint_data.get("last_processed_index", 0) + 1
            results = checkpoint_data.get("results", results)
            print(f"📂 Resuming from checkpoint at index {start_index}\n")

    # Process resources
    print("="*64)
    print("")

    for i, broken in enumerate(broken_resources[start_index:], start=start_index):
        print(f"[{i+1}/{len(broken_resources)}] {broken.subject} - {broken.resource_title[:40]}")

        result = await process_broken_resource(broken, fixer, dry_run)

        if result:
            results["fixed"].append(result)
        else:
            results["not_found"].append({
                "file": broken.curriculum_file,
                "url": broken.resource_url,
                "title": broken.resource_title
            })

        # Save checkpoint
        if (i + 1) % 25 == 0:
            checkpoint.save({
                "last_processed_index": i,
                "results": results
            })
            print(f"💾 Checkpoint saved ({i+1} processed)\n")

        print("")

    # Clear checkpoint
    checkpoint.clear()

    # Summary
    duration = (datetime.now() - start_time).total_seconds()

    print("="*64)
    print("\n✨ Summary:")
    print(f"   Total broken: {len(broken_resources)}")
    print(f"   Fixed: {len(results['fixed'])}")
    print(f"   Not found: {len(results['not_found'])}")
    print(f"   Duration: {format_duration(duration)}")

    if dry_run:
        print("\n   🔍 DRY RUN - No files were modified")
        print("   Remove --dry-run to apply changes")

    # Save detailed results
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n📄 Detailed results saved to: {output_path}")

    print("")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Fix broken curriculum resource links using async LLM")
    parser.add_argument("--report", required=True, help="Path to health check report JSON")
    parser.add_argument("--dry-run", action="store_true", help="Don't update files, just show what would be fixed")
    parser.add_argument("--limit", type=int, help="Limit number of resources to process (for testing)")
    parser.add_argument("--output", help="Save detailed results to JSON file")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint if available")

    args = parser.parse_args()

    report_path = Path(args.report)
    if not report_path.exists():
        print(f"❌ Report not found: {report_path}")
        sys.exit(1)

    output_path = Path(args.output) if args.output else None

    # Setup logging
    setup_logging(DATA_DIR / "link_fixer_async.log", "INFO")

    # Run async processing
    try:
        asyncio.run(main_async(
            report_path=report_path,
            dry_run=args.dry_run,
            limit=args.limit,
            output_path=output_path,
            resume=args.resume
        ))
    except KeyboardInterrupt:
        print("\n⚠ Processing interrupted by user")
        print("  Run with --resume flag to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
