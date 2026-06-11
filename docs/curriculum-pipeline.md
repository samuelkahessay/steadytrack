# Curriculum Data Pipeline Documentation

## Overview

SteadyTrack's curriculum data is sourced directly from official Alberta Education documents. This document explains the complete pipeline from PDF download to production curriculum JSON files.

## Architecture

### Data Flow

```mermaid
graph LR
    A[Alberta Education PDFs] --> B[Extract Text]
    B --> C[Parse Outcomes]
    C --> D[Map to Resources]
    D --> E[Production Curriculum]
```

### Directory Structure

```
steadytrack/
├── data/
│   ├── sources/              # Source data (git ignored)
│   │   └── alberta/
│   │       ├── pdfs/         # Original PDF documents
│   │       ├── text/         # Extracted text content
│   │       └── parsed/       # Parsed outcome structures
│   └── curriculum/           # Production data (git tracked)
│       ├── bio-20.json       # Biology 20 curriculum
│       ├── bio-30.json       # Biology 30 curriculum
│       ├── chem-20.json      # Chemistry 20 curriculum
│       ├── chem-30.json      # Chemistry 30 curriculum
│       ├── phys-20.json      # Physics 20 curriculum
│       ├── phys-30.json      # Physics 30 curriculum
│       ├── math-20-1.json    # Math 20-1 curriculum
│       ├── math-30-1.json    # Math 30-1 curriculum
│       ├── ela-20-1.json     # English 20-1 curriculum
│       ├── ela-30-1.json     # English 30-1 curriculum
│       ├── social-20-1.json  # Social Studies 20-1
│       ├── social-30-1.json  # Social Studies 30-1
│       └── index.ts          # TypeScript exports
└── scripts/
    └── curriculum/
        ├── 2-parse-outcomes.py   # PDF → parsed outcomes
        ├── 3-map-curriculum.py   # Parsed outcomes → curriculum JSON
        └── README.md             # Quick reference guide
```

## Pipeline Steps

### 1. Download PDFs (Manual)

Download official curriculum documents from Alberta Education and place them in `data/sources/alberta/pdfs/`.

#### Required Files

| Subject | Filename | Source |
|---------|----------|--------|
| Biology | `pos_bio_20_30.pdf` | [Alberta.ca](https://education.alberta.ca/media/3069378/pos_bio_20_30.pdf) |
| Chemistry | `pos_chem_20_30.pdf` | [Alberta.ca](https://education.alberta.ca/media/3069379/pos_chem_20_30.pdf) |
| Physics | `pos_phys_20_30.pdf` | [Alberta.ca](https://education.alberta.ca/media/3069387/pos_phys_20_30.pdf) |
| Science | `pos_science_20_30.pdf` | [Alberta.ca](https://education.alberta.ca/media/3069386/pos_science_20_30.pdf) |
| Mathematics | `math10to12.pdf` | [Alberta.ca](https://education.alberta.ca/media/3115252/math10to12.pdf) |
| Math Standards | `mathematics-20-1-standards.pdf` | [Alberta.ca](https://www.alberta.ca/system/files/custom_downloaded_images/edc-math-20-1-standards.pdf) |
| ELA | `ela-pos-10-12.pdf` | [Alberta.ca](https://education.alberta.ca/media/3115279/elapgm10to12.pdf) |
| Social 11 | `program-of-study-grade-11.pdf` | [Alberta.ca](https://education.alberta.ca/media/3273004/program-of-study-grade-11.pdf) |
| Social 12 | `program-of-study-grade-12.pdf` | [Alberta.ca](https://education.alberta.ca/media/3273005/program-of-study-grade-12.pdf) |

### 2. Parse Outcomes (Automated)

**Script**: `scripts/curriculum/2-parse-outcomes.py`

Extracts structured learning outcomes from PDF documents.

#### What It Does

1. **Text Extraction**: Uses `pdfplumber` to extract text while preserving layout
2. **Outcome Parsing**: Identifies general and specific outcomes using regex patterns
3. **Categorization**: Classifies outcomes by type (knowledge, skills, STS)
4. **Structuring**: Builds hierarchical JSON with outcome relationships

#### Output Format

```json
{
  "general_outcomes": [
    {
      "code": "20-A1",
      "description": "Students will explain..."
    }
  ],
  "specific_outcomes": [
    {
      "code": "20-A1.1k",
      "category": "knowledge",
      "description": "define momentum as...",
      "general_parent": "20-A1"
    }
  ]
}
```

#### Run Command

```bash
cd scripts/curriculum
python3 2-parse-outcomes.py
```

### 3. Map to Curriculum (Automated)

**Script**: `scripts/curriculum/3-map-curriculum.py`

Maps parsed outcomes to curriculum structure with learning resources.

#### What It Does

1. **Load Parsed Data**: Reads outcome structures from `data/sources/alberta/parsed/`
2. **Load Curriculum**: Reads existing curriculum files from `data/curriculum/`
3. **Map Outcomes**: Associates resources with specific outcome codes
4. **Validate**: Ensures all outcome codes exist in official documents
5. **Update**: Writes back to `data/curriculum/` with enriched data

#### Curriculum File Structure

```json
{
  "subject": "Physics 30",
  "grade": 12,
  "units": [
    {
      "id": "electric-fields",
      "title": "Electric Fields and Forces",
      "estimatedHours": 6,
      "outcomes": [
        {
          "code": "30-B1",
          "description": "Students will explain...",
          "type": "general"
        },
        {
          "code": "30-B1.1k",
          "description": "explain electrical interactions...",
          "category": "knowledge",
          "parent": "30-B1"
        }
      ],
      "topics": [
        "Electric charge and Coulomb's law",
        "Electric fields and field lines"
      ],
      "resources": [
        {
          "type": "video",
          "title": "Introduction to Electric Fields",
          "url": "https://...",
          "difficulty": "beginner",
          "alignedOutcomes": ["30-B1", "30-B1.1k"]
        }
      ]
    }
  ]
}
```

#### Run Command

```bash
cd scripts/curriculum
python3 3-map-curriculum.py
```

## Outcome Code Structure

### Sciences (Biology, Chemistry, Physics)

- **Format**: `{level}-{unit}{outcome}.{sub}`
- **Example**: `20-A1.3k`
  - `20` = Grade level (20 or 30)
  - `A` = Unit letter (A, B, C, D)
  - `1` = General outcome number
  - `.3k` = Specific outcome (knowledge)

### Mathematics

- **Format**: `{strand}{number}`
- **Example**: `RF8`, `PCB2`, `A4`, `T3`
  - `RF` = Relations & Functions
  - `PCB` = Permutations, Combinations, Binomial
  - `A` = Algebra
  - `T` = Trigonometry

### Social Studies

- **Format**: `{level}-1.{outcome}`
- **Example**: `30-1.3`
  - `30-1` = Grade 12, Program 1
  - `.3` = Related issue number

### English Language Arts

- **Format**: `{outcome}.{sub}.{specific}`
- **Example**: `2.1.2`
  - `2` = General outcome (Comprehend/Respond)
  - `1.2` = Specific outcome

## Maintenance

### When Alberta Updates Curriculum

1. Download new PDFs
2. Run parse script: `python3 2-parse-outcomes.py`
3. Review changes in `data/sources/alberta/parsed/`
4. Run mapping script: `python3 3-map-curriculum.py`
5. Test in application
6. Commit updated `data/curriculum/` files

### Adding New Resources

Two approaches:

**A. Manual Edit** (Quick)
1. Edit `data/curriculum/{subject}.json` directly
2. Add resource to appropriate unit
3. Set `alignedOutcomes` array
4. Test and commit

**B. Update Mapping Script** (Permanent)
1. Edit `scripts/curriculum/3-map-curriculum.py`
2. Add resource to unit mapping
3. Run script to regenerate
4. Test and commit

### Fixing Misaligned Outcomes

If resources don't match official outcomes:

1. Check `data/sources/alberta/parsed/` for correct codes
2. Update `data/curriculum/` files with correct codes
3. Verify against official PDF
4. Update mapping script if systematic issue

## Git Workflow

### Tracked Files

- `data/curriculum/*.json` - Production curriculum data
- `scripts/curriculum/*.py` - Processing scripts
- `scripts/curriculum/README.md` - Quick reference
- `docs/curriculum-pipeline.md` - This document

### Ignored Files

- `data/sources/` - All source data (PDFs, text, parsed)
- `data/alberta/` - Legacy path (if exists)

### Committing Changes

```bash
# After updating curriculum
git add data/curriculum/
git commit -m "Update {subject} curriculum with new resources"

# After modifying pipeline
git add scripts/curriculum/
git commit -m "Improve outcome parsing for {subject}"
```

## Troubleshooting

### Parse Script Fails

**Issue**: `pdfplumber` not installed
```bash
python3 -m pip install pdfplumber
```

**Issue**: PDF format changed
- Review PDF structure manually
- Update regex patterns in `2-parse-outcomes.py`
- Test with single subject first

**Issue**: Outcome codes not recognized
- Check PDF page structure
- Verify column detection logic
- Update outcome pattern matchers

### Mapping Script Fails

**Issue**: Parsed file not found
- Ensure Step 2 completed successfully
- Check `data/sources/alberta/parsed/` exists
- Verify correct filenames

**Issue**: Outcome code mismatch
- Compare with `data/sources/alberta/parsed/`
- Check for typos in curriculum files
- Verify official outcome codes in PDF

### Resource URLs Broken

**Issue**: External resource moved/deleted
- Update URL in curriculum JSON
- Find alternative resource
- Consider hosting backup

## Performance

### Pipeline Runtime

- **Parse**: ~2-5 minutes (9 PDFs)
- **Map**: ~1-2 seconds (12 curriculum files)
- **Total**: ~3-7 minutes for full regeneration

### File Sizes

- **PDFs**: ~6MB total
- **Text**: ~1MB total
- **Parsed**: ~500KB total
- **Curriculum**: ~300KB total

## Future Improvements

### Potential Enhancements

1. **Automated Downloads**: Script to fetch PDFs from Alberta.ca
2. **Change Detection**: Compare old/new parsed outcomes
3. **Validation Suite**: Automated tests for outcome alignments
4. **Resource Scoring**: Quality metrics for learning resources
5. **Difficulty Analysis**: Auto-suggest difficulty levels
6. **Coverage Reports**: Identify outcomes without resources

### Known Limitations

1. **Manual PDF Download**: No automated fetching yet
2. **Format Changes**: Alberta may restructure PDFs
3. **OCR Quality**: Some PDFs have poor text extraction
4. **Resource Discovery**: Manual curation of learning resources
5. **Outcome Granularity**: Some specific outcomes very detailed

## References

- [Alberta Education - Programs of Study](https://www.alberta.ca/programs-of-study)
- [Alberta Education - K-12 Curriculum](https://www.alberta.ca/kindergarten-to-grade-12-curriculum)
- [pdfplumber Documentation](https://github.com/jsvine/pdfplumber)

## Support

For questions about the curriculum pipeline:
1. Check `scripts/curriculum/README.md` for quick reference
2. Review this document for detailed explanations
3. Examine script comments for implementation details
4. Open an issue on GitHub if stuck
