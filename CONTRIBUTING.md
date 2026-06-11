# Contributing

SteadyTrack is archived, so contributions should keep the project easy to run and learn from locally.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The default runtime uses browser `localStorage`, checked-in curriculum JSON, and a local SQLite database under `.local/`. Do not require contributors to create hosted service accounts for ordinary development.

## Before Opening A PR

Run the checks that match your change:

```bash
npm test
npm run lint
npm run build
```

For curriculum/data changes, also run the relevant script from `scripts/README.md`.

## Change Guidelines

- Keep user-owned study data local-first.
- Keep learner docs short, current, and runnable from a fresh clone.
- Prefer checked-in demo data or local fixtures over hosted services.
- Keep generated outputs out of git unless they are intentionally part of the public snapshot.
- Do not add production runbooks, private process notes, service-role instructions, incident notes, or deployment checklists.
- Do not commit secrets, tokens, downloaded PDFs, local databases, `.next/`, or report output.

## Commit Style

Use conventional commit messages when you commit your own work:

```text
feat: add local progress export
fix: handle empty study plan state
docs: simplify curriculum pipeline notes
test: cover streak rollover
```

## Project Areas

- `app/` and `components/` contain the Next.js UI.
- `lib/storage/` contains browser storage adapters.
- `lib/local-db/` contains the local SQLite content adapter.
- `data/curriculum/` contains public curriculum JSON.
- `data/demo-microcards.json` seeds local study cards.
- `scripts/` contains optional local inspection and data-maintenance tools.

## Documentation Policy

Documentation should help a new reader understand or run the public archive. If a note only explains an old launch plan, production migration, private operational process, or abandoned refactor, leave it out of the public repo.
