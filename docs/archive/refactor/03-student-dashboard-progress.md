# Feature Analysis: Student Dashboard and Progress Tracking

**Feature Name:** Student Dashboard and Progress Tracking
**Priority:** P0-Critical (Core Feature)
**Complexity:** ⭐⭐⭐⭐⭐ (5/5) - **MOST COMPLEX FEATURE**
**Estimated Effort:** 16-20 hours

---

## Executive Summary

This is the **most complex feature** in the app, combining:
- Real-time progress tracking
- Streak calculations (timezone-aware)
- Weekly activity summaries
- Optimistic UI updates
- Multi-table data fetching
- Celebration modals
- Live refresh on focus

**Key Challenge:** 418-line DashboardClient with 8+ responsibilities requires significant refactoring.

---

## 1. Files Involved

### Core Files (**Must Port**- Complex)
```
app/(dashboard)/dashboard/
└── page.tsx (141 lines) - Server Component with data fetching

components/dashboard/
├── DashboardClient.tsx (418 lines) ⚠️ **MONSTER** - Needs major refactor
├── SubjectProgressCard.tsx (515 lines) ⚠️ **MONSTER** - Split into 4 components
├── TodaysFocus.tsx (176 lines) - Today's units display
├── StreakHero.tsx (192 lines) - Streak visualization
├── YourProgress.tsx (143 lines) - Weekly summary chart
├── DashboardHeader.tsx (67 lines) - Header with navigation
├── ProgressBar.tsx (55 lines) - Progress visualization
├── Celebration Modal.tsx (86 lines) - Milestone celebrations
├── DashboardSkeleton.tsx - Loading state
└── UnitChecklistClient.tsx - Unit checklist logic
```

### API Routes
```
app/api/progress/
├── route.ts - Mark unit complete/undo (uses RPCs)
└── bulk/route.ts - Bulk progress operations
```

### Database Tables
```
- study_plans (SELECT) - User's plan
- user_progress (SELECT/INSERT/DELETE via RPC) - Unit completions
- study_streaks (SELECT/UPDATE via RPC) - Streak data
- quick_check_results (SELECT) - Quiz activity
- resource_progress (SELECT) - Resource activity
```

---

## 2. Copy vs Refactor Analysis

### 🚨 **CRITICAL REFACTORING NEEDED**

#### **1. DashboardClient.tsx** (418 lines)
**Current State:** Monolithic "God Component"

**8+ Responsibilities:**
1. State management (5 useState hooks)
2. Data fetching (4 Supabase queries)
3. Weekly summary calculation
4. Streak calculation (60+ lines)
5. Progress update handling (114 lines)
6. Live refresh on focus/visibility
7. Milestone detection
8. UI layout orchestration

**Proposed Refactor:**
```
DashboardLayout (80 lines)
  └─→ useDashboardData hook (150 lines) - State + fetching
        ├─→ useProgressTracking (80 lines) - Progress updates
        ├─→ useStreakCalculation (60 lines) - Streak logic
        └─→ useWeeklySummary (40 lines) - Activity summary
```

**Benefits:**
- Each hook is independently testable
- Logic reusable (e.g., parent dashboard could use same hooks)
- Easier to maintain

#### **2. SubjectProgressCard.tsx** (515 lines)
**Current State:** Over-responsible component

**6 Responsibilities:**
1. Progress calculation
2. Unit checklist UI
3. Microcard viewer
4. Quick check integration
5. Curriculum alignment
6. Outcome-level breakdown

**Proposed Refactor:**
```
SubjectProgressCard (100 lines)
  ├─→ SubjectHeader (40 lines)
  ├─→ UnitChecklist (120 lines)
  │     └─→ UnitCheckboxItem (60 lines)
  ├─→ OutcomeBreakdown (80 lines)
  └─→ CurriculumPanel (80 lines)
```

---

## 3. New File Structure (Refactored)

```
src/
├── app/(dashboard)/dashboard/
│   └── page.tsx ✅ (minor cleanup - copy mostly as-is)
│
├── components/dashboard/
│   ├── DashboardLayout.tsx 🆕 (container - 80 lines)
│   ├── DashboardHeader.tsx ✅ (copy as-is)
│   ├── StreakHero.tsx ✅ (copy as-is)
│   ├── TodaysFocus.tsx ✅ (copy as-is)
│   ├── YourProgress.tsx ✅ (copy as-is)
│   ├── CelebrationModal.tsx ✅ (copy as-is)
│   ├── DashboardSkeleton.tsx ✅ (copy as-is)
│   │
│   └── subject-progress/ 🆕 (extracted from SubjectProgressCard)
│       ├── SubjectProgressCard.tsx (container)
│       ├── SubjectHeader.tsx
│       ├── UnitChecklist.tsx
│       ├── UnitCheckboxItem.tsx
│       ├── OutcomeBreakdown.tsx
│       └── CurriculumPanel.tsx
│
├── lib/hooks/ 🆕 (extract from DashboardClient)
│   ├── useDashboardData.ts (main hook)
│   ├── useProgressTracking.ts (progress updates)
│   ├── useStreakCalculation.ts (streak logic)
│   └── useWeeklySummary.ts (activity summary)
│
└── app/api/progress/
    ├── route.ts 🔧 (minor improvements)
    └── bulk/route.ts ✅ (copy as-is)
```

---

## 4. Supabase Queries & Optimizations

### Server Component Queries (Dashboard Page)

```typescript
// 1. Get study plan
const { data: plan } = await supabase
  .from('study_plans')
  .select('*')
  .eq('user_id', user.id)
  .single();

// 2. Get streak + progress in parallel
const [streakRes, progressRes] = await Promise.all([
  supabase.from('study_streaks').select('*').eq('user_id', user.id).single(),
  supabase.from('user_progress').select('*').eq('user_id', user.id).eq('plan_id', plan.id),
]);
```

**Optimization:** ✅ Already parallelized

### Client-Side Queries (DashboardClient)

```typescript
// Refresh all data on focus
const [streakRes, progressRes, quickRes, resourceRes] = await Promise.all([
  supabase.from('study_streaks').select('*').eq('user_id', user.id),
  supabase.from('user_progress').select('*').eq('user_id', user.id).eq('plan_id', planId),
  supabase.from('quick_check_results').select('created_at').eq('user_id', user.id).eq('plan_id', planId),
  supabase.from('resource_progress').select('completed_at').eq('user_id', user.id).eq('plan_id', planId).eq('completed', true)
]);
```

**Optimization:** ⚠️ Consider:
1. **Debounce refresh** - Only refresh if >30s since last refresh
2. **Select specific columns** - Don't need all fields for activity dates

### RPC Functions

```typescript
// Mark unit complete (atomic streak update)
const { data } = await supabase.rpc('mark_unit_complete', {
  p_plan_id: planId,
  p_subject: subject,
  p_unit_id: unitId
});
// Returns: { success, streakIncreased, newStreak, milestone }

// Undo unit progress (recalculates streak)
const { data } = await supabase.rpc('undo_unit_progress', {
  p_plan_id: planId,
  p_unit_id: unitId
});
// Returns: { success, newStreak }
```

**Optimization:** ✅ Already atomic - single RPC call handles transaction

---

## 5. Step-by-Step Porting Guide

### Phase 1: Foundation (3 hours)

**Step 1.1:** Port server component (dashboard page)
```bash
cp app/(dashboard)/dashboard/page.tsx NEW_PROJECT/app/(dashboard)/dashboard/
```

**Step 1.2:** Port simple UI components (no refactoring)
```bash
cp components/dashboard/DashboardHeader.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/StreakHero.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/TodaysFocus.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/YourProgress.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/ProgressBar.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/CelebrationModal.tsx NEW_PROJECT/components/dashboard/
cp components/dashboard/DashboardSkeleton.tsx NEW_PROJECT/components/dashboard/
```

**Step 1.3:** Port API routes
```bash
cp app/api/progress/route.ts NEW_PROJECT/app/api/progress/
cp app/api/progress/bulk/route.ts NEW_PROJECT/app/api/progress/bulk/
```

---

### Phase 2: Extract State Management Hooks (6 hours) 🆕

**Step 2.1:** Create `useProgressTracking` hook
```typescript
// lib/hooks/useProgressTracking.ts
import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';

export function useProgressTracking(
  planId: string,
  userId: string,
  initialProgress: UserProgress[]
) {
  const [progress, setProgress] = useState(initialProgress);
  const { showToast } = useToast();

  const handleProgressUpdate = useCallback(async ({
    type,
    unitId,
    subject
  }: ProgressUpdatePayload) => {
    // Optimistic update
    const nextProgress = type === 'completed'
      ? [...progress, createProgressRecord(planId, userId, subject, unitId)]
      : progress.filter(p => p.unit_id !== unitId);

    setProgress(nextProgress);

    // Call API
    try {
      const response = await fetch('/api/progress', {
        method: type === 'completed' ? 'POST' : 'DELETE',
        body: JSON.stringify({ planId, unitId, subject })
      });

      if (!response.ok) {
        // Rollback on error
        setProgress(progress);
        showToast('Failed to update progress', 'error');
        return null;
      }

      return await response.json();
    } catch (error) {
      setProgress(progress); // Rollback
      showToast('Network error', 'error');
      return null;
    }
  }, [planId, userId, progress, showToast]);

  return { progress, handleProgressUpdate, setProgress };
}
```

**Step 2.2:** Create `useStreakCalculation` hook
```typescript
// lib/hooks/useStreakCalculation.ts
export function useStreakCalculation(
  initialStreak: StudyStreak | null,
  progress: UserProgress[]
) {
  const [streak, setStreak] = useState(initialStreak);

  const updateStreakFromProgress = useCallback((nextProgress: UserProgress[]) => {
    // Compute if studied today
    const today = formatLocalDate(new Date());
    const studiedToday = nextProgress.some(
      p => formatLocalDate(new Date(p.completed_at)) === today
    );

    // Calculate new streak value
    const newCurrent = calculateStreak(streak, studiedToday);
    const newLongest = Math.max(streak?.longest_streak ?? 0, newCurrent);

    setStreak({
      ...streak,
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_study_date: studiedToday ? today : streak?.last_study_date,
      updated_at: new Date().toISOString()
    });
  }, [streak]);

  return { streak, updateStreakFromProgress, setStreak };
}
```

**Step 2.3:** Create `useWeeklySummary` hook (similar pattern)

**Step 2.4:** Create `useDashboardData` (orchestrator hook)
```typescript
// lib/hooks/useDashboardData.ts
export function useDashboardData(
  planId: string,
  userId: string,
  initialData: InitialDashboardData
) {
  const { progress, handleProgressUpdate, setProgress } = useProgressTracking(...);
  const { streak, updateStreakFromProgress, setStreak } = useStreakCalculation(...);
  const { weeklySummary, setWeeklySummary } = useWeeklySummary(...);

  // Live refresh on focus
  const refreshData = useCallback(async () => {
    const [streakRes, progressRes, ...] = await Promise.all([...]);
    setStreak(streakRes.data);
    setProgress(progressRes.data);
    // Update weekly summary
  }, [planId]);

  useEffect(() => {
    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', refreshData);
    return () => {
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', refreshData);
    };
  }, [refreshData]);

  return {
    progress,
    streak,
    weeklySummary,
    handleProgressUpdate,
    refreshData
  };
}
```

---

### Phase 3: Refactor DashboardClient (3 hours)

**Step 3.1:** Create simplified DashboardLayout
```typescript
// components/dashboard/DashboardLayout.tsx
'use client';

import { useDashboardData } from '@/lib/hooks/useDashboardData';
import DashboardHeader from './DashboardHeader';
import StreakHero from './StreakHero';
import TodaysFocus from './TodaysFocus';
import YourProgress from './YourProgress';
import SubjectProgressCard from './subject-progress/SubjectProgressCard';
import CelebrationModal from './CelebrationModal';

export default function DashboardLayout({ initialData }) {
  const {
    progress,
    streak,
    weeklySummary,
    handleProgressUpdate
  } = useDashboardData(initialData.planId, initialData.userId, initialData);

  const [celebrationMilestone, setCelebrationMilestone] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <div className="max-w-6xl mx-auto px-4 pb-8">
        <StreakHero streak={streak} planId={initialData.planId} />
        <TodaysFocus plan={initialData.plan} progress={progress} />
        <YourProgress summary={weeklySummary} progress={progress} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialData.plan.subjects.map(subject => (
            <SubjectProgressCard
              key={subject}
              subject={subject}
              planId={initialData.planId}
              progress={progress}
              units={initialData.units}
              onProgressUpdate={handleProgressUpdate}
            />
          ))}
        </div>
      </div>

      <CelebrationModal
        isOpen={showCelebration}
        milestone={celebrationMilestone}
        onClose={() => {
          setShowCelebration(false);
          setCelebrationMilestone(null);
        }}
      />
    </div>
  );
}
```

---

### Phase 4: Refactor SubjectProgressCard (4 hours)

**Step 4.1:** Extract SubjectHeader component (40 lines)
**Step 4.2:** Extract UnitChecklist component (120 lines)
**Step 4.3:** Extract OutcomeBreakdown component (80 lines)
**Step 4.4:** Extract CurriculumPanel component (80 lines)

**Step 4.5:** Create simplified container
```typescript
// components/dashboard/subject-progress/SubjectProgressCard.tsx
export function SubjectProgressCard({ subject, planId, progress, units, onProgressUpdate }) {
  const [showOutcomes, setShowOutcomes] = useState(false);

  const subjectProgress = progress.filter(p => p.subject === subject);
  const subjectUnits = units.filter(u => u.subject === subject);

  return (
    <Card>
      <SubjectHeader
        subject={subject}
        progress={subjectProgress}
        totalUnits={subjectUnits.length}
      />

      <UnitChecklist
        subject={subject}
        planId={planId}
        units={subjectUnits}
        progress={subjectProgress}
        onProgressUpdate={onProgressUpdate}
      />

      {showOutcomes && (
        <>
          <OutcomeBreakdown subject={subject} progress={subjectProgress} />
          <CurriculumPanel subject={subject} />
        </>
      )}

      <Button onClick={() => setShowOutcomes(!showOutcomes)}>
        {showOutcomes ? 'Hide Details' : 'Show Details'}
      </Button>
    </Card>
  );
}
```

---

### Phase 5: Testing (2-3 hours)

**Unit Tests:**
```typescript
describe('useProgressTracking', () => {
  it('should update progress optimistically', () => {
    const { result } = renderHook(() => useProgressTracking(...));
    act(() => {
      result.current.handleProgressUpdate({ type: 'completed', unitId: '1', subject: 'Math' });
    });
    expect(result.current.progress).toHaveLength(1);
  });

  it('should rollback on API error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useProgressTracking(...));
    await act(async () => {
      await result.current.handleProgressUpdate({ type: 'completed', ... });
    });
    expect(result.current.progress).toHaveLength(0); // Rolled back
  });
});
```

**Integration Tests:**
```typescript
describe('Dashboard Data Flow', () => {
  it('should mark unit complete and update streak', async () => {
    const { getByText } = render(<DashboardLayout initialData={mockData} />);
    fireEvent.click(getByText('Unit 1'));
    await waitFor(() => {
      expect(getByText('1 day streak')).toBeInTheDocument();
    });
  });
});
```

---

## 6. Key Challenges & Solutions

### Challenge 1: Optimistic Updates with Rollback
**Problem:** UI updates immediately but API call may fail

**Solution:**
```typescript
const previousProgress = progress;
setProgress(nextProgress); // Optimistic

try {
  await fetch('/api/progress', ...);
} catch (error) {
  setProgress(previousProgress); // Rollback
  showToast('Failed', 'error');
}
```

### Challenge 2: Timezone-Aware Streak Calculation
**Problem:** User's "today" depends on timezone

**Solution:** Plan has `locked_timezone` field
```typescript
const today = formatLocalDate(new Date()); // Uses browser timezone
const studiedToday = progress.some(p =>
  formatLocalDate(new Date(p.completed_at)) === today
);
```

### Challenge 3: Weekly Summary from Multiple Sources
**Problem:** Activity from 3 tables (user_progress, quick_check_results, resource_progress)

**Solution:** Merge dates from all sources
```typescript
const activityDates = new Set();
// Add unit completions
progress.forEach(p => activityDates.add(formatLocalDate(p.completed_at)));
// Add quiz attempts
quickChecks.forEach(q => activityDates.add(formatLocalDate(q.created_at)));
// Add resource completions
resources.forEach(r => activityDates.add(formatLocalDate(r.completed_at)));
```

---

## 7. Success Criteria

✅ **Feature is successfully ported when:**
1. Dashboard loads with plan, streak, progress
2. Unit checkboxes toggle with optimistic updates
3. Streak increments on first completion of day
4. Weekly summary shows all activity types
5. Milestone celebration modal shows at 25/50/75/100%
6. Live refresh works on focus/visibility change
7. Rollback works on API errors
8. All UI components render correctly
9. Mobile responsive layout works
10. All tests pass (unit + integration + E2E)

---

**Next Feature:** [04-curriculum-browser.md](./04-curriculum-browser.md)
