# Curriculum Pipeline

The public archive ships with final curriculum JSON in `data/curriculum/`. The original source PDFs and intermediate extraction outputs are intentionally not included.

## Data Flow

```text
Official Alberta curriculum documents
  -> optional local extraction scripts
  -> reviewed curriculum JSON
  -> app UI and study-plan generator
```

## Tracked Curriculum Files

- `bio-20.json`
- `bio-30.json`
- `chem-20.json`
- `chem-30.json`
- `phys-20.json`
- `phys-30.json`
- `math-20-1.json`
- `math-30-1.json`
- `ela-20-1.json`
- `ela-30-1.json`
- `social-20-1.json`
- `social-30-1.json`
- `index.ts`

Each subject file contains units, outcomes, topics, resources, and Alberta document links where available.

## Useful Local Scripts

```bash
npx tsx scripts/validate-coverage.ts
npx tsx scripts/detect-resource-gaps.ts
npx tsx scripts/analyze-resource-diversity.ts
```

The scripts read local JSON and write reports to ignored output locations. They should not require production credentials.

## Regenerating From Source Documents

The parser scripts in `scripts/curriculum/` are kept for learning and experimentation. If you want to rerun them:

1. Create `data/sources/alberta/pdfs/`.
2. Download official Alberta curriculum PDFs into that folder.
3. Install the Python dependencies mentioned in `scripts/curriculum/README.md`.
4. Run the parser or mapper scripts locally.
5. Review every generated change before replacing `data/curriculum/`.

Generated source folders are ignored by git.

## Outcome Codes

- Sciences: `20-A1.3k`, `30-B2.1s`
- Mathematics: `RF8`, `PCB2`, `A4`
- Social Studies: `30-1.3`
- English Language Arts: `2.1.2`

The app treats codes as stable IDs for schedule generation, resource grouping, and microcard matching.

## Editing Guidance

Small fixes can be made directly in `data/curriculum/*.json`. Keep resource entries factual and inspectable:

- `title`
- `url`
- `type`
- `source`
- `difficulty`
- `alignedOutcomes`

After edits, run tests and at least one relevant data validation script.
