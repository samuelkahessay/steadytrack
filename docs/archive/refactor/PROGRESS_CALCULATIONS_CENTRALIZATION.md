# Progress Calculations Centralization

**Date:** January 2025
**Status:** Complete
**Context:** Implementing ADR Quick Win - Centralize progress calculation logic

---

## Overview

Centralized duplicated progress calculation logic into pure TypeScript functions in `lib/services/progress-calculations.ts`. This reduces code duplication, improves testability, and ensures consistent behavior across authenticated users, guest users, and API routes.

## What Was Done

### Phase 1: Replace TypeScript Duplications

#### 1.1 Activity Route - `countMissedStudyDays()`
**File:** `app/api/activity/route.ts`

**Before:** 31 lines of custom date parsing with potential DST issues
**After:** Single import from centralized function

**Benefits:**
- ✅ UTC-based date handling (DST-safe)
- ✅ Weekend-aware logic
- ✅ Consistent with database SQL function

#### 1.2 Guest Context - `calculateStreakFromDates()`
**File:** `contexts/GuestPlanContext.tsx`

**Before:** 27 lines of simple consecutive-day logic
**After:** 8 lines using centralized function

**Benefits:**
- ✅ Added weekend-aware streaks for guest users
- ✅ DST-safe calculations
- ✅ Consistent with authenticated user logic
- ✅ 70% code reduction

#### 1.3 Milestone Detection - `detectMilestone()`
**File:** `lib/hooks/queries/mutations/useProgressMutation.ts`

**Before:** Milestone detection only on server
**After:** Added `detectProgressMilestone()` helper for client-side use

**Benefits:**
- ✅ Optional client-side milestone detection
- ✅ Can show celebration UI immediately (optimistic)
- ✅ Components can use without backend round-trip

#### 1.4 Progress Service Helpers
**File:** `lib/services/progress.ts`

**Added:**
- `calculateStreakFromProgress()` - Calculate streaks from progress records
- `isStreakActive()` - Check if a streak is still active

**Benefits:**
- ✅ Server components can calculate streaks without RPC
- ✅ Useful for analytics and reporting
- ✅ Reduces database queries

### Phase 2: Documentation & Testing

#### 2.1 SQL/TypeScript Relationship
**File:** `lib/services/progress-calculations.ts`

**Added:**
- Architecture notes explaining SQL vs TypeScript implementations
- Usage guidelines for different contexts
- Cross-references to related files

#### 2.2 Comprehensive Unit Tests
**File:** `lib/services/__tests__/progress-calculations.test.ts`

**Coverage:** 49 tests, all passing ✅

**Test categories:**
- Weekend vs weekday streak logic
- DST transition handling
- Milestone detection boundary conditions
- Progress percentage rounding
- Weekly summary calculations

#### 2.3 Documentation
**Files updated:**
- `lib/services/progress-calculations.ts` - Architecture notes
- This document - Summary and migration guide

---

## Files Modified/Created

### Phase 1 & 2 - Core Refactoring
1. ✏️ `app/api/activity/route.ts` - Use centralized `countMissedStudyDays`
2. ✏️ `contexts/GuestPlanContext.tsx` - Use centralized `calculateStreakFromDates`
3. ✏️ `lib/hooks/queries/mutations/useProgressMutation.ts` - Add milestone detection helper
4. ✏️ `lib/services/progress.ts` - Add streak calculation helpers
5. ✏️ `lib/services/progress-calculations.ts` - Add architecture documentation
6. 🆕 `lib/services/__tests__/progress-calculations.test.ts` - 49 comprehensive tests
7. 🆕 `docs/refactor/PROGRESS_CALCULATIONS_CENTRALIZATION.md` - This comprehensive guide

### Phase 3 - Optional Enhancements ✅
8. 🆕 `lib/hooks/queries/useStreakCalculation.ts` - React Query hook for client-side calculations
9. ✏️ `lib/services/progress-calculations.ts` - Add planning utilities (`calculateRequiredPace`, `predictCompletionDate`, `isOnTrack`)
10. ✏️ `lib/services/__tests__/progress-calculations.test.ts` - 21 additional tests (70 total, all passing)

---

## Benefits Achieved

### Code Quality
- ✅ **70% reduction** in duplicate logic (27 lines → 8 lines in GuestContext)
- ✅ **Single source of truth** for progress calculations
- ✅ **70 unit tests** ensure correctness across edge cases (49 Phase 1+2, 21 Phase 3)
- ✅ **DST-safe** date handling everywhere
- ✅ **Weekend-aware** streaks for all users (including guests)
- ✅ **Progress planning utilities** for on-track monitoring and predictions

### Developer Experience
- ✅ **Easy to use** - Import pure functions, no database required
- ✅ **Well documented** - Architecture notes and usage examples
- ✅ **Type-safe** - Full TypeScript coverage
- ✅ **Testable** - Pure functions are easy to test

### User Experience
- ✅ **Consistent behavior** across authenticated and guest modes
- ✅ **Accurate streaks** that respect study plan settings
- ✅ **Milestone detection** for celebration UI
- ✅ **Reliable calculations** across time zones and DST

---

## Architecture

### SQL vs TypeScript

```
┌─────────────────────────────────────────────────┐
│         Progress Calculation Logic              │
├─────────────────────────────────────────────────┤
│                                                 │
│  SQL (Source of Truth)     TypeScript (Mirror)  │
│  ├── count_missed_study_days  countMissedStudyDays()│
│  ├── mark_unit_complete       detectMilestone()    │
│  └── undo_unit_progress       calculateStreakFromDates()│
│                                                 │
│  Used by:                   Used by:            │
│  • Database triggers        • Client components │
│  • RPC functions            • Server components │
│  • Data integrity           • Guest mode        │
│                             • Testing           │
└─────────────────────────────────────────────────┘
```

**Important:** SQL and TypeScript implementations must be kept in sync manually. Tests help ensure consistency.

### Usage Patterns

#### Server Components
```typescript
import { calculateStreakFromProgress, isStreakActive } from '@/lib/services/progress';

// Calculate streak from loaded progress data
const streakStats = calculateStreakFromProgress(progressRecords, plan.includes_weekends);

// Check if streak is active
const active = isStreakActive(streak.last_study_date, plan.includes_weekends);
```

#### Client Components
```typescript
import { calculateStreakFromDates, detectMilestone } from '@/lib/services/progress-calculations';

// Calculate streak from date array
const streakData = calculateStreakFromDates(dates, today, includesWeekends);

// Detect milestone
const milestone = detectMilestone(previousPercent, currentPercent);
```

#### React Query Mutations
```typescript
import { detectProgressMilestone } from '@/lib/hooks/queries/mutations/useProgressMutation';

// In component
const milestone = detectProgressMilestone(
  previousProgress.length,
  currentProgress.length,
  plan.total_units
);
if (milestone) {
  showCelebration(milestone);
}
```

#### Guest Mode
```typescript
// contexts/GuestPlanContext.tsx
import { calculateStreakFromDates } from '@/lib/services/progress-calculations';

const streakCalculation = calculateStreakFromDates(
  updatedDates,
  today,
  plan.includesWeekends ?? true
);
```

---

## Testing

All pure functions have comprehensive test coverage:

```bash
npm test -- progress-calculations.test.ts
```

**Results:**
- ✅ **70 tests passing** (49 Phase 1+2, 21 Phase 3)
- ✅ Weekend logic verified
- ✅ DST transitions tested
- ✅ Edge cases covered (completed plans, past end dates, slow pace)
- ✅ Boundary conditions validated
- ✅ Progress planning utilities tested (pace, predictions, on-track status)

---

## Phase 3: Optional Enhancements (Completed!)

### 3.1 React Query Hook for Client-Side Calculations ✅
**File:** `lib/hooks/queries/useStreakCalculation.ts`

```typescript
// Calculate streak from cached progress data (no backend call needed)
const streakStats = useStreakCalculation(progressRecords, plan.includes_weekends);

// Check if streak is active
const isActive = useIsStreakActive(streakStats);
```

**Benefits:**
- ✅ No backend call required if progress data is already cached
- ✅ Automatic memoization with `useMemo`
- ✅ Perfect for optimistic UI updates

### 3.2 Additional Progress Utilities ✅
**File:** `lib/services/progress-calculations.ts`

#### `calculateRequiredPace()`
Calculate units per day needed to complete on time:
```typescript
const pacing = calculateRequiredPace(
  completedUnits,
  totalUnits,
  startDate,
  endDate,
  currentDate,
  includesWeekends
);

console.log(`Need ${pacing.requiredUnitsPerDay.toFixed(1)} units/day`);
console.log(`${pacing.daysRemaining} days left`);
console.log(`On track: ${pacing.isOnTrack}`);
```

**Use cases:**
- Show "You need to complete X units/day" message
- Display progress warnings if user is behind
- Calculate how much effort is needed to finish on time

#### `predictCompletionDate()`
Predict when user will finish based on current pace:
```typescript
const completionDate = predictCompletionDate(
  completedUnits,
  totalUnits,
  progressRecords,
  currentDate,
  includesWeekends
);

if (completionDate) {
  console.log(`At your current pace, you'll finish on ${completionDate}`);
}
```

**Use cases:**
- Show estimated completion date in dashboard
- Warn if predicted completion is after plan end date
- Celebrate if user is ahead of schedule

#### `isOnTrack()`
Simple boolean check for on-track status:
```typescript
const onTrack = isOnTrack(
  completedUnits,
  totalUnits,
  startDate,
  endDate,
  currentDate,
  includesWeekends
);

if (!onTrack) {
  showWarning("You're falling behind! Pick up the pace.");
}
```

**Use cases:**
- Simple conditional UI (show warning badge)
- Analytics/reporting
- Parent dashboard indicators

### 3.3 Comprehensive Test Coverage ✅
All Phase 3 utilities have extensive tests:
- 21 new tests added (total: 70 tests, all passing)
- Weekend vs weekday pace calculations
- Edge cases (completed plans, past end dates, slow pace)
- Prediction accuracy validation

### Future Ideas (Not Yet Implemented)

**Validation Helper:**
```typescript
// Validate that SQL and TypeScript produce same results
export function validateStreakCalculation(sqlResult, dates, includesWeekends) {
  const tsResult = calculateStreakFromDates(dates, today, includesWeekends);
  return deepEqual(sqlResult, tsResult);
}
```

---

## Maintenance Notes

### When Updating Logic

1. **Update SQL First** (source of truth)
   - Modify function in `supabase/migrations/*.sql`
   - Test with database queries

2. **Update TypeScript** (mirror)
   - Update function in `lib/services/progress-calculations.ts`
   - Update tests in `__tests__/progress-calculations.test.ts`

3. **Verify Consistency**
   - Run tests: `npm test -- progress-calculations.test.ts`
   - Test in both authenticated and guest modes
   - Check across DST transitions

### Common Pitfalls

- ❌ **Date format mismatch** - Always use YYYY-MM-DD strings
- ❌ **Timezone confusion** - Functions expect UTC dates at noon
- ❌ **Weekend flag** - Remember to pass `includesWeekends` parameter
- ❌ **Array mutation** - Functions don't mutate input arrays (pure functions)

---

## Related ADR Sections

This work implements the **"Quick Wins"** from `ADR_2025-01-REFACTOR.md`:

> **3. Create progress service (6h) - Centralize business logic**
>
> The pure functions were part of this effort, and are now fully integrated throughout the codebase.

**Estimated Time:**
- Phase 1 & 2: 8 hours (actual)
- Phase 3: 3 hours (actual)
- **Total: 11 hours**

**Complexity:** Medium-High (Phase 3 added planning utilities)
**Impact:** High - Reduced duplication, improved reliability, added planning features

---

## Success Criteria ✅

### Phase 1 & 2 (Core Refactoring)
- ✅ Centralized progress calculation logic
- ✅ Replaced all TypeScript duplications
- ✅ Added weekend-aware logic to guest mode
- ✅ Created comprehensive test suite (49 tests)
- ✅ Documented architecture and usage patterns
- ✅ All tests passing
- ✅ No breaking changes to existing functionality

### Phase 3 (Optional Enhancements)
- ✅ Created React Query hook for client-side streak calculations
- ✅ Added progress planning utilities (`calculateRequiredPace`, `predictCompletionDate`, `isOnTrack`)
- ✅ Extended test suite with 21 additional tests (70 total)
- ✅ All Phase 3 tests passing
- ✅ Comprehensive documentation with usage examples

---

**Document prepared by:** Claude Code
**Review date:** January 2025
**Status:** Complete - All phases implemented and tested
