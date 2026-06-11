#!/usr/bin/env python3
"""
LLM-powered resource finder for specific hard-to-fill outcomes.
Uses GPT-5-mini to generate/suggest free online educational resources.
"""

import sys
import os
import json
import re
import requests
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add parent directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
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

# Hard-coded list of 22 specific outcomes to target
TARGET_OUTCOMES = {
    # Biology 30
    "bio-30.json": [
        "30-C2.2k",  # Punnett squares - dominant/recessive patterns
        "30-C1.5k",  # Crossing over & nondisjunction
        "30-D1.3k",  # Hardy-Weinberg principle
        "30-D2.2k",  # Defense mechanisms in predation
    ],
    # Biology 20
    "bio-20.json": [
        "20-B1.5k",  # Taxonomy & binomial nomenclature
        "20-D3.1k",  # Excretory system structures
        "20-D3.3k",  # Kidney function
    ],
    # Chemistry 30
    "chem-30.json": [
        "30-B1.5k",  # Oxidizing vs reducing agents
        "30-B2.2sts",  # Corrosion prevention technologies
    ],
    # Chemistry 20
    "chem-20.json": [
        "20-C1.1k",  # Pure substances vs mixtures
        "20-C1.4k",  # Electrolytes vs nonelectrolytes
        "20-D1.3k",  # Quantitative vs qualitative analysis
    ],
    # Physics 30
    "phys-30.json": [
        "30-D3.2k",  # Nuclear equations - alpha/beta decay
        "30-D3.3k",  # Half-life calculations
        "30-D3.5k",  # Fission vs fusion
        "30-C1.8k",  # Diffraction, interference, polarization
        "30-C1.10k", # Double-slit & diffraction grating
        "30-C1.4k",  # Measuring speed of EMR
    ],
    # Physics 20
    "phys-20.json": [
        "20-A1.2k",  # Scalar vs vector quantities
        "20-B2.6k",  # Weight on different planets
        "20-C2.5k",  # Power qualitative/quantitative
    ],
}

@dataclass
class OutcomeContext:
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    outcome_code: str
    outcome_description: str
    subject_file: str

@dataclass
class ResourceCandidate:
    url: str
    title: str
    type: str  # video, article, practice, simulation, reference
    source: str
    difficulty: str
    provider: str
    aligned_outcomes: List[str]
    confidence_score: float = 0.9
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


class LLMResourceFinder:
    """Use LLM to generate resource suggestions for specific outcomes"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.fallback_model = "gpt-4o"
        self.cache_file = CACHE_DIR / "llm_finder_cache.json"
        self.cache = self._load_cache()

    def _load_cache(self) -> dict:
        """Load cache"""
        if self.cache_file.exists():
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_cache(self):
        """Save cache"""
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)

    def find_resources(self, outcome: OutcomeContext) -> List[ResourceCandidate]:
        """Use LLM to find free online resources for an outcome"""

        # Check cache first
        cache_key = f"{outcome.subject_file}:{outcome.outcome_code}"
        if cache_key in self.cache:
            print(f"   💾 Using cached resources for {outcome.outcome_code}")
            return self._parse_cached_resources(self.cache[cache_key], outcome)

        print(f"   🤖 LLM searching for {outcome.outcome_code}: {outcome.outcome_description[:80]}...")

        # Build prompt asking LLM to suggest resources
        prompt = self._build_resource_prompt(outcome)

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
                                "content": "You are an expert educational resource curator. Your task is to recommend the best FREE online resources for high school students learning specific curriculum outcomes."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "max_completion_tokens": 1500,
                    },
                    timeout=45
                )

                if response.status_code != 200:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ LLM API error: {response.status_code}")
                        print(f"      Response: {response.text[:200]}")
                        return []
                    else:
                        print(f"      ⚠ {model_name} failed (status {response.status_code}), trying {self.fallback_model}...")
                        continue

                result = response.json()

                # Check response structure
                if "choices" not in result or len(result["choices"]) == 0:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ Unexpected API response structure")
                        return []
                    else:
                        print(f"      ⚠ {model_name} unexpected response, trying {self.fallback_model}...")
                        continue

                message = result["choices"][0].get("message", {})

                # Check for refusal
                refusal = message.get("refusal")
                if refusal:
                    print(f"      ⚠ LLM refused: {refusal}")
                    if model_name == self.fallback_model:
                        return []
                    else:
                        print(f"      ⚠ Trying {self.fallback_model}...")
                        continue

                llm_response = message.get("content", "")

                if not llm_response:
                    if model_name == self.fallback_model:
                        print(f"      ⚠ LLM returned empty content")
                        return []
                    else:
                        print(f"      ⚠ {model_name} empty response, trying {self.fallback_model}...")
                        continue

                # Parse LLM response into resource candidates
                resources = self._parse_llm_response(llm_response, outcome)

                if resources:
                    print(f"      ✓ LLM found {len(resources)} resources")
                    # Cache the results
                    self.cache[cache_key] = {
                        "outcome_code": outcome.outcome_code,
                        "outcome_description": outcome.outcome_description,
                        "llm_response": llm_response,
                        "resources": [
                            {
                                "url": r.url,
                                "title": r.title,
                                "type": r.type,
                                "source": r.source,
                                "difficulty": r.difficulty,
                                "provider": r.provider,
                            }
                            for r in resources
                        ],
                        "timestamp": datetime.now().isoformat()
                    }
                    self._save_cache()
                    return resources
                else:
                    print(f"      ⚠ Could not parse any resources from LLM response")

            except Exception as e:
                if model_name == self.fallback_model:
                    print(f"      ⚠ LLM error: {str(e)}")
                    return []
                else:
                    print(f"      ⚠ {model_name} error, trying {self.fallback_model}...")
                    continue

        return []

    def _build_resource_prompt(self, outcome: OutcomeContext) -> str:
        """Build prompt asking LLM to suggest free educational resources"""

        prompt = f"""I need free online educational resources for a high school student to master this learning outcome:

**Subject:** {outcome.subject} (Grade {outcome.grade})
**Outcome Code:** {outcome.outcome_code}
**Description:** {outcome.outcome_description}

**Your Task:**
Find 3-5 FREE online resources that directly teach this specific concept. Consider ALL quality sources including:

**Top-tier educational platforms:**
- Khan Academy (videos, articles, practice)
- MIT OpenCourseWare (ocw.mit.edu)
- PhET Interactive Simulations (phet.colorado.edu)
- OpenStax textbooks
- CK-12 Foundation (ck12.org)

**Educational video channels:**
- CrashCourse, Bozeman Science, Professor Dave Explains
- Khan Academy's YouTube channel
- MIT OpenCourseWare videos
- TED-Ed

**Reference & encyclopedic:**
- Wikipedia (for well-established scientific concepts)
- Chemistry LibreTexts / Biology LibreTexts / Physics LibreTexts
- HyperPhysics (hyperphysics.phy-astr.gsu.edu)

**Interactive & practice:**
- Brilliant.org free content
- Wolfram MathWorld
- Interactive simulations and visualizations

**Response Format:**
For each resource, provide:
1. **URL:** [exact working URL]
2. **Title:** [clear descriptive title]
3. **Type:** [video/article/simulation/practice/reference]
4. **Source:** [provider name]
5. **Why relevant:** [1 sentence explaining alignment]

**Example:**
```
RESOURCE 1:
URL: https://www.khanacademy.org/science/biology/heredity-and-genetics/hardy-weinberg-principle/v/hardy-weinberg-principle
Title: Hardy-Weinberg Principle
Type: video
Source: Khan Academy
Why: Explains Hardy-Weinberg equation and allele frequency calculations step-by-step

RESOURCE 2:
URL: https://en.wikipedia.org/wiki/Hardy%E2%80%93Weinberg_principle
Title: Hardy-Weinberg Principle
Type: reference
Source: Wikipedia
Why: Comprehensive article covering mathematical derivation and real-world applications

RESOURCE 3:
...
```

**Important:**
- Only suggest resources you are confident exist at real URLs
- Mix different resource types (videos + articles + simulations when possible)
- Ensure each resource directly addresses the specific concept in the outcome
- Include specific topic URLs, not generic homepages
- Wikipedia is acceptable for well-established scientific concepts

Your recommendations:"""

        return prompt

    def _parse_llm_response(self, response: str, outcome: OutcomeContext) -> List[ResourceCandidate]:
        """Parse LLM response into ResourceCandidate objects"""
        resources = []

        # Split by "RESOURCE" markers
        resource_blocks = re.split(r'RESOURCE \d+:', response)

        for block in resource_blocks[1:]:  # Skip first empty split
            # Extract fields using regex
            url_match = re.search(r'URL:\s*(https?://[^\s\n]+)', block)
            title_match = re.search(r'Title:\s*([^\n]+)', block)
            type_match = re.search(r'Type:\s*([^\n]+)', block)
            source_match = re.search(r'Source:\s*([^\n]+)', block)

            if url_match and title_match:
                url = url_match.group(1).strip()
                title = title_match.group(1).strip()
                resource_type = type_match.group(1).strip().lower() if type_match else "video"
                source = source_match.group(1).strip() if source_match else "Online Resource"

                # Map type
                if "video" in resource_type or "youtube" in url.lower():
                    resource_type = "video"
                elif "simulation" in resource_type or "phet" in url.lower():
                    resource_type = "simulation"
                elif "practice" in resource_type or "exercise" in resource_type:
                    resource_type = "practice"
                elif "reference" in resource_type or "wikipedia" in url.lower():
                    resource_type = "reference"
                else:
                    resource_type = "article"

                # Determine provider from URL
                provider = self._extract_provider(url)

                # Determine difficulty
                difficulty = "intermediate"
                if outcome.grade >= 12:
                    difficulty = "advanced"
                elif outcome.grade <= 10:
                    difficulty = "beginner"

                resource = ResourceCandidate(
                    url=url,
                    title=title,
                    type=resource_type,
                    source=source,
                    difficulty=difficulty,
                    provider=provider,
                    aligned_outcomes=[outcome.outcome_code],
                    confidence_score=0.9,
                    embeddable="phet" in url.lower() or "youtube" in url.lower()
                )
                resources.append(resource)

        return resources

    def _parse_cached_resources(self, cached_data: dict, outcome: OutcomeContext) -> List[ResourceCandidate]:
        """Reconstruct ResourceCandidate objects from cache"""
        resources = []
        for r in cached_data.get("resources", []):
            resource = ResourceCandidate(
                url=r["url"],
                title=r["title"],
                type=r["type"],
                source=r["source"],
                difficulty=r["difficulty"],
                provider=r["provider"],
                aligned_outcomes=[outcome.outcome_code],
                confidence_score=0.9,
                embeddable="phet" in r["url"].lower() or "youtube" in r["url"].lower()
            )
            resources.append(resource)
        return resources

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
        elif "hyperphysics" in url_lower:
            return "hyperphysics"
        elif "ck12.org" in url_lower or "ck-12" in url_lower:
            return "ck12"
        elif "brilliant.org" in url_lower:
            return "brilliant"
        elif "wolfram" in url_lower:
            return "wolfram"
        elif "ted.com" in url_lower or "ted-ed" in url_lower:
            return "ted-ed"
        else:
            return "online"


def load_target_outcomes() -> List[OutcomeContext]:
    """Load the 22 target outcomes from curriculum files"""
    outcomes = []

    for subject_file, outcome_codes in TARGET_OUTCOMES.items():
        curriculum_path = CURRICULUM_DIR / subject_file

        if not curriculum_path.exists():
            print(f"⚠️  Warning: {subject_file} not found")
            continue

        with open(curriculum_path, 'r') as f:
            curriculum = json.load(f)

        subject = curriculum.get('subject', '')
        grade = curriculum.get('grade', 0)

        # Find each target outcome
        for unit in curriculum.get('units', []):
            unit_id = unit.get('id')
            unit_title = unit.get('title')

            for outcome in unit.get('outcomes', []):
                outcome_code = outcome.get('code')

                if outcome_code in outcome_codes:
                    outcomes.append(OutcomeContext(
                        subject=subject,
                        grade=grade,
                        unit_id=unit_id,
                        unit_title=unit_title,
                        outcome_code=outcome_code,
                        outcome_description=outcome.get('description', ''),
                        subject_file=subject_file
                    ))

    return outcomes


def add_resources_to_curriculum(
    outcome: OutcomeContext,
    resources: List[ResourceCandidate]
) -> int:
    """Add resources to curriculum file"""

    curriculum_path = CURRICULUM_DIR / outcome.subject_file

    with open(curriculum_path, 'r') as f:
        curriculum = json.load(f)

    # Find the unit
    unit = None
    for u in curriculum.get('units', []):
        if u.get('id') == outcome.unit_id:
            unit = u
            break

    if not unit:
        print(f"      ⚠ Unit {outcome.unit_id} not found")
        return 0

    # Initialize resources array if needed
    if 'resources' not in unit:
        unit['resources'] = []

    # Get existing URLs
    existing_urls = set(r.get('url') for r in unit['resources'])

    resources_added = 0

    for resource in resources:
        resource_dict = resource.to_curriculum_format()

        # Check if URL already exists
        existing_resource = None
        for r in unit['resources']:
            if r.get('url') == resource_dict['url']:
                existing_resource = r
                break

        if existing_resource:
            # Update alignedOutcomes
            aligned = existing_resource.get('alignedOutcomes', [])
            if outcome.outcome_code not in aligned:
                aligned.append(outcome.outcome_code)
                existing_resource['alignedOutcomes'] = aligned
                resources_added += 1
        else:
            # Add new resource
            unit['resources'].append(resource_dict)
            resources_added += 1

    # Save curriculum
    with open(curriculum_path, 'w') as f:
        json.dump(curriculum, f, indent=2, ensure_ascii=False)
        f.write('\n')

    return resources_added


def main():
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║                                                                ║")
    print("║   🎯 LLM Resource Finder - Specific Outcomes                  ║")
    print("║                                                                ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print("")
    print("🎯 Targeting 22 specific hard-to-fill outcomes")
    print("🤖 Using GPT-4o-mini to generate resource recommendations")
    print("💾 Results cached to avoid re-processing")
    print("")

    # Load target outcomes
    print("📚 Loading target outcomes...")
    outcomes = load_target_outcomes()

    if not outcomes:
        print("❌ No outcomes found")
        return

    print(f"   Found {len(outcomes)} outcomes to process\n")

    # Breakdown by subject
    by_subject = {}
    for outcome in outcomes:
        subject = outcome.subject
        if subject not in by_subject:
            by_subject[subject] = []
        by_subject[subject].append(outcome)

    for subject, subject_outcomes in by_subject.items():
        print(f"   • {subject}: {len(subject_outcomes)} outcomes")

    print("\n" + "="*64)
    print("")

    # Initialize finder
    finder = LLMResourceFinder()

    total_resources_added = 0
    outcomes_filled = 0

    # Process each outcome
    for idx, outcome in enumerate(outcomes, 1):
        print(f"[{idx}/{len(outcomes)}] {outcome.subject} - {outcome.outcome_code}")

        # Find resources using LLM
        resources = finder.find_resources(outcome)

        if not resources:
            print(f"      ⚠ No resources found\n")
            continue

        # Add to curriculum
        added = add_resources_to_curriculum(outcome, resources)

        if added > 0:
            print(f"      ✅ Added {added} resources to {outcome.subject_file}\n")
            total_resources_added += added
            outcomes_filled += 1
        else:
            print(f"      ℹ️  Resources already exist (no changes)\n")

    # Summary
    print("="*64)
    print("\n✨ Summary:")
    print(f"   Outcomes processed: {len(outcomes)}")
    print(f"   Outcomes filled: {outcomes_filled}")
    print(f"   Resources added: {total_resources_added}")
    print(f"   Cache: {finder.cache_file}")
    print("")
    print("📊 Run validation to check new coverage:")
    print("   npx tsx scripts/validate-coverage.ts")
    print("")


if __name__ == "__main__":
    main()
