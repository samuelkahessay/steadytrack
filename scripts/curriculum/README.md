# Curriculum Data Pipeline

This directory contains scripts for processing Alberta Education curriculum documents into structured JSON files used by the SteadyTrack application.

## Pipeline Overview

The curriculum data pipeline has 3 main steps:

```
1. Download PDFs  →  2. Parse Outcomes  →  3. Map to Curriculum
```

### Directory Structure

```
data/
├── sources/alberta/          # Source data (not tracked in git)
│   ├── pdfs/                 # Downloaded curriculum PDFs
│   ├── text/                 # Extracted text from PDFs
│   └── parsed/               # Parsed outcomes from PDFs
└── curriculum/               # Final curriculum JSON (tracked in git)
    ├── bio-20.json
    ├── bio-30.json
    ├── chem-20.json
    ├── chem-30.json
    ├── phys-20.json
    ├── phys-30.json
    ├── math-20-1.json
    ├── math-30-1.json
    ├── ela-20-1.json
    ├── ela-30-1.json
    ├── social-20-1.json
    └── social-30-1.json
```

## Step 1: Download PDFs

**Manual step** - Download curriculum PDFs from Alberta Education:

### Required PDFs

Place these files in `data/sources/alberta/pdfs/`:

- **Biology**: `pos_bio_20_30.pdf`
- **Chemistry**: `pos_chem_20_30.pdf`
- **Physics**: `pos_phys_20_30.pdf`
- **Science**: `pos_science_20_30.pdf`
- **Math**: `math10to12.pdf`, `mathematics-20-1-standards.pdf`
- **ELA**: `ela-pos-10-12.pdf`
- **Social Studies**: `program-of-study-grade-11.pdf`, `program-of-study-grade-12.pdf`

### Download Sources

All PDFs can be downloaded from:
- [Alberta Education - Programs of Study](https://www.alberta.ca/programs-of-study)
- [Alberta Education - High School Programs](https://www.alberta.ca/kindergarten-to-grade-12-curriculum)

## Step 2: Parse Outcomes

**Script**: `2-parse-outcomes.py`

Extracts structured outcomes from PDF documents and saves them to `data/sources/alberta/parsed/`.

### Prerequisites

```bash
python3 -m pip install pdfplumber
```

### Usage

```bash
cd scripts/curriculum
python3 2-parse-outcomes.py
```

### What it does

- Extracts text from PDFs using `pdfplumber`
- Saves extracted text to `data/sources/alberta/text/`
- Parses general and specific outcomes
- Categorizes outcomes (knowledge, skills, STS)
- Outputs structured JSON to `data/sources/alberta/parsed/`

### Output Files

- `biology.json` / `biology_30.json` - Biology 20/30 outcomes
- `chemistry.json` / `chemistry_30.json` - Chemistry 20/30 outcomes
- `physics.json` / `physics_30.json` - Physics 20/30 outcomes
- `science.json` / `science_30.json` - Science 20/30 outcomes
- `math_20_1.json` / `math_30_1.json` - Math 20-1/30-1 outcomes
- `ela_20_1.json` - ELA 20-1 outcomes
- `social_20_1.json` / `social_30_1.json` - Social Studies 20-1/30-1 outcomes

### PyMuPDF variant + Side-by-Side Report

If you prefer using PyMuPDF and want a side-by-side comparison against the repo’s existing curriculum outcomes, use:

- **Script**: `alberta_outcomes_pymupdf_compare.py`

Prerequisites:

```bash
python3 -m pip install pymupdf
```

Run:

```bash
cd scripts/curriculum
python3 alberta_outcomes_pymupdf_compare.py --report ../../data/reports/alberta_outcomes_comparison.html
```

What it does:
- Extracts outcomes from the PDFs in `data/sources/alberta/pdfs/` via PyMuPDF
- Parses sciences (20/30) and Math 20-1 standards
- Writes parsed JSON to `data/sources/alberta/parsed/*_pymupdf.json`
- Generates an HTML report at `data/reports/alberta_outcomes_comparison.html` comparing original vs. new outcomes side by side

Optional (LLM):
- Add a third column “LLM‑Refined” that cleans up jumbled outcomes into concise bullet points with:

```bash
python3 alberta_outcomes_pymupdf_compare.py \
  --report ../../data/reports/alberta_outcomes_comparison.html \
  --use-llm --llm-model gpt-5 --llm-policy auto
```

- Models allowed: `gpt-5`, `gpt-5-nano`, `gpt-5-mini` (no 4/4.1/4o/4.5). Policies:
  - `off` (default): do not call LLM
  - `auto`: refine only when the extracted text appears long/jumbled
  - `force`: refine every outcome

- The script reads your key from `OPENAI_API_KEY` or `OPENAI_KEY` (or `.env.local`).
- Responses are cached in `data/reports/llm_cache.json`. Use `--clear-llm-cache` to recompute.

## Step 3: Map to Curriculum

**Script**: `3-map-curriculum.py`

Maps parsed outcomes to the application's curriculum structure with learning resources.

### Usage

```bash
cd scripts/curriculum
python3 3-map-curriculum.py
```

### What it does

- Reads parsed outcomes from `data/sources/alberta/parsed/`
- Reads existing curriculum JSONs from `data/curriculum/`
- Maps resources to specific outcomes
- Validates outcome codes against official curriculum
- Writes updated curriculum files to `data/curriculum/`

### Output Files

Updated curriculum JSON files in `data/curriculum/` with:
- Structured outcome objects
- Aligned learning resources
- Proper outcome hierarchies
- Validated outcome codes

## Resource Maintenance (20-level)

Script: `20_resource_maintainer.py`

Maintains and improves learning resources across all Grade 11 (20-level) subjects. It normalizes resource entries, validates `alignedOutcomes`, deduplicates, sorts, and can optionally check that links work.

### Usage

```bash
cd scripts/curriculum
# Dry run (no file writes)
python3 20_resource_maintainer.py --dry-run

# Apply updates to files
python3 20_resource_maintainer.py --write

# Filter by subjects (prefixes: bio, chem, phys, math, ela, social)
python3 20_resource_maintainer.py --subjects bio,chem,phys --write

# Check links online and write a JSON report (requires network access)
python3 20_resource_maintainer.py --write --check-links --report ../../out/20_report.json

# Apply permanent redirects for moved URLs
python3 20_resource_maintainer.py --write --check-links --apply-redirects
```

### What it does

- Normalizes resource `type`, `title`, `url`, and `difficulty`
- Infers `source` (e.g., Khan Academy, OpenStax, PhET) from URLs
- Ensures `alignedOutcomes` only reference codes present in the unit
- Deduplicates resources by URL within each unit
- Sorts resources by type, difficulty, then title
- Optionally checks links (HEAD/GET) and records statuses in a report

Outputs a one-line summary and can also write a JSON or Markdown report with `--report`.

## Title/Link Validator (20 + 30)

Script: `resource_title_validator.py`

Validates that resource titles reasonably match their URLs and actual page titles (fetched). Useful for catching mislabeled resources after manual edits.

### Usage

```bash
cd scripts/curriculum
# Dry run across 20 + 30
python3 resource_title_validator.py --dry-run --report ../../out/title_audit.json

# Apply high-confidence fixes to titles
python3 resource_title_validator.py --write --report ../../out/title_audit_fixed.json

# Filter by subjects
python3 resource_title_validator.py --subjects bio,chem,phys --write

# Skip network (slug-only checks)
python3 resource_title_validator.py --no-fetch --report ../../out/title_audit_slug_only.json
```

### What it does

- Compares `resource.title` to URL slug and fetched `<title>`
- Provider-aware heuristics (Khan Academy, OpenStax, LibreTexts)
- Detects possible type hint mismatch for Khan Academy (`/a/` article, `/v/` video, `/e/` practice)
- Writes a JSON report with sim scores and suggestions
- Optional `--write` updates titles when high-confidence suggestions exist

## When to Regenerate

### Full Regeneration (Steps 1-3)
Run all steps when:
- Alberta Education releases updated curriculum
- New subjects/grade levels are added
- Major curriculum restructuring occurs

### Partial Regeneration
Run only Step 3 when:
- Adding new learning resources
- Updating resource URLs
- Fixing resource-outcome alignments
- Adjusting curriculum structure

## Manual Edits

It's acceptable to manually edit files in `data/curriculum/` for:
- Adding/updating learning resources
- Adjusting unit organization
- Fixing typos or descriptions
- Customizing for SteadyTrack's needs

Just be aware that running Step 3 will overwrite manual changes. Consider updating the mapping script instead for permanent changes.

## Troubleshooting

### PDFs not found
- Ensure PDFs are in `data/sources/alberta/pdfs/`
- Check PDF filenames match expected names
- Download missing PDFs from Alberta Education

### Parse errors
- Update `pdfplumber`: `python3 -m pip install --upgrade pdfplumber`
- Check PDF format hasn't changed (Alberta may update formatting)
- Review extraction logic in `2-parse-outcomes.py`

### Mapping errors
- Ensure Step 2 completed successfully
- Check parsed JSON files exist in `data/sources/alberta/parsed/`
- Validate outcome codes in curriculum files

## Notes

- Source data (`data/sources/`) is not tracked in git
- Only final curriculum JSONs (`data/curriculum/`) are committed
- This keeps the repository size small (~300KB vs ~7MB with PDFs)
- The pipeline can be re-run anytime to regenerate from official sources
