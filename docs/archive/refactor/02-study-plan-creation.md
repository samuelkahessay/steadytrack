# Feature Analysis: Study Plan Creation and Management

**Feature Name:** Study Plan Creation and Management
**Priority:** P0-Critical (Core Feature)
**Complexity:** ⭐⭐⭐⭐ (4/5)
**Estimated Effort:** 10-12 hours

---

## 1. Files Involved

### Core Files (Must Port)
```
app/(dashboard)/plan/
├── new/page.tsx (23 lines) - Redirects to subjects page
└── new/subjects/page.tsx (385 lines) - Main plan creation wizard

app/api/plan/
└── route.ts (78 lines) - API endpoint for plan creation/update

lib/shared/
├── generateStudySchedule.ts (163 lines) - Core schedule generation algorithm
└── distributeResources.ts (321 lines) - Resource distribution logic

lib/validation/
└── plan.ts (38 lines) - Zod schema + subject validation

lib/guest/
├── storage.ts - Guest plan storage (LocalStorage)
└── analytics.ts - Guest event tracking
```

### Supporting Files
```
data/curriculum/ - Static curriculum JSON files (all subjects)
lib/date.ts - Date utilities (addDays, startOfLocalDay, isWeekend)
lib/types.ts - TypeScript types (FlexibleSchedule, ScheduleDay, etc.)
```

### Database Tables & RPC
```
- profiles (UPDATE) - Store grade, display_name
- study_plans (INSERT/UPDATE via RPC) - Main plan storage
- RPC: regenerate_study_plan() - Atomic plan creation/update
```

---

## 2. Copy vs Refactor Analysis

### ✅ Copy As-Is (Well-Structured)

1. **`lib/shared/generateStudySchedule.ts`** (163 lines)
   - **Pure function** - Can run on client or server
   - Clean separation of concerns
   - Good documentation
   - Supports both unit-level and resource-level distribution
   - **Key Feature:** Timezone-aware date handling
   - **Key Feature:** Weekend inclusion logic
   - **Key Feature:** Load balancing algorithm (LPT heuristic)

2. **`lib/shared/distributeResources.ts`** (321 lines)
   - **Pure function** - Deterministic resource distribution
   - Outcome-level granularity (prevents duplicate outcomes)
   - Handles units with/without outcomes
   - Resource sorting by type (video → article → practice)
   - Extensive dev-mode diagnostics
   - **Copy as-is, but consider:** Extracting diagnostics to separate utility

3. **`lib/validation/plan.ts`** (38 lines)
   - Clean Zod schema
   - Simple subject validation
   - Good defaults
   - **Minor improvement:** Add custom error messages

### 🔧 Significant Refactoring Needed

1. **`app/(dashboard)/plan/new/subjects/page.tsx`** (385 lines)
   - **Current Issues:**
     - Monolithic component (8 responsibilities)
     - Duplicate logic for guest vs authenticated flows
     - Inline API calls
     - Manual auth check
     - Mixed concerns (UI + business logic)

   - **8 Responsibilities:**
     1. Grade selection UI
     2. Subject selection UI (2 groups: grade 11 & 12)
     3. Duration selection UI
     4. Weekend toggle UI
     5. Auth state detection
     6. Client-side schedule generation (guest mode)
     7. API calls (authenticated mode)
     8. LocalStorage management (guest mode)

   - **Refactor Strategy:**
     ```
     SubjectSelectionPage (container) 50 lines
       ├─→ GradeSelector 30 lines
       ├─→ SubjectGrid 60 lines
       ├─→ DurationSelector 40 lines
       ├─→ WeekendToggle 20 lines
       ├─→ PlanSummary 20 lines
       └─→ usePlanCreation hook 80 lines (auth + API + guest logic)
     ```

2. **`app/api/plan/route.ts`** (78 lines)
   - **Current:** Inline logic with some structure
   - **Improvement:** Extract to service layer
     ```typescript
     // lib/services/plan-service.ts
     class PlanService {
       async createOrUpdatePlan(userId, params) { ... }
       async validateSubjects(grade, subjects) { ... }
       private generateSchedule(subjects, options) { ... }
     }
     ```

3. **Guest Mode Integration**
   - Currently: Inline LocalStorage calls
   - **Improvement:** Unified interface for auth + guest
     ```typescript
     // lib/services/plan-storage.ts
     interface PlanStorage {
       savePlan(plan): Promise<Plan>;
       getPlan(): Promise<Plan | null>;
     }

     class AuthPlanStorage implements PlanStorage { ... }
     class GuestPlanStorage implements PlanStorage { ... }
     ```

---

## 3. New File Structure (Refactored)

```
src/
├── app/
│   ├── (dashboard)/plan/new/
│   │   ├── page.tsx ✅ (redirects - copy as-is)
│   │   └── subjects/
│   │       └── page.tsx 🔧 (refactor into smaller components)
│   │
│   └── api/plan/
│       └── route.ts 🔧 (extract to service layer)
│
├── components/plan-creation/ 🆕 (NEW - extracted from page)
│   ├── PlanCreationWizard.tsx (container)
│   ├── GradeSelector.tsx
│   ├── SubjectGrid.tsx
│   ├── DurationSelector.tsx
│   ├── WeekendToggle.tsx
│   └── PlanSummary.tsx
│
├── lib/
│   ├── shared/
│   │   ├── generateStudySchedule.ts ✅ (copy as-is)
│   │   └── distributeResources.ts ✅ (copy as-is)
│   │
│   ├── services/ 🆕 (NEW - extract business logic)
│   │   ├── plan-service.ts (plan creation logic)
│   │   └── plan-storage.ts (unified auth + guest storage)
│   │
│   ├── validation/
│   │   └── plan.ts ✅ (copy as-is, minor improvements)
│   │
│   ├── hooks/ 🆕 (NEW - extract state management)
│   │   └── usePlanCreation.ts (plan creation flow)
│   │
│   └── guest/ ✅ (copy as-is)
│       ├── storage.ts
│       └── analytics.ts
│
└── data/curriculum/ ✅ (copy all static files)
```

**Legend:**
- ✅ = Copy as-is
- 🔧 = Major refactoring
- 🆕 = New file (extract during port)

---

## 4. Supabase Queries & Optimizations

### Queries Used

#### 1. Profile Upsert (API Route)
```typescript
await supabase.from('profiles').upsert({
  id: userId,
  grade,
  display_name: displayName || null
});
```
**Optimization:** ✅ Already optimized
- Uses upsert (idempotent)
- Only updates if changed (Postgres UPSERT)

#### 2. Plan Creation/Update (RPC Function)
```typescript
const { data: plan, error } = await supabase.rpc('regenerate_study_plan', {
  p_subjects: uniqueSubjects,
  p_schedule: schedule,
  p_total_units: totalUnits,
  p_duration_weeks: durationWeeks,
  p_includes_weekends: includesWeekends,
  p_reset: reset, // Preserve progress by default
});
```
**Optimization:** ✅ Already atomic
- Single RPC call handles complex transaction
- Locks timezone at creation time
- Computes start/end dates server-side
- Optional progress reset (defaults to false)

**RPC Function Details** (from migration):
```sql
CREATE OR REPLACE FUNCTION regenerate_study_plan(
  p_subjects TEXT[],
  p_schedule JSONB,
  p_total_units INT,
  p_duration_weeks INT,
  p_includes_weekends BOOLEAN,
  p_reset BOOLEAN DEFAULT FALSE
)
RETURNS study_plans AS $$
DECLARE
  v_plan study_plans;
  v_timezone TEXT;
BEGIN
  -- Get user's timezone from profiles
  SELECT timezone INTO v_timezone
  FROM profiles
  WHERE id = auth.uid();

  -- Parse dates from schedule
  -- (dates are timezone-aware using locked_timezone)
  ...

  -- Upsert plan (ON CONFLICT user_id DO UPDATE)
  INSERT INTO study_plans (user_id, subjects, schedule, ...)
  VALUES (auth.uid(), p_subjects, p_schedule, ...)
  ON CONFLICT (user_id) DO UPDATE SET ...
  RETURNING * INTO v_plan;

  -- Reset progress if requested
  IF p_reset THEN
    DELETE FROM user_progress WHERE user_id = auth.uid();
    UPDATE study_streaks SET current_streak = 0, ... WHERE user_id = auth.uid();
  END IF;

  RETURN v_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Database Schema

#### `study_plans` Table
```sql
CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT[] NOT NULL CHECK (array_length(subjects, 1) BETWEEN 2 AND 12),
  schedule JSONB NOT NULL, -- FlexibleSchedule structure
  total_units INTEGER NOT NULL,
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks BETWEEN 1 AND 12),
  includes_weekends BOOLEAN NOT NULL,
  start_date DATE NOT NULL, -- Locked at creation
  end_date DATE NOT NULL, -- Computed from schedule
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired', 'archived'
  current_day_index INTEGER DEFAULT 0, -- Manual day override
  locked_timezone TEXT NOT NULL, -- Timezone locked at plan creation
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
CREATE POLICY "Users can SELECT own plan"
  ON study_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own plan"
  ON study_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own plan"
  ON study_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own plan"
  ON study_plans FOR DELETE
  USING (auth.uid() = user_id);
```

**Optimization:** ✅ Already has UNIQUE index on `user_id`
- Enforces 1:1 user:plan relationship
- Fast lookup by user
- RLS policies prevent cross-user access

---

## 5. Shared Components Needed

### UI Components (from `components/ui/`)
- **Button** - Submit, cancel actions
- **Card** - Subject selection, grade selection
- **Toast** - Success/error notifications
- **Spinner/Loading** - Plan generation state

### Utility Functions
- **`cn()` from `lib/utils.ts`** - className utility
- **`getAllSubjects()` from `data/curriculum`** - Get all available subjects
- **`getCurriculumData(subject)` from `data/curriculum`** - Get unit/outcome data
- **Date utilities** from `lib/date.ts`:
  - `addDays()` - Add days to a date
  - `startOfLocalDay()` - Get start of day in local time
  - `isWeekend()` - Check if Saturday/Sunday

### Hooks
- **`getSupabaseClient()`** - Supabase client for auth checks
- **`useToast()`** - Toast notifications
- **`useRouter()`** - Navigation after plan creation

### Types
- **`FlexibleSchedule`** - Schedule structure
- **`ScheduleDay`** - Single day in schedule
- **`CurriculumUnit`** - Unit structure from curriculum files

---

## 6. Step-by-Step Porting Guide

### Phase 1: Foundation (2 hours)

**Step 1.1:** Port schedule generation utilities
```bash
# Copy pure functions (no dependencies)
cp lib/shared/generateStudySchedule.ts NEW_PROJECT/lib/shared/
cp lib/shared/distributeResources.ts NEW_PROJECT/lib/shared/
```

**Step 1.2:** Port curriculum data
```bash
# Copy all static JSON files
cp -r data/curriculum NEW_PROJECT/data/
```

**Step 1.3:** Port validation schemas
```bash
cp lib/validation/plan.ts NEW_PROJECT/lib/validation/
```

**Step 1.4:** Test schedule generation (unit test)
```typescript
// __tests__/lib/shared/generateStudySchedule.test.ts
import { generateStudySchedule } from '@/lib/shared/generateStudySchedule';

describe('generateStudySchedule', () => {
  it('should generate 1-week plan with 2 subjects', () => {
    const schedule = generateStudySchedule(
      ['Math 20-1', 'Physics 20'],
      1, // 1 week
      false, // weekdays only
      undefined, // start today
      'resource' // resource-level distribution
    );

    expect(schedule.days.length).toBe(5); // 5 weekdays
    expect(schedule.days.every(day => day.units.length > 0)).toBe(true);
  });

  it('should include weekends when requested', () => {
    const schedule = generateStudySchedule(['Math 20-1'], 1, true);
    expect(schedule.days.length).toBe(7); // 7 days including weekends
  });

  it('should support multi-week plans', () => {
    const schedule = generateStudySchedule(['Math 20-1'], 3, false);
    expect(schedule.days.length).toBe(15); // 3 weeks * 5 weekdays
  });
});
```

---

### Phase 2: UI Components (3 hours)

**Step 2.1:** Extract GradeSelector component
```typescript
// components/plan-creation/GradeSelector.tsx
'use client';

import { Card } from '@/components/ui/card';

interface GradeSelectorProps {
  selectedGrade: number | null;
  onSelectGrade: (grade: number) => void;
}

export function GradeSelector({ selectedGrade, onSelectGrade }: GradeSelectorProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        1. Select Your Grade
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {[11, 12].map((grade) => (
          <Card
            key={grade}
            className={`p-6 cursor-pointer transition-all min-h-[100px] flex items-center justify-center ${
              selectedGrade === grade
                ? 'border-blue-500 border-2 bg-blue-50'
                : 'hover:border-gray-300 border-2 border-transparent'
            }`}
            onClick={() => onSelectGrade(grade)}
          >
            <p className="text-2xl font-bold">Grade {grade}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**Step 2.2:** Extract SubjectGrid component (similar pattern)

**Step 2.3:** Extract DurationSelector component (similar pattern)

**Step 2.4:** Extract WeekendToggle component (similar pattern)

---

### Phase 3: Business Logic Hook (2 hours)

**Step 3.1:** Create `usePlanCreation` hook
```typescript
// lib/hooks/usePlanCreation.ts
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/hooks/getSupabaseClient';
import { useToast } from '@/components/ui/toast';
import { generateStudySchedule } from '@/lib/shared/generateStudySchedule';
import { saveGuestPlan, saveGuestProgress, saveGuestStreak, getGuestPlanId } from '@/lib/guest/storage';

interface PlanParams {
  grade: number;
  subjects: string[];
  durationWeeks: number;
  includesWeekends: boolean;
}

export function usePlanCreation() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { showToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, [supabase]);

  const createPlan = async (params: PlanParams) => {
    setIsGenerating(true);

    try {
      if (isAuthenticated) {
        // Authenticated flow
        return await createAuthPlan(params);
      } else {
        // Guest flow
        return await createGuestPlan(params);
      }
    } catch (error) {
      console.error('Failed to create plan:', error);
      showToast('An error occurred. Please try again.', 'error');
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const createAuthPlan = async (params: PlanParams) => {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        displayName: null,
        reset: false // Preserve existing progress
      })
    });

    if (response.ok) {
      showToast('Your study plan has been created!', 'success');
      router.push('/dashboard');
      return true;
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to create plan', 'error');
      return false;
    }
  };

  const createGuestPlan = async (params: PlanParams) => {
    const schedule = generateStudySchedule(
      params.subjects,
      params.durationWeeks,
      params.includesWeekends,
      undefined, // startDate - use today
      'resource' // Force resource-level distribution
    );
    const totalUnits = schedule.days.reduce((acc, day) => acc + day.units.length, 0);

    const guestPlan = saveGuestPlan({
      grade: params.grade,
      subjects: params.subjects,
      schedule,
      totalUnits,
      durationWeeks: params.durationWeeks,
      includesWeekends: params.includesWeekends,
    });

    if (!guestPlan) {
      showToast('Failed to create guest plan', 'error');
      return false;
    }

    // Initialize empty progress/streak
    const guestPlanId = getGuestPlanId();
    saveGuestProgress({ guestPlanId, completedUnits: [], completedResources: [] });
    saveGuestStreak({ guestPlanId, currentStreak: 0, longestStreak: 0, studyDates: [] });

    showToast('Your preview plan is ready!', 'success');
    router.push('/plan/guest');
    return true;
  };

  return {
    createPlan,
    isGenerating,
    isAuthenticated
  };
}
```

---

### Phase 4: Refactored Page Component (1 hour)

**Step 4.1:** Create simplified page component
```typescript
// app/(dashboard)/plan/new/subjects/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { GradeSelector } from '@/components/plan-creation/GradeSelector';
import { SubjectGrid } from '@/components/plan-creation/SubjectGrid';
import { DurationSelector } from '@/components/plan-creation/DurationSelector';
import { WeekendToggle } from '@/components/plan-creation/WeekendToggle';
import { PlanSummary } from '@/components/plan-creation/PlanSummary';
import { usePlanCreation } from '@/lib/hooks/usePlanCreation';
import { Button } from '@/components/ui/button';

function PlanCreationContent() {
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [durationWeeks, setDurationWeeks] = useState<number>(1);
  const [includesWeekends, setIncludesWeekends] = useState<boolean>(false);

  const { createPlan, isGenerating, isAuthenticated } = usePlanCreation();

  const handleSubmit = async () => {
    if (!selectedGrade || selectedSubjects.length < 2) {
      return;
    }

    await createPlan({
      grade: selectedGrade,
      subjects: selectedSubjects,
      durationWeeks,
      includesWeekends
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Study Plan
          </h1>
          <p className="text-gray-600">
            Select your grade, subjects, and configure your study schedule
          </p>
        </div>

        <GradeSelector
          selectedGrade={selectedGrade}
          onSelectGrade={setSelectedGrade}
        />

        <SubjectGrid
          selectedGrade={selectedGrade}
          selectedSubjects={selectedSubjects}
          onToggleSubject={(subject) => {
            if (selectedSubjects.includes(subject)) {
              setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
            } else if (selectedSubjects.length < 12) {
              setSelectedSubjects([...selectedSubjects, subject]);
            }
          }}
        />

        <DurationSelector
          durationWeeks={durationWeeks}
          includesWeekends={includesWeekends}
          onChangeDuration={setDurationWeeks}
        />

        <WeekendToggle
          includesWeekends={includesWeekends}
          onToggle={setIncludesWeekends}
        />

        <PlanSummary
          selectedSubjects={selectedSubjects}
          durationWeeks={durationWeeks}
          includesWeekends={includesWeekends}
        />

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.back()} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedGrade || selectedSubjects.length < 2 || isGenerating}
            className="flex-1"
          >
            {isGenerating
              ? (isAuthenticated ? 'Creating...' : 'Creating Preview...')
              : (isAuthenticated ? 'Generate My Plan' : 'Create Preview')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlanCreationContent />
    </Suspense>
  );
}
```

---

### Phase 5: API Route (1 hour)

**Step 5.1:** Port API route (copy as-is for now)
```bash
cp app/api/plan/route.ts NEW_PROJECT/app/api/plan/
```

**Step 5.2:** (Optional) Extract to service layer
```typescript
// lib/services/plan-service.ts
export class PlanService {
  constructor(private supabase: SupabaseClient) {}

  async createOrUpdatePlan(userId: string, params: PlanParams) {
    // Validate subjects
    if (!isValidSubjects(params.subjects)) {
      throw new Error('Invalid subjects');
    }

    // Update profile
    await this.supabase.from('profiles').upsert({
      id: userId,
      grade: params.grade,
      display_name: params.displayName || null
    });

    // Generate schedule
    const schedule = generateStudySchedule(
      params.subjects,
      params.durationWeeks,
      params.includesWeekends,
      params.startDate,
      'resource' // Always use resource mode
    );

    const totalUnits = schedule.days.reduce((acc, day) => acc + day.units.length, 0);

    // Create plan via RPC
    const { data: plan, error } = await this.supabase.rpc('regenerate_study_plan', {
      p_subjects: params.subjects,
      p_schedule: schedule,
      p_total_units: totalUnits,
      p_duration_weeks: params.durationWeeks,
      p_includes_weekends: params.includesWeekends,
      p_reset: params.reset ?? false
    });

    if (error) throw error;
    return plan;
  }
}
```

---

### Phase 6: Testing (2 hours)

**Step 6.1:** Unit tests for schedule generation (see Phase 1)

**Step 6.2:** Integration test for API route
```typescript
// __tests__/api/plan/route.test.ts
describe('POST /api/plan', () => {
  it('should create plan for authenticated user', async () => {
    const response = await fetch('http://localhost:3000/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth_token=...' // Mock auth
      },
      body: JSON.stringify({
        grade: 11,
        subjects: ['Math 20-1', 'Physics 20'],
        durationWeeks: 1,
        includesWeekends: false
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.plan).toBeDefined();
  });

  it('should reject invalid subject count', async () => {
    const response = await fetch('http://localhost:3000/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        grade: 11,
        subjects: ['Math 20-1'], // Only 1 subject (min is 2)
        durationWeeks: 1,
        includesWeekends: false
      })
    });

    expect(response.status).toBe(400);
  });
});
```

**Step 6.3:** E2E test for plan creation flow
```typescript
// __tests__/e2e/plan-creation.test.ts
describe('Plan Creation Flow', () => {
  it('should create plan from wizard', async () => {
    // Navigate to plan creation
    await page.goto('http://localhost:3000/plan/new/subjects');

    // Select grade
    await page.click('text=Grade 11');

    // Select 2 subjects
    await page.click('text=Math 20-1');
    await page.click('text=Physics 20');

    // Set duration
    await page.fill('input[type="number"]', '2');

    // Submit
    await page.click('text=Generate My Plan');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('/dashboard');
  });
});
```

---

## 7. Testing Checklist

### Unit Tests
- [ ] `generateStudySchedule()` - Various durations (1-12 weeks)
- [ ] `generateStudySchedule()` - Weekend inclusion on/off
- [ ] `generateStudySchedule()` - Resource vs unit distribution modes
- [ ] `distributeResourcesAcrossDays()` - Outcome uniqueness
- [ ] `distributeResourcesAcrossDays()` - Load balancing
- [ ] `isValidSubjects()` - Subject validation

### Integration Tests
- [ ] API route - Create plan (authenticated)
- [ ] API route - Update plan (regenerate)
- [ ] API route - Invalid inputs (400 errors)
- [ ] API route - Unauthorized (401 error)
- [ ] RPC function - Plan creation in database
- [ ] RPC function - Progress reset when `reset=true`
- [ ] RPC function - Progress preserved when `reset=false`

### Manual Testing
- [ ] **Grade Selection**
  - [ ] Click Grade 11 → highlights
  - [ ] Click Grade 12 → highlights
  - [ ] Switch grades → updates subject list

- [ ] **Subject Selection**
  - [ ] Select 2+ subjects → enables submit
  - [ ] Select < 2 subjects → submit disabled
  - [ ] Select 12 subjects → additional subjects disabled
  - [ ] Subjects grouped by grade level

- [ ] **Duration Selection**
  - [ ] Select 1 week → calculates 5 days (weekdays)
  - [ ] Select 1 week + weekends → calculates 7 days
  - [ ] Custom duration (1-12) → validates range
  - [ ] Summary updates dynamically

- [ ] **Plan Generation**
  - [ ] Authenticated user → calls API, redirects to /dashboard
  - [ ] Guest user → generates client-side, redirects to /plan/guest
  - [ ] Loading state → shows spinner, disables submit
  - [ ] Success → shows toast, navigates
  - [ ] Error → shows error toast, stays on page

- [ ] **Schedule Quality**
  - [ ] Units distributed evenly across days
  - [ ] No duplicate outcomes in schedule
  - [ ] Resources sorted by type (video → article → practice)
  - [ ] Multi-week plans have week labels
  - [ ] Weekend days excluded when `includesWeekends=false`

---

## 8. Migration Risks & Mitigation

### Risk 1: Schedule Generation Algorithm Bugs
**Symptom:** Uneven distribution, duplicate outcomes, missing units

**Mitigation:**
- Pure functions = easy to test
- Add comprehensive unit tests (various durations, subject counts)
- Dev-mode diagnostics already in `distributeResources.ts`
- Test with real curriculum data (all 20+ subjects)

### Risk 2: Guest Mode Data Loss
**Symptom:** Guest plan lost on page refresh

**Mitigation:**
- LocalStorage is stable (survives refresh)
- Add `beforeunload` warning if guest plan exists
- Test cross-tab sync (storage events)
- Consider IndexedDB fallback (more storage)

### Risk 3: RPC Function Failure
**Symptom:** Plan creation fails with RPC error

**Mitigation:**
- RPC function is atomic (rolls back on error)
- Test RPC function directly in Supabase SQL editor
- Add error logging in API route
- Fallback: Direct table INSERT if RPC fails (no progress reset)

---

## 9. Performance Considerations

### 1. Client-Side Schedule Generation ✅
- Pure functions run in < 100ms (even with 12 subjects)
- No server round-trip for guest mode

### 2. RPC Function Performance ⚠️
- Single RPC call = atomic transaction
- **Optimization:** Could parallelize profile upsert + plan upsert
- **Current:** ~50-100ms (acceptable)

### 3. Subject Validation ⚠️
- Currently: O(n) loop through curriculum files
- **Optimization:** Pre-build subject index:
  ```typescript
  // data/curriculum/index.ts
  const VALID_SUBJECTS = new Set([
    'Math 20-1', 'Math 30-1', 'Physics 20', ...
  ]);
  export function isValidSubject(subject: string) {
    return VALID_SUBJECTS.has(subject);
  }
  ```

---

## 10. Dependencies for Next Features

### This Feature is Required By:
- ✅ **Dashboard** (#3) - Displays plan and progress
- ✅ **Study Mode** (#10) - Shows daily units
- ✅ **Progress Tracking** (#5) - Tracks unit completion

### This Feature Depends On:
- ✅ **Authentication** (#1) - User ID for plan ownership
- ✅ **Curriculum Data** - Static JSON files (must port first)

---

## 11. Success Criteria

✅ **Feature is successfully ported when:**
1. Users can create plans with 2-12 subjects
2. Plans support 1-12 weeks duration
3. Weekend inclusion toggle works
4. Authenticated users → plan saved to database
5. Guest users → plan saved to LocalStorage
6. Schedule generation produces valid, balanced schedules
7. No duplicate outcomes in schedules
8. Resources sorted by type (video → article → practice)
9. API route handles all edge cases (validation, errors)
10. All tests pass (unit + integration + manual)

---

**Next Feature:** [03-student-dashboard-progress.md](./03-student-dashboard-progress.md)
