# Curriculum Scripts

These scripts are optional tools for inspecting or regenerating `data/curriculum/`.

## Local Data Checks

```bash
python3 scripts/curriculum/resource_maintainer.py --dry-run
python3 scripts/curriculum/resource_title_validator.py --dry-run --no-fetch
```

Use `--write` only after reviewing the proposed changes.

## Rebuilding From PDFs

The source PDFs are not tracked. To experiment locally:

1. Create `data/sources/alberta/pdfs/`.
2. Download official Alberta curriculum PDFs.
3. Install parser dependencies:

```bash
python3 -m pip install pdfplumber pymupdf
```

4. Run one of the parser scripts:

```bash
cd scripts/curriculum
python3 2-parse-outcomes.py
python3 alberta_outcomes_pymupdf_compare.py --report ../../data/reports/alberta_outcomes_comparison.html
```

5. Review generated files before updating `data/curriculum/`.

## Resource Maintenance

Useful scripts:

- `resource_maintainer.py` - normalize resource metadata and outcome alignment
- `resource_title_validator.py` - check resource titles against URL/title hints
- `check_khan_404s.py` - check Khan Academy links
- `flag_outcome_resource_mismatches.py` - find orphaned or mismatched resources
- `automated_youtube_id_resolver.py` and `batch_youtube_resolver.py` - update YouTube metadata
- `enrich_embed_metadata.py` - mark embeddable resources

Some scripts may use network access to validate public resource links. They should not require production credentials.

## LLM-Assisted Scripts

The `llm_*` and title-improvement scripts are kept as examples of local data enrichment workflows. They should write reviewable local output first. Commit only final public data after manual review.

## Safety Notes

- Generated source folders and reports are ignored by git.
- Do not commit downloaded PDFs unless the license and purpose are clear.
- Do not commit private prompt batches, API responses, credentials, or service-role output.
