#!/usr/bin/env python3
"""
Async LLM-powered gap filler for curriculum outcomes with insufficient resources.
Uses GPT-4o to find diverse, high-quality educational resources.

Features:
- Finds outcomes with insufficient resources (configurable target)
- Requests 5 diverse candidates per outcome (video + article + practice)
- Concurrent processing and verification
- Ensures resource diversity and quality
- Checkpoint/resume support

Usage:
    # Fill only empty outcomes (0 resources)
    scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \\
        --target-count 0 \\
        --dry-run \\
        --limit 10

    # Fill outcomes with <3 resources to reach 3 total
    scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \\
        --target-count 3 \\
        --output out/gap_filler.json
"""

import sys
import json
import asyncio
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Set
from datetime import datetime
from collections import Counter

# Import shared utilities
from llm_utils import (
    get_async_client,
    async_retry_with_backoff,
    CheckpointManager,
    verify_urls_batch,
    format_duration,
    infer_resource_type_from_url,
    infer_source_from_url,
    is_embeddable,
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
class OutcomeGap:
    """An outcome with insufficient resources"""
    curriculum_file: str
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    outcome_code: str
    outcome_description: str
    current_resource_count: int
    existing_types: Set[str]
    existing_urls: Set[str]


@dataclass
class ResourceCandidate:
    """A candidate resource to add"""
    url: str
    title: str
    source: str
    resource_type: str
    difficulty: str
    provider: str
    embeddable: bool
    confidence: str
    reasoning: str
    is_verified: bool = False


class AsyncLLMGapFiller:
    """Async LLM-powered gap filler for curriculum resources"""

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
        self.cache_file = CACHE_DIR / "llm_gap_filler_cache_async.json"
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
    async def find_resource_candidates(self, gap: OutcomeGap) -> List[ResourceCandidate]:
        """
        Find diverse resource candidates for an outcome.

        Returns:
            List of resource candidates with different types (video, article, practice, etc.)
        """
        # Check cache
        cache_key = f"{gap.curriculum_file}:{gap.outcome_code}"
        if cache_key in self.cache:
            logger.info(f"   💾 Using cached candidates")
            return self._parse_cached_candidates(self.cache[cache_key])

        # Build prompt
        prompt = self._build_prompt(gap)

        # Try primary model, then fallback
        for model_name in [self.model, self.fallback_model]:
            try:
                async with self.semaphore:
                    response = await async_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are an expert educational resource curator. Your task is to "
                                          "recommend the best FREE online resources for high school students "
                                          "learning specific curriculum outcomes."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        temperature=1.0,
                        max_completion_tokens=1500,
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
                candidates = self._parse_llm_response(llm_response, gap)

                if candidates:
                    # Cache the results
                    self.cache[cache_key] = {
                        "outcome_code": gap.outcome_code,
                        "outcome_description": gap.outcome_description,
                        "candidates": [
                            {
                                "url": c.url,
                                "title": c.title,
                                "source": c.source,
                                "type": c.resource_type,
                                "difficulty": c.difficulty,
                                "provider": c.provider,
                                "embeddable": c.embeddable,
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

    def _build_prompt(self, gap: OutcomeGap) -> str:
        """Build prompt for finding resources"""

        existing_info = ""
        if gap.current_resource_count > 0:
            existing_info = f"\n**Existing Resources:** {gap.current_resource_count} resources already exist "
            existing_info += f"(types: {', '.join(gap.existing_types) if gap.existing_types else 'none'})\n"

        prompt = f"""Find {self.num_candidates} FREE online educational resources for this high school learning outcome.

**Learning Outcome:**
- Code: {gap.outcome_code}
- Description: {gap.outcome_description}
- Subject: {gap.subject} (Grade {gap.grade})
- Unit: {gap.unit_title}
{existing_info}

**Your Task:**
Find {self.num_candidates} diverse, high-quality FREE resources that directly teach this concept.

**Diversity Requirements:**
- Include at least 1 VIDEO (Khan Academy, CrashCourse, Bozeman Science, YouTube edu channels)
- Include at least 1 ARTICLE or REFERENCE (OpenStax, LibreTexts, Wikipedia, CK-12)
- Include at least 1 INTERACTIVE or PRACTICE (Khan Academy exercises, PhET simulations, practice problems)
- Mix different difficulty levels (beginner, intermediate, advanced)
- Mix different providers (don't suggest all from one source)

**Top-Tier Sources (Prefer These):**
- Khan Academy (videos, articles, practice)
- PhET Interactive Simulations (phet.colorado.edu)
- OpenStax textbooks
- CK-12 Foundation (ck12.org)
- MIT OpenCourseWare (ocw.mit.edu)
- LibreTexts (Biology/Chemistry/Physics LibreTexts)
- Wikipedia (for reference/overview)
- CrashCourse, Bozeman Science (educational YouTube)

**Response Format:**
For each resource, provide:

```
RESOURCE 1:
URL: [exact working URL]
TITLE: [clear, descriptive title]
SOURCE: [provider name]
TYPE: [video/article/simulation/practice/reference]
DIFFICULTY: [beginner/intermediate/advanced]
CONFIDENCE: [high/medium/low]
REASONING: [1 sentence explaining relevance]

RESOURCE 2:
...
```

**Important:**
- Only suggest URLs you are confident exist
- Ensure diversity across the {self.num_candidates} resources
- Match the grade level ({gap.grade}) and subject ({gap.subject})
- Avoid duplicating existing resource types if possible

Your {self.num_candidates} diverse recommendations:"""

        return prompt

    def _parse_llm_response(self, response: str, gap: OutcomeGap) -> List[ResourceCandidate]:
        """Parse LLM response into candidates"""
        candidates = []

        # Split by "RESOURCE" markers
        blocks = re.split(r'RESOURCE \d+:', response)

        for block in blocks[1:]:  # Skip first empty split
            # Extract fields
            url_match = re.search(r'URL:\s*(https?://[^\s\n]+)', block, re.IGNORECASE)
            title_match = re.search(r'TITLE:\s*([^\n]+)', block, re.IGNORECASE)
            source_match = re.search(r'SOURCE:\s*([^\n]+)', block, re.IGNORECASE)
            type_match = re.search(r'TYPE:\s*([^\n]+)', block, re.IGNORECASE)
            difficulty_match = re.search(r'DIFFICULTY:\s*([^\n]+)', block, re.IGNORECASE)
            confidence_match = re.search(r'CONFIDENCE:\s*([^\n]+)', block, re.IGNORECASE)
            reasoning_match = re.search(r'REASONING:\s*([^\n]+(?:\n[^\n]+)?)', block, re.IGNORECASE)

            if not url_match or not title_match:
                continue

            url = url_match.group(1).strip()
            title = title_match.group(1).strip()

            # Skip if URL already exists
            if url.lower() in {u.lower() for u in gap.existing_urls}:
                logger.info(f"      Skipping duplicate URL: {url}")
                continue

            # Validate URL format
            if not re.match(r'^https?://', url):
                continue

            # Extract/infer fields
            source = source_match.group(1).strip() if source_match else infer_source_from_url(url)
            resource_type = type_match.group(1).strip().lower() if type_match else infer_resource_type_from_url(url) or "article"
            difficulty = difficulty_match.group(1).strip().lower() if difficulty_match else self._infer_difficulty(gap.grade)
            confidence = confidence_match.group(1).strip().lower() if confidence_match else "medium"
            reasoning = reasoning_match.group(1).strip() if reasoning_match else "LLM suggested resource"

            # Normalize type
            if "video" in resource_type or "youtube" in url.lower():
                resource_type = "video"
            elif "simulation" in resource_type or "sim" in resource_type or "phet" in url.lower():
                resource_type = "simulation"
            elif "practice" in resource_type or "exercise" in resource_type or "/e/" in url:
                resource_type = "practice"
            elif "reference" in resource_type or "wikipedia" in url.lower():
                resource_type = "reference"
            elif "interactive" in resource_type:
                resource_type = "interactive"
            elif "article" in resource_type or "read" in resource_type:
                resource_type = "article"

            # Normalize difficulty
            if difficulty not in ["beginner", "intermediate", "advanced"]:
                difficulty = self._infer_difficulty(gap.grade)

            # Extract provider
            provider = self._extract_provider(url)

            # Check if embeddable
            embeddable = is_embeddable(url)

            candidates.append(ResourceCandidate(
                url=url,
                title=title,
                source=source,
                resource_type=resource_type,
                difficulty=difficulty,
                provider=provider,
                embeddable=embeddable,
                confidence=confidence,
                reasoning=reasoning
            ))

        return candidates

    def _infer_difficulty(self, grade: int) -> str:
        """Infer difficulty based on grade"""
        if grade <= 10:
            return "beginner"
        elif grade == 11:
            return "intermediate"
        else:  # grade 12+
            return "advanced"

    def _extract_provider(self, url: str) -> str:
        """Extract provider identifier from URL"""
        url_lower = url.lower()
        if "khanacademy" in url_lower:
            return "khan-academy"
        elif "youtube" in url_lower:
            return "youtube"
        elif "phet.colorado.edu" in url_lower:
            return "phet"
        elif "openstax" in url_lower:
            return "openstax"
        elif "crashcourse" in url_lower:
            return "crashcourse"
        elif "mit.edu" in url_lower or "ocw.mit.edu" in url_lower:
            return "mit-ocw"
        elif "wikipedia.org" in url_lower:
            return "wikipedia"
        elif "libretexts.org" in url_lower:
            return "libretexts"
        elif "ck12.org" in url_lower or "ck-12" in url_lower:
            return "ck12"
        elif "bozemanscience" in url_lower:
            return "bozeman-science"
        else:
            return "online"

    def _parse_cached_candidates(self, cached_data: dict) -> List[ResourceCandidate]:
        """Reconstruct candidates from cache"""
        return [
            ResourceCandidate(
                url=c["url"],
                title=c["title"],
                source=c["source"],
                resource_type=c["type"],
                difficulty=c["difficulty"],
                provider=c["provider"],
                embeddable=c["embeddable"],
                confidence=c["confidence"],
                reasoning=c["reasoning"]
            )
            for c in cached_data.get("candidates", [])
        ]

    async def fill_outcome_gap(
        self,
        gap: OutcomeGap,
        target_count: int = 3
    ) -> List[ResourceCandidate]:
        """
        Fill an outcome gap with verified, diverse resources.

        Args:
            gap: Outcome gap to fill
            target_count: Target number of total resources (including existing)

        Returns:
            List of verified resources to add
        """
        needed = max(target_count - gap.current_resource_count, 1)
        logger.info(f"   Need {needed} more resources (current: {gap.current_resource_count}, target: {target_count})")

        # Get candidates
        candidates = await self.find_resource_candidates(gap)

        if not candidates:
            logger.warning(f"   No candidates found")
            return []

        logger.info(f"   Got {len(candidates)} candidates from LLM")

        # Verify all candidates concurrently
        if self.verify_links:
            urls_to_verify = [c.url for c in candidates]
            verification_results = await verify_urls_batch(urls_to_verify, self.semaphore)

            # Mark verified candidates
            for candidate in candidates:
                candidate.is_verified = verification_results.get(candidate.url, False)

            # Filter to verified
            verified = [c for c in candidates if c.is_verified]

            if not verified:
                logger.warning(f"   All {len(candidates)} candidates failed verification")
                return []

            logger.info(f"   {len(verified)}/{len(candidates)} candidates verified")

            # Ensure diversity
            diverse = self._select_diverse_resources(verified, gap.existing_types, needed)
            return diverse
        else:
            # No verification
            return candidates[:needed]

    def _select_diverse_resources(
        self,
        candidates: List[ResourceCandidate],
        existing_types: Set[str],
        needed: int
    ) -> List[ResourceCandidate]:
        """
        Select diverse resources prioritizing:
        1. Different types from existing
        2. High confidence
        3. Diverse providers
        """
        selected = []
        used_types = set(existing_types)
        used_providers = set()

        # Priority 1: Fill missing types (video, article, practice)
        desired_types = ["video", "article", "practice", "simulation"]
        for desired_type in desired_types:
            if desired_type not in used_types and len(selected) < needed:
                for candidate in candidates:
                    if candidate.resource_type == desired_type and candidate not in selected:
                        selected.append(candidate)
                        used_types.add(candidate.resource_type)
                        used_providers.add(candidate.provider)
                        break

        # Priority 2: Add remaining high-confidence resources with diverse providers
        confidence_order = {"high": 3, "medium": 2, "low": 1}
        remaining = [c for c in candidates if c not in selected]
        remaining.sort(key=lambda c: (
            confidence_order.get(c.confidence, 0),
            c.provider not in used_providers,  # Prefer new providers
            c.resource_type not in used_types  # Prefer new types
        ), reverse=True)

        for candidate in remaining:
            if len(selected) >= needed:
                break
            selected.append(candidate)
            used_types.add(candidate.resource_type)
            used_providers.add(candidate.provider)

        return selected[:needed]


def find_outcome_gaps(target_count: int = 3) -> List[OutcomeGap]:
    """
    Find all outcomes with fewer than target_count resources.

    Args:
        target_count: Target number of resources per outcome.
                     Use 0 to find only empty outcomes (no resources),
                     Use 3 to find outcomes with <3 resources, etc.

    Returns:
        List of outcome gaps
    """
    gaps = []

    # Only process curriculum files (subject-grade pattern)
    curriculum_pattern = re.compile(r'^(bio|chem|phys|math|ela|social)-\d+.*\.json$')

    for curriculum_file in CURRICULUM_DIR.glob("*.json"):
        if curriculum_file.name.startswith("."):
            continue

        # Skip non-curriculum files
        if not curriculum_pattern.match(curriculum_file.name):
            continue

        with open(curriculum_file, 'r') as f:
            curriculum = json.load(f)

        # Skip if not a dict (array files, etc.)
        if not isinstance(curriculum, dict):
            continue

        subject = curriculum.get('subject', '')
        grade = curriculum.get('grade', 11)

        for unit in curriculum.get('units', []):
            unit_id = unit.get('id', '')
            unit_title = unit.get('title', '')
            resources = unit.get('resources', [])

            # Build resource lookup
            resource_by_outcome = {}
            for resource in resources:
                for outcome_code in resource.get('alignedOutcomes', []):
                    if outcome_code not in resource_by_outcome:
                        resource_by_outcome[outcome_code] = []
                    resource_by_outcome[outcome_code].append(resource)

            # Check each outcome
            for outcome in unit.get('outcomes', []):
                if not isinstance(outcome, dict):
                    continue

                outcome_code = outcome.get('code', '')
                outcome_description = outcome.get('description', '')

                if not outcome_code:
                    continue

                # Get resources for this outcome
                outcome_resources = resource_by_outcome.get(outcome_code, [])
                count = len(outcome_resources)

                # Find gaps: outcomes with fewer resources than target
                # If target_count is 0, find only empty outcomes (count == 0)
                # If target_count is 3, find outcomes with count < 3
                if target_count == 0:
                    meets_criteria = (count == 0)
                else:
                    meets_criteria = (count < target_count)

                if meets_criteria:
                    # Collect existing types and URLs
                    existing_types = {r.get('type', '').lower() for r in outcome_resources}
                    existing_urls = {r.get('url', '') for r in outcome_resources}

                    gaps.append(OutcomeGap(
                        curriculum_file=curriculum_file.name,
                        subject=subject,
                        grade=grade,
                        unit_id=unit_id,
                        unit_title=unit_title,
                        outcome_code=outcome_code,
                        outcome_description=outcome_description,
                        current_resource_count=count,
                        existing_types=existing_types,
                        existing_urls=existing_urls
                    ))

    return gaps


def add_resources_to_curriculum(
    gap: OutcomeGap,
    resources: List[ResourceCandidate]
) -> bool:
    """Add resources to curriculum file"""
    curriculum_path = CURRICULUM_DIR / gap.curriculum_file

    with open(curriculum_path, 'r') as f:
        curriculum = json.load(f)

    # Find unit
    unit = next((u for u in curriculum.get('units', []) if u.get('id') == gap.unit_id), None)
    if not unit:
        return False

    # Initialize resources array if needed
    if 'resources' not in unit:
        unit['resources'] = []

    # Add each resource
    for resource in resources:
        resource_dict = {
            "type": resource.resource_type,
            "title": resource.title,
            "url": resource.url,
            "difficulty": resource.difficulty,
            "alignedOutcomes": [gap.outcome_code],
            "source": resource.source,
            "provider": resource.provider,
            "embeddable": resource.embeddable
        }
        unit['resources'].append(resource_dict)

    # Save curriculum
    with open(curriculum_path, 'w') as f:
        json.dump(curriculum, f, indent=2, ensure_ascii=False)
        f.write('\n')

    return True


async def process_outcome_gap(
    gap: OutcomeGap,
    filler: AsyncLLMGapFiller,
    target_count: int = 3,
    dry_run: bool = True
) -> Optional[Dict[str, Any]]:
    """Process a single outcome gap"""
    logger.info(f"Processing: {gap.outcome_code} - {gap.outcome_description[:60]}")
    logger.info(f"   Current: {gap.current_resource_count} resources (types: {', '.join(gap.existing_types) if gap.existing_types else 'none'})")

    # Fill gap
    new_resources = await filler.fill_outcome_gap(gap, target_count)

    if new_resources:
        logger.info(f"   ✅ Found {len(new_resources)} resources to add")
        for i, resource in enumerate(new_resources, 1):
            logger.info(f"      {i}. [{resource.resource_type}] {resource.title}")
            logger.info(f"         {resource.url}")
            logger.info(f"         Source: {resource.source}, Confidence: {resource.confidence}")

        if not dry_run:
            # Add to curriculum
            success = add_resources_to_curriculum(gap, new_resources)
            if success:
                logger.info(f"      💾 Added {len(new_resources)} resources to {gap.curriculum_file}")
            else:
                logger.error(f"      ⚠ Failed to update curriculum file")
                return None

        return {
            "file": gap.curriculum_file,
            "unit": gap.unit_id,
            "outcome_code": gap.outcome_code,
            "outcome_description": gap.outcome_description,
            "resources_added": len(new_resources),
            "resources": [
                {
                    "url": r.url,
                    "title": r.title,
                    "type": r.resource_type,
                    "source": r.source,
                    "confidence": r.confidence
                }
                for r in new_resources
            ]
        }
    else:
        logger.error(f"   ❌ No resources found")
        return None


async def main_async(
    target_count: int = 3,
    dry_run: bool = True,
    limit: Optional[int] = None,
    output_path: Optional[Path] = None,
    resume: bool = False
):
    """Main async processing function"""
    start_time = datetime.now()

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║   🎯 Async LLM Gap Filler - Fill Resource Gaps               ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print("")

    # Find gaps
    if target_count == 0:
        print(f"🔍 Finding outcomes with 0 resources (empty outcomes)...")
    else:
        print(f"🔍 Finding outcomes with <{target_count} resources...")
    gaps = find_outcome_gaps(target_count)

    if not gaps:
        if target_count == 0:
            print(f"✅ No gaps found! All outcomes have at least 1 resource.")
        else:
            print(f"✅ No gaps found! All outcomes have {target_count}+ resources.")
        return

    print(f"   Found {len(gaps)} outcomes needing more resources\n")

    # Group by subject
    by_subject = Counter(g.subject for g in gaps)
    print("   Gaps by subject:")
    for subject, count in by_subject.most_common():
        print(f"      • {subject}: {count}")
    print("")

    # Apply limit
    if limit:
        gaps = gaps[:limit]
        print(f"   Limited to first {limit} outcomes\n")

    # Initialize filler
    filler = AsyncLLMGapFiller(
        model=PRIMARY_MODEL,
        verify_links=True,
        num_candidates=5,
        concurrency=CONCURRENT_REQUESTS
    )

    # Checkpoint manager
    checkpoint = CheckpointManager(DATA_DIR / "checkpoint_gap_filler.json", interval=50)

    # Resume from checkpoint
    start_index = 0
    results = {"filled": [], "failed": []}

    if resume and checkpoint.exists():
        checkpoint_data = checkpoint.load()
        if checkpoint_data:
            start_index = checkpoint_data.get("last_processed_index", 0) + 1
            results = checkpoint_data.get("results", results)
            print(f"📂 Resuming from checkpoint at index {start_index}\n")

    # Process gaps
    print("="*64)
    print("")

    for i, gap in enumerate(gaps[start_index:], start=start_index):
        print(f"[{i+1}/{len(gaps)}] {gap.subject} - {gap.outcome_code}")

        result = await process_outcome_gap(gap, filler, target_count, dry_run)

        if result:
            results["filled"].append(result)
        else:
            results["failed"].append({
                "file": gap.curriculum_file,
                "outcome_code": gap.outcome_code,
                "description": gap.outcome_description
            })

        # Save checkpoint
        if (i + 1) % 50 == 0:
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
    total_resources_added = sum(r["resources_added"] for r in results["filled"])

    print("="*64)
    print("\n✨ Summary:")
    print(f"   Total gaps: {len(gaps)}")
    print(f"   Filled: {len(results['filled'])}")
    print(f"   Failed: {len(results['failed'])}")
    print(f"   Resources added: {total_resources_added}")
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

    parser = argparse.ArgumentParser(description="Fill gaps in curriculum resource coverage using async LLM")
    parser.add_argument(
        "--target-count",
        type=int,
        default=3,
        help="Target number of resources per outcome. Use 0 to fill only empty outcomes (default: 3)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Don't update files, just show what would be added")
    parser.add_argument("--limit", type=int, help="Limit number of outcomes to process (for testing)")
    parser.add_argument("--output", help="Save detailed results to JSON file")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint if available")

    args = parser.parse_args()

    output_path = Path(args.output) if args.output else None

    # Setup logging
    setup_logging(DATA_DIR / "gap_filler_async.log", "INFO")

    # Run async processing
    try:
        asyncio.run(main_async(
            target_count=args.target_count,
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
