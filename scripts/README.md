# Scripts

Scripts in this archive should be useful from a local checkout. Old production, migration, and service-role scripts were removed from the public snapshot.

## Local Validation

```bash
npm test
npm run lint
npm run build
npx tsx scripts/validate-coverage.ts
npx tsx scripts/detect-resource-gaps.ts
npx tsx scripts/analyze-resource-diversity.ts
```

## Data Reports

```bash
npx tsx scripts/generate-implementation-review.ts
```

This writes local review output under ignored report paths.

## Microcards

```bash
npm run generate:microcards
```

The default command writes local output. If you use an LLM API key, review the generated cards before committing any data changes.

## Curriculum Maintenance

See `scripts/curriculum/README.md` for parser and resource-maintenance scripts. These are optional tools for people who want to experiment with rebuilding or auditing `data/curriculum/`.

## Duplicate Folder Checks

```bash
npm run check:duplicate-folders
npm run clean:duplicate-folders
```

These keep accidental copied folders out of the data tree.

## Script Policy

- Prefer scripts that read checked-in data and write local ignored output.
- Keep scripts safe to run without production credentials.
- Do not add deployment scripts, incident tools, service-role database scripts, or private operational reports to the public archive.
