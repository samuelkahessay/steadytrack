# Architecture

SteadyTrack is a local-first Next.js archive. The goal is to let a reader run the product from a fresh clone and inspect the main design choices without provisioning any external service.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Radix UI primitives
- better-sqlite3 for local server-side content storage
- Vitest and Playwright for tests

## Data Ownership

User-created study data stays in the browser:

- study plans
- completed units
- streaks
- settings
- quick-check state
- activity history

Content data ships with the repo:

- curriculum JSON lives in `data/curriculum/`
- demo microcards live in `data/demo-microcards.json`
- the local SQLite database is created at `.local/steadytrack.sqlite`

## Runtime Flow

```text
Student action -> lib/storage/* -> browser localStorage -> UI update
Content request -> app/api/* -> lib/local-db/server.ts -> local SQLite
First local DB run -> seed from data/demo-microcards.json
```

No authentication is required. API routes are used for local content and contribution forms, not for storing private student progress.

## Important Directories

- `app/` - App Router pages and route handlers
- `components/dashboard/` - progress dashboard UI
- `components/plan/` - plan details, units, outcomes, and resources
- `components/curriculum/` - curriculum browser UI
- `components/microcards/` - quick-check card UI
- `lib/storage/` - SSR-safe browser storage wrappers
- `lib/local-db/` - local SQLite adapter
- `lib/content/` - small client/server facade over the local content adapter
- `lib/shared/planGenerator.ts` - study-plan generation logic
- `data/curriculum/` - public curriculum data used by the app
- `scripts/` - optional local data inspection and maintenance tools

## Local Storage Pattern

All direct browser storage access should go through `lib/storage/local.ts`. The wrapper handles SSR guards, JSON parsing, and fallback values.

Storage keys are namespaced with `steadytrack:`. Examples:

```text
steadytrack:plan:current
steadytrack:plan:history
steadytrack:progress:{planId}
steadytrack:streak
steadytrack:activity
steadytrack:preferences
```

## Local Content Adapter

`lib/local-db/server.ts` creates the SQLite schema on demand and exposes a small query interface that matches the content calls used by the app. This keeps route handlers simple while making the archive runnable without cloud data.

The browser facade in `lib/content/client.ts` uses checked-in demo cards for client-side microcard lookups.

## What To Preserve

When extending the archive:

- keep the default path runnable without credentials
- keep docs aligned with the local snapshot, not an old production service
- prefer local fixtures for examples and tests
- avoid adding deployment runbooks or private operational process notes
