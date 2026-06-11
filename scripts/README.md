# SteadyTrack Scripts

Automated scripts for curriculum management, resource curation, and quality assurance.

## 🎯 Core Resource Management

### Async LLM-Powered Tools (Primary)

These are the main tools for maintaining curriculum resources:

**`curriculum/llm_link_fixer_async.py`** - Fix broken resource links
- Finds replacement URLs for broken/outdated links using GPT-4o
- Multi-candidate approach (5 alternatives per broken link)
- Concurrent verification of all candidates
- 3-stage fallback strategy (exact → equivalent → any relevant)
```bash
# Fix all broken links
scripts/.venv/bin/python scripts/curriculum/llm_link_fixer_async.py \
  --report out/health_report.json \
  --output out/link_fixes.json

# Dry-run test
scripts/.venv/bin/python scripts/curriculum/llm_link_fixer_async.py \
  --report out/health_report.json \
  --dry-run --limit 10
```

**`curriculum/llm_gap_filler_async.py`** - Fill resource gaps
- Finds diverse resources for outcomes with 0 resources
- Ensures resource diversity (video + article + practice)
- Verifies all URLs before adding
```bash
# Fill only empty outcomes (0 resources)
scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \
  --target-count 0 \
  --output out/gap_filler.json

# Fill outcomes with <3 resources (diversity improvement)
scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \
  --target-count 3 \
  --output out/diversity_filler.json
```

**`curriculum/title_improver_async.py`** - Improve resource titles
- Identifies poor titles (URLs, generic names, single words)
- Generates clear, descriptive alternatives via GPT-4o
- Batch processing (20 titles at once)
```bash
# Auto-approve all improvements
scripts/.venv/bin/python scripts/curriculum/title_improver_async.py \
  --auto-approve \
  --output out/title_improvements.json

# Interactive approval mode
scripts/.venv/bin/python scripts/curriculum/title_improver_async.py \
  --output out/title_improvements.json
```

**`curriculum/llm_utils.py`** - Shared async utilities
- AsyncOpenAI client management
- Exponential backoff retry logic
- Checkpoint management
- URL verification utilities
- Not run directly - imported by other scripts

### Resource Health & Maintenance

**`curriculum/resource_maintainer.py`** - Health checks & normalization
- Scans all curriculum files for issues
- Validates resource URLs (format checking)
- Optional link checking (HEAD/GET requests)
- Normalizes resource metadata
- Fixes aligned outcomes
```bash
# Dry-run health check
python3 scripts/curriculum/resource_maintainer.py --dry-run

# Full check with link validation
python3 scripts/curriculum/resource_maintainer.py \
  --check-links \
  --write \
  --report out/health_report.json
```

## 📊 Validation & Analysis

**`validate-coverage.ts`** - Coverage validation
- Validates 100% outcome coverage goal
- Checks resource diversity (video, article, practice)
- Analyzes difficulty progression
- Generates detailed HTML/JSON reports
```bash
npx tsx scripts/validate-coverage.ts
```

**`detect-resource-gaps.ts`** - Gap detection
- Identifies outcomes with insufficient resources
- Groups gaps by subject and grade
- Exports gap list for processing
```bash
npx tsx scripts/detect-resource-gaps.ts
```

**`analyze-resource-diversity.ts`** - Diversity analysis
- Analyzes resource type distribution
- Checks provider diversity
- Identifies over-reliance on single sources
```bash
npx tsx scripts/analyze-resource-diversity.ts
```

## 🏗️ Curriculum Processing

**`curriculum/2-parse-outcomes.py`** - Parse Alberta curriculum PDFs
- Extracts learning outcomes from official PDFs
- Structures data into JSON format
- Initial curriculum file generation

**`curriculum/3-map-curriculum.py`** - Map curriculum structure
- Maps units to outcomes
- Creates curriculum hierarchy
- Validates structure

**`curriculum/alberta_outcomes_pymupdf_compare.py`** - Compare curriculum sources
- Compares extracted outcomes with official documents
- Validates accuracy of parsing
- Generates comparison reports
```bash
scripts/.venv/bin/python scripts/curriculum/alberta_outcomes_pymupdf_compare.py \
  --use-llm \
  --llm-model gpt-4o \
  --report data/reports/comparison.html
```

**`curriculum/scrape_alberta_curriculum_enhanced.py`** - Web scraper
- Scrapes Alberta Education curriculum website
- Extracts learning outcomes and descriptions
- Enhanced version with better parsing

**`curriculum/consolidate_llm_outcomes.py`** - Consolidate LLM-generated data
- Merges LLM-generated outcome descriptions
- Consolidates alignment data
- Validates consistency

**`curriculum/update_alignment_descriptions.py`** - Update descriptions
- Updates outcome descriptions from authoritative sources
- Ensures consistency across curriculum files

**`curriculum/verify_consolidation.py`** - Verify data integrity
- Validates consolidated curriculum data
- Checks for inconsistencies
- Reports errors

## 🛠️ Utility Scripts

**`validate-schedule-distribution.ts`** - Validate study schedules
- Ensures proper schedule distribution
- Validates date ranges and pacing
- Identifies scheduling conflicts
```bash
npm run validate:schedules
```

**`generate_microcards.ts`** - Generate microcard study content
- Creates microcard study materials
- Supports file or database persistence
```bash
npm run generate:microcards      # Save to file
npm run generate:microcards:db   # Save to database
```

**`check-duplicate-folders.sh` / `clean-duplicate-folders.sh`** - Duplicate detection
- Identifies duplicate data folders
- Cleans up redundant directories
```bash
npm run check:duplicate-folders
npm run clean:duplicate-folders
```

**`curriculum/apply_title_suggestions.py`** - Apply title improvements
- Applies LLM-generated title suggestions
- Batch processing support

**`curriculum/resource_title_validator.py`** - Validate titles
- Checks resource titles for quality
- Identifies poor/generic titles
- Generates improvement suggestions

**`curriculum/flag_outcome_resource_mismatches.py`** - Flag mismatches
- Identifies resources not aligned to valid outcomes
- Reports orphaned resources
- Suggests corrections

**`curriculum/automated_youtube_id_resolver.py`** - Resolve YouTube IDs
- Extracts YouTube video IDs from URLs
- Validates video availability
- Updates metadata

**`curriculum/batch_youtube_resolver.py`** - Batch YouTube processing
- Batch processes YouTube resources
- Resolves IDs and metadata
- Updates curriculum files

**`curriculum/enrich_embed_metadata.py`** - Enrich embeddable resources
- Adds metadata for embeddable resources (YouTube, PhET)
- Marks resources as embeddable
- Validates embed URLs

## 📂 Project Structure

```
scripts/
├── curriculum/                      # Curriculum management
│   ├── llm_utils.py                # Shared async utilities
│   ├── llm_link_fixer_async.py     # Fix broken links (async)
│   ├── llm_gap_filler_async.py     # Fill resource gaps (async)
│   ├── title_improver_async.py     # Improve titles (async)
│   ├── resource_maintainer.py      # Health checks & validation
│   │
│   ├── 2-parse-outcomes.py         # Curriculum processing
│   ├── 3-map-curriculum.py
│   ├── alberta_outcomes_pymupdf_compare.py
│   ├── scrape_alberta_curriculum_enhanced.py
│   ├── consolidate_llm_outcomes.py
│   ├── update_alignment_descriptions.py
│   ├── verify_consolidation.py
│   │
│   └── [utility scripts]            # Metadata & validation
│
├── validate-coverage.ts             # Coverage validation
├── detect-resource-gaps.ts          # Gap detection
├── analyze-resource-diversity.ts    # Diversity analysis
│
└── archive/                         # Old/completed scripts
    ├── resource-populator*.py      # Superseded by llm_gap_filler_async.py
    ├── llm_*.py                    # Completed alignment work
    ├── pdf_*.py                    # PDF processing (completed)
    └── curriculum/
        ├── 20_resource_maintainer.py  # Superseded by resource_maintainer.py
        ├── 30_resource_maintainer.py  # Superseded by resource_maintainer.py
        └── llm_link_fixer.py          # Superseded by llm_link_fixer_async.py
```

## 🚀 Common Workflows

### Full Resource Quality Pipeline

```bash
# 1. Health check (find broken links and gaps)
python3 scripts/curriculum/resource_maintainer.py \
  --check-links \
  --report out/health_report.json

# 2. Fix broken links
scripts/.venv/bin/python scripts/curriculum/llm_link_fixer_async.py \
  --report out/health_report.json \
  --output out/link_fixes.json

# 3. Fill empty outcomes
scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \
  --target-count 0 \
  --output out/gap_filler.json

# 4. Improve poor titles
scripts/.venv/bin/python scripts/curriculum/title_improver_async.py \
  --auto-approve \
  --output out/title_improvements.json

# 5. Final validation
python3 scripts/curriculum/resource_maintainer.py \
  --check-links \
  --report out/final_health.json

npx tsx scripts/validate-coverage.ts
```

### Add Resources for Specific Outcomes

```bash
# Fill specific outcomes with 0 resources
scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \
  --target-count 0 \
  --limit 10 \
  --dry-run

# Review and apply
scripts/.venv/bin/python scripts/curriculum/llm_gap_filler_async.py \
  --target-count 0 \
  --output out/filled_outcomes.json
```

### Validate Curriculum Quality

```bash
# Check coverage
npx tsx scripts/validate-coverage.ts

# Analyze resource diversity
npx tsx scripts/analyze-resource-diversity.ts

# Find gaps
npx tsx scripts/detect-resource-gaps.ts
```

## ⚙️ Configuration

### Environment Variables

Create `.env.local` in project root:
```
OPENAI_API_KEY=sk-...
```

### Python Virtual Environment

All Python scripts use `scripts/.venv`:
```bash
# Create venv (if not exists)
python3 -m venv scripts/.venv

# Install dependencies
scripts/.venv/bin/pip install openai requests beautifulsoup4 lxml pymupdf
```

### LLM Models

**Primary**: gpt-4o (good quality/cost balance)
**Fallback**: gpt-5 (if available, else gpt-4o-mini)

Configured in `curriculum/llm_utils.py`

## 📊 Current Status (Oct 2024)

- **Coverage**: 95% (781/823 outcomes)
- **Broken Links**: 87 need fixing
- **Empty Outcomes**: 42 need resources
- **Poor Titles**: 17 need improvement

**Target**: 95%+ coverage with 100% healthy links

## 🗄️ Archive

Old/superseded scripts are in `scripts/archive/`:
- Resource populators (4 versions) → superseded by `llm_gap_filler_async.py`
- Old maintainers (20, 30 level) → consolidated into `resource_maintainer.py`
- Non-async link fixer → superseded by `llm_link_fixer_async.py`
- Completed one-off scripts (alignment, PDF processing, etc.)

These are kept for historical reference but not actively used.

## 📝 Notes

- All async scripts support `--resume` for checkpoint recovery
- All async scripts support `--dry-run` for testing
- All async scripts use caching to avoid redundant LLM calls
- Concurrent processing: 15-20 requests at a time
- Total pipeline time: ~20 minutes for full quality pass

## 🤝 Contributing

When adding new scripts:
1. Follow naming convention: `verb_noun.py` or `noun_processor.py`
2. Add docstring with usage examples
3. Support `--dry-run` and `--help` flags
4. Update this README with script documentation
5. Use shared utilities from `curriculum/llm_utils.py` when possible
