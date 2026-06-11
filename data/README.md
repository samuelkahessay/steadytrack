# Data Directory Documentation

## 📁 Directory Structure

### Active Directories (In Use)

#### `curriculum/`
**Purpose**: Main curriculum data files used by the application
**Format**: JSON files containing subject units, outcomes, resources
**Files**:
- `bio-20.json`, `bio-30.json` - Biology (Grade 11, 12)
- `chem-20.json`, `chem-30.json` - Chemistry (Grade 11, 12)
- `phys-20.json`, `phys-30.json` - Physics (Grade 11, 12)
- `math-20-1.json`, `math-30-1.json` - Mathematics (Grade 11, 12)
- `ela-20-1.json`, `ela-30-1.json` - English Language Arts (Grade 11, 12)
- `social-20-1.json`, `social-30-1.json` - Social Studies (Grade 11, 12)
- `index.ts` - TypeScript module that exports curriculum data to the app
- `youtube_id_mappings.json` - YouTube video ID mappings for embed support
- `resources_needing_review.json` - Resources flagged for manual review

**Last Updated**: Oct 8, 2024 (LLM-refined outcomes consolidated)
**Total Outcomes**: 823 (LLM-refined with proper capitalization)

#### `alignment/`
**Purpose**: Original alignment data mapping curriculum outcomes to PDF evidence
**Format**: JSON files with outcomes, evidence snippets, and document references
**Stage**: Source data (Stage 1 of processing pipeline)
**Files**: `biology.json`, `chemistry.json`, `physics.json`, `english.json`, `math.json`, `social.json`
**Sub-directories**: `correlations/` - detailed correlation maps per document

#### `alignment_llm_merged/`
**Purpose**: Current alignment data with LLM-refined outcome descriptions
**Format**: JSON files with refined descriptions merged from LLM cache
**Stage**: Final output (Stage 3 of processing pipeline)
**Last Updated**: Oct 8, 2024 (231 outcomes updated with LLM descriptions)
**Files**:
- `biology.json` (11 outcomes)
- `chemistry.json` (121 outcomes)
- `physics.json` (82 outcomes)
- `english.json` (17 outcomes)
- `math.json` (0 outcomes - empty, needs population)
- `social.json` (0 outcomes - empty, needs population)

#### `reports/`
**Purpose**: Generated reports and cache files
**Files**:
- `llm_cache.json` - **SOURCE OF TRUTH** for LLM-refined outcomes (823 outcomes)
- `consolidation_report.txt` - Curriculum consolidation results
- `alignment_update_report.txt` - Alignment file update results
- `verification_report.txt` - Final verification results
- `alberta_outcomes_comparison.html` - Production comparison report

#### `sources/`
**Purpose**: Source PDF documents for processing
**Contents**: Alberta curriculum PDFs and study materials

#### `llm/`
**Purpose**: LLM processing jobs and outputs
**Contents**: Batch job files for LLM outcome refinement

#### `qc/`
**Purpose**: Quality control files and validation data

### Processing Pipeline Directories (Keep for Regeneration)

#### `extracted/`
**Purpose**: Raw extracted text from PDF documents
**Size**: ~28 MB
**Pipeline Stage**: Stage 0 - PDF extraction
**Used by**: `pdf_extract.py`

#### `clean/`
**Purpose**: Cleaned and structured text from PDF extraction
**Size**: ~23 MB
**Pipeline Stage**: Stage 1 - Text cleaning
**Used by**: `pdf_structure.py`, `clean_align_curriculum.py`

#### `structured/`
**Purpose**: Structured JSON data from cleaned text
**Size**: ~41 MB
**Pipeline Stage**: Stage 2 - Structuring
**Used by**: `extract_correlation_maps.py`

### Archived Directories

#### `_archived/`
**Purpose**: Deprecated files and directories no longer in active use
**Sub-directories**:
- `alignment_enhanced/` - Superseded by `alignment_llm_merged/` (archived Oct 8, 2024)
- `deprecated_curriculum_2024/` - Old curriculum files with incomplete structure
- `test_reports/` - Test HTML reports

---

## 🔄 Data Processing Pipeline

### Overview
```
PDFs → extracted/ → clean/ → structured/ → alignment/ → [alignment_enhanced/] → alignment_llm_merged/
                                              ↓
                                         curriculum/
                                              ↓
                                         llm_cache.json
```

### Detailed Pipeline

#### Stage 0: PDF Extraction
- **Script**: `scripts/pdf_extract.py`
- **Input**: `sources/*.pdf`
- **Output**: `extracted/<subject>-<type>/`
- **Purpose**: Extract raw text and structure from Alberta curriculum PDFs

#### Stage 1: Text Cleaning & Alignment
- **Script**: `scripts/clean_align_curriculum.py`
- **Input**: `extracted/`, `clean/`
- **Output**: `alignment/<subject>.json`
- **Purpose**: Clean extracted text and align content with curriculum outcomes

#### Stage 2: Correlation Extraction
- **Script**: `scripts/extract_correlation_maps.py`
- **Input**: `structured/`
- **Output**: `alignment/correlations/<doc>.json`
- **Purpose**: Build detailed correlation maps between documents and outcomes

#### Stage 3: Alignment Enhancement (Deprecated)
- **Script**: `scripts/enhance_alignment_with_correlations.py`
- **Input**: `alignment/`, `alignment/correlations/`
- **Output**: `alignment_enhanced/` (now archived)
- **Purpose**: Enhanced alignment with AI summaries (intermediate stage)

#### Stage 4: LLM Refinement
- **Scripts**:
  - `scripts/llm_export_alignment_jobs.py` - Export jobs for LLM processing
  - `scripts/llm_merge_alignment.py` - Merge LLM refinements back
- **Input**: `alignment_enhanced/` or `alignment/`
- **Output**: `alignment_llm_merged/`, `reports/llm_cache.json`
- **Purpose**: Refine outcome descriptions using LLM (GPT-5)

#### Stage 5: Curriculum Consolidation
- **Script**: `scripts/curriculum/consolidate_llm_outcomes.py`
- **Input**: `reports/llm_cache.json`, `curriculum/*.json`
- **Output**: Updated `curriculum/*.json` files
- **Purpose**: Consolidate LLM-refined outcomes into curriculum files
- **Last Run**: Oct 8, 2024
- **Results**: 823 outcomes consolidated, 410 added, 413 updated, 55 duplicates removed

#### Stage 6: Alignment Description Update
- **Script**: `scripts/curriculum/update_alignment_descriptions.py`
- **Input**: `reports/llm_cache.json`, `alignment_llm_merged/*.json`
- **Output**: Updated `alignment_llm_merged/*.json` files
- **Purpose**: Update alignment files with LLM-refined descriptions
- **Last Run**: Oct 8, 2024
- **Results**: 231 outcomes updated

---

## 📊 Data Statistics

### Curriculum Files (Oct 8, 2024)
| File | Subject | Outcomes |
|------|---------|----------|
| bio-20.json | Biology 20 | 119 |
| bio-30.json | Biology 30 | 128 |
| chem-20.json | Chemistry 20 | 107 |
| chem-30.json | Chemistry 30 | 111 |
| phys-20.json | Physics 20 | 95 |
| phys-30.json | Physics 30 | 143 |
| math-20-1.json | Mathematics 20-1 | 20 |
| math-30-1.json | Mathematics 30-1 | 16 |
| ela-20-1.json | English Language Arts 20-1 | 38 |
| ela-30-1.json | English Language Arts 30-1 | 38 |
| social-20-1.json | Social Studies 20-1 | 4 |
| social-30-1.json | Social Studies 30-1 | 4 |
| **TOTAL** | | **823** |

### LLM Cache
- **File**: `reports/llm_cache.json`
- **Total Outcomes**: 823
- **Format**: `"subject::code": "- Refined description"`
- **Model**: GPT-5
- **Purpose**: Single source of truth for LLM-refined outcome descriptions

### Alignment Files (Oct 8, 2024)
| File | Outcomes | Status |
|------|----------|--------|
| biology.json | 11 | ✅ Updated |
| chemistry.json | 121 | ✅ Updated |
| physics.json | 82 | ✅ Updated |
| english.json | 17 | ✅ Updated |
| math.json | 0 | ⚠️ Empty (needs population) |
| social.json | 0 | ⚠️ Empty (needs population) |
| **TOTAL** | 231 | |

---

## 🔧 How to Regenerate Data

### Full Pipeline (from PDFs)
```bash
# 1. Extract from PDFs
python scripts/pdf_extract.py

# 2. Clean and align
python scripts/clean_align_curriculum.py

# 3. Extract correlations
python scripts/extract_correlation_maps.py

# 4. LLM refinement (requires API access)
python scripts/llm_export_alignment_jobs.py
# (Run LLM jobs externally)
python scripts/llm_merge_alignment.py

# 5. Consolidate to curriculum
python scripts/curriculum/consolidate_llm_outcomes.py

# 6. Update alignment descriptions
python scripts/curriculum/update_alignment_descriptions.py
```

### Partial Updates

#### Update curriculum with new LLM refinements:
```bash
python scripts/curriculum/consolidate_llm_outcomes.py \
  --cache data/reports/llm_cache.json \
  --curriculum-dir data/curriculum
```

#### Update alignment descriptions:
```bash
python scripts/curriculum/update_alignment_descriptions.py \
  --cache data/reports/llm_cache.json \
  --alignment-dir data/alignment_llm_merged
```

#### Verify consolidation:
```bash
python scripts/curriculum/verify_consolidation.py \
  --cache data/reports/llm_cache.json \
  --curriculum-dir data/curriculum \
  --report data/reports/verification_report.txt
```

---

## ⚠️ Important Notes

### DO NOT Delete
- `llm_cache.json` - Source of truth for refined outcomes
- `extracted/`, `clean/`, `structured/` - Needed for regeneration
- `alignment/` - Original source alignment data
- `sources/` - Source PDF documents

### Safe to Archive
- Old test reports (moved to `_archived/test_reports/`)
- `alignment_enhanced/` (superseded, moved to `_archived/`)
- Deprecated curriculum files (moved to `_archived/deprecated_curriculum_2024/`)

### Future Work
- Populate `alignment_llm_merged/math.json` (data exists in `alignment/math.json`)
- Populate `alignment_llm_merged/social.json` (data exists in `alignment/social.json`)
- Run full alignment enhancement pipeline for math and social subjects

---

## 📝 File Naming Conventions

### Curriculum Files
- Pattern: `{subject}-{grade}.json`
- Examples: `bio-20.json`, `chem-30.json`, `math-20-1.json`, `ela-30-1.json`

### Alignment Files
- Pattern: `{subject}.json`
- Examples: `biology.json`, `chemistry.json`, `math.json`

### LLM Cache Keys
- Pattern: `"{subject}::{outcome-code}"`
- Examples: `"biology-20::20-A1.1k"`, `"chemistry-30::30-B2.3s"`

---

## 📞 Questions?

For questions about the data pipeline or to request regeneration, see:
- Pipeline scripts: `scripts/curriculum/`
- Documentation: `ARCHITECTURE.md` (project root)
- Change log: `CHANGELOG.md` (project root)
