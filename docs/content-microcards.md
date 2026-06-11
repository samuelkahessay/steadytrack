# Content Microcards

Microcards are short study cards attached to curriculum outcomes. They power the infinite learning mode and the quick-check UI.

## Local Data

The public archive uses checked-in seed data:

- source file: `data/demo-microcards.json`
- local database: `.local/steadytrack.sqlite`
- server adapter: `lib/local-db/server.ts`

The SQLite database is created and seeded automatically on first run.

## Card Shape

Each card includes:

- `id`
- `subject`
- `unit_id`
- `outcome_code`
- `summary`
- `steps`
- `pitfall`
- `quick_check`
- `recommended_resource_url`
- `sources`
- `quality_score`
- `status`

`quick_check` contains a question, answer choices, the correct answer, and an explanation.

## API Usage

- `GET /api/microcards?subjects=Math%2030-1`
- `GET /api/infinite-feed/cards?subjects=Math%2030-1&limit=20`

Both routes use the local content adapter by default.

## Generating More Cards

```bash
npm run generate:microcards
```

The default script path writes local output. If you use an LLM API key, keep generated cards paraphrased, review them manually, and only commit cards that are suitable for a public learning archive.
