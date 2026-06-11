# Feature Analysis: Guest Mode (Unauthenticated Users)

**Priority:** P2-Medium | **Complexity:** ⭐⭐⭐⭐⭐ (5/5) - **VERY COMPLEX**
**Estimated Effort:** 12-16 hours

## 1. Overview

**Most complex non-auth feature** - Duplicates entire app flow for unauthenticated users using LocalStorage.

**Key Challenges:**
- Duplicate state management (mirrors auth user logic)
- Cross-tab synchronization (storage events)
- Migration to authenticated account (conflict resolution)
- Merge vs replace logic
- beforeunload warnings (prevent data loss)

## 2. Files Involved

```
app/plan/guest/
├── page.tsx (421 lines) - Guest dashboard
└── layout.tsx - Guest layout wrapper

contexts/
└── GuestPlanContext.tsx (274 lines) - **COMPLEX** LocalStorage state

components/guest/
├── SignInPrompt.tsx - Modal prompting sign-in
├── ConflictResolutionModal.tsx - Merge/replace UI
└── MigrationLoadingState.tsx - Migration progress

lib/guest/
├── storage.ts - LocalStorage CRUD helpers
└── analytics.ts - Guest event tracking

app/api/plan/
├── migrate-guest/route.ts - Migrate guest → auth
└── merge-guest/route.ts - Merge guest progress into existing plan
```

## 3. Guest Data Structure (LocalStorage)

```typescript
{
  plan: StudyPlan, // Same structure as DB
  progress: {
    completedUnits: Array<{ subject, unitId }>,
    completedResources: Array<{ subject, unitId, resourceUrl }>
  },
  streak: {
    currentStreak: number,
    longestStreak: number,
    studyDates: string[] // YYYY-MM-DD dates
  },
  promptShownAt: number // Timestamp for sign-in prompts
}
```

## 4. Copy vs Refactor

**🚨 MAJOR REFACTORING NEEDED:**

### Problem 1: Duplicate Logic
- Guest mode reimplements progress tracking, streak calculation, schedule rendering
- ~60% code overlap with authenticated flow

### Problem 2: Complex Migration
- 3 migration paths (migrate, merge, replace)
- Must handle mismatched plan structures
- Streak merging logic (combine study dates)

**Proposed Refactor:**
```
Unified Storage Interface:
  interface PlanStorage {
    getPlan(): Promise<Plan>;
    savePlan(plan: Plan): Promise<void>;
    getProgress(): Promise<Progress>;
    updateProgress(progress: Progress): Promise<void>;
    getStreak(): Promise<Streak>;
    updateStreak(streak: Streak): Promise<void>;
  }

  class AuthStorage implements PlanStorage { /* uses Supabase */ }
  class GuestStorage implements PlanStorage { /* uses LocalStorage */ }

Benefits:
- Single codebase for both modes
- Easier to test
- Consistent behavior
```

## 5. New File Structure

```
src/
├── app/plan/guest/
│   ├── page.tsx 🔧 (use unified storage)
│   └── layout.tsx ✅
│
├── contexts/
│   └── GuestPlanContext.tsx 🔧 (simplify with unified storage)
│
├── components/guest/ ✅ (copy as-is)
│
├── lib/
│   ├── guest/ ✅ (copy storage.ts, analytics.ts)
│   │
│   └── storage/ 🆕 (NEW - unified interface)
│       ├── types.ts (PlanStorage interface)
│       ├── AuthStorage.ts
│       ├── GuestStorage.ts
│       └── useStorage.ts (hook that returns appropriate storage)
│
└── app/api/plan/
    ├── migrate-guest/route.ts ✅
    └── merge-guest/route.ts ✅
```

## 6. Migration Flow

```
1. User creates guest plan → Saved to LocalStorage
2. User authenticates → Redirect to /plan/guest?postAuth=1
3. Check if user has existing plan:

   A. NO PLAN: Direct migration
      - Create plan in DB from guest data
      - Copy progress, streak
      - Clear LocalStorage
      - Redirect to /dashboard

   B. HAS PLAN: Show conflict modal

      Option 1: MERGE (recommended)
      - Keep existing plan
      - Add guest progress to existing plan
      - Merge streak (combine study dates)
      - Redirect to /dashboard

      Option 2: REPLACE
      - Delete existing plan
      - Use guest plan
      - Redirect to /dashboard

      Option 3: KEEP EXISTING
      - Discard guest data
      - Redirect to /dashboard
```

## 7. Porting Guide (12 hours)

### Phase 1: Core Storage (3 hours)
1. Create unified PlanStorage interface
2. Implement AuthStorage (Supabase wrapper)
3. Implement GuestStorage (LocalStorage wrapper)
4. Create `useStorage()` hook that returns appropriate storage based on auth state

### Phase 2: Guest Context (2 hours)
1. Copy GuestPlanContext
2. Refactor to use unified storage
3. Test cross-tab sync (storage events)

### Phase 3: Guest UI (2 hours)
1. Copy guest dashboard page
2. Copy sign-in prompt, conflict modal
3. Test localStorage persistence

### Phase 4: Migration APIs (3 hours)
1. Copy migrate-guest route
2. Copy merge-guest route
3. Test all 3 migration paths (migrate, merge, replace)

### Phase 5: Testing (2 hours)
- [ ] Guest can create plan without account
- [ ] Progress saves to LocalStorage
- [ ] Cross-tab sync works
- [ ] Sign-in prompt shows after 3 units
- [ ] beforeunload warning works
- [ ] Auto-migration on login
- [ ] Conflict modal shows if plan exists
- [ ] Merge option works (combines progress)
- [ ] Replace option works (discards existing)
- [ ] Guest data cleared after migration

## 8. Key Challenges

### Challenge 1: Streak Merging
**Problem:** How to combine guest streak with existing streak?

**Solution:**
```typescript
function mergeStreaks(guestStreak, authStreak) {
  // Combine study dates from both
  const allDates = new Set([
    ...guestStreak.studyDates,
    ...authStreak.studyDates
  ]);

  // Recalculate current streak from combined dates
  const sorted = Array.from(allDates).sort();
  const currentStreak = calculateStreakFromDates(sorted);
  const longestStreak = Math.max(
    guestStreak.longestStreak,
    authStreak.longestStreak,
    currentStreak
  );

  return { currentStreak, longestStreak, studyDates: sorted };
}
```

### Challenge 2: Cross-Tab Sync
**Problem:** Updates in Tab A must reflect in Tab B

**Solution:**
```typescript
window.addEventListener('storage', (event) => {
  if (event.key === 'steadytrack_guest_plan') {
    // Reload guest plan from storage
    const updatedPlan = JSON.parse(event.newValue);
    setGuestPlan(updatedPlan);
  }
});
```

### Challenge 3: Data Loss Prevention
**Problem:** User closes tab with unsaved guest data

**Solution:**
```typescript
window.addEventListener('beforeunload', (event) => {
  const guestPlan = getGuestPlan();
  if (guestPlan && !isAuthenticated) {
    event.preventDefault();
    event.returnValue = 'You have unsaved progress. Are you sure you want to leave?';
  }
});
```

## 9. Success Criteria

✅ Guest can create plan without account
✅ Progress persists in LocalStorage
✅ Cross-tab sync works
✅ Sign-in prompt shows appropriately
✅ beforeunload warning prevents accidental data loss
✅ Migration works (all 3 paths)
✅ Conflict resolution UI clear and functional
✅ Guest data cleared after successful migration

**Next:** [09-settings-account-management.md](./09-settings-account-management.md)
