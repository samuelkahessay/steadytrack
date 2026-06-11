# Data

This directory contains the public data needed to run the archive locally.

## Files

- `curriculum/` - Alberta high-school curriculum JSON used by the app
- `curriculum/index.ts` - typed loader used by application code
- `curriculum/youtube_id_mappings.json` - optional embed metadata
- `curriculum/resources_needing_review.json` - public resource-review queue
- `demo-microcards.json` - seed cards for local SQLite
- `lib/copy.ts` - data-facing copy used by the UI

## Runtime Behavior

The app reads curriculum JSON directly from `data/curriculum/`. Server API routes read microcards from `.local/steadytrack.sqlite`; that database is created from `data/demo-microcards.json` on first run.

## Ignored Working Data

The original source PDFs, extraction outputs, generated reports, and scratch review files are not tracked. If you regenerate curriculum data locally, keep those working folders out of git unless the final checked-in JSON intentionally changes.

## Editing Data

After editing curriculum or microcard data, run:

```bash
npm test
npx tsx scripts/validate-coverage.ts
```

For resource-heavy edits, also consider:

```bash
npx tsx scripts/detect-resource-gaps.ts
npx tsx scripts/analyze-resource-diversity.ts
```
