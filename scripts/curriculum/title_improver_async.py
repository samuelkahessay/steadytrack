#!/usr/bin/env python3
"""
Async LLM-powered title improver for curriculum resources.
Uses GPT-4o to generate user-friendly, descriptive titles.

Features:
- Identifies poor titles (URLs, generic names, technical jargon)
- Batch processing (20 titles at a time)
- Concurrent processing
- Preview mode for user approval
- Checkpoint/resume support

Usage:
    scripts/.venv/bin/python scripts/curriculum/title_improver_async.py \\
        --dry-run \\
        --limit 20

    scripts/.venv/bin/python scripts/curriculum/title_improver_async.py \\
        --auto-approve \\
        --output out/title_improvements.json
"""

import sys
import json
import asyncio
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Set
from datetime import datetime

# Import shared utilities
from llm_utils import (
    get_async_client,
    async_retry_with_backoff,
    CheckpointManager,
    format_duration,
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

# Batch size for title improvements
BATCH_SIZE = 20


@dataclass
class ResourceTitle:
    """A resource needing title improvement"""
    curriculum_file: str
    subject: str
    grade: int
    unit_id: str
    resource_url: str
    current_title: str
    resource_type: str
    source: str
    difficulty: str
    aligned_outcomes: List[str]
    outcome_descriptions: List[str]


@dataclass
class TitleImprovement:
    """An improved title suggestion"""
    resource_url: str
    current_title: str
    suggested_title: str
    reasoning: str
    confidence: str


class AsyncTitleImprover:
    """Async LLM-powered title improver"""

    def __init__(
        self,
        model: str = PRIMARY_MODEL,
        concurrency: int = CONCURRENT_REQUESTS
    ):
        self.model = model
        self.fallback_model = FALLBACK_MODEL
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.cache_file = CACHE_DIR / "title_improver_cache_async.json"
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
    async def improve_titles_batch(
        self,
        titles: List[ResourceTitle]
    ) -> List[TitleImprovement]:
        """
        Improve a batch of titles using LLM.

        Args:
            titles: Batch of resources needing title improvements

        Returns:
            List of title improvements
        """
        # Check if all are cached
        cache_keys = [f"{t.curriculum_file}:{t.resource_url}" for t in titles]
        all_cached = all(key in self.cache for key in cache_keys)

        if all_cached:
            logger.info(f"   💾 Using cached improvements for all {len(titles)} titles")
            return [self._parse_cached_improvement(self.cache[key]) for key in cache_keys]

        # Build batch prompt
        prompt = self._build_batch_prompt(titles)

        # Try primary model, then fallback
        for model_name in [self.model, self.fallback_model]:
            try:
                async with self.semaphore:
                    response = await async_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are an expert at creating clear, user-friendly titles for "
                                          "educational resources. Your titles are concise, descriptive, and "
                                          "help students understand what they'll learn."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        temperature=1.0,
                        max_completion_tokens=2000,
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
                improvements = self._parse_llm_response(llm_response, titles)

                if improvements:
                    # Cache the results
                    for title, improvement in zip(titles, improvements):
                        if improvement:
                            cache_key = f"{title.curriculum_file}:{title.resource_url}"
                            self.cache[cache_key] = {
                                "current_title": improvement.current_title,
                                "suggested_title": improvement.suggested_title,
                                "reasoning": improvement.reasoning,
                                "confidence": improvement.confidence,
                                "timestamp": datetime.now().isoformat()
                            }
                    self._save_cache()
                    return improvements

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

    def _build_batch_prompt(self, titles: List[ResourceTitle]) -> str:
        """Build prompt for batch title improvement"""

        resources_text = ""
        for i, title in enumerate(titles, 1):
            outcomes_preview = ", ".join(title.outcome_descriptions[:2]) if title.outcome_descriptions else "N/A"
            resources_text += f"""
RESOURCE {i}:
Current Title: {title.current_title}
URL: {title.resource_url}
Type: {title.resource_type}
Source: {title.source}
Subject: {title.subject} (Grade {title.grade})
Difficulty: {title.difficulty}
Learning Outcomes: {outcomes_preview[:100]}...

"""

        prompt = f"""Improve the titles of these {len(titles)} educational resources to be more user-friendly and descriptive.

{resources_text}

**Title Requirements:**
- **Clear**: Immediately convey what the resource teaches
- **Concise**: 3-10 words (max 80 characters)
- **Descriptive**: Include key concepts/topics
- **Grade-appropriate**: Match the difficulty level
- **Professional**: Proper capitalization, no jargon
- **Unique**: Each title should be distinct

**Examples:**
- Bad: "taxonomy" → Good: "Introduction to Biological Classification"
- Bad: "video" → Good: "Momentum and Collisions Explained"
- Bad: "https://..." → Good: "Hardy-Weinberg Principle Practice Problems"

**Response Format:**
For each resource, provide:

```
TITLE 1:
SUGGESTED: [Your improved title (3-10 words)]
REASONING: [1 sentence why this is better]
CONFIDENCE: [high/medium/low]

TITLE 2:
...
```

**Important:**
- Provide EXACTLY {len(titles)} improved titles in order
- Keep titles concise but informative
- Use proper capitalization (Title Case)
- If current title is already good, you may keep it but explain why

Your {len(titles)} improved titles:"""

        return prompt

    def _parse_llm_response(
        self,
        response: str,
        titles: List[ResourceTitle]
    ) -> List[TitleImprovement]:
        """Parse LLM response into improvements"""
        improvements = []

        # Split by "TITLE" markers
        blocks = re.split(r'TITLE \d+:', response)

        for i, block in enumerate(blocks[1:]):  # Skip first empty split
            if i >= len(titles):
                break

            title = titles[i]

            # Extract fields
            suggested_match = re.search(r'SUGGESTED:\s*([^\n]+)', block, re.IGNORECASE)
            reasoning_match = re.search(r'REASONING:\s*([^\n]+(?:\n[^\n]+)?)', block, re.IGNORECASE)
            confidence_match = re.search(r'CONFIDENCE:\s*([^\n]+)', block, re.IGNORECASE)

            if not suggested_match:
                improvements.append(None)
                continue

            suggested_title = suggested_match.group(1).strip()
            reasoning = reasoning_match.group(1).strip() if reasoning_match else "LLM suggested improvement"
            confidence = confidence_match.group(1).strip().lower() if confidence_match else "medium"

            # Clean up suggested title
            suggested_title = suggested_title.strip('"\'')

            # Validate title length
            if len(suggested_title) > 120:
                suggested_title = suggested_title[:117] + "..."

            improvements.append(TitleImprovement(
                resource_url=title.resource_url,
                current_title=title.current_title,
                suggested_title=suggested_title,
                reasoning=reasoning,
                confidence=confidence
            ))

        # Pad with None if we didn't get enough improvements
        while len(improvements) < len(titles):
            improvements.append(None)

        return improvements

    def _parse_cached_improvement(self, cached_data: dict) -> TitleImprovement:
        """Reconstruct improvement from cache"""
        return TitleImprovement(
            resource_url="",  # Not stored in cache
            current_title=cached_data["current_title"],
            suggested_title=cached_data["suggested_title"],
            reasoning=cached_data["reasoning"],
            confidence=cached_data["confidence"]
        )


def is_poor_title(title: str, url: str) -> bool:
    """Check if a title needs improvement"""
    if not title or len(title.strip()) < 3:
        return True

    title_lower = title.lower().strip()

    # Check for URLs
    if title_lower.startswith(('http://', 'https://', 'www.')):
        return True

    # Check for generic/poor titles
    poor_titles = {
        'video', 'article', 'simulation', 'practice', 'reference', 'resource',
        'link', 'webpage', 'website', 'page', 'content', 'material',
        'untitled', 'n/a', 'na', 'none', 'unknown'
    }

    if title_lower in poor_titles:
        return True

    # Check for single-word technical terms (likely too generic)
    words = title_lower.split()
    if len(words) == 1 and len(title) < 15:
        # Single short word is probably too generic
        return True

    # Check for excessive length
    if len(title) > 100:
        return True

    # Check for mostly numbers/special chars
    alpha_chars = sum(c.isalpha() for c in title)
    if alpha_chars < len(title) * 0.5:
        return True

    return False


def find_resources_needing_titles() -> List[ResourceTitle]:
    """Find all resources with poor titles"""
    resources = []

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

        # Skip if not a dict
        if not isinstance(curriculum, dict):
            continue

        subject = curriculum.get('subject', '')
        grade = curriculum.get('grade', 11)

        # Build outcome map
        outcome_map = {}
        for unit in curriculum.get('units', []):
            for outcome in unit.get('outcomes', []):
                if isinstance(outcome, dict):
                    outcome_map[outcome.get('code')] = outcome.get('description', '')

        for unit in curriculum.get('units', []):
            unit_id = unit.get('id', '')

            for resource in unit.get('resources', []):
                title = resource.get('title', '')
                url = resource.get('url', '')

                if is_poor_title(title, url):
                    aligned_codes = resource.get('alignedOutcomes', [])
                    aligned_descriptions = [outcome_map.get(code, '') for code in aligned_codes]

                    resources.append(ResourceTitle(
                        curriculum_file=curriculum_file.name,
                        subject=subject,
                        grade=grade,
                        unit_id=unit_id,
                        resource_url=url,
                        current_title=title,
                        resource_type=resource.get('type', 'article'),
                        source=resource.get('source', ''),
                        difficulty=resource.get('difficulty', 'intermediate'),
                        aligned_outcomes=aligned_codes,
                        outcome_descriptions=aligned_descriptions
                    ))

    return resources


def update_resource_title(
    curriculum_file: str,
    unit_id: str,
    resource_url: str,
    new_title: str
) -> bool:
    """Update a resource title in curriculum file"""
    curriculum_path = CURRICULUM_DIR / curriculum_file

    with open(curriculum_path, 'r') as f:
        curriculum = json.load(f)

    # Find unit
    unit = next((u for u in curriculum.get('units', []) if u.get('id') == unit_id), None)
    if not unit:
        return False

    # Find and update resource
    for resource in unit.get('resources', []):
        if resource.get('url') == resource_url:
            resource['title'] = new_title

            # Save
            with open(curriculum_path, 'w') as f:
                json.dump(curriculum, f, indent=2, ensure_ascii=False)
                f.write('\n')

            return True

    return False


async def process_title_batch(
    batch: List[ResourceTitle],
    improver: AsyncTitleImprover,
    dry_run: bool = True,
    auto_approve: bool = False
) -> List[Dict[str, Any]]:
    """Process a batch of titles"""
    logger.info(f"Processing batch of {len(batch)} titles...")

    # Get improvements
    improvements = await improver.improve_titles_batch(batch)

    results = []

    for title, improvement in zip(batch, improvements):
        if not improvement:
            logger.warning(f"   ⚠ No improvement for: {title.current_title}")
            continue

        logger.info(f"\n   [{title.subject}] {title.resource_type}")
        logger.info(f"   Current:   \"{title.current_title}\"")
        logger.info(f"   Suggested: \"{improvement.suggested_title}\"")
        logger.info(f"   Reasoning: {improvement.reasoning}")
        logger.info(f"   Confidence: {improvement.confidence}")

        # Approval
        approved = auto_approve
        if not auto_approve and not dry_run:
            response = input("   Apply this change? [y/N]: ").strip().lower()
            approved = response in ['y', 'yes']

        if approved or dry_run:
            if not dry_run:
                success = update_resource_title(
                    title.curriculum_file,
                    title.unit_id,
                    title.resource_url,
                    improvement.suggested_title
                )
                if success:
                    logger.info(f"   ✅ Updated in {title.curriculum_file}")
                else:
                    logger.error(f"   ❌ Failed to update")
                    continue
            else:
                logger.info(f"   🔍 [DRY RUN] Would update")

            results.append({
                "file": title.curriculum_file,
                "unit": title.unit_id,
                "url": title.resource_url,
                "old_title": title.current_title,
                "new_title": improvement.suggested_title,
                "confidence": improvement.confidence,
                "reasoning": improvement.reasoning
            })
        else:
            logger.info(f"   ⏭  Skipped")

    return results


async def main_async(
    dry_run: bool = True,
    auto_approve: bool = False,
    limit: Optional[int] = None,
    output_path: Optional[Path] = None,
    resume: bool = False
):
    """Main async processing function"""
    start_time = datetime.now()

    print("╔════════════════════════════════════════════════════════════════╗")
    print("║   ✨ Async Title Improver - User-Friendly Titles             ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print("")

    # Find resources
    print("🔍 Finding resources with poor titles...")
    resources = find_resources_needing_titles()

    if not resources:
        print("✅ No resources with poor titles found!")
        return

    print(f"   Found {len(resources)} resources needing title improvements\n")

    # Apply limit
    if limit:
        resources = resources[:limit]
        print(f"   Limited to first {limit} resources\n")

    # Initialize improver
    improver = AsyncTitleImprover(
        model=PRIMARY_MODEL,
        concurrency=CONCURRENT_REQUESTS
    )

    # Checkpoint manager
    checkpoint = CheckpointManager(DATA_DIR / "checkpoint_title_improver.json", interval=BATCH_SIZE)

    # Resume from checkpoint
    start_index = 0
    all_results = []

    if resume and checkpoint.exists():
        checkpoint_data = checkpoint.load()
        if checkpoint_data:
            start_index = checkpoint_data.get("last_processed_index", 0) + 1
            all_results = checkpoint_data.get("results", [])
            print(f"📂 Resuming from checkpoint at index {start_index}\n")

    # Process in batches
    print("="*64)
    print("")

    for batch_start in range(start_index, len(resources), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(resources))
        batch = resources[batch_start:batch_end]

        print(f"[Batch {batch_start//BATCH_SIZE + 1}] Processing {batch_start+1}-{batch_end} of {len(resources)}")

        results = await process_title_batch(batch, improver, dry_run, auto_approve)
        all_results.extend(results)

        # Save checkpoint
        if (batch_end) % BATCH_SIZE == 0 or batch_end == len(resources):
            checkpoint.save({
                "last_processed_index": batch_end - 1,
                "results": all_results
            })
            print(f"\n💾 Checkpoint saved ({batch_end} processed)\n")

    # Clear checkpoint
    checkpoint.clear()

    # Summary
    duration = (datetime.now() - start_time).total_seconds()

    print("="*64)
    print("\n✨ Summary:")
    print(f"   Resources checked: {len(resources)}")
    print(f"   Titles improved: {len(all_results)}")
    print(f"   Duration: {format_duration(duration)}")

    if dry_run:
        print("\n   🔍 DRY RUN - No files were modified")
        print("   Remove --dry-run and use --auto-approve to apply changes")

    # Save detailed results
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(all_results, f, indent=2)
        print(f"\n📄 Detailed results saved to: {output_path}")

    print("")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Improve resource titles using async LLM")
    parser.add_argument("--dry-run", action="store_true", help="Don't update files, just show suggestions")
    parser.add_argument("--auto-approve", action="store_true", help="Auto-approve all suggestions (skip prompts)")
    parser.add_argument("--limit", type=int, help="Limit number of resources to process (for testing)")
    parser.add_argument("--output", help="Save detailed results to JSON file")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint if available")

    args = parser.parse_args()

    output_path = Path(args.output) if args.output else None

    # Setup logging
    setup_logging(DATA_DIR / "title_improver_async.log", "INFO")

    # Run async processing
    try:
        asyncio.run(main_async(
            dry_run=args.dry_run,
            auto_approve=args.auto_approve,
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
