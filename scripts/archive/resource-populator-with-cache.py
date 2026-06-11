#!/usr/bin/env python3
"""
Enhanced resource populator with intelligent caching.
Saves LLM results to avoid re-processing and wasting API calls.
"""

import sys
import os
import json
import argparse
import hashlib
import re
import requests
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add parent directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = ROOT_DIR / "data"
CURRICULUM_DIR = DATA_DIR / "curriculum"
REPORTS_DIR = DATA_DIR / "reports"

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

@dataclass
class OutcomeContext:
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    outcome_code: str
    outcome_description: str
    strand: Optional[str] = None

@dataclass
class ResourceCandidate:
    url: str
    title: str
    type: str  # video, article, practice, simulation
    source: str
    difficulty: str
    provider: str
    aligned_outcomes: List[str] = field(default_factory=list)
    confidence_score: float = 0.5
    embeddable: bool = False

    def to_curriculum_format(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "title": self.title,
            "url": self.url,
            "difficulty": self.difficulty,
            "alignedOutcomes": self.aligned_outcomes,
            "source": self.source,
            "provider": self.provider,
            "embeddable": self.embeddable
        }

# Import the necessary classes from resource_populator_enhanced
sys.path.insert(0, str(SCRIPT_DIR))
exec(open(SCRIPT_DIR / "resource-populator-enhanced.py").read(), globals())

# Cache directory
CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def get_outcome_cache_key(outcome: OutcomeContext) -> str:
    """Generate cache key for an outcome"""
    # Use outcome code + description hash for cache key
    content = f"{outcome.outcome_code}:{outcome.outcome_description}"
    return hashlib.md5(content.encode()).hexdigest()


class CachedResourcePopulator(ResourcePopulator):
    """Resource populator with caching to avoid re-running LLM calls"""

    def __init__(self, use_llm: bool = False, llm_model: str = "gpt-5-mini", use_cache: bool = True):
        super().__init__(use_llm, llm_model)
        self.use_cache = use_cache
        self.cache_hits = 0
        self.cache_misses = 0

    def get_cache_file(self, subject_file: str) -> Path:
        """Get cache file path for a subject"""
        cache_file = CACHE_DIR / f"{subject_file.replace('.json', '')}_cache.json"
        return cache_file

    def load_cache(self, subject_file: str) -> dict:
        """Load cache for a subject"""
        cache_file = self.get_cache_file(subject_file)
        if cache_file.exists() and self.use_cache:
            with open(cache_file, 'r') as f:
                return json.load(f)
        return {}

    def save_cache(self, subject_file: str, cache: dict):
        """Save cache for a subject"""
        cache_file = self.get_cache_file(subject_file)
        with open(cache_file, 'w') as f:
            json.dump(cache, f, indent=2)

    def find_resources(self, outcome: OutcomeContext, min_per_type: int = 1, current: int = 0, total: int = 0, cache: dict = None) -> List[ResourceCandidate]:
        """Find resources with caching support"""

        cache_key = get_outcome_cache_key(outcome)

        # Check cache first
        if cache and cache_key in cache and self.use_cache:
            cached_data = cache[cache_key]
            self.cache_hits += 1

            # Show progress with cache indicator
            progress_bar = ""
            if total > 0:
                pct = int((current / total) * 100)
                bar_length = 20
                filled = int((pct / 100) * bar_length)
                progress_bar = f" [{('█' * filled) + ('░' * (bar_length - filled))}] {pct}%"

            print(f"   💾 [{current}/{total}]{progress_bar} Using cached results for {outcome.outcome_code}")
            print(f"      ✓ Cached: {len(cached_data['final_selection'])} resources from {len(cached_data['candidates'])} candidates")

            # Reconstruct ResourceCandidate objects from cached data
            candidates = []
            for res in cached_data['final_selection']:
                candidates.append(ResourceCandidate(
                    url=res['url'],
                    title=res['title'],
                    type=res['type'],
                    source=res['source'],
                    difficulty=res['difficulty'],
                    provider=res['provider'],
                    aligned_outcomes=[outcome.outcome_code],
                    confidence_score=res.get('confidence_score', 0.8),
                    embeddable=res.get('embeddable', False)
                ))
            return candidates

        # Cache miss - do the actual search
        self.cache_misses += 1
        all_candidates = []

        # Search multiple sources
        progress_bar = ""
        if total > 0:
            pct = int((current / total) * 100)
            bar_length = 20
            filled = int((pct / 100) * bar_length)
            progress_bar = f" [{('█' * filled) + ('░' * (bar_length - filled))}] {pct}%"

        print(f"   🔍 [{current}/{total}]{progress_bar} Searching for {outcome.outcome_code}: {outcome.outcome_description[:60]}...")

        all_candidates.extend(self.khan.search_outcomes(outcome, max_results=5))
        all_candidates.extend(self.openstax.search_outcomes(outcome, max_results=2))
        all_candidates.extend(self.phet.search_outcomes(outcome, max_results=1))

        # Dynamically decide how many resources
        target_count = min(max(2, len(all_candidates) // 2), 5)

        # Use LLM to rank
        ranked = self.llm.rank_candidates(outcome, all_candidates, top_n=target_count)

        # Ensure diversity
        final_resources = self._ensure_diversity(ranked, min_per_type, max_total=target_count)

        print(f"      ✓ Selected {len(final_resources)} resources ({len(all_candidates)} candidates evaluated)")

        # Cache the results
        if cache is not None:
            cache[cache_key] = {
                'outcome_code': outcome.outcome_code,
                'outcome_description': outcome.outcome_description,
                'candidates': [
                    {
                        'url': c.url,
                        'title': c.title,
                        'type': c.type,
                        'source': c.source,
                        'confidence_score': c.confidence_score
                    }
                    for c in all_candidates
                ],
                'final_selection': [
                    {
                        'url': r.url,
                        'title': r.title,
                        'type': r.type,
                        'source': r.source,
                        'difficulty': r.difficulty,
                        'provider': r.provider,
                        'confidence_score': r.confidence_score,
                        'embeddable': r.embeddable
                    }
                    for r in final_resources
                ],
                'llm_used': self.llm.enabled,
                'timestamp': datetime.now().isoformat()
            }

        return final_resources

    def populate_curriculum(
        self,
        subject_file: str,
        outcomes: List[OutcomeContext],
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """Add resources to curriculum file with caching and smart diversity"""

        # Load cache for this subject
        cache = self.load_cache(subject_file)

        curriculum_path = CURRICULUM_DIR / subject_file

        if not curriculum_path.exists():
            return {"success": False, "error": f"File not found: {subject_file}"}

        # Load curriculum
        with open(curriculum_path, 'r') as f:
            curriculum = json.load(f)

        print(f"\n📚 {curriculum['subject']} (Grade {curriculum['grade']})")
        print(f"   Processing {len(outcomes)} outcomes")
        print(f"   Using LLM: {'✓ Yes (gpt-5-mini)' if self.llm.enabled else '✗ No (keyword matching only)'}")
        print(f"   Cache: {len(cache)} outcomes cached")
        print(f"   Smart diversity: Will prefer unused URLs over duplicates\n")

        resources_added = 0
        diversity_swaps = 0

        # Process each outcome
        for idx, outcome in enumerate(outcomes, 1):
            # Find resources (will use cache if available)
            candidates = self.find_resources(outcome, current=idx, total=len(outcomes), cache=cache)

            if not candidates:
                print(f"      ⚠ No resources found")
                continue

            # Find the unit in curriculum
            unit = None
            for u in curriculum.get('units', []):
                if u.get('id') == outcome.unit_id:
                    unit = u
                    break

            if not unit:
                print(f"      ⚠ Unit {outcome.unit_id} not found in curriculum")
                continue

            # Add resources to unit
            if 'resources' not in unit:
                unit['resources'] = []

            # Get existing URLs in this unit
            existing_urls = set(r.get('url') for r in unit['resources'])

            # Smart diversity: prefer candidates that aren't already in the unit
            new_candidates = [c for c in candidates if c.url not in existing_urls]
            reused_candidates = [c for c in candidates if c.url in existing_urls]

            # Prioritize new candidates, but allow some reuse if we don't have enough new ones
            # Target: at least 2 NEW resources per outcome when possible
            min_new_resources = min(2, len(new_candidates))
            selected_candidates = new_candidates[:min_new_resources]

            # Fill remaining slots with reused candidates if needed
            remaining_slots = len(candidates) - len(selected_candidates)
            if remaining_slots > 0 and reused_candidates:
                selected_candidates.extend(reused_candidates[:remaining_slots])

            if len(new_candidates) > 0 and len(reused_candidates) > 0:
                diversity_swaps += 1
                print(f"      🎯 Diversity boost: Using {len(new_candidates)} new URLs, skipping {len(reused_candidates)} already-used")

            for candidate in selected_candidates:
                resource_dict = candidate.to_curriculum_format()

                # Check if this URL already exists in the unit
                existing_resource = None
                for r in unit['resources']:
                    if r.get('url') == resource_dict['url']:
                        existing_resource = r
                        break

                if existing_resource:
                    # Resource exists - update alignedOutcomes if this outcome isn't already listed
                    aligned = existing_resource.get('alignedOutcomes', [])
                    if outcome.outcome_code not in aligned:
                        aligned.append(outcome.outcome_code)
                        existing_resource['alignedOutcomes'] = aligned
                        resources_added += 1  # Count as "added" since we're improving alignment
                else:
                    # New resource - add it
                    unit['resources'].append(resource_dict)
                    resources_added += 1

        # Save curriculum
        if not dry_run:
            with open(curriculum_path, 'w') as f:
                json.dump(curriculum, f, indent=2, ensure_ascii=False)
                f.write('\n')
            print(f"\n   💾 Saved {curriculum_path}")
            if len(outcomes) > 0:
                print(f"   📊 Resources added: {resources_added} total (avg {resources_added/len(outcomes):.1f} per outcome)")
            if diversity_swaps > 0:
                print(f"   🎯 Diversity improvements: {diversity_swaps} outcomes got unique URLs")

            # Save cache
            self.save_cache(subject_file, cache)
            print(f"   💾 Cache updated: {self.get_cache_file(subject_file)}")
            print(f"   📈 Cache stats: {self.cache_hits} hits, {self.cache_misses} misses")
        else:
            print(f"\n   🔍 DRY RUN - No changes written")

        return {
            "success": True,
            "subject": curriculum['subject'],
            "outcomes_processed": len(outcomes),
            "resources_added": resources_added,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "diversity_swaps": diversity_swaps
        }


def main():
    parser = argparse.ArgumentParser(description="Enhanced automated resource population WITH CACHING")
    parser.add_argument("--subject", help="Subject file to process (e.g., bio-30.json)")
    parser.add_argument("--all-sciences", action="store_true", help="Process all science subjects")
    parser.add_argument("--outcomes", help="Comma-separated outcome codes to process")
    parser.add_argument("--limit", type=int, help="Limit number of outcomes to process (for testing)")
    parser.add_argument("--use-llm", action="store_true", help="Use LLM for resource ranking")
    parser.add_argument("--llm-model", default="gpt-5-mini", help="LLM model (gpt-5-mini, gpt-5-nano, etc.)")
    parser.add_argument("--no-cache", action="store_true", help="Ignore cache and re-process everything")
    parser.add_argument("--clear-cache", action="store_true", help="Clear cache before running")
    parser.add_argument("--dry-run", action="store_true", help="Don't write changes")
    parser.add_argument("--write", action="store_true", help="Write resources to curriculum files")
    parser.add_argument("--report", help="Write report to file")
    args = parser.parse_args()

    # Clear cache if requested
    if args.clear_cache:
        import shutil
        if CACHE_DIR.exists():
            shutil.rmtree(CACHE_DIR)
            CACHE_DIR.mkdir()
        print("🗑️  Cache cleared\n")

    # Initialize populator with caching
    populator = CachedResourcePopulator(
        use_llm=args.use_llm,
        llm_model=args.llm_model,
        use_cache=not args.no_cache
    )

    # Determine subjects
    subjects = []
    if args.subject:
        subjects = [args.subject if args.subject.endswith('.json') else f"{args.subject}.json"]
    elif args.all_sciences:
        subjects = ["bio-20.json", "bio-30.json", "chem-20.json", "chem-30.json", "phys-20.json", "phys-30.json"]
    else:
        print("❌ Specify --subject or --all-sciences")
        sys.exit(1)

    # Load gaps
    all_results = []

    for subject_file in subjects:
        subject_key = subject_file.replace('.json', '')

        # Load gaps for this subject
        outcomes = populator.load_gaps(subject_filter=subject_key)

        # Filter by outcome codes if specified
        if args.outcomes:
            outcome_codes = set(args.outcomes.split(','))
            outcomes = [o for o in outcomes if o.outcome_code in outcome_codes]

        # Limit if specified
        if args.limit:
            outcomes = outcomes[:args.limit]

        if not outcomes:
            print(f"\n📚 {subject_file}: No gaps found")
            continue

        # Populate
        result = populator.populate_curriculum(
            subject_file,
            outcomes,
            dry_run=not args.write
        )
        all_results.append(result)

    # Print summary
    print("\n\n============================================================")
    print("✨ SUMMARY")
    print("============================================================")
    print(f"Subjects processed: {len(all_results)}")
    print(f"Outcomes processed: {sum(r['outcomes_processed'] for r in all_results)}")
    print(f"Resources added: {sum(r['resources_added'] for r in all_results)}")
    print(f"Cache hits: {sum(r.get('cache_hits', 0) for r in all_results)}")
    print(f"Cache misses: {sum(r.get('cache_misses', 0) for r in all_results)}")

    if args.write:
        print("\n✅ Changes written to curriculum files!")
        print("\nRun validation to check coverage:")
        print("   npx tsx scripts/validate-coverage.ts")
    else:
        print("\n💡 This was a DRY RUN. Use --write to apply changes.")


if __name__ == "__main__":
    from datetime import datetime
    main()
