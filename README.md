# SteadyTrack Archive

SteadyTrack was a local-first study tracker built during the Alberta teacher strike window to help high-school students keep momentum while classes were disrupted.

This public snapshot is archived. It is designed to run locally without Supabase, Vercel, or private credentials.

## Local Runtime

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The open-source version uses:

- localStorage for study plans, streaks, settings, and progress
- `.local/steadytrack.sqlite` for local content cards, feedback, and contributor-signup submissions
- checked-in curriculum JSON under `data/curriculum/`
- checked-in demo microcards under `data/demo-microcards.json`

On first run, the server creates `.local/steadytrack.sqlite` and seeds it from the demo microcard JSON. Delete that file and restart the dev server to rebuild the local database.

## What Was Live

The live version used:

- Next.js on Vercel
- Supabase for content tables and anonymous feedback/submission storage
- localStorage for student-owned study progress
- Sentry and Vercel Analytics for operational visibility

Those cloud services are not required for this archived snapshot. The local database exists so the product can be inspected, tested, and screenshotted without exposing production infrastructure.

## Repository Shape

- `app/` - Next.js App Router pages and API routes
- `components/` - UI, dashboard, plan, and landing components
- `lib/storage/` - localStorage adapters for progress and plans
- `lib/local-db/` - local SQLite adapter for the archived runtime
- `data/curriculum/` - final curriculum JSON used by the app
- `data/demo-microcards.json` - seed content for local learning cards
- `docs/` - historical architecture and planning notes

## Archive Status

Shipped during the 2025 Alberta teacher strike window. Public app retired; code released as an inspectable case-study artifact.
