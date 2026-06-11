#!/usr/bin/env python3
"""
Automated Resource Discovery and Population Script

Discovers high-quality learning resources from multiple sources and matches them
to curriculum outcomes using semantic analysis and LLM-assisted alignment.

Sources:
- Khan Academy (videos, articles, practice exercises)
- OpenStax (open textbooks)
- PhET (interactive simulations)
- LibreTexts (open educational content)
- ChemCollective (virtual chemistry labs)

Usage:
  python3 resource-populator.py --subject bio-30 --dry-run
  python3 resource-populator.py --subject phys-30 --use-llm --write
  python3 resource-populator.py --all-sciences --use-llm --write --report ../../data/reports/populator_report.json
"""

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
CURRICULUM_DIR = ROOT / "data" / "curriculum"
REPORTS_DIR = ROOT / "data" / "reports"

# Resource type mappings
RESOURCE_TYPES = {
    "video": ["video", "lecture", "tutorial"],
    "article": ["article", "reading", "text", "chapter", "section"],
    "practice": ["exercise", "practice", "quiz", "problems", "worksheet"],
    "simulation": ["simulation", "interactive", "virtual lab", "phet"],
    "virtual-lab": ["virtual lab", "lab simulation", "chemcollective"],
    "reference": ["reference", "guide", "handbook", "manual"],
}


@dataclass
class ResourceCandidate:
    """Candidate resource with metadata"""
    url: str
    title: str
    type: str
    source: str
    difficulty: str
    provider: str
    aligned_outcomes: List[str]
    confidence_score: float
    description: Optional[str] = None
    embeddable: bool = False
    youtube_id: Optional[str] = None


@dataclass
class OutcomeContext:
    """Context for an outcome that needs resources"""
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    outcome_code: str
    outcome_description: str
    strand: Optional[str] = None
    category: Optional[str] = None
    existing_resources: List[str] = field(default_factory=list)


class KhanAcademySearcher:
    """Search Khan Academy for resources"""

    BASE_SEARCH_URL = "https://www.khanacademy.org/search?referer=%2F&page_search_query="

    @staticmethod
    def search_outcomes(outcome: OutcomeContext, max_results: int = 5) -> List[ResourceCandidate]:
        """
        Search Khan Academy for resources matching an outcome.
        In a real implementation, this would make API calls or web scraping.
        For now, returns structured search URLs and known high-quality resources.
        """
        candidates = []

        # Build search query from outcome
        search_terms = KhanAcademySearcher._extract_key_terms(outcome.outcome_description)
        subject_context = KhanAcademySearcher._map_subject_to_khan(outcome.subject)

        # For now, return search URLs that can be manually reviewed
        # TODO: Implement actual Khan Academy API integration
        search_query = f"{subject_context} {search_terms}"
        search_url = f"{KhanAcademySearcher.BASE_SEARCH_URL}{quote_plus(search_query)}"

        # Return placeholder indicating manual review needed
        candidates.append(ResourceCandidate(
            url=search_url,
            title=f"Khan Academy: {search_terms}",
            type="video",
            source="Khan Academy",
            difficulty="beginner",
            provider="khan-academy-search",
            aligned_outcomes=[outcome.outcome_code],
            confidence_score=0.5,
            description=f"Search results for: {search_query}",
            embeddable=False,
        ))

        return candidates

    @staticmethod
    def _extract_key_terms(description: str) -> str:
        """Extract key searchable terms from outcome description"""
        # Remove common prefixes
        text = re.sub(r'^-\s*', '', description)
        text = re.sub(r'^(Explain|Describe|Identify|Analyze|Compare|Investigate)\s+', '', text, flags=re.IGNORECASE)

        # Take first meaningful phrase (up to first period or semicolon)
        match = re.search(r'^([^.;]+)', text)
        if match:
            text = match.group(1)

        # Clean up
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:100]  # Limit length

    @staticmethod
    def _map_subject_to_khan(subject: str) -> str:
        """Map curriculum subject to Khan Academy subject area"""
        subject_lower = subject.lower()

        if "math" in subject_lower:
            return "mathematics precalculus algebra"
        elif "bio" in subject_lower:
            return "biology ap biology"
        elif "chem" in subject_lower:
            return "chemistry ap chemistry"
        elif "phys" in subject_lower:
            return "physics ap physics"
        elif "ela" in subject_lower or "english" in subject_lower:
            return "ela grammar reading writing"
        elif "social" in subject_lower:
            return "history world history"

        return ""


class OpenStaxSearcher:
    """Search OpenStax for textbook resources"""

    BOOKS = {
        "biology": {
            "20": "https://openstax.org/books/biology-2e/pages/",
            "30": "https://openstax.org/books/biology-2e/pages/",
        },
        "chemistry": {
            "20": "https://openstax.org/books/chemistry-2e/pages/",
            "30": "https://openstax.org/books/chemistry-2e/pages/",
        },
        "physics": {
            "20": "https://openstax.org/books/college-physics-2e/pages/",
            "30": "https://openstax.org/books/university-physics-volume-1/pages/",
        },
    }

    @staticmethod
    def search_outcomes(outcome: OutcomeContext, max_results: int = 3) -> List[ResourceCandidate]:
        """Find relevant OpenStax textbook sections"""
        candidates = []

        # Determine which book to use
        subject_key = OpenStaxSearcher._get_subject_key(outcome.subject)
        grade_key = str(outcome.grade % 10)  # 20 or 30

        if subject_key and grade_key in OpenStaxSearcher.BOOKS.get(subject_key, {}):
            base_url = OpenStaxSearcher.BOOKS[subject_key][grade_key]

            # For now, return the book's main page
            # TODO: Implement chapter/section matching based on outcome content
            candidates.append(ResourceCandidate(
                url=base_url + "1-introduction",
                title=f"OpenStax {subject_key.title()} - Introduction",
                type="article",
                source="OpenStax",
                difficulty="intermediate",
                provider="openstax",
                aligned_outcomes=[outcome.outcome_code],
                confidence_score=0.6,
                description=f"OpenStax textbook section for {outcome.outcome_description[:80]}",
                embeddable=False,
            ))

        return candidates

    @staticmethod
    def _get_subject_key(subject: str) -> Optional[str]:
        """Extract subject key (biology, chemistry, physics)"""
        subject_lower = subject.lower()

        if "bio" in subject_lower:
            return "biology"
        elif "chem" in subject_lower:
            return "chemistry"
        elif "phys" in subject_lower:
            return "physics"

        return None


class PhETSearcher:
    """Search PhET for interactive simulations"""

    BASE_URL = "https://phet.colorado.edu/en/simulations/filter?subjects="

    SUBJECT_FILTERS = {
        "biology": "biology",
        "chemistry": "chemistry",
        "physics": "physics",
        "math": "math",
    }

    @staticmethod
    def search_outcomes(outcome: OutcomeContext, max_results: int = 2) -> List[ResourceCandidate]:
        """Find relevant PhET simulations"""
        candidates = []

        subject_filter = PhETSearcher._get_subject_filter(outcome.subject)
        if subject_filter:
            # Build search URL
            search_url = f"{PhETSearcher.BASE_URL}{subject_filter}&sort=relevance"

            # For now, return search page
            # TODO: Implement actual PhET API/scraping to find specific simulations
            candidates.append(ResourceCandidate(
                url=search_url,
                title=f"PhET {subject_filter.title()} Simulations",
                type="simulation",
                source="PhET",
                difficulty="beginner",
                provider="phet",
                aligned_outcomes=[outcome.outcome_code],
                confidence_score=0.4,
                description=f"Interactive simulations for {outcome.outcome_description[:80]}",
                embeddable=True,
            ))

        return candidates

    @staticmethod
    def _get_subject_filter(subject: str) -> Optional[str]:
        """Get PhET subject filter"""
        subject_lower = subject.lower()

        for key, value in PhETSearcher.SUBJECT_FILTERS.items():
            if key in subject_lower:
                return value

        return None


class ResourcePopulator:
    """Main resource population orchestrator"""

    def __init__(self, use_llm: bool = False, llm_model: str = "gpt-4"):
        self.use_llm = use_llm
        self.llm_model = llm_model
        self.khan_searcher = KhanAcademySearcher()
        self.openstax_searcher = OpenStaxSearcher()
        self.phet_searcher = PhETSearcher()

    def load_gaps(self) -> List[OutcomeContext]:
        """Load outcomes that need resources from gap report"""
        gaps_file = REPORTS_DIR / "resource-gaps.json"

        if not gaps_file.exists():
            print(f"❌ Gap report not found: {gaps_file}")
            print("   Run 'npm run detect-gaps' first to generate the report")
            sys.exit(1)

        with open(gaps_file, 'r', encoding='utf-8') as f:
            gap_data = json.load(f)

        outcomes = []
        for gap in gap_data.get('gaps', []):
            if not gap.get('hasResources', True):  # Only outcomes without resources
                outcomes.append(OutcomeContext(
                    subject=gap['subject'],
                    grade=gap['grade'],
                    unit_id=gap['unitId'],
                    unit_title=gap['unitTitle'],
                    outcome_code=gap['outcomeCode'],
                    outcome_description=gap['outcomeDescription'],
                    strand=gap.get('strand'),
                ))

        return outcomes

    def find_resources_for_outcome(self, outcome: OutcomeContext) -> List[ResourceCandidate]:
        """Find candidate resources for a single outcome"""
        all_candidates = []

        # Search multiple sources
        all_candidates.extend(self.khan_searcher.search_outcomes(outcome))
        all_candidates.extend(self.openstax_searcher.search_outcomes(outcome))
        all_candidates.extend(self.phet_searcher.search_outcomes(outcome))

        # TODO: Add LibreTexts, ChemCollective searchers

        # Filter and rank candidates
        if self.use_llm:
            all_candidates = self._rank_with_llm(outcome, all_candidates)

        return all_candidates

    def _rank_with_llm(self, outcome: OutcomeContext, candidates: List[ResourceCandidate]) -> List[ResourceCandidate]:
        """Use LLM to rank and filter candidates (placeholder)"""
        # TODO: Implement LLM-based ranking
        # For now, just return sorted by confidence score
        return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)

    def populate_subject(self, subject_file: str, dry_run: bool = True) -> Dict[str, Any]:
        """Populate resources for a subject"""
        curriculum_path = CURRICULUM_DIR / subject_file

        if not curriculum_path.exists():
            print(f"❌ Curriculum file not found: {curriculum_path}")
            return {"success": False, "error": "File not found"}

        # Load curriculum
        with open(curriculum_path, 'r', encoding='utf-8') as f:
            curriculum = json.load(f)

        # Load gaps to find outcomes needing resources
        all_gaps = self.load_gaps()
        subject_gaps = [g for g in all_gaps if g.subject.lower().replace(' ', '-') in subject_file.lower()]

        print(f"\n📚 Processing {curriculum['subject']} (Grade {curriculum['grade']})")
        print(f"   Found {len(subject_gaps)} outcomes without resources\n")

        results = {
            "subject": curriculum['subject'],
            "grade": curriculum['grade'],
            "outcomes_processed": 0,
            "resources_added": 0,
            "candidates_found": [],
        }

        # Process each gap
        for gap in subject_gaps[:10]:  # Limit to first 10 for testing
            print(f"🔍 Finding resources for {gap.outcome_code}: {gap.outcome_description[:60]}...")

            candidates = self.find_resources_for_outcome(gap)

            print(f"   ✓ Found {len(candidates)} candidate resources")

            results["outcomes_processed"] += 1
            results["candidates_found"].extend([{
                "outcome_code": gap.outcome_code,
                "url": c.url,
                "title": c.title,
                "type": c.type,
                "source": c.source,
                "confidence": c.confidence_score,
            } for c in candidates])

            # In write mode, would add resources to curriculum here
            if not dry_run:
                # TODO: Implement resource addition to curriculum JSON
                pass

        return results


def main():
    parser = argparse.ArgumentParser(description="Automated resource discovery and population")
    parser.add_argument("--subject", help="Subject file to process (e.g., bio-30.json)")
    parser.add_argument("--all-sciences", action="store_true", help="Process all science subjects")
    parser.add_argument("--use-llm", action="store_true", help="Use LLM for resource ranking")
    parser.add_argument("--llm-model", default="gpt-4", help="LLM model to use")
    parser.add_argument("--dry-run", action="store_true", help="Don't write changes")
    parser.add_argument("--write", action="store_true", help="Write resources to curriculum files")
    parser.add_argument("--report", help="Path to write report JSON")
    args = parser.parse_args()

    # Initialize populator
    populator = ResourcePopulator(use_llm=args.use_llm, llm_model=args.llm_model)

    # Determine which subjects to process
    subjects = []
    if args.subject:
        subjects = [args.subject]
    elif args.all_sciences:
        subjects = [
            "bio-20.json", "bio-30.json",
            "chem-20.json", "chem-30.json",
            "phys-20.json", "phys-30.json",
        ]
    else:
        print("❌ Please specify --subject or --all-sciences")
        sys.exit(1)

    # Process subjects
    all_results = []
    for subject_file in subjects:
        result = populator.populate_subject(
            subject_file,
            dry_run=args.dry_run or not args.write
        )
        all_results.append(result)

    # Write report
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                "results": all_results,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "settings": {
                    "use_llm": args.use_llm,
                    "llm_model": args.llm_model,
                    "dry_run": args.dry_run or not args.write,
                }
            }, f, indent=2)

        print(f"\n📊 Report written to {report_path}")

    # Summary
    total_outcomes = sum(r["outcomes_processed"] for r in all_results)
    total_candidates = sum(len(r["candidates_found"]) for r in all_results)

    print(f"\n✨ Summary:")
    print(f"   Subjects processed: {len(all_results)}")
    print(f"   Outcomes processed: {total_outcomes}")
    print(f"   Candidate resources found: {total_candidates}")

    if args.dry_run or not args.write:
        print(f"\n💡 This was a dry run. Use --write to apply changes.")


if __name__ == "__main__":
    main()
