# SteadyTrack API Service Layer

This directory contains the client-side API service layer for SteadyTrack. All client-side API interactions should go through these functions to ensure consistent error handling, type safety, and maintainability.

## Structure

```
/lib/api/
  index.ts              # Central export point - import from here
  analytics.ts          # Client-side event tracking
  sharing.ts            # Share link verification and progress (server-safe)
  sharing-client.ts     # Share link creation (client-only)
  route-helpers.ts      # Server-side auth/rate-limit wrappers for API routes
  README.md             # This file
```

## Important Note: Direct API Usage

**Most of the app makes direct fetch() calls to `/api/*` endpoints** rather than using client wrappers. This follows Next.js 15 best practices:

- ✅ **Server Components** → Query Supabase inline
- ✅ **API Routes** → Query Supabase inline
- ✅ **Client Components** → Use `fetch()` to call `/api/*` endpoints

The modules in this directory provide **specialized helpers** for:
1. **Analytics** - Client-side event tracking with sendBeacon support
2. **Sharing** - Server-side share link verification and progress fetching
3. **Route Helpers** - Auth/rate-limit wrappers for API route handlers

---

## Module Overview

### `analytics.ts` (Client-side)

Client-side analytics tracking with unload-sensitive event support.

**Exports:**
- `trackEvent(eventName, eventData?)` - Track single event
- `trackEvents(events[])` - Batch track events
- `EVENT_NAMES` - Typed event name constants
- `EventName` type - Type-safe event names

**Usage:**
```typescript
'use client';

import { trackEvent, EVENT_NAMES } from '@/lib/api/analytics';

// Track user action
await trackEvent(EVENT_NAMES.ARTICLE_OPENED, {
  url: 'https://example.com',
  unitId: 'math_unit_1'
});
```

**Features:**
- Uses `navigator.sendBeacon` for unload-sensitive events (article opens, resource completion)
- Automatically captures user ID from auth context
- Fails silently to avoid disrupting UX

---

### `sharing.ts` (Server-side)

Server-safe share link management and progress fetching.

**Exports:**
- `verifyShareToken(token)` - Validate share token and return student ID
- `deactivateShareLink(studentId)` - Revoke share link
- `getProgressByToken(token)` - Fetch comprehensive progress data

**Usage:**
```typescript
// Server Component or API Route
import { getProgressByToken } from '@/lib/api/sharing';

const { data, error } = await getProgressByToken(token);
if (data) {
  console.log(data.progress.overall); // 75%
  console.log(data.streak.current_streak); // 5 days
  console.log(data.weeklySummary.activityDates); // ['2025-01-06', '2025-01-07', ...]
}
```

**Returns:**
- `studentId` - Student user ID
- `progress` - Overall % and by-subject breakdown
- `streak` - Current streak data
- `weeklySummary` - Last 7 days activity

---

### `sharing-client.ts` (Client-side)

Client-safe share link creation.

**Exports:**
- `createShareLink()` - Generate new share link

**Usage:**
```typescript
'use client';

import { createShareLink } from '@/lib/api/sharing-client';

const { data, error } = await createShareLink();
if (data) {
  console.log(data.token); // '64-char hex string'
  console.log(data.url); // Full shareable URL
}
```

---

### `route-helpers.ts` (Server-side)

Authentication and rate limiting wrappers for API route handlers.

**Exports:**
- `withAuth(handler)` - Wrap handler with auth check
- `withAuthRateLimit(config, handler)` - Auth + rate limiting combined
- `withApiHandler(name, handler)` - Consistent error handling
- `getUserIdFromRequest(request)` - Extract user ID helper
- `RateLimitPresets` - Pre-configured rate limit settings

**Usage:**
```typescript
// app/api/example/route.ts
import { withAuthRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { NextResponse } from 'next/server';

export const POST = withAuthRateLimit(
  RateLimitPresets.PERMISSIVE,
  async (request, { supabase, userId }) => {
    // User is authenticated, rate limited, and you have:
    // - supabase: Authenticated Supabase client
    // - userId: User's ID string

    const body = await request.json();

    const { data, error } = await supabase
      .from('table')
      .insert({ user_id: userId, ...body });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  }
);
```

**Rate Limit Presets:**
- `STRICT`: 3 req/hour - Sensitive operations (account deletion, token generation)
- `MODERATE`: 10 req/hour - Heavy mutations (plan creation)
- `PERMISSIVE`: 100 req/min - Frequent operations (progress updates)
- `BULK`: 20 req/min - Bulk operations

---

## Central Export (`index.ts`)

Import from the central entry point for convenience:

```typescript
import {
  // Analytics
  trackEvent,
  EVENT_NAMES,

  // Sharing
  createShareLink,
  getProgressByToken,

  // Types
  type StudyPlan,
  type StudyStreak,
} from '@/lib/api';
```

---

## Error Handling

All API functions follow a consistent error handling pattern:

```typescript
{ data: T | null, error: string | null }
```

- On success: `{ data: <result>, error: null }`
- On failure: `{ data: null, error: <message> }`

**Example:**

```typescript
const result = await createShareLink();
if (result.error) {
  // Handle error
  showToast(result.error, 'error');
} else {
  // Handle success
  console.log('Share link:', result.data.url);
}
```

---

## Related Directories

### `/lib/services/`
Server-side business logic services:
- `progress.ts` - Progress calculation, weekly summaries, streak data

### `/lib/supabase/`
Supabase client creation:
- `client.ts` - Client Component access
- `server.ts` - Server Component/Route Handler access
- `middleware.ts` - Middleware-safe client
- `admin.ts` - Service role client (bypasses RLS)
- `cookies.ts` - Shared cookie security logic

### `/lib/analytics/`
Analytics event catalog:
- `events.ts` - Typed event names and categories

---

## Best Practices

1. **Client Components** → Use `fetch('/api/endpoint')` for mutations
2. **Server Components** → Query Supabase directly inline
3. **API Routes** → Use `withAuthRateLimit()` wrapper for protected endpoints
4. **Analytics** → Use `trackEvent()` from `@/lib/api/analytics`
5. **Errors** → Always check `error` field before using `data`
6. **Types** → Import types from `@/lib/api` or `@/lib/types`

---

## Migration Notes

### Terminology Changes
- **Parent Link** → **Share Link** (more inclusive)
- Route: `/api/parent-link` → `/api/share-link` (deprecated shim exists)
- Route: `/parent/[token]` → `/share/[token]`
- Functions: `verifyParentToken` → `verifyShareToken`
- Functions: `deactivateParentLink` → `deactivateShareLink`

### API Architecture
- Most data fetching happens inline in Server Components (Next.js 15 pattern)
- Client wrappers are minimal and focused on specific use cases
- API routes are the data layer for Client Components

---

## Questions?

See the main project documentation:
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Overall architecture
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development workflow
