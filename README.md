# SteadyTrack Archive

SteadyTrack is an archived local-first study tracker for Alberta high-school students. This public snapshot is meant to be downloaded, run locally, inspected, and reused as a learning project.

No hosted database, deployment account, analytics service, or private credential is required.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

On first run the server creates `.local/steadytrack.sqlite` and seeds it from `data/demo-microcards.json`. Delete that SQLite file and restart the dev server to rebuild the local content database.

## Useful Checks

```bash
npm test
npm run lint
npm run build
```

`npm run build` works without hosted-service credentials.

## How The Snapshot Works

- `app/` - Next.js App Router pages and API routes
- `components/` - landing, dashboard, study plan, curriculum, and microcard UI
- `lib/storage/` - browser `localStorage` adapters for plans, progress, streaks, settings, and activity
- `lib/local-db/` - local SQLite adapter used by server API routes
- `lib/content/` - small client/server facade over the local content adapter
- `data/curriculum/` - checked-in Alberta curriculum JSON
- `data/demo-microcards.json` - local seed cards for the learning mode
- `docs/` - concise architecture and data notes for learners

## Learn From It

This repo is useful if you want to study:

- a local-first product architecture in Next.js
- browser-owned progress state with SSR-safe storage wrappers
- a lightweight local database adapter that mimics a hosted content table
- curriculum data modeling for units, outcomes, resources, and study cards
- how to preserve a retired product as a runnable case study

The original live service is retired. This archive keeps the product inspectable without carrying private runbooks, production migrations, or cloud setup instructions.
