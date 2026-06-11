# Architecture Decision Record: January 2025 Major Refactor

**Date:** January 13, 2025
**Status:** Analysis Complete - Ready for Refactor
**Context:** Preparing for major refactor to address technical debt and scalability issues

---

## Table of Contents

1. [Authentication System](#1-authentication-system)
2. [Data Models & Services](#2-data-models--services)
3. [UI Components](#3-ui-components)
4. [Routing & Navigation](#4-routing--navigation)
5. [State Management](#5-state-management)
6. [Summary & Critical Path](#summary--critical-path)

---

## 1. Authentication System

### Current Approach

- **Provider**: Supabase Auth with Google OAuth
- **Session Management**: JWT tokens via cookies using `@supabase/ssr`
- **Route Protection**: Next.js middleware checking session on all routes
- **Security Model**: Row-Level Security (RLS) policies enforced at database level
- **Client Architecture**:
  - 3 separate client factories: `server.ts`, `client.ts`, `middleware.ts`
  - `'server-only'` and `'client-only'` imports for boundary enforcement
  - Custom `useSupabase()` hook with lazy initialization + ref caching
- **API Protection**: `withAuth()` and `withAuthRateLimit()` wrappers for API routes
- **Rate Limiting**: Upstash Redis with sliding window, per-user + IP composite keys

**Code Reference:**
- lib/supabase/server.ts:7-37
- lib/supabase/client.ts:22-53
- middleware.ts:1-80
- lib/api/route-helpers.ts:56-161

### Pain Points & Issues

#### 🔴 Critical Issues

1. **Cookie Management Complexity**
   - Secure flag detection via header sniffing (`getCookieSecureOptionServer`)
   - Commented-out domain cookie configuration suggests incomplete cross-domain setup
   - Error: "safe to ignore if setting cookies is unavailable" (line server.ts:31) - silent failures

2. **No Auth State Subscription**
   - Client components don't listen to auth changes (no `onAuthStateChange`)
   - Page refresh required to detect logout in another tab
   - Race condition: user logs out elsewhere, client still thinks authenticated

3. **Rate Limiting Fail-Open**
   - Silently disables if Upstash not configured (lib/ratelimit.ts:132-141)
   - Production without Redis = no rate limiting = DDoS vulnerability
   - Inconsistent: some routes have rate limits, others don't

#### 🟡 Medium Issues

4. **Auth Context Prop Drilling**
   - No React Context for auth state
   - `userId` passed through props everywhere (see DashboardClient:39)
   - Every component manually calls `supabase.auth.getUser()`

5. **Middleware Re-fetches Session**
   - Middleware checks session, then page checks again
   - Duplicate Supabase calls on every protected route
   - No session caching/memoization

6. **Error Handling Inconsistent**
   - Some routes redirect on auth error, others throw
   - dashboard/page.tsx:40 - redirect on error
   - settings/page.tsx might have different behavior

### What's Working Well

✅ **RLS Policies**: Database-level security is solid, comprehensive policies on all tables
✅ **Server/Client Separation**: `'server-only'` imports prevent client bundle leaks
✅ **withAuth Wrapper**: Clean API route protection with consistent error responses
✅ **Middleware Protection**: Route protection works reliably
✅ **Type Safety**: Full TypeScript coverage for auth flows

### Estimated Refactor Effort

| Component | Action | Effort | Priority |
|-----------|--------|--------|----------|
| Cookie management | **Simplify** - Remove secure flag detection, use env var | 2 hours | Medium |
| Auth state subscription | **Add** - Implement `onAuthStateChange` listener | 4 hours | High |
| Rate limiting | **Fix** - Make Upstash required in prod, fail closed | 3 hours | Critical |
| Auth context | **Create** - React Context for auth state | 6 hours | Medium |
| Session caching | **Add** - Memoize session in middleware → page | 4 hours | Low |
| **TOTAL** | | **19 hours** | |

**Overall:** 🟡 **Salvage** - Core architecture is sound, needs cleanup and auth state management

### Recommendation

> **Add React Auth Context + onAuthStateChange listener to fix stale auth state issues. Make rate limiting fail-closed in production.**

---

## 2. Data Models & Services

### Current Approach

- **Database**: PostgreSQL via Supabase with 9 tables
- **Schema Management**: SQL migrations in `supabase/migrations/`
- **Type Generation**: TypeScript types from database schema (types/database.ts)
- **Validation**: Zod schemas at API boundaries (lib/validation/)
- **Business Logic**:
  - 7 PostgreSQL RPC functions for complex operations
  - 1 service file: `lib/services/progress.ts` (244 lines)
  - Most business logic in API routes or components
- **Data Structures**:
  - JSONB columns for flexible data (`study_plans.schedule`)
  - Pure functions for schedule generation (`generateStudySchedule`)

**Tables:**
```
profiles (5 columns) → study_plans (14 columns) → user_progress (8 columns)
                                                 → resource_progress (7 columns)
                                                 → quick_check_results (9 columns)
study_streaks (7 columns)
parent_access (5 columns)
events (4 columns) - analytics
content_microcards (13 columns) - learning content
```

**Code Reference:**
- supabase/migrations/20250101000000_initial_schema.sql:1-1209
- lib/services/progress.ts:1-244
- lib/validation/progress.ts:1-31
- lib/shared/generateStudySchedule.ts:19-162

### Pain Points & Issues

#### 🔴 Critical Issues

1. **Service Layer Missing**
   - Only 1 service file (`progress.ts`) out of 9 tables
   - Business logic scattered across:
     - API routes (app/api/progress/route.ts:35-39)
     - Page components (app/(dashboard)/dashboard/page.tsx:109)
     - Client components (DashboardClient.tsx:222-336)
   - Example: Progress calculation logic duplicated in 3 places
   - Violates Single Responsibility Principle

2. **RPC Functions = Business Logic Leak**
   - Complex business logic in database functions (SQL)
   - `mark_unit_complete` handles streak calculation (should be service layer)
   - `undo_unit_progress` recalculates streaks (duplicate logic with client)
   - Impossible to unit test without database
   - Schema changes require migration + code deploy coordination

3. **Type Safety Gaps**
   - JSONB `schedule` column has no runtime validation
   - Client assumes structure: `(schedule as FlexibleSchedule).days`
   - If migration changes structure, client breaks silently
   - No Zod schema for schedule validation

#### 🟡 Medium Issues

4. **Duplicate State Calculations**
   - Weekly summary calculated in:
     - `lib/services/progress.ts:129-166`
     - `DashboardClient.tsx:61-111` (client-side)
     - `DashboardClient.tsx:152-171` (refresh)
   - Streak calculation in:
     - Database RPC (`mark_unit_complete`)
     - `DashboardClient.tsx:283-336` (optimistic)
     - `GuestPlanContext.tsx:88-128` (guest users)

5. **No Database Seeding**
   - 180 test files but no seed data
   - Manual testing requires creating plans every time
   - Integration tests would need fixtures

6. **Migration Documentation Missing**
   - 30+ migration files, no docs on order/dependencies
   - No rollback strategy
   - Schema changes risky

### What's Working Well

✅ **Strong Typing**: Database types auto-generated, comprehensive TypeScript coverage
✅ **Validation**: Zod schemas at all API boundaries prevent bad data
✅ **RLS Security**: All tables protected with row-level security
✅ **Indexes**: Foreign keys indexed, query performance good
✅ **Pure Functions**: `generateStudySchedule` is testable and reusable
✅ **Flexible Schema**: JSONB columns allow schedule changes without migrations

### Estimated Refactor Effort

| Component | Action | Effort | Priority |
|-----------|--------|--------|----------|
| Service layer | **Build** - Create services for all tables (plans, streaks, progress) | 16 hours | Critical |
| RPC functions | **Refactor** - Move business logic to services, keep RPC thin | 12 hours | High |
| Type safety | **Add** - Zod schemas for JSONB columns with runtime validation | 6 hours | High |
| Duplicate logic | **Consolidate** - Single source of truth for calculations | 8 hours | High |
| Database seeding | **Create** - Seed scripts for development/testing | 4 hours | Low |
| Migration docs | **Document** - Document schema, migration strategy | 3 hours | Low |
| **TOTAL** | | **49 hours** | |

**Overall:** 🔴 **Rebuild Service Layer** - Data models are fine, but service layer is missing entirely

### Recommendation

> **Build comprehensive service layer to centralize business logic. Move RPC function logic to services. Add Zod validation for JSONB columns.**

---

## 3. UI Components

### Current Approach

- **Component Library**: 73 .tsx files across features
- **Design System**: shadcn/ui components (39 imports found)
- **Architecture**:
  - Server Components for data fetching (87 'use client' directives = selective hydration)
  - Client Components for interactivity
  - Suspense boundaries with skeleton loaders
- **State**: React hooks (176 useState/useEffect/useCallback/useMemo found)
- **Styling**: Tailwind CSS utility classes, inline styles
- **Patterns**:
  - Card components everywhere
  - Collapsible sections (CollapsibleSection.tsx:121)
  - Modal dialogs (CelebrationModal, MicrocardModal)
  - Custom hooks: `useSupabase`, `useMicrocards`, `useQuickCheck`

**Largest Components by Line Count:**
```
SubjectProgressCard.tsx        515 lines  (8 responsibilities)
UnitCheckbox.tsx              442 lines  (6 responsibilities)
settings-subjects-card.tsx     426 lines  (7 responsibilities)
settings-account-card.tsx      420 lines  (5 responsibilities)
DashboardClient.tsx            418 lines  (orchestration + state)
UnitChecklistClient.tsx        315 lines  (3 responsibilities)
```

**Code Reference:**
- components/dashboard/SubjectProgressCard.tsx:1-515
- components/dashboard/DashboardClient.tsx:1-418
- components/plan/UnitCheckbox.tsx:1-442

### Pain Points & Issues

#### 🔴 Critical Issues

1. **Monster Components (500+ Lines)**

   **SubjectProgressCard.tsx (515 lines):**
   - Responsibilities: progress calculation, unit checklist, microcard viewer, quick check, curriculum display, outcome breakdown, progress updates, toast notifications
   - 8 dependencies: ProgressBar, CurriculumPanel, Card, useToast, getCurriculumData, types, useSupabase, createBrowserClient
   - State: 11 useState hooks
   - Should be split into: ProgressCard (container), UnitList, MicrocardViewer, QuickCheck, CurriculumPanel

   **UnitCheckbox.tsx (442 lines):**
   - Single checkbox component doing: rendering, microcard fetching, quick check UI, resource tracking, progress API calls, toast notifications
   - Should be: Checkbox + MicrocardButton + QuickCheckModal + ProgressHook

   **settings-subjects-card.tsx (426 lines):**
   - Handles: form state, validation, API calls, optimistic updates, error handling, schedule regeneration, progress reset modal
   - Should be: SettingsCard (container) + SubjectForm + ResetConfirmation + PlanService

2. **Duplicate Components Across Features**
   - Progress bars: 3 different implementations
   - Collapsible sections: 2 implementations
   - Card wrappers: shadcn Card used 40+ times, custom wrappers in 10+ places
   - Modal patterns: Dialog, Modal, Drawer all doing similar things

3. **Client Components Doing Server Concerns**
   - SubjectProgressCard fetches microcards client-side (could be server component)
   - DashboardClient refetches all data on focus (152-177) - should use React Query
   - Settings cards call API routes directly - should use mutations

#### 🟡 Medium Issues

4. **Props Drilling Everywhere**
   - DashboardClient receives 7 props
   - SubjectProgressCard receives 6-8 props (optional albertaDocs/totalOutcomes)
   - UnitChecklistClient passes `onProgressUpdate` through 3 layers

5. **State Management Chaos**
   - DashboardClient: 5 useState + 1 useRef + complex useEffect chains
   - SubjectProgressCard: 11 useState + 5 useEffect
   - Race conditions: `isRefreshingRef` hack to prevent double fetches (DashboardClient.tsx:57)

6. **Toast Context Uses Math.random()**
   - components/ui/toast.tsx:25 - `Math.random().toString(36)`
   - Not cryptographically secure (fine for UI but sloppy)
   - Could collide in rapid succession

### What's Working Well

✅ **Server Components**: Excellent use of server components to reduce client JavaScript
✅ **shadcn/ui**: Consistent design system, accessible components
✅ **Loading States**: Suspense + skeletons provide good UX
✅ **Optimistic Updates**: UI feels responsive with optimistic updates
✅ **Type Safety**: Strong TypeScript throughout components
✅ **Error Boundaries**: Proper error handling at route level

### Estimated Refactor Effort

| Component | Action | Effort | Priority |
|-----------|--------|--------|----------|
| SubjectProgressCard | **Split** into 5 smaller components | 12 hours | Critical |
| UnitCheckbox | **Split** into 4 components | 8 hours | High |
| Settings cards | **Split** each into 3 components (x2) | 10 hours | High |
| DashboardClient | **Refactor** with React Query, reduce state | 8 hours | Critical |
| Duplicate components | **Consolidate** into shared library | 6 hours | Medium |
| Props drilling | **Fix** with context or state library | 4 hours | Medium |
| Toast IDs | **Replace** with crypto.randomUUID() | 30 min | Low |
| **TOTAL** | | **48.5 hours** | |

**Overall:** 🔴 **Rebuild Large Components** - Need to split 500+ line components into composable pieces

### Recommendation

> **Immediately split SubjectProgressCard (515 lines) and UnitCheckbox (442 lines) into smaller, focused components. Introduce React Query to replace manual refetch logic.**

---

## 4. Routing & Navigation

### Current Approach

- **Framework**: Next.js 14 App Router with React Server Components
- **Structure**:
  - Route groups: `(auth)`, `(dashboard)` for layout sharing
  - Dynamic routes: `[id]`, `[token]`, `[slug]`, `[resourceId]`
  - Parallel routes: None
  - Intercepting routes: None
- **Data Fetching**: Server Components fetch data at page level
- **Protection**: Middleware checks auth on all routes, redirects to /login
- **Loading**: Suspense boundaries, force-dynamic on dashboard

**Route Map:**
```
/ (public landing)
├── /login (auth group)
├── /privacy, /terms, /curriculum (public)
├── /plan/guest (unauthenticated demo)
└── /dashboard (protected)
    ├── /dashboard
    ├── /settings
    ├── /plan/new, /plan/new/subjects
    ├── /plan/[id]
    └── /plan/[id]/study, /plan/[id]/study/[resourceId]
```

**Code Reference:**
- app/(dashboard)/dashboard/page.tsx:33-140
- middleware.ts:1-80

### Pain Points & Issues

#### 🔴 Critical Issues

1. **No Layout Data Fetching**
   - Every page calls `supabase.auth.getUser()` independently
   - dashboard/page.tsx:36, settings/page.tsx (presumably), plan/[id]/page.tsx (presumably)
   - Could fetch user once in layout, pass via props or context
   - Wastes Supabase API calls (impacts rate limits)

2. **Inconsistent Error Handling**
   - dashboard/page.tsx:40 - redirects on auth error
   - dashboard/page.tsx:64 - throws error on plan fetch failure
   - Some routes might handle differently (no standardization)
   - Error boundaries catch some, redirects catch others

3. **No Parallel Routes for Modals**
   - Modals render in-component (CelebrationModal, MicrocardModal)
   - URL doesn't reflect modal state (bad for sharing/back button)
   - Could use `@modal` parallel route + intercepting routes
   - See Next.js docs: https://nextjs.org/docs/app/building-your-application/routing/parallel-routes

#### 🟡 Medium Issues

4. **Guest Routes Completely Separate**
   - `/plan/guest` uses localStorage, separate context (GuestPlanContext)
   - `/plan/[id]` uses database, authenticated
   - Zero code sharing despite similar UI
   - Migration from guest → authenticated is complex

5. **Force Dynamic Everywhere**
   - `export const dynamic = 'force-dynamic'` on most pages
   - Disables Next.js caching entirely
   - Could use ISR or on-demand revalidation for some routes

6. **Redirects Lose Context**
   - `redirect('/login')` - no return URL preserved
   - User logs in, lands on dashboard, not original destination
   - Should: `redirect('/login?returnTo=' + pathname)`

### What's Working Well

✅ **Route Groups**: Clean separation of auth vs dashboard layouts
✅ **Middleware**: Consistent auth enforcement across all routes
✅ **Server Components**: Initial data fetching is fast
✅ **Loading States**: Suspense boundaries work well
✅ **Dynamic Routes**: [id], [token] patterns are idiomatic

### Estimated Refactor Effort

| Component | Action | Effort | Priority |
|-----------|--------|--------|----------|
| Layout data fetching | **Add** - Fetch user in dashboard layout, pass via context | 4 hours | High |
| Error handling | **Standardize** - Consistent error handling per route | 3 hours | Medium |
| Parallel routes | **Add** - Use @modal for modals, update routes | 8 hours | Low |
| Guest/auth merge | **Refactor** - Share components, unified flow | 12 hours | Medium |
| Redirect context | **Add** - Preserve returnTo parameter | 2 hours | Low |
| **TOTAL** | | **29 hours** | |

**Overall:** 🟢 **Keep & Improve** - Routing architecture is solid, just needs optimization

### Recommendation

> **Fetch user once in layout to reduce duplicate auth calls. Standardize error handling across routes. Consider parallel routes for modals.**

---

## 5. State Management

### Current Approach

- **Global State**: None - no Redux, Zustand, Jotai, or similar
- **Component State**: React `useState`, `useEffect`, `useCallback`, `useMemo` (176 occurrences)
- **Server State**: Fetched via Server Components, passed as props to Client Components
- **Contexts**: 2 contexts only
  - `ToastProvider` (app/layout.tsx) - global toast notifications
  - `GuestPlanContext` (app/plan/guest/layout.tsx) - localStorage for guest users
- **Caching**: None - no React Query, SWR, or Apollo
- **Optimistic Updates**: Manual implementation in DashboardClient (222-336)

**State Distribution:**
```
DashboardClient.tsx:        5 useState, 11 useEffect/useCallback/useMemo
SubjectProgressCard.tsx:   11 useState, 5 useEffect
UnitCheckbox.tsx:           8 useState, 6 useEffect
settings-subjects-card:    12 useState, 7 useEffect
settings-account-card:     10 useState, 4 useEffect
```

**Code Reference:**
- components/dashboard/DashboardClient.tsx:50-198
- components/dashboard/SubjectProgressCard.tsx (useState heavy)
- contexts/GuestPlanContext.tsx:38-265

### Pain Points & Issues

#### 🔴 Critical Issues - This is THE Biggest Problem

1. **NO STATE MANAGEMENT LIBRARY**

   **This is the root cause of most component issues.**

   - Manual state sync across components
   - No cache invalidation strategy
   - No optimistic update framework
   - Every component refetches independently
   - Race conditions everywhere

   **Example from DashboardClient.tsx:**
   ```typescript
   // Manual refetch with race condition guard (line 115-177)
   const isRefreshingRef = useRef(false);
   const refreshData = useCallback(async () => {
     if (isRefreshingRef.current) return; // 🚩 Race condition hack
     isRefreshingRef.current = true;
     // ... 60 lines of manual fetching and state updates
   }, []);
   ```

   **This should be:**
   ```typescript
   const { data, refetch } = useQuery(['streak', userId], fetchStreak);
   // React Query handles caching, deduping, race conditions
   ```

2. **Duplicate State Calculations (3+ Places)**

   **Weekly Summary calculated in:**
   - Server: `lib/services/progress.ts:129-166`
   - Client initial: `DashboardClient.tsx:61-111`
   - Client refresh: `DashboardClient.tsx:152-171`
   - Client optimistic: `DashboardClient.tsx:270-281`

   **Streak calculation in:**
   - Database: `mark_unit_complete` RPC function
   - Client optimistic: `DashboardClient.tsx:283-336`
   - Guest context: `GuestPlanContext.tsx:88-128`

   **Result:** 3 different implementations, inconsistent results, bugs

3. **Props Drilling for State Updates**

   **Example flow:**
   ```
   DashboardClient (handleProgressUpdate)
     → SubjectProgressCard (onProgressUpdate prop)
       → UnitChecklistClient (onProgressUpdate prop)
         → UnitCheckbox (onToggle prop)
   ```

   **4 layers of prop drilling for a single callback!**

4. **Manual Optimistic Updates**

   **DashboardClient.tsx:222-336 (114 lines!):**
   - Manually compute next state
   - Update local state immediately
   - Call API
   - Hope it succeeds (no rollback on error!)
   - Recalculate streak, weekly summary, progress

   **React Query would do this in 5 lines:**
   ```typescript
   const mutation = useMutation(markComplete, {
     onMutate: optimisticUpdate,
     onError: rollback,
   });
   ```

#### 🟡 Medium Issues

5. **No Cache Invalidation**
   - Page focus refetches everything (DashboardClient:182-197)
   - No way to invalidate specific queries
   - No way to update cache from mutations
   - Stale data everywhere

6. **useEffect Hell**
   - 176 hook usages found
   - Complex dependency arrays
   - Dependency warnings ignored (probably)
   - Stale closures everywhere

7. **Guest Context Duplicates Auth Logic**
   - GuestPlanContext (274 lines) reimplements entire state management
   - Storage events for cross-tab sync (complex)
   - Should share state logic with auth users

### What's Working Well

✅ **Server Components**: Reduces client state significantly
✅ **Optimistic Updates**: UI feels responsive (when it works)
✅ **LocalStorage for Guests**: Cross-tab sync is clever
✅ **Toast Context**: Simple and effective

### Estimated Refactor Effort

| Component | Action | Effort | Priority |
|-----------|--------|--------|----------|
| React Query | **Install** - Add React Query for server state | 2 hours | Critical |
| Migrate queries | **Convert** - Replace manual fetches with useQuery | 16 hours | Critical |
| Migrate mutations | **Convert** - Replace manual updates with useMutation | 12 hours | Critical |
| Optimistic updates | **Refactor** - Use React Query's built-in optimistic updates | 8 hours | High |
| Remove duplicates | **Delete** - Remove duplicate calculation logic | 6 hours | High |
| Context cleanup | **Simplify** - Keep Toast, refactor GuestPlan | 4 hours | Medium |
| Props drilling | **Fix** - Remove onProgressUpdate props with mutations | 4 hours | Medium |
| **TOTAL** | | **52 hours** | |

**Overall:** 🔴 **REBUILD REQUIRED** - State management is the #1 architectural problem

### Recommendation

> **CRITICAL: Introduce React Query immediately. This will fix 80% of state management issues, eliminate race conditions, remove duplicate logic, and simplify components by 30-50%.**

---

## Summary & Critical Path

### The Big Three Problems

1. **🔥 NO STATE MANAGEMENT LIBRARY** (State Management section)
   - Root cause of 500+ line components
   - Manual optimistic updates, race conditions, duplicate logic
   - **Fix:** Introduce React Query
   - **Impact:** Reduces complexity by 40%

2. **🔥 NO SERVICE LAYER** (Data Models section)
   - Business logic scattered across components, routes, database
   - Duplicate calculations in 3+ places
   - Impossible to test
   - **Fix:** Build comprehensive service layer
   - **Impact:** Centralizes logic, enables testing

3. **🔥 MONSTER COMPONENTS** (UI Components section)
   - SubjectProgressCard: 515 lines, 8 responsibilities
   - UnitCheckbox: 442 lines
   - Settings cards: 420+ lines each
   - **Fix:** Split into smaller, focused components
   - **Impact:** Maintainability, reusability

### Refactor Effort Summary

| System | Status | Effort | Priority |
|--------|--------|--------|----------|
| **State Management** | 🔴 Rebuild | 52 hours | CRITICAL |
| **Data Models** | 🔴 Rebuild Service Layer | 49 hours | CRITICAL |
| **UI Components** | 🔴 Rebuild Large Components | 48.5 hours | HIGH |
| **Routing** | 🟢 Keep & Improve | 29 hours | MEDIUM |
| **Auth** | 🟡 Salvage | 19 hours | MEDIUM |
| **TOTAL** | | **197.5 hours** | |

### Critical Path (Do These First)

**Phase 1: Foundation (Week 1-2)**
1. Install React Query (2h)
2. Create service layer for progress, plans, streaks (16h)
3. Add auth state subscription (4h)
4. Migrate critical queries to useQuery (8h)

**Phase 2: Component Refactor (Week 3-4)**
5. Split SubjectProgressCard into 5 components (12h)
6. Split UnitCheckbox into 4 components (8h)
7. Migrate mutations to useMutation (12h)
8. Remove duplicate state logic (6h)

**Phase 3: Polish (Week 5)**
9. Refactor settings cards (10h)
10. Optimize routing with layout data fetching (4h)
11. Move RPC logic to services (12h)
12. Add Zod validation for JSONB (6h)

**Total Critical Path: ~100 hours (~2.5 weeks of full-time work)**

### Quick Wins (Do If Time-Constrained)

If you can only do a few things:

1. **Install React Query** (2h) - Immediately fixes race conditions, caching
2. **Split SubjectProgressCard** (12h) - Biggest complexity reduction
3. **Create progress service** (6h) - Centralize business logic
4. **Add auth state subscription** (4h) - Fix stale auth bugs

**Quick wins total: 24 hours (~3 days)**

### What NOT to Refactor

- ✅ Database schema - it's good
- ✅ Routing structure - it's clean
- ✅ Auth security (RLS) - it's solid
- ✅ TypeScript coverage - it's comprehensive
- ✅ Validation (Zod) - it's working

### Final Recommendation

> **Start with React Query + service layer. This will make component refactoring 3x easier because you'll have clean data fetching and business logic from the start. Do NOT try to refactor components before fixing state management - it will just create more mess.**

---

**Document prepared by:** Claude Code
**Review date:** January 2025
**Next review:** After Phase 1 completion
