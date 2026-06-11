#!/usr/bin/env python3
"""
Map existing curriculum resources to official Alberta Education outcomes.
Replaces string-based outcomes with structured outcome objects from parsed PDFs.
"""
import json
from pathlib import Path
from typing import Dict, List, Any

ROOT = Path(__file__).resolve().parents[2]
PARSED_DIR = ROOT / "data" / "sources" / "alberta" / "parsed"
CURRICULUM_DIR = ROOT / "data" / "curriculum"


def load_json(path: Path) -> Any:
    """Load JSON file."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path: Path, data: Any):
    """Save JSON file with proper formatting."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def map_biology_20():
    """Map Biology 20 curriculum to Alberta outcomes."""
    # Load parsed Alberta outcomes
    alberta = load_json(PARSED_DIR / "biology.json")
    curr = load_json(CURRICULUM_DIR / "bio-20.json")

    # Create lookup for quick access
    general_by_code = {o['code']: o for o in alberta['general_outcomes']}
    specific_by_code = {o['code']: o for o in alberta['specific_outcomes']}

    # Map units to outcomes
    unit_outcome_map = {
        "energy-matter-biosphere": {
            "general": ["20-A1", "20-A2", "20-A3"],
            "specific_knowledge": [
                "20-A1.1k", "20-A1.2k", "20-A1.3k", "20-A1.4k",
                "20-A2.1k", "20-A2.2k",
                "20-A3.1k", "20-A3.2k", "20-A3.3k"
            ],
            "resource_map": {
                "Energy Flow through Ecosystems": ["20-A1.1k", "20-A1.3k", "20-A1.4k"],
                "Biogeochemical Cycles": ["20-A2.1k", "20-A2.2k"],
                "Carbon and Nutrient Cycles": ["20-A2.1k"],
                "The Nitrogen Cycle": ["20-A2.1k"],
                "Biogeochemical Cycles Practice": ["20-A2.1k", "20-A2.2k"],
                "Ecology and the Biosphere - LibreTexts": ["20-A1", "20-A2", "20-A3"]
            }
        },
        "ecosystems-population-change": {
            "general": ["20-B1", "20-B2"],
            "specific_knowledge": [
                "20-B1.1k", "20-B1.2k", "20-B1.3k", "20-B1.4k", "20-B1.5k",
                "20-B2.1k", "20-B2.2k", "20-B2.3k", "20-B2.4k", "20-B2.5k", "20-B2.6k"
            ],
            "resource_map": {
                "Populations, Communities, and Ecosystems": ["20-B1.1k", "20-B1.2k"],
                "Population Dynamics and Regulation": ["20-B2"],
                "Population Growth and Regulation": ["20-B2"],
                "Population Ecology Review": ["20-B2"],
                "Exponential and Logistic Growth": ["20-B2"],
                "What is Population Ecology?": ["20-B2"],
                "Community Ecology - OpenStax": ["20-B1.2k", "20-B1.3k"]
            }
        },
        "photosynthesis-cellular-respiration": {
            "general": ["20-C1", "20-C2"],
            "specific_knowledge": [
                "20-C1.1k", "20-C1.2k",
                "20-C2.1k", "20-C2.2k", "20-C2.3k", "20-C2.4k"
            ],
            "resource_map": {
                "Introduction to Cellular Respiration": ["20-C2.1k", "20-C2.2k"],
                "Intro to Photosynthesis": ["20-C1.1k", "20-C1.2k"],
                "Photosynthesis - OpenStax": ["20-C1.1k"],
                "Cellular Respiration - OpenStax": ["20-C2.1k", "20-C2.2k"],
                "Krebs Cycle Overview": ["20-C2.1k"],
                "Photosynthesis Practice": ["20-C1"],
                "Cellular Respiration Practice": ["20-C2"],
                "ATP Synthesis - LibreTexts": ["20-C2.2k"]
            }
        },
        "human-systems": {
            "general": ["20-D1", "20-D2", "20-D3", "20-D4"],
            "specific_knowledge": [
                "20-D1.1k", "20-D1.2k", "20-D1.3k", "20-D1.4k", "20-D1.5k",
                "20-D2.1k", "20-D2.2k", "20-D2.3k", "20-D2.4k", "20-D2.5k", "20-D2.6k", "20-D2.7k", "20-D2.8k", "20-D2.9k",
                "20-D3.1k", "20-D3.2k", "20-D3.3k", "20-D3.4k",
                "20-D4.1k", "20-D4.2k"
            ],
            "resource_map": {
                "Introduction to the Digestive System": ["20-D1.1k", "20-D1.2k", "20-D1.4k"],
                "Introduction to the Cardiovascular System": ["20-D2.1k", "20-D2.2k", "20-D2.3k"],
                "Gas Exchange - OpenStax": ["20-D1.5k"],
                "Human Body Systems Overview": ["20-D1", "20-D2", "20-D3", "20-D4"],
                "Homeostasis and Regulation": ["20-D2", "20-D3"],
                "The Immune System - OpenStax": ["20-D2.8k"],
                "Nervous System - LibreTexts": ["20-D4"],
                "Endocrine System Overview": ["20-D3.4k"]
            }
        }
    }

    # Update each unit
    for unit in curr['units']:
        unit_id = unit['id']
        if unit_id not in unit_outcome_map:
            print(f"Warning: No mapping for unit {unit_id}")
            continue

        mapping = unit_outcome_map[unit_id]

        # Build outcomes array with general + specific
        outcomes = []

        # Add general outcomes
        for code in mapping['general']:
            if code in general_by_code:
                gen = general_by_code[code]
                outcomes.append({
                    "code": gen['code'],
                    "description": gen['description'],
                    "type": "general"
                })

        # Add specific knowledge outcomes
        for code in mapping['specific_knowledge']:
            if code in specific_by_code:
                spec = specific_by_code[code]
                outcomes.append({
                    "code": spec['code'],
                    "description": spec['description'],
                    "category": spec['category'],
                    "parent": spec['general_parent']
                })

        # Remove old outcome fields
        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        # Map resources to aligned outcomes
        for resource in unit.get('resources', []):
            title = resource.get('title', '')
            aligned = mapping['resource_map'].get(title, [])
            if aligned:
                resource['alignedOutcomes'] = aligned

    # Save updated curriculum
    save_json(CURRICULUM_DIR / "bio-20.json", curr)
    print(f"✓ Updated Bio 20: {len(curr['units'])} units with Alberta outcomes")


def map_science_generic(subject_name: str, parsed_prefix: str, curr_prefix: str, grade: str = "20"):
    """
    Generic mapper for science subjects (Chemistry, Physics) that follow
    the same A/B/C/D structure as Biology.
    Supports both Grade 11 (20-level) and Grade 12 (30-level).
    """
    # Load parsed Alberta outcomes
    alberta = load_json(PARSED_DIR / f"{parsed_prefix}.json")
    curr_file = CURRICULUM_DIR / f"{curr_prefix}-{grade}.json"

    if not curr_file.exists():
        print(f"Skipping {subject_name} {grade}: curriculum file not found")
        return

    curr = load_json(curr_file)

    # Create lookups
    general_by_code = {o['code']: o for o in alberta['general_outcomes']}
    specific_by_code = {o['code']: o for o in alberta['specific_outcomes']}

    # Update each unit - assign outcomes based on unit structure
    for unit in curr['units']:
        outcomes = []
        general_codes_seen = set()

        # Extract general outcome codes from existing outcomes field
        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    # Extract code like "20-A1" from "20-A1: description"
                    code = old_out.split(':')[0].strip().replace('–', '-')
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                # Try to find as general outcome
                if code in general_by_code:
                    if code not in general_codes_seen:
                        gen = general_by_code[code]
                        outcomes.append({
                            "code": gen['code'],
                            "description": gen['description'],
                            "type": "general"
                        })
                        general_codes_seen.add(code)

        # Add related specific knowledge outcomes for each general outcome
        for gen_code in general_codes_seen:
            for spec_code, spec in specific_by_code.items():
                if (spec.get('general_parent') == gen_code and
                    spec.get('category') == 'knowledge'):
                    outcomes.append({
                        "code": spec['code'],
                        "description": spec['description'],
                        "category": spec['category'],
                        "parent": spec['general_parent']
                    })

        # Remove old fields
        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        # For resources, map to general outcomes if no specific mapping exists
        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                # Default: map to the general outcomes of this unit
                resource['alignedOutcomes'] = [o['code'] for o in outcomes if o.get('type') == 'general']

    save_json(curr_file, curr)
    print(f"✓ Updated {subject_name} {grade}: {len(curr['units'])} units")


def map_math_20_1():
    """Map Math 20-1 curriculum to Alberta outcomes."""
    alberta = load_json(PARSED_DIR / "math_20_1.json")
    curr = load_json(CURRICULUM_DIR / "math-20-1.json")

    # Flatten Alberta outcomes into single list with codes
    all_outcomes = []
    for strand, outcomes in alberta.items():
        for out in outcomes:
            all_outcomes.append({
                "code": out['code'],
                "description": out['description'],
                "strand": strand
            })

    outcome_by_code = {o['code']: o for o in all_outcomes}

    # Update units
    for unit in curr['units']:
        outcomes = []

        # Extract codes from existing outcomes
        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    # Extract code like "RF3" from "RF3: Analyze quadratic..."
                    parts = old_out.split(':')
                    if parts:
                        code = parts[0].strip()
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                if code in outcome_by_code:
                    out = outcome_by_code[code]
                    outcomes.append({
                        "code": out['code'],
                        "description": out['description'],
                        "strand": out['strand']
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        # Map resources
        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                resource['alignedOutcomes'] = [o['code'] for o in outcomes]

    save_json(CURRICULUM_DIR / "math-20-1.json", curr)
    print(f"✓ Updated Math 20-1: {len(curr['units'])} units")


def map_social_20_1():
    """Map Social 20-1 curriculum to Alberta outcomes."""
    alberta = load_json(PARSED_DIR / "social_20_1.json")
    curr = load_json(CURRICULUM_DIR / "social-20-1.json")

    outcome_by_code = {o['code']: o for o in alberta}

    # Update units
    for unit in curr['units']:
        outcomes = []

        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    code = old_out.split(':')[0].strip().replace('–', '-')
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                if code in outcome_by_code:
                    out = outcome_by_code[code]
                    outcomes.append({
                        "code": out['code'],
                        "description": out['description']
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                resource['alignedOutcomes'] = [o['code'] for o in outcomes]

    save_json(CURRICULUM_DIR / "social-20-1.json", curr)
    print(f"✓ Updated Social 20-1: {len(curr['units'])} units")


def map_ela_20_1():
    """Map ELA 20-1 curriculum to Alberta outcomes."""
    alberta = load_json(PARSED_DIR / "ela_20_1.json")
    curr = load_json(CURRICULUM_DIR / "ela-20-1.json")

    # Create lookups
    general_by_code = {o['code']: o for o in alberta['general_outcomes']}
    specific_by_code = {o['code']: o for o in alberta['specific_outcomes']}

    # Update units
    for unit in curr['units']:
        outcomes = []
        general_codes_seen = set()

        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    # Extract code like "2.1.1" from "2.1.1: Description..."
                    code = old_out.split(':')[0].strip()
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                # Try to find as specific outcome first
                if code in specific_by_code:
                    spec = specific_by_code[code]
                    # Determine parent general outcome (first digit/char of code)
                    parent_code = code.split('.')[0] if '.' in code else code

                    # Add parent general outcome if not already added
                    if parent_code in general_by_code and parent_code not in general_codes_seen:
                        gen = general_by_code[parent_code]
                        outcomes.append({
                            "code": gen['code'],
                            "title": gen['title'],
                            "type": "general"
                        })
                        general_codes_seen.add(parent_code)

                    # Add specific outcome
                    outcomes.append({
                        "code": spec['code'],
                        "title": spec['title'],
                        "parent": parent_code
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                # Map to specific outcome codes only
                resource['alignedOutcomes'] = [o['code'] for o in outcomes if 'parent' in o]

    save_json(CURRICULUM_DIR / "ela-20-1.json", curr)
    print(f"✓ Updated ELA 20-1: {len(curr['units'])} units")


def map_biology_30():
    """Map Biology 30 curriculum to Alberta outcomes."""
    # Load parsed Alberta outcomes
    alberta = load_json(PARSED_DIR / "biology_30.json")
    curr = load_json(CURRICULUM_DIR / "bio-30.json")

    # Create lookup for quick access
    general_by_code = {o['code']: o for o in alberta['general_outcomes']}
    specific_by_code = {o['code']: o for o in alberta['specific_outcomes']}

    # Map units to outcomes - similar structure to Biology 20 but with 30- prefix
    unit_outcome_map = {
        "nervous-endocrine-systems": {
            "general": ["30-A1", "30-A2"],
            "specific_knowledge": [
                "30-A1.1k", "30-A1.2k", "30-A1.3k", "30-A1.4k", "30-A1.5k", "30-A1.6k",
                "30-A2.1k", "30-A2.2k", "30-A2.3k", "30-A2.4k", "30-A2.5k"
            ]
        },
        "reproduction-development": {
            "general": ["30-B1", "30-B2", "30-B3"],
            "specific_knowledge": [
                "30-B1.1k", "30-B1.2k", "30-B1.3k", "30-B1.4k",
                "30-B2.1k", "30-B2.2k", "30-B2.3k",
                "30-B3.1k", "30-B3.2k", "30-B3.3k", "30-B3.4k"
            ]
        },
        "cell-division-genetics": {
            "general": ["30-C1", "30-C2", "30-C3"],
            "specific_knowledge": [
                "30-C1.1k", "30-C1.2k", "30-C1.3k",
                "30-C2.1k", "30-C2.2k", "30-C2.3k", "30-C2.4k", "30-C2.5k", "30-C2.6k",
                "30-C3.1k", "30-C3.2k", "30-C3.3k", "30-C3.4k"
            ]
        },
        "population-community-dynamics": {
            "general": ["30-D1", "30-D2", "30-D3"],
            "specific_knowledge": [
                "30-D1.1k", "30-D1.2k", "30-D1.3k", "30-D1.4k", "30-D1.5k",
                "30-D2.1k", "30-D2.2k", "30-D2.3k", "30-D2.4k",
                "30-D3.1k", "30-D3.2k", "30-D3.3k", "30-D3.4k"
            ]
        }
    }

    # Update each unit
    for unit in curr['units']:
        unit_id = unit['id']
        if unit_id not in unit_outcome_map:
            print(f"Warning: No mapping for Bio 30 unit {unit_id}")
            continue

        mapping = unit_outcome_map[unit_id]

        # Build outcomes array with general + specific
        outcomes = []

        # Add general outcomes
        for code in mapping['general']:
            if code in general_by_code:
                gen = general_by_code[code]
                outcomes.append({
                    "code": gen['code'],
                    "description": gen['description'],
                    "type": "general"
                })

        # Add specific knowledge outcomes
        for code in mapping['specific_knowledge']:
            if code in specific_by_code:
                spec = specific_by_code[code]
                outcomes.append({
                    "code": spec['code'],
                    "description": spec['description'],
                    "category": spec['category'],
                    "parent": spec['general_parent']
                })

        # Remove old outcome fields
        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        # Map resources to aligned outcomes
        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                # Default: map to general outcomes of this unit
                resource['alignedOutcomes'] = [o['code'] for o in outcomes if o.get('type') == 'general']

    # Save updated curriculum
    save_json(CURRICULUM_DIR / "bio-30.json", curr)
    print(f"✓ Updated Bio 30: {len(curr['units'])} units with Alberta outcomes")


def map_math_30_1():
    """Map Math 30-1 curriculum to Alberta outcomes."""
    alberta = load_json(PARSED_DIR / "math_30_1.json")
    curr = load_json(CURRICULUM_DIR / "math-30-1.json")

    # Flatten Alberta outcomes into single list with codes
    all_outcomes = []
    for strand, outcomes in alberta.items():
        for out in outcomes:
            all_outcomes.append({
                "code": out['code'],
                "description": out['description'],
                "strand": strand
            })

    outcome_by_code = {o['code']: o for o in all_outcomes}

    # Update units
    for unit in curr['units']:
        outcomes = []

        # Extract codes from existing outcomes
        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    # Extract code like "RF3" from "RF3: Analyze quadratic..."
                    parts = old_out.split(':')
                    if parts:
                        code = parts[0].strip()
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                if code in outcome_by_code:
                    out = outcome_by_code[code]
                    outcomes.append({
                        "code": out['code'],
                        "description": out['description'],
                        "strand": out['strand']
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        # Map resources
        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                resource['alignedOutcomes'] = [o['code'] for o in outcomes]

    save_json(CURRICULUM_DIR / "math-30-1.json", curr)
    print(f"✓ Updated Math 30-1: {len(curr['units'])} units")


def map_social_30_1():
    """Map Social 30-1 curriculum to Alberta outcomes."""
    alberta = load_json(PARSED_DIR / "social_30_1.json")
    curr = load_json(CURRICULUM_DIR / "social-30-1.json")

    outcome_by_code = {o['code']: o for o in alberta}

    # Update units
    for unit in curr['units']:
        outcomes = []

        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    code = old_out.split(':')[0].strip().replace('–', '-')
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                if code in outcome_by_code:
                    out = outcome_by_code[code]
                    outcomes.append({
                        "code": out['code'],
                        "description": out['description']
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                resource['alignedOutcomes'] = [o['code'] for o in outcomes]

    save_json(CURRICULUM_DIR / "social-30-1.json", curr)
    print(f"✓ Updated Social 30-1: {len(curr['units'])} units")


def map_ela_30_1():
    """Map ELA 30-1 curriculum to Alberta outcomes (reuses ELA 20-1 outcomes)."""
    # ELA outcomes are the same across all three grades (10-1, 20-1, 30-1)
    alberta = load_json(PARSED_DIR / "ela_20_1.json")
    curr = load_json(CURRICULUM_DIR / "ela-30-1.json")

    # Create lookups
    general_by_code = {o['code']: o for o in alberta['general_outcomes']}
    specific_by_code = {o['code']: o for o in alberta['specific_outcomes']}

    # Update units
    for unit in curr['units']:
        outcomes = []
        general_codes_seen = set()

        if 'outcomes' in unit:
            for old_out in unit.get('outcomes', []):
                # Handle both string-based and structured outcomes
                if isinstance(old_out, str):
                    # Extract code like "2.1.1" from "2.1.1: Description..."
                    code = old_out.split(':')[0].strip()
                elif isinstance(old_out, dict) and 'code' in old_out:
                    code = old_out['code']
                else:
                    continue

                # Try to find as specific outcome first
                if code in specific_by_code:
                    spec = specific_by_code[code]
                    # Determine parent general outcome (first digit/char of code)
                    parent_code = code.split('.')[0] if '.' in code else code

                    # Add parent general outcome if not already added
                    if parent_code in general_by_code and parent_code not in general_codes_seen:
                        gen = general_by_code[parent_code]
                        outcomes.append({
                            "code": gen['code'],
                            "title": gen['title'],
                            "type": "general"
                        })
                        general_codes_seen.add(parent_code)

                    # Add specific outcome
                    outcomes.append({
                        "code": spec['code'],
                        "title": spec['title'],
                        "parent": parent_code
                    })

        if 'outcomesRef' in unit:
            del unit['outcomesRef']
        unit['outcomes'] = outcomes

        for resource in unit.get('resources', []):
            if 'alignedOutcomes' not in resource:
                # Map to specific outcome codes only
                resource['alignedOutcomes'] = [o['code'] for o in outcomes if 'parent' in o]

    save_json(CURRICULUM_DIR / "ela-30-1.json", curr)
    print(f"✓ Updated ELA 30-1: {len(curr['units'])} units")


def main():
    """Map all curriculum files to Alberta outcomes."""
    print("Mapping curriculum to Alberta Education outcomes...\n")

    # Grade 11 (20-level)
    print("=== Grade 11 (20-level) ===")
    map_biology_20()
    map_science_generic("Chemistry", "chemistry", "chem", "20")
    map_science_generic("Physics", "physics", "phys", "20")
    map_math_20_1()
    map_social_20_1()
    map_ela_20_1()

    # Grade 12 (30-level)
    print("\n=== Grade 12 (30-level) ===")
    map_biology_30()
    map_science_generic("Chemistry", "chemistry_30", "chem", "30")
    map_science_generic("Physics", "physics_30", "phys", "30")
    map_math_30_1()
    map_social_30_1()
    map_ela_30_1()

    print("\nDone!")


if __name__ == "__main__":
    main()
