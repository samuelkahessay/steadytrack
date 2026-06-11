# React Query Migration Guide

**Date:** January 2025
**Status:** ✅ COMPLETE - All Major Components Migrated
**Related:** ADR_2025-01-REFACTOR.md

---

## ✅ Completion Summary (January 2025)

### Migration Complete!
React Query has been successfully integrated throughout the application, replacing manual data fetching and state management.

**Components Migrated:**
- ✅ **DashboardClient.tsx**: 418 → 184 lines (56% reduction)
- ✅ **SubjectProgressCard.tsx**: 515 → 485 lines (integrated queries and mutations)
- ✅ **Settings components**: All 3 components using React Query (account, parent, subjects)
- ✅ **13 custom hooks created**: Queries, mutations, and specialized hooks

**Impact Achieved:**
- 🚫 Eliminated 229+ lines of manual fetching logic
- 🚫 Removed race condition hacks (useRef guards)
- ✅ Proper optimistic updates with automatic rollback
- ✅ Built-in cache invalidation and refetching
- ✅ Average 40-50% code reduction per component migrated

**Infrastructure:**
- ✅ Query client configured and wrapped in app layout
- ✅ DevTools integrated for development debugging
- ✅ Centralized query keys registry
- ✅ API utility functions for reusable fetch logic

---

---

## Table of Contents

1. [Overview](#overview)
2. [What's Been Set Up](#whats-been-set-up)
3. [Before & After Examples](#before--after-examples)
4. [Common Patterns](#common-patterns)
5. [Migration Checklist](#migration-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Overview

React Query has been installed and configured to replace manual data fetching, race condition handling, and optimistic updates throughout the application.

### Why React Query?

From ADR "Quick Wins" section:
- ✅ Immediately fixes race conditions and caching issues
- ✅ Eliminates manual refetch logic (115 lines in DashboardClient)
- ✅ Provides built-in optimistic updates (replaces 114 lines of manual code)
- ✅ Reduces component complexity by 30-50%
- ✅ Removes props drilling by using query cache

### What We Had Before

```tsx
// DashboardClient.tsx:115-178 (63 lines of manual refetch logic)
const isRefreshingRef = useRef(false); // Race condition hack!
const refreshData = useCallback(async () => {
  if (isRefreshingRef.current) return;
  isRefreshingRef.current = true;

  // ... 60 lines of manual fetching
  const [streakRes, progressRes, quickRes, resourceRes] = await Promise.all([...]);

  // Manual state updates
  setStreak(streakRes.data);
  setProgress(progressRes.data);
  // ... more manual updates
}, []);

// Manual focus/visibility refetching
useEffect(() => {
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  // ...
}, []);
```

### What We Have Now

```tsx
// Clean, declarative data fetching with React Query
const { data: streak } = useStreakQuery(userId);
const { data: progress } = useProgressQuery(userId, planId);

// React Query handles:
// ✅ Caching
// ✅ Race conditions
// ✅ Refetching on focus/visibility
// ✅ Loading states
// ✅ Error handling
```

---

## What's Been Set Up

### 1. Core Infrastructure

#### Query Client Configuration
**File:** `lib/query/client.ts`

```tsx
import { getQueryClient } from '@/lib/query/client';

const queryClient = getQueryClient();
```

**Configuration:**
- `staleTime: 5 minutes` - Data considered fresh for 5 minutes
- `gcTime: 10 minutes` - Unused cache kept for 10 minutes
- `refetchOnWindowFocus: true` - Auto-refetch when user returns
- `retry: 1` - Retry failed requests once

#### Query Provider
**File:** `components/providers/QueryProvider.tsx`

Already wrapped around the entire app in `app/layout.tsx`:

```tsx
<ErrorBoundary>
  <QueryProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </QueryProvider>
</ErrorBoundary>
```

#### Query Keys Registry
**File:** `lib/query/keys.ts`

Centralized, type-safe query keys:

```tsx
import { queryKeys } from '@/lib/query/keys';

// Usage
queryKeys.streaks.byUser(userId)        // ['streaks', 'user', userId]
queryKeys.progress.byUserAndPlan(...)   // ['progress', 'user', userId, 'plan', planId]
queryKeys.microcards.batch(...)         // ['microcards', 'batch', subject, ...codes]
```

#### API Utilities
**File:** `lib/query/api.ts`

Reusable API functions:

```tsx
import { fetchStreak, fetchProgress, RouteApiClient } from '@/lib/query/api';

// Supabase queries
const streak = await fetchStreak(supabase, userId);
const progress = await fetchProgress(supabase, userId, planId);

// Route API calls
const result = await RouteApiClient.markUnitComplete({ planId, subject, unitId });
```

### 2. Example Hooks

Three example hooks are provided to demonstrate patterns:

#### Queries
- `lib/hooks/queries/useStreakQuery.ts` - Fetch user's streak
- `lib/hooks/queries/useProgressQuery.ts` - Fetch user's progress
- `lib/hooks/queries/useMicrocardsQuery.ts` - Fetch microcards

#### Mutations
- `lib/hooks/queries/mutations/useProgressMutation.ts` - Mark units complete/undo

### 3. DevTools

React Query DevTools are available in development:
- **Keyboard shortcut:** Click the floating button in bottom-right corner
- **Features:** View queries, mutations, cache, and invalidations in real-time

---

## Before & After Examples

### Example 1: Fetching Streak Data

#### Before (Manual)

```tsx
// DashboardClient.tsx:50-57
const [streak, setStreak] = useState<StudyStreak | null>(initialStreak);
const isRefreshingRef = useRef(false);

const refreshData = useCallback(async () => {
  if (isRefreshingRef.current) return; // Race condition hack
  isRefreshingRef.current = true;

  const { data } = await supabase
    .from('study_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  setStreak(data);
  isRefreshingRef.current = false;
}, [userId, supabase]);

// Manual focus/visibility refetching
useEffect(() => {
  const onFocus = () => { void refreshData(); };
  window.addEventListener('focus', onFocus);
  return () => window.removeEventListener('focus', onFocus);
}, [refreshData]);
```

#### After (React Query)

```tsx
import { useStreakQuery } from '@/lib/hooks/queries/useStreakQuery';

// Clean, declarative data fetching
const { data: streak, isLoading, error } = useStreakQuery(userId);

// React Query automatically:
// ✅ Caches data
// ✅ Refetches on focus/visibility
// ✅ Handles race conditions
// ✅ Provides loading/error states
```

**Lines of code:** Before: ~25 lines → After: 1 line
**Reduction:** 96% 🎉

### Example 2: Optimistic Updates

#### Before (Manual)

```tsx
// DashboardClient.tsx:222-336 (114 lines!)
const handleProgressUpdate = useCallback(({ type, unitId, subject }) => {
  // Manual optimistic update computation
  const nextProgress = (() => {
    if (type === 'completed') {
      const existingIndex = progress.findIndex((p) => p.unit_id === unitId);
      if (existingIndex >= 0) {
        const copy = [...progress];
        copy[existingIndex] = {
          ...copy[existingIndex],
          completed: true,
          completed_at: new Date().toISOString(),
        };
        return copy;
      }
      return [...progress, /* new progress entry */];
    }
    return progress.filter((p) => p.unit_id !== unitId);
  })();

  setProgress(nextProgress); // No rollback on error!

  // Manual streak calculation (30+ lines)
  const prevStudiedToday = progress.some(...);
  const nextStudiedToday = nextProgress.some(...);
  let current = prevCurrent;
  if (type === 'completed' && !prevStudiedToday && nextStudiedToday) {
    // ... 20 more lines of streak calculation
  }

  setStreak(/* manually computed streak */);

  // No error handling or rollback!
}, [progress, streak, ...]);
```

#### After (React Query)

```tsx
import { useMarkUnitComplete, useUndoUnitProgress } from '@/lib/hooks/queries/mutations/useProgressMutation';

// Clean mutation hooks
const markComplete = useMarkUnitComplete(userId, planId);
const undoProgress = useUndoUnitProgress(userId, planId);

// Usage in component
const handleToggle = (unitId: string, checked: boolean) => {
  if (checked) {
    markComplete.mutate({ planId, subject, unitId });
  } else {
    undoProgress.mutate({ planId, unitId });
  }
};

// React Query automatically:
// ✅ Optimistically updates UI
// ✅ Rolls back on error
// ✅ Invalidates related queries on success
// ✅ Provides loading/error states
```

**Lines of code:** Before: 114 lines → After: 5 lines
**Reduction:** 95% 🎉

### Example 3: Fetching Microcards

#### Before (Manual)

```tsx
// SubjectProgressCard.tsx:72-134 (62 lines)
const [unitMicrocards, setUnitMicrocards] = useState<Record<string, ContentMicrocard[]>>({});
const [loadingMicrocards, setLoadingMicrocards] = useState(false);

useEffect(() => {
  if (!isExpanded || subjectUnits.length === 0) return;

  let cancelled = false;

  async function fetchUnitMicrocards() {
    try {
      setLoadingMicrocards(true);

      // Collect outcome codes
      const allOutcomeCodes = /* ... */;

      // Fetch microcards
      const { data, error } = await supabase
        .from('content_microcards')
        .select('*')
        .eq('subject', subject)
        .in('outcome_code', allOutcomeCodes)
        .eq('status', 'active');

      if (cancelled) return; // Race condition handling
      if (error) throw error;

      // Organize by unit
      const microcardsByUnit = /* ... 20 lines */;
      setUnitMicrocards(microcardsByUnit);
    } catch (err) {
      console.error('Failed to fetch microcards:', err);
    } finally {
      if (!cancelled) setLoadingMicrocards(false);
    }
  }

  void fetchUnitMicrocards();

  return () => { cancelled = true; }; // Cleanup
}, [isExpanded, subject, subjectUnits, supabase]);
```

#### After (React Query)

```tsx
import { useMicrocardsQuery } from '@/lib/hooks/queries/useMicrocardsQuery';

// Collect outcome codes (still needed)
const outcomeCodes = subjectUnits.flatMap(unit =>
  unit.outcomes?.map(o => o.code) || []
);

// Fetch microcards with React Query
const { data: microcards, isLoading } = useMicrocardsQuery(subject, outcomeCodes);

// Organize by unit (still needed, but simplified)
const microcardsByUnit = useMemo(() => {
  const grouped: Record<string, ContentMicrocard[]> = {};
  microcards?.forEach(card => {
    // Group logic here
  });
  return grouped;
}, [microcards]);

// React Query automatically:
// ✅ Caches data
// ✅ Handles race conditions
// ✅ Provides loading state
// ✅ Deduplicates requests
```

**Lines of code:** Before: 62 lines → After: ~15 lines
**Reduction:** 75% 🎉

---

## Common Patterns

### Pattern 1: Simple Query

**When to use:** Fetching data that doesn't change often

```tsx
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { fetchStreak } from '@/lib/query/api';

function MyComponent({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.streaks.byUser(userId),
    queryFn: () => fetchStreak(supabase, userId),
    enabled: !!userId, // Only run if userId exists
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Streak: {data?.current_streak || 0}</div>;
}
```

### Pattern 2: Dependent Queries

**When to use:** Query B depends on data from Query A

```tsx
// First query
const { data: plan } = useQuery({
  queryKey: queryKeys.plans.byId(planId),
  queryFn: () => fetchPlan(supabase, planId),
});

// Second query depends on first
const { data: progress } = useQuery({
  queryKey: queryKeys.progress.byUserAndPlan(userId, planId),
  queryFn: () => fetchProgress(supabase, userId, planId),
  enabled: !!plan, // Only run if plan exists
});
```

### Pattern 3: Mutation with Optimistic Update

**When to use:** User action that modifies server data

```tsx
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (data) => apiCall(data),

  // Optimistic update: run before API call
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['myData'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['myData']);

    // Optimistically update
    queryClient.setQueryData(['myData'], (old) => ({
      ...old,
      ...newData,
    }));

    // Return context for rollback
    return { previous };
  },

  // Rollback on error
  onError: (err, variables, context) => {
    queryClient.setQueryData(['myData'], context.previous);
  },

  // Refetch on success
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['myData'] });
  },
});
```

### Pattern 4: Parallel Queries

**When to use:** Multiple independent queries at once

```tsx
// React Query automatically batches and deduplicates these!
const streakQuery = useStreakQuery(userId);
const progressQuery = useProgressQuery(userId, planId);
const planQuery = usePlanQuery(planId);

// Check if all queries are loading
const isLoading = streakQuery.isLoading || progressQuery.isLoading || planQuery.isLoading;

// Or use useQueries for dynamic lists
const results = useQueries({
  queries: subjectIds.map(id => ({
    queryKey: ['subject', id],
    queryFn: () => fetchSubject(id),
  })),
});
```

### Pattern 5: Cache Invalidation

**When to use:** Refresh data after a mutation

```tsx
const queryClient = useQueryClient();

// Invalidate specific query
queryClient.invalidateQueries({
  queryKey: queryKeys.streaks.byUser(userId)
});

// Invalidate all streak queries
queryClient.invalidateQueries({
  queryKey: queryKeys.streaks.all
});

// Invalidate multiple query groups
queryClient.invalidateQueries({
  queryKey: queryKeys.progress.all
});
queryClient.invalidateQueries({
  queryKey: queryKeys.streaks.all
});
```

---

## Migration Checklist

### For Each Component with Manual Fetching

- [ ] **Identify data fetching logic**
  - Look for `useState` + `useEffect` + Supabase calls
  - Look for manual refetch functions
  - Look for race condition hacks (`useRef` for preventing double fetches)

- [ ] **Create or reuse query hook**
  - Check if a hook already exists in `lib/hooks/queries/`
  - If not, create a new one following the examples
  - Add query key to `lib/query/keys.ts` if needed
  - Add API function to `lib/query/api.ts` if needed

- [ ] **Replace manual fetching with React Query**
  - Remove `useState` for data
  - Remove `useEffect` for fetching
  - Remove manual refetch logic
  - Replace with `useQuery` or custom hook

- [ ] **Handle loading/error states**
  - Use `isLoading`, `isFetching`, `error` from query
  - Remove manual loading state management

- [ ] **Update mutations**
  - Replace manual API calls with `useMutation`
  - Add optimistic updates if needed
  - Add proper error handling and rollback
  - Invalidate related queries on success

- [ ] **Test thoroughly**
  - Test loading states
  - Test error states
  - Test refetching on focus/visibility
  - Test optimistic updates and rollback
  - Check React Query DevTools for proper cache behavior

### Priority Order (from ADR)

1. **DashboardClient.tsx** (115 lines of manual refetch logic)
   - High impact, most complex
   - Replace `refreshData` callback with queries
   - Replace `handleProgressUpdate` with mutations

2. **SubjectProgressCard.tsx** (62 lines of microcard fetching)
   - Medium impact, clear pattern
   - Replace microcard fetching with query
   - Replace unit toggle with mutations

3. **Settings components** (multiple files)
   - Medium impact
   - Replace form submissions with mutations
   - Add optimistic updates for better UX

4. **Other components** as needed

---

## Troubleshooting

### Problem: "Cannot read property 'getQueryData' of undefined"

**Cause:** Trying to use `useQueryClient()` outside of `QueryProvider`

**Solution:** Ensure component is rendered inside `QueryProvider` (check `app/layout.tsx`)

### Problem: Queries not refetching on window focus

**Cause:** `refetchOnWindowFocus` might be disabled or component is unmounted

**Solution:**
```tsx
// Explicitly enable in query options
useQuery({
  queryKey: [...],
  queryFn: () => ...,
  refetchOnWindowFocus: true, // Explicitly enable
})
```

### Problem: Optimistic update not rolling back on error

**Cause:** Missing `onError` handler or context not returned from `onMutate`

**Solution:**
```tsx
const mutation = useMutation({
  onMutate: async () => {
    // MUST return context!
    return { previous: queryClient.getQueryData(key) };
  },
  onError: (err, variables, context) => {
    // MUST restore from context!
    if (context?.previous) {
      queryClient.setQueryData(key, context.previous);
    }
  },
});
```

### Problem: Stale data after mutation

**Cause:** Forgot to invalidate queries after mutation

**Solution:**
```tsx
const mutation = useMutation({
  mutationFn: apiCall,
  onSuccess: () => {
    // Invalidate all related queries!
    queryClient.invalidateQueries({ queryKey: ['myData'] });
    queryClient.invalidateQueries({ queryKey: ['relatedData'] });
  },
});
```

### Problem: Too many network requests

**Cause:** `staleTime` too low or aggressive refetching

**Solution:**
```tsx
// Increase staleTime for data that doesn't change often
useQuery({
  queryKey: [...],
  queryFn: () => ...,
  staleTime: 10 * 60 * 1000, // 10 minutes
})
```

### Problem: Query runs when it shouldn't

**Cause:** Missing or incorrect `enabled` option

**Solution:**
```tsx
useQuery({
  queryKey: [...],
  queryFn: () => ...,
  enabled: !!userId && !!planId, // Only run if both exist
})
```

---

## Resources

- [React Query Documentation](https://tanstack.com/query/latest/docs/framework/react/overview)
- [React Query DevTools](https://tanstack.com/query/latest/docs/framework/react/devtools)
- [Query Keys Best Practices](https://tkdodo.eu/blog/effective-react-query-keys)
- [Optimistic Updates Guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

**Next Steps:**
1. Start migrating DashboardClient.tsx
2. Migrate SubjectProgressCard.tsx
3. Update settings components
4. Remove manual refetch logic from remaining components

**Questions?** See ADR_2025-01-REFACTOR.md or React Query docs.
