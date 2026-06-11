# SteadyTrack Dependency Map & Architecture Analysis

**Generated**: October 13, 2025
**Purpose**: Comprehensive analysis for major refactor initiative
**Branch**: `refactor/dependency-analysis`

---

## Table of Contents

1. [Database Schema & Relationships](#1-database-schema--relationships)
2. [Component Dependency Matrix](#2-component-dependency-matrix)
3. [Data Flow Patterns](#3-data-flow-patterns)
4. [Route Dependencies](#4-route-dependencies)
5. [Shared Components & Usage](#5-shared-components--usage)
6. [Identified Issues & Coupling](#6-identified-issues--coupling)
7. [Refactor Recommendations](#7-refactor-recommendations)

---

## 1. Database Schema & Relationships

### 1.1 Core Tables

#### **profiles**
Extends Supabase auth.users with student-specific data.

```sql
profiles
├── id: UUID (PK, FK → auth.users.id ON DELETE CASCADE)
├── grade: INTEGER (11 or 12)
├── timezone: TEXT (IANA timezone, default: 'UTC')
├── display_name: TEXT (optional, for parent dashboard)
└── created_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `auth.users` (1:1)
- Children: `study_plans` (1:1)

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE their own profile

---

#### **study_plans**
Main study plan with flexible schedule supporting 1-12 weeks.

```sql
study_plans
├── id: UUID (PK)
├── user_id: UUID (FK → auth.users.id ON DELETE CASCADE)
├── subjects: TEXT[] (2-6 subjects, now supports up to 12 via migration)
├── schedule: JSONB (flexible schedule structure)
├── total_units: INTEGER (precomputed for performance)
├── duration_weeks: INTEGER (1-12)
├── includes_weekends: BOOLEAN
├── start_date: DATE (locked at creation)
├── end_date: DATE (computed from schedule)
├── status: TEXT ('active', 'completed', 'expired', 'archived')
├── current_day_index: INTEGER (manual day override, 0-based)
├── locked_timezone: TEXT (timezone locked at plan creation)
├── completed_at: TIMESTAMPTZ (when all units completed)
├── expired_at: TIMESTAMPTZ (when plan expired)
├── archived_at: TIMESTAMPTZ (when user archived)
└── created_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `profiles` via `user_id` (1:1 unique index)
- Children: `user_progress`, `resource_progress` (1:N)

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE/DELETE their own plans

**Indexes:**
- `idx_study_plans_user_id_unique` (UNIQUE)
- `idx_study_plans_user_status`
- `idx_study_plans_user_end_date`

---

#### **user_progress**
Tracks unit-level completion for streak calculations.

```sql
user_progress
├── id: UUID (PK)
├── user_id: UUID (FK → auth.users.id ON DELETE CASCADE)
├── plan_id: UUID (FK → study_plans.id ON DELETE CASCADE)
├── subject: TEXT
├── unit_id: TEXT
├── completed: BOOLEAN (default: TRUE)
├── completed_at: TIMESTAMPTZ (for streak & weekly summary)
└── created_at: TIMESTAMPTZ

UNIQUE(user_id, plan_id, unit_id)
```

**Relationships:**
- Parent: `study_plans` via `plan_id` (N:1)
- Used by: `study_streaks` calculation

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE/DELETE their own progress

**Indexes:**
- `idx_user_progress_plan_unit` (UNIQUE)
- `user_progress_user_date_idx` (composite: user_id, completed_at DESC)
- `idx_user_progress_completed_at`
- `idx_user_progress_plan_id`

---

#### **study_streaks**
Tracks current/longest streak and total study days.

```sql
study_streaks
├── id: UUID (PK)
├── user_id: UUID (UNIQUE, FK → auth.users.id ON DELETE CASCADE)
├── current_streak: INTEGER (default: 0)
├── longest_streak: INTEGER (default: 0)
├── last_study_date: DATE
├── total_study_days: INTEGER (default: 0)
└── updated_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `profiles` via `user_id` (1:1)
- Updated by: `mark_unit_complete`, `undo_unit_progress` RPCs

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE their own streak

**Indexes:**
- `idx_study_streaks_user_id`

---

#### **parent_access**
Share links for parent dashboard access.

```sql
parent_access
├── id: UUID (PK)
├── student_user_id: UUID (FK → auth.users.id ON DELETE CASCADE)
├── share_token: TEXT (UNIQUE)
├── is_active: BOOLEAN (default: TRUE)
└── created_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `profiles` via `student_user_id` (1:N)
- Accessed by: `parent_dashboard_overview` RPC

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE/DELETE their own share links
- Parents read via RPC (no direct access)

**Indexes:**
- `idx_parent_access_share_token` (UNIQUE)
- `idx_parent_access_student_id`

---

#### **resource_progress**
Tracks resource-level completion (more granular than unit).

```sql
resource_progress
├── id: UUID (PK)
├── user_id: UUID (FK → auth.users.id ON DELETE CASCADE)
├── plan_id: UUID (FK → study_plans.id ON DELETE CASCADE)
├── unit_id: TEXT
├── resource_url: TEXT (unique identifier)
├── completed: BOOLEAN (default: TRUE)
├── completed_at: TIMESTAMPTZ
└── created_at: TIMESTAMPTZ

UNIQUE(user_id, plan_id, unit_id, resource_url)
```

**Relationships:**
- Parent: `study_plans` via `plan_id` (N:1)
- Complements: `user_progress` (more granular tracking)

**RLS Policies:**
- Students can SELECT/INSERT/UPDATE/DELETE their own resource progress

**Indexes:**
- `idx_resource_progress_user_plan`
- `idx_resource_progress_unit`

---

#### **events**
Analytics and telemetry tracking.

```sql
events
├── id: UUID (PK)
├── user_id: UUID (FK → auth.users.id ON DELETE SET NULL)
├── event_name: TEXT
├── event_data: JSONB
└── created_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `profiles` via `user_id` (N:1, nullable)

**RLS Policies:**
- Authenticated users can INSERT their own events
- Only service_role can SELECT/DELETE (for reporting)

**Indexes:**
- `idx_events_user_id`
- `idx_events_event_name`
- `idx_events_created_at`

---

#### **content_microcards**
AI-generated study cards aligned to curriculum outcomes.

```sql
content_microcards
├── id: UUID (PK)
├── subject: TEXT
├── unit_id: TEXT
├── outcome_code: TEXT
├── summary: TEXT
├── steps: TEXT[]
├── pitfall: TEXT (nullable)
├── quick_check: JSONB ({ question, choices, answer, explanation })
├── recommended_resource_url: TEXT (nullable)
├── sources: JSONB (array of source references)
├── version: INTEGER
├── status: TEXT ('active', 'draft', 'archived')
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ
```

**Relationships:**
- Linked to: `quick_check_results` via `microcard_id`

**Usage:**
- Read by: Dashboard, Study Mode, Curriculum Browser
- Written by: `scripts/generate_microcards.ts`

---

#### **quick_check_results**
Tracks quiz attempts from microcards.

```sql
quick_check_results
├── id: UUID (PK)
├── user_id: UUID (FK → auth.users.id ON DELETE CASCADE)
├── plan_id: UUID (nullable, for tracking)
├── subject: TEXT
├── unit_id: TEXT (nullable)
├── outcome_code: TEXT (nullable)
├── microcard_id: TEXT (nullable)
├── correct: BOOLEAN
├── selected: TEXT (nullable, user's choice)
└── created_at: TIMESTAMPTZ
```

**Relationships:**
- Parent: `profiles` via `user_id` (N:1)
- Referenced by: Weekly activity calculations

**Usage:**
- Contributes to weekly summary and streak tracking (activity dates)

---

### 1.2 Database Relationships Diagram

```
auth.users (Supabase Auth)
    │
    ├─→ profiles (1:1)
    │       │
    │       ├─→ study_plans (1:1 unique)
    │       │       │
    │       │       ├─→ user_progress (1:N)
    │       │       │       └─→ Updates study_streaks
    │       │       │
    │       │       └─→ resource_progress (1:N)
    │       │
    │       ├─→ study_streaks (1:1)
    │       │
    │       ├─→ parent_access (1:N)
    │       │
    │       ├─→ events (1:N, nullable)
    │       │
    │       └─→ quick_check_results (1:N)
    │
    └─→ content_microcards (standalone, no FK to users)
```

---

### 1.3 RPC Functions

#### **parent_dashboard_overview(p_share_token text)**
Returns complete student data for parent dashboard via share token.

**Input:** Share token (string)
**Output:** JSONB with student_user_id, plan, streak, progress array
**Security:** SECURITY DEFINER, accessible by anon + authenticated
**Tables Accessed:**
- `parent_access` (validate token)
- `study_plans` (latest plan)
- `study_streaks` (current streak)
- `user_progress` (all progress records)

**Used By:**
- `app/share/[token]/page.tsx`
- `app/parent/[token]/page.tsx`
- `components/parent/ParentDashboard.tsx`

---

#### **mark_unit_complete(p_plan_id uuid, p_subject text, p_unit_id text)**
Atomically marks a unit complete and updates streak if first completion today.

**Input:** Plan ID, subject, unit ID
**Output:** JSONB with success, streakIncreased, newStreak, milestone
**Security:** SECURITY DEFINER, accessible by anon + authenticated
**Logic:**
1. Validate plan belongs to user
2. Insert into `user_progress` (ON CONFLICT DO NOTHING)
3. If first completion today: update `study_streaks`
4. Calculate milestone (25%, 50%, 75%, 100%)
5. Insert analytics event

**Tables Modified:**
- `user_progress` (INSERT)
- `study_streaks` (INSERT/UPDATE)
- `events` (INSERT)

**Used By:**
- `app/api/progress/route.ts` (POST handler)
- `app/api/progress/bulk/route.ts`
- Dashboard components via API

---

#### **undo_unit_progress(p_plan_id uuid, p_unit_id text)**
Removes unit completion and recalculates streak from scratch.

**Input:** Plan ID, unit ID
**Output:** JSONB with success, newStreak
**Security:** SECURITY DEFINER, accessible by anon + authenticated
**Logic:**
1. Delete from `user_progress`
2. Recompute streak by scanning all remaining progress dates
3. Update `study_streaks` with new values
4. Insert analytics event

**Tables Modified:**
- `user_progress` (DELETE)
- `study_streaks` (UPDATE)
- `events` (INSERT)

**Used By:**
- `app/api/progress/route.ts` (DELETE handler)
- Dashboard components via API

---

#### **regenerate_study_plan(...)**
Atomically creates or updates study plan with optional progress reset.

**Input:** subjects, schedule, total_units, duration_weeks, includes_weekends, reset
**Output:** study_plans row
**Security:** SECURITY DEFINER, accessible by authenticated
**Logic:**
1. Get user timezone from profiles
2. Parse dates from schedule JSONB
3. UPSERT study_plan (ON CONFLICT user_id)
4. If reset=true: DELETE user_progress, RESET study_streaks
5. Insert analytics event

**Tables Modified:**
- `study_plans` (INSERT/UPDATE)
- `user_progress` (DELETE if reset)
- `study_streaks` (RESET if reset)
- `events` (INSERT)

**Used By:**
- `app/api/plan/route.ts` (POST handler)
- Plan creation flow

---

#### **get_effective_day_index(p_plan_id uuid)**
Calculates the current effective day index for a plan.

**Input:** Plan ID
**Output:** INTEGER (day index)
**Logic:**
- Uses locked_timezone to compute local "today"
- Returns max(auto_day, manual_day), capped at last day of schedule

**Used By:**
- Plan view pages for determining "current day"

---

#### **advance_plan_day(p_plan_id uuid, p_mode text)**
Manually advances plan to next day and updates status if complete/expired.

**Input:** Plan ID, mode (default: 'manual')
**Output:** JSONB with success, new_day_index, status
**Logic:**
- Increment current_day_index
- Check if plan completed (all units done) or expired (past end_date)
- Update status accordingly

**Used By:**
- Plan navigation UI

---

#### **update_plan_status(p_plan_id uuid)**
Idempotent status checker - updates plan status based on completion and date.

**Input:** Plan ID
**Output:** TEXT (status)
**Logic:**
- If archived: return 'archived'
- If completed all units: set 'completed'
- If past end_date: set 'expired'
- Else: return 'active'

**Used By:**
- Dashboard and plan view pages

---

### 1.4 Key Indexes for Performance

**Most Critical Indexes:**
1. `user_progress_user_date_idx` (user_id, completed_at DESC)
   - Accelerates date-window scans for weekly summaries
   - Used heavily in dashboard queries

2. `idx_study_plans_user_id_unique` (UNIQUE)
   - Enforces 1:1 user:plan relationship
   - Fast plan lookup by user

3. `idx_user_progress_plan_unit` (UNIQUE)
   - Prevents duplicate completions
   - Fast unit completion checks

4. `idx_parent_access_share_token` (UNIQUE)
   - Fast parent dashboard token lookups
   - Security-critical

---

## 2. Component Dependency Matrix

### 2.1 Most Reused Components

#### **UI Components** (`components/ui/`)
- **Button** - Used 50+ times across all pages
  - `components/ui/button.tsx`
  - Imports: `lib/utils.ts` (className utility)
  - Usage: Every interactive element

- **Card** - Used 40+ times
  - `components/ui/card.tsx`
  - Variants: CardHeader, CardTitle, CardContent
  - Usage: Dashboard, Plan view, Landing page

- **Toast** - Used 20+ times
  - `components/ui/toast.tsx`
  - Managed by: `useToast` hook
  - Usage: All success/error notifications

- **Dialog** - Used 10+ times
  - `components/ui/dialog.tsx`
  - Usage: Modals, confirmations

- **Skeleton** - Used 8+ times
  - `components/ui/skeleton.tsx`
  - Usage: Loading states

- **Progress** - Used 5+ times
  - `components/ui/progress.tsx`
  - Usage: Subject progress bars

---

#### **Layout Components**
- **Footer** - Used 8+ times
  - `components/landing/Footer.tsx`
  - Imports: `lib/constants.ts`
  - Pages: Landing, Dashboard, Settings, Curriculum

- **DashboardHeader** - Used 3 times
  - `components/dashboard/DashboardHeader.tsx`
  - Usage: Dashboard, Settings
  - Contains: Navigation, user menu

---

#### **Domain Components**
- **MicrocardModal** - Used 3+ times
  - `components/microcards/MicrocardModal.tsx`
  - Dependencies: `MicrocardContent`, `QuickCheckCard`
  - Usage: Dashboard, Plan view, Curriculum browser

- **GoogleAuthButton** - Used 2 times
  - `components/auth/GoogleAuthButton.tsx`
  - Usage: Landing hero, Login page

---

### 2.2 Largest Components (Refactor Candidates)

#### **1. SubjectProgressCard.tsx** (515 lines)
**Location:** `components/dashboard/SubjectProgressCard.tsx`

**Dependencies:**
```typescript
// Internal
import ProgressBar from '@/components/dashboard/ProgressBar'
import CurriculumPanel from '@/components/plan/CurriculumPanel'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

// Lib
import { getCurriculumData } from '@/data/curriculum'
import type { UserProgress, UnitItem } from '@/lib/types'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
```

**Tables Accessed:**
- `content_microcards` (reads for microcard data)

**Complexity:**
- Manages unit checklist state
- Handles progress updates
- Shows microcard viewer
- Displays curriculum alignment
- Has outcome-level breakdown

**Refactor Suggestions:**
- Extract unit checklist logic → separate component
- Extract microcard viewer → shared component
- Reduce responsibilities (SRP violation)

---

#### **2. UnitCheckbox.tsx** (442 lines)
**Location:** `components/plan/UnitCheckbox.tsx`

**Dependencies:**
```typescript
import MicrocardModal from '@/components/microcards/MicrocardModal'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
import { useMicrocards } from '@/hooks/useMicrocards'
import { useQuickCheck } from '@/hooks/useQuickCheck'
import type { UnitItem, ProgressUpdatePayload } from '@/lib/types'
```

**Tables Accessed:**
- `quick_check_results` (reads/writes quiz attempts)

**Complexity:**
- Checkbox with microcard integration
- Quick check quiz functionality
- Progress update handling
- Complex conditional rendering

**Refactor Suggestions:**
- Split into: UnitCheckbox (simple) + MicrocardCheckbox (complex)
- Extract quick check logic to separate hook

---

#### **3. settings-subjects-card.tsx** (426 lines)
**Location:** `components/settings/settings-subjects-card.tsx`

**Dependencies:**
```typescript
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
import { getCurriculumData } from '@/data/curriculum'
```

**Tables Accessed:**
- `profiles` (reads/updates grade, display_name)
- `study_plans` (reads current plan)

**Complexity:**
- Subject selection UI
- Plan modification warnings
- Curriculum validation

**Refactor Suggestions:**
- Extract subject selector → reusable component
- Simplify conditional logic

---

#### **4. DashboardClient.tsx** (418 lines)
**Location:** `components/dashboard/DashboardClient.tsx`

**Dependencies:**
```typescript
// 9 component imports
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import StreakHero from '@/components/dashboard/StreakHero'
import SubjectProgressCard from '@/components/dashboard/SubjectProgressCard'
import TodaysFocus from '@/components/dashboard/TodaysFocus'
import YourProgress from '@/components/dashboard/YourProgress'
import CelebrationModal from '@/components/dashboard/CelebrationModal'
import Footer from '@/components/landing/Footer'
import { useToast } from '@/components/ui/toast'

// Types & utilities
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
import { getCurriculumData } from '@/data/curriculum'
```

**Tables Accessed:**
- `study_streaks` (reads/updates)
- `user_progress` (reads)
- `quick_check_results` (reads for activity)
- `resource_progress` (reads for activity)

**Complexity:**
- Central orchestrator for dashboard
- Manages local state for progress, streak, weekly summary
- Computes weekly summary client-side
- Handles progress updates and celebrations
- Manages live refresh on focus/visibility

**Refactor Suggestions:**
- Extract state management → custom hook (useDashboardState)
- Extract weekly summary calculation → utility function
- Reduce prop drilling

---

#### **5. settings-account-card.tsx** (420 lines)
**Location:** `components/settings/settings-account-card.tsx`

**Dependencies:**
```typescript
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
```

**Tables Accessed:**
- `profiles` (reads/updates timezone)

**Complexity:**
- Timezone management
- Account deletion flow
- Data export
- Confirmation modals

**Refactor Suggestions:**
- Extract timezone selector → reusable component
- Extract deletion flow → separate component
- Use compound components pattern

---

### 2.3 Component Usage by Route

#### **Landing Page** (`app/page.tsx`)
```typescript
// Components used (10 total)
Hero
SubjectBrowser
StickyNav
ProblemSolutionCard
CurriculumShowcase
MotivationDemo
HowItWorks
FAQ
Footer
GoogleAuthButton (nested in Hero)
```

**Data Access:** None (static content)

---

#### **Dashboard** (`app/(dashboard)/dashboard/page.tsx` → `DashboardClient.tsx`)
```typescript
// Components used (8 total)
DashboardHeader
StreakHero
TodaysFocus
YourProgress
SubjectProgressCard (one per subject, 2-12x)
CelebrationModal
Footer
DashboardSkeleton (loading state)
```

**Data Access:**
- Server: `study_plans`, `study_streaks`, `user_progress`
- Client: `quick_check_results`, `resource_progress` (for weekly summary)

**Key Dependencies:**
- `lib/services/progress.ts` (not used in latest refactor, data computed in page)
- `data/curriculum` (for unit metadata)

---

#### **Plan View** (`app/(dashboard)/plan/[id]/page.tsx`)
```typescript
// Components used (3 main + nested)
PlanDayCard (one per day)
  └─→ UnitCheckbox (one per unit)
      └─→ MicrocardModal (conditionally)
NextUpCard
CurriculumDocLinks
```

**Data Access:**
- `study_plans` (plan schedule)
- `user_progress` (completion status)
- `resource_progress` (resource-level status)

---

#### **Study Mode** (`app/(dashboard)/plan/[id]/study/page.tsx`)
```typescript
// Components used (5 main)
StudyModeHeader
OutcomeSidebar
MicrocardViewer
  └─→ QuickCheckCard
MobileSidebarDrawer
MobileBottomNav
```

**Data Access:**
- `study_plans` (plan context)
- `content_microcards` (microcard content)
- `quick_check_results` (quiz attempts)
- `resource_progress` (resource completion tracking)

---

#### **Settings** (`app/(dashboard)/settings/page.tsx`)
```typescript
// Components used (5 total)
DashboardHeader
SettingsSubjectsCard
SettingsParentCard
SettingsAccountCard
Footer
```

**Data Access:**
- `profiles` (grade, timezone, display_name)
- `parent_access` (share links)

---

#### **Parent Dashboard** (`app/share/[token]/page.tsx`)
```typescript
// Components used (2 main + nested)
ParentDashboard
  └─→ SubjectProgressList
  └─→ StreakBadge
  └─→ WeeklyCheckmarks
  └─→ ReassuranceMessage
  └─→ LastUpdated
InvalidTokenPage (if token invalid)
```

**Data Access:**
- RPC: `parent_dashboard_overview(token)` (single query)

---

#### **Curriculum Browser** (`app/curriculum/[slug]/page.tsx`)
```typescript
// Components used (3 main)
SubjectCard
UnitAccordion
SubjectShareButton
```

**Data Access:**
- Static curriculum data from `data/curriculum`

---

### 2.4 Shared Hook Dependencies

#### **getSupabaseClient** (`hooks/getSupabaseClient.ts`)
Returns Supabase client for client-side queries.

**Used By:** 15+ components
- All dashboard components
- All settings components
- Plan view components
- Study mode components

**Import Pattern:**
```typescript
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
const supabase = getSupabaseClient()
```

---

#### **useMicrocards** (`hooks/useMicrocards.ts`)
Fetches microcards for a given subject and unit.

**Used By:**
- `SubjectProgressCard.tsx`
- `UnitCheckbox.tsx`

**Tables Accessed:**
- `content_microcards`

---

#### **useQuickCheck** (`hooks/useQuickCheck.ts`)
Manages quick check quiz state and submission.

**Used By:**
- `UnitCheckbox.tsx`
- `QuickCheckCard.tsx`
- `DashboardClient.tsx` (for activity calculation)

**Tables Accessed:**
- `quick_check_results`

---

## 3. Data Flow Patterns

### 3.1 Primary Data Flow: Supabase → UI

```
┌─────────────────────────────────────────────────────────┐
│ Supabase Database (PostgreSQL + RLS)                    │
│  - profiles, study_plans, user_progress, etc.           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├── Direct Table Queries (via Supabase JS SDK)
                  │   ├─→ Server Components (app/**/page.tsx)
                  │   │    └─→ Pass data as props to Client Components
                  │   │
                  │   └─→ Client Components (getSupabaseClient hook)
                  │        └─→ Direct reads for dynamic updates
                  │
                  └── RPC Function Calls (via .rpc())
                      ├─→ API Routes (app/api/**/route.ts)
                      │    └─→ Return JSON to client
                      │
                      └─→ Client Components (via fetch)
                           └─→ Update local state
```

---

### 3.2 Progress Update Flow (Critical Path)

```
User checks unit checkbox
    │
    ├── Client: UnitCheckbox.tsx
    │     └─→ Calls POST /api/progress
    │
    ├── API: app/api/progress/route.ts
    │     ├─→ Validates plan ownership
    │     ├─→ Calls RPC: mark_unit_complete(planId, subject, unitId)
    │     └─→ Returns { success, streakIncreased, newStreak, milestone }
    │
    ├── Database: mark_unit_complete() RPC
    │     ├─→ INSERT into user_progress (idempotent via ON CONFLICT)
    │     ├─→ Check if first completion today
    │     ├─→ UPDATE study_streaks if streak increased
    │     ├─→ Calculate milestone (25%, 50%, 75%, 100%)
    │     └─→ INSERT into events (analytics)
    │
    └── Client: DashboardClient.tsx (via handleProgressUpdate)
          ├─→ Updates local progress state (immediate feedback)
          ├─→ Recomputes weekly summary
          ├─→ Updates streak display
          ├─→ Shows celebration modal if milestone reached
          └─→ Shows toast if streak increased
```

**Performance Optimizations:**
- Idempotent ON CONFLICT prevents duplicate progress
- Streak calculated server-side (single transaction)
- Client updates local state immediately (optimistic UI)
- No extra roundtrips for streak/summary (computed locally)

---

### 3.3 Dashboard Data Loading Flow

```
User navigates to /dashboard
    │
    ├── Server: app/(dashboard)/dashboard/page.tsx
    │     ├─→ Query: study_plans (user's plan)
    │     ├─→ Query: study_streaks (current streak)
    │     ├─→ Query: user_progress (all progress records)
    │     └─→ Compute: todaysUnits from plan.schedule
    │
    ├── Server → Client: Pass props to DashboardClient
    │
    └── Client: DashboardClient.tsx
          ├─→ On mount: Fetch quick_check_results + resource_progress
          │             (to augment weekly summary with all activity types)
          │
          ├─→ On focus/visibility: Refresh all data
          │     ├─→ Re-fetch study_streaks
          │     ├─→ Re-fetch user_progress
          │     ├─→ Re-fetch quick_check_results
          │     ├─→ Re-fetch resource_progress
          │     └─→ Recompute weekly summary
          │
          └── Render:
                ├─→ StreakHero (shows current/longest streak)
                ├─→ TodaysFocus (shows today's units)
                ├─→ YourProgress (weekly summary)
                └─→ SubjectProgressCard (one per subject)
```

**Key Pattern:**
- **Server-side initial load** (fast first render)
- **Client-side refresh** (live updates when user returns)
- **Optimistic UI updates** (no loading spinners on progress toggle)

---

### 3.4 Parent Dashboard Flow (Secure Token-Based Access)

```
Parent receives share link: /share/{token}
    │
    ├── Server: app/share/[token]/page.tsx
    │     └─→ RPC: parent_dashboard_overview(token)
    │           ├─→ Validates token in parent_access table
    │           ├─→ Fetches student's plan, streak, progress
    │           └─→ Returns JSONB or NULL (if invalid)
    │
    └── Client: ParentDashboard.tsx
          ├─→ If data: Display read-only dashboard
          │     ├─→ SubjectProgressList
          │     ├─→ StreakBadge
          │     ├─→ WeeklyCheckmarks
          │     └─→ ReassuranceMessage
          │
          └─→ If NULL: Show InvalidTokenPage
```

**Security Model:**
- No auth required for parent dashboard
- Token validated server-side via RPC
- RPC uses SECURITY DEFINER to bypass RLS
- Parent cannot modify any data (read-only)

---

### 3.5 Plan Generation Flow

```
User completes /plan/new form
    │
    ├── Client: app/(dashboard)/plan/new/subjects/page.tsx
    │     └─→ POST /api/plan with { grade, subjects, durationWeeks, includesWeekends, startDate }
    │
    ├── API: app/api/plan/route.ts
    │     ├─→ Validate subjects with isValidSubjectsForGrade()
    │     ├─→ Call generateStudySchedule() (pure function)
    │     │     ├─→ Collects all units from data/curriculum
    │     │     ├─→ Uses distributeResourcesAcrossDays() for resource-level distribution
    │     │     └─→ Returns FlexibleSchedule (days with units)
    │     │
    │     └─→ RPC: regenerate_study_plan(subjects, schedule, totalUnits, ...)
    │           ├─→ UPSERT profiles (grade, display_name)
    │           ├─→ UPSERT study_plans (ON CONFLICT user_id)
    │           ├─→ DELETE user_progress (if reset=true)
    │           ├─→ RESET study_streaks (if reset=true)
    │           └─→ INSERT into events
    │
    └── Client: Redirect to /dashboard
```

**Key Functions:**
- `generateStudySchedule()` in `lib/shared/generateStudySchedule.ts`
- `distributeResourcesAcrossDays()` in `lib/shared/distributeResources.ts`
- Both are **pure functions** (can run on client or server)

---

### 3.6 Study Mode Flow

```
User clicks "Study" button → /plan/{id}/study
    │
    ├── Server: app/(dashboard)/plan/[id]/study/page.tsx
    │     ├─→ Query: study_plans (plan context)
    │     ├─→ Query: content_microcards (for all outcomes in plan)
    │     ├─→ Query: quick_check_results (user's past attempts)
    │     └─→ Query: resource_progress (resource completion status)
    │
    └── Client: Study mode layout
          ├─→ StudyModeHeader (navigation)
          ├─→ OutcomeSidebar (outcome list, progress tracking)
          │     └─→ Click outcome → Update URL with ?outcome={code}
          │
          ├─→ MicrocardViewer (when outcome selected)
          │     ├─→ Shows microcard content
          │     ├─→ Embedded QuickCheckCard
          │     └─→ Submit quiz → POST to quick_check_results
          │
          └─→ MobileBottomNav (mobile navigation)
```

**State Management:**
- URL params for current outcome (`?outcome={code}`)
- Local state for sidebar open/closed
- Supabase real-time updates for completion status

---

## 4. Route Dependencies

### 4.1 Route Protection Matrix

| Route                           | Auth Required | Middleware Redirect       | Data Dependencies                     |
|---------------------------------|---------------|---------------------------|---------------------------------------|
| `/`                             | No            | None                      | Static curriculum data                |
| `/login`                        | No            | → `/dashboard` if auth    | None                                  |
| `/dashboard`                    | **Yes**       | → `/login` if no auth     | `study_plans`, `study_streaks`, `user_progress` |
| `/plan/new`                     | **Yes**       | → `/login` if no auth     | `profiles` (to check existing plan)   |
| `/plan/new/subjects`            | **Yes**       | → `/login` if no auth     | `profiles`, `study_plans`             |
| `/plan/guest`                   | No            | → `/dashboard` if auth    | Local storage (guest plan)            |
| `/plan/[id]`                    | **Yes**       | → `/login` if no auth     | `study_plans`, `user_progress`, `resource_progress` |
| `/plan/[id]/study`              | **Yes**       | → `/login` if no auth     | `study_plans`, `content_microcards`, `quick_check_results`, `resource_progress` |
| `/plan/[id]/study/[resourceId]` | **Yes**       | → `/login` if no auth     | `study_plans`, `resource_progress`    |
| `/settings`                     | **Yes**       | → `/login` if no auth     | `profiles`, `parent_access`           |
| `/onboarding`                   | **Yes**       | → `/login` if no auth     | `profiles`                            |
| `/share/[token]`                | No            | None                      | RPC: `parent_dashboard_overview`      |
| `/parent/[token]`               | No            | None                      | RPC: `parent_dashboard_overview`      |
| `/curriculum`                   | No            | None                      | Static curriculum data                |
| `/curriculum/[slug]`            | No            | None                      | Static curriculum data                |
| `/terms`                        | No            | None                      | None                                  |
| `/privacy`                      | No            | None                      | None                                  |
| `/api/*`                        | **Varies**    | API routes handle auth    | Varies by endpoint                    |

---

### 4.2 Middleware Logic

**File:** `middleware.ts`

**Protected Routes:**
- `/dashboard`, `/onboarding`, `/settings`
- `/plan/[id]` (but NOT `/plan/new` or `/plan/guest`)

**Public Routes (redirect if authenticated):**
- `/login` → `/dashboard`

**Guest Plan Special Case:**
- `/plan/guest` allows unauthenticated access
- If authenticated AND no postAuth/migrate params → redirect to `/dashboard`

**Session Refresh:**
- Middleware calls `supabase.auth.getSession()` to refresh session
- Uses `redirectWithCookies()` to preserve session cookies (critical for auth)

---

### 4.3 API Routes Dependencies

| Endpoint                          | Method | Auth Required | Tables Modified                       | RPC Called                          |
|-----------------------------------|--------|---------------|---------------------------------------|-------------------------------------|
| `/api/plan`                       | POST   | Yes           | `profiles`, `study_plans`, `user_progress`, `study_streaks`, `events` | `regenerate_study_plan()` |
| `/api/progress`                   | POST   | Yes           | `user_progress`, `study_streaks`, `events` | `mark_unit_complete()` |
| `/api/progress`                   | DELETE | Yes           | `user_progress`, `study_streaks`, `events` | `undo_unit_progress()` |
| `/api/progress/bulk`              | POST   | Yes           | `user_progress`, `study_streaks`, `events` | `apply_bulk_progress()` |
| `/api/share-link`                 | GET    | Yes           | `parent_access`                       | None                                |
| `/api/share-link`                 | POST   | Yes           | `parent_access`, `events`             | None                                |
| `/api/share-link/regenerate`      | POST   | Yes           | `parent_access`, `events`             | None                                |
| `/api/share-link/deactivate`      | POST   | Yes           | `parent_access`, `events`             | None                                |
| `/api/resource-progress`          | POST   | Yes           | `resource_progress`                   | None                                |
| `/api/resource-progress/start`    | POST   | Yes           | `resource_progress`                   | None                                |
| `/api/account/delete`             | DELETE | Yes           | All user tables (cascade)             | None                                |
| `/api/account/export`             | GET    | Yes           | All user tables (read)                | None                                |
| `/api/analytics`                  | POST   | Yes           | `events`                              | None                                |
| `/api/activity`                   | GET    | Yes           | `study_streaks`, `profiles`           | None                                |
| `/api/activity`                   | PUT    | Yes           | `study_streaks`                       | None                                |
| `/api/health`                     | GET    | No            | `profiles` (health check)             | None                                |

---

## 5. Shared Components & Usage

### 5.1 Utility Functions (lib/)

#### **Core Utilities**

1. **lib/date.ts**
   - `formatLocalDate()` - Convert Date to YYYY-MM-DD
   - `startOfLocalDay()` - Get start of day in local time
   - `addDays()` - Add days to a date
   - `isWeekend()` - Check if date is Saturday/Sunday
   - **Used by:** Schedule generation, streak calculations, dashboard

2. **lib/utils.ts**
   - `cn()` - Tailwind className utility (clsx + tailwind-merge)
   - **Used by:** Every component with conditional styling

3. **lib/logger.ts**
   - `serverLogger` - Structured logging for server-side
   - **Used by:** API routes, server components

4. **lib/ratelimit.ts**
   - `RateLimitPresets` - Rate limiting configurations
   - **Used by:** API route handlers

---

#### **Supabase Clients** (lib/supabase/)

1. **lib/supabase/server.ts**
   - `createServerClient()` - Server-side Supabase client
   - **Used by:** Server components, API routes

2. **lib/supabase/client.ts**
   - `createBrowserClient()` - Browser Supabase client
   - **Used by:** Client components (via getSupabaseClient hook)

3. **lib/supabase/middleware.ts**
   - `createMiddlewareClient()` - Middleware Supabase client
   - **Used by:** middleware.ts

4. **lib/supabase/admin.ts**
   - `createAdminClient()` - Service role client (bypasses RLS)
   - **Used by:** Account deletion, analytics

---

#### **Business Logic** (lib/)

1. **lib/services/progress.ts** (Server-only)
   - `calculateOverallProgress()` - Compute progress percentage
   - `getWeeklySummary()` - Last 7 days activity
   - `getStreak()` - Get user streak
   - `getFullProgressData()` - All-in-one progress data
   - **Used by:** Parent dashboard (previously used in main dashboard, now computed inline)

2. **lib/shared/generateStudySchedule.ts** (Pure function)
   - `generateStudySchedule()` - Generate flexible schedule from subjects
   - **Used by:** Plan creation API, guest plan

3. **lib/shared/distributeResources.ts** (Pure function)
   - `distributeResourcesAcrossDays()` - Outcome-level distribution
   - **Used by:** generateStudySchedule() for resource mode

4. **lib/utils/unit-completion.ts**
   - `fetchMicrocards()` - Get microcards for subject/unit
   - `recordQuickCheckResult()` - Save quiz attempt
   - `getOutcomeCompletionData()` - Check outcome completion
   - **Used by:** Study mode, dashboard

5. **lib/studyState.ts**
   - `recordQuickCheckOutcome()` - Record quiz + update streak
   - **Used by:** Quick check components

---

#### **Validation** (lib/validation/)

1. **lib/validation/plan.ts**
   - `PlanGenerationSchema` - Zod schema for plan creation
   - `isValidSubjectsForGrade()` - Validate subject selection
   - **Used by:** Plan API route

2. **lib/validation/progress.ts**
   - `ProgressCompleteSchema` - Zod schema for progress update
   - `ProgressUndoSchema` - Zod schema for undo
   - **Used by:** Progress API route

---

#### **Data Access** (data/)

1. **data/curriculum**
   - `getCurriculumData(subject)` - Get curriculum for subject
   - **Used by:** 20+ components (dashboard, plan, study, landing)

---

### 5.2 Context Providers

#### **GuestPlanContext** (`contexts/GuestPlanContext.tsx`)
Manages guest plan state in local storage.

**Provides:**
- `guestPlan` state
- `setGuestPlan()` function
- `clearGuestPlan()` function

**Used By:**
- `app/plan/guest/page.tsx`
- `components/guest/ConflictResolutionModal.tsx`

---

### 5.3 Component Composition Patterns

#### **Card Composition**
```typescript
// Most common pattern across codebase
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Used in:**
- Dashboard cards
- Plan day cards
- Settings cards
- Landing page cards

---

#### **Button with Toast**
```typescript
// Common pattern for async actions
const { showToast } = useToast()

async function handleAction() {
  try {
    await doSomething()
    showToast('Success!', 'success')
  } catch (error) {
    showToast('Error', 'error')
  }
}

<Button onClick={handleAction}>Action</Button>
```

**Used in:**
- All settings cards
- Progress updates
- Share link generation

---

#### **Suspense + Skeleton**
```typescript
// Server components pattern
<Suspense fallback={<DashboardSkeleton />}>
  <DashboardClient {...props} />
</Suspense>
```

**Used in:**
- Dashboard page
- Plan view pages

---

## 6. Identified Issues & Coupling

### 6.1 Tight Coupling Issues

#### **Issue 1: SubjectProgressCard Over-Responsibility**
**File:** `components/dashboard/SubjectProgressCard.tsx` (515 lines)

**Problems:**
- Handles 8 different concerns:
  1. Progress calculation
  2. Unit checklist UI
  3. Microcard viewer
  4. Quick check integration
  5. Curriculum alignment display
  6. Outcome-level breakdown
  7. Progress updates (optimistic)
  8. Toast notifications

**Dependencies (8 imports):**
```typescript
import ProgressBar from '@/components/dashboard/ProgressBar'
import CurriculumPanel from '@/components/plan/CurriculumPanel'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getCurriculumData } from '@/data/curriculum'
import type { UserProgress, UnitItem, ProgressUpdatePayload } from '@/lib/types'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
import { createBrowserClient } from '@/lib/supabase/client'
```

**Impact:**
- Hard to test (too many responsibilities)
- Hard to reuse (tightly coupled to dashboard context)
- High change frequency (touches many concerns)

**Refactor Path:**
```
SubjectProgressCard (container)
  ├─→ SubjectProgressHeader (title, percentage)
  ├─→ SubjectUnitList (checklist)
  │     └─→ UnitCheckboxItem (single item)
  │           └─→ MicrocardViewer (if applicable)
  └─→ CurriculumAlignmentPanel (outcomes, docs)
```

---

#### **Issue 2: UnitCheckbox Complexity**
**File:** `components/plan/UnitCheckbox.tsx` (442 lines)

**Problems:**
- Combines checkbox UI with microcard modal and quick check quiz
- Direct Supabase queries (should use API routes or hooks)
- Complex conditional rendering

**Dependencies (7 imports + 3 hooks):**
```typescript
import MicrocardModal from '@/components/microcards/MicrocardModal'
import { getSupabaseClient } from '@/hooks/getSupabaseClient'
import { useMicrocards } from '@/hooks/useMicrocards'
import { useQuickCheck } from '@/hooks/useQuickCheck'
```

**Impact:**
- Hard to test in isolation
- Difficult to extract/reuse checkbox without microcard logic

**Refactor Path:**
```
UnitCheckbox (simple checkbox)
  ├─→ onClick: Call parent handler

MicrocardCheckbox (enhanced checkbox)
  ├─→ Wraps UnitCheckbox
  └─→ Adds MicrocardModal integration
```

---

#### **Issue 3: DashboardClient State Complexity**
**File:** `components/dashboard/DashboardClient.tsx` (418 lines)

**Problems:**
- Manages 5 pieces of state:
  1. `streak` (StudyStreak)
  2. `weeklySummary` (WeeklySummaryStats)
  3. `progress` (UserProgress[])
  4. `celebrationMilestone` (number | null)
  5. `showCelebration` (boolean)

- Complex `useEffect` for weekly summary calculation
- 50+ lines of `handleProgressUpdate` logic
- Mixes data fetching with UI orchestration

**Impact:**
- Hard to test state transitions
- Difficult to extract logic for reuse

**Refactor Path:**
```typescript
// Extract custom hook
function useDashboardState(userId, planId, initialData) {
  const [streak, setStreak] = useState(...)
  const [progress, setProgress] = useState(...)
  const [weeklySummary, setWeeklySummary] = useState(...)

  const handleProgressUpdate = useCallback(...)
  const refreshData = useCallback(...)

  return { streak, progress, weeklySummary, handleProgressUpdate, refreshData }
}

// Simplified component
function DashboardClient({ userId, planId, initialData }) {
  const { streak, progress, weeklySummary, handleProgressUpdate } = useDashboardState(...)

  return (
    <div>
      <StreakHero streak={streak} />
      <TodaysFocus plan={plan} progress={progress} />
      ...
    </div>
  )
}
```

---

### 6.2 Potential Circular Dependencies

#### **Pattern: Component → Hook → Component**

**Example 1:**
```
SubjectProgressCard
  └─→ useMicrocards
        └─→ getSupabaseClient
              └─→ createBrowserClient

✓ No circular dependency (terminates at client factory)
```

**Example 2:**
```
DashboardClient
  └─→ SubjectProgressCard
        └─→ handleProgressUpdate (passed as prop)
              └─→ Updates DashboardClient state

✓ No circular dependency (callback pattern)
```

**Analysis:** No true circular dependencies detected. All component hierarchies are acyclic.

---

### 6.3 Duplicate Logic Identified

#### **1. Progress Calculation (3 locations)**

**Location 1:** `lib/services/progress.ts` (server-side)
```typescript
export async function calculateOverallProgress(userId, planId) {
  // Fetches plan + progress from Supabase
  // Calculates overall % and by-subject breakdown
}
```

**Location 2:** `DashboardClient.tsx` (client-side)
```typescript
// Computes progress locally from state
const completedUnits = progress.filter(p => completedIds.includes(p.unit_id))
const percentage = Math.round((completedUnits.length / totalUnits) * 100)
```

**Location 3:** `SubjectProgressCard.tsx` (client-side)
```typescript
// Computes subject-specific progress
const subjectProgress = progress.filter(p => p.subject === subject)
const completed = subjectProgress.length
const total = units.filter(u => u.subject === subject).length
const percentage = Math.round((completed / total) * 100)
```

**Solution:** Centralize in shared utility:
```typescript
// lib/utils/progress-calculations.ts
export function calculateProgress(progress, units, subject?) {
  // Single source of truth for progress calculation
}
```

---

#### **2. Weekly Summary Calculation (2 locations)**

**Location 1:** `lib/services/progress.ts` (server-side)
```typescript
export async function getWeeklySummary(userId) {
  // Queries last 7 days from user_progress
}
```

**Location 2:** `DashboardClient.tsx` (client-side)
```typescript
useEffect(() => {
  // Fetches user_progress, quick_check_results, resource_progress
  // Merges into activity dates
}, [])
```

**Solution:** Use server-side calculation OR move to shared utility that can run on both.

---

#### **3. Streak Calculation (2 locations)**

**Location 1:** `mark_unit_complete()` RPC (database)
```sql
-- Increments streak if yesterday was last study date
-- Resets to 1 if gap detected
```

**Location 2:** `DashboardClient.tsx` (client-side optimistic update)
```typescript
// Mirrors server logic for immediate UI feedback
if (type === 'completed' && !prevStudiedToday && nextStudiedToday) {
  const yesterday = ...
  if (prevLastStudyDate === yesterday) {
    current = prevCurrent + 1
  } else {
    current = 1
  }
}
```

**Solution:** This duplication is intentional (optimistic UI). Consider extracting to shared function for consistency:
```typescript
// lib/utils/streak-calculations.ts
export function computeNextStreak(prevStreak, todayStudied, yesterdayStudied) {
  // Shared logic between server and client
}
```

---

### 6.4 API Design Issues

#### **Issue: Inconsistent Error Handling**

**Some routes return:**
```typescript
{ error: 'message' }
```

**Others throw:**
```typescript
throw new Error('message')
```

**Some use custom error codes:**
```typescript
if (error.code === 'P0010') { /* Plan not found */ }
if (error.code === 'PGRST116') { /* No rows */ }
```

**Solution:** Standardize error responses:
```typescript
// lib/api/errors.ts
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

// Usage in routes
if (!plan) {
  throw new ApiError('PLAN_NOT_FOUND', 'Plan not found', 404)
}
```

---

#### **Issue: No Request Validation Layer**

Currently, validation is inline in each API route:
```typescript
const parsed = PlanGenerationSchema.safeParse(await request.json())
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
}
```

**Solution:** Create validation middleware:
```typescript
// lib/api/with-validation.ts
export function withValidation(schema, handler) {
  return async (request) => {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.errors }, { status: 400 })
    }
    return handler(request, parsed.data)
  }
}

// Usage
export const POST = withValidation(PlanGenerationSchema, handlePlanCreation)
```

---

### 6.5 Performance Bottlenecks

#### **1. N+1 Query Problem in Dashboard**

**Current Flow:**
```typescript
// Dashboard fetches plan, then fetches progress for each subject separately
const plan = await supabase.from('study_plans').select().eq('user_id', userId).single()
const progress = await supabase.from('user_progress').select().eq('plan_id', plan.id)

// In SubjectProgressCard (rendered once per subject):
for (const subject of plan.subjects) {
  // Each card re-filters progress
  const subjectProgress = progress.filter(p => p.subject === subject)
}
```

**Solution:** Already optimized (all progress fetched once). No N+1 issue detected.

---

#### **2. Microcard Fetching (One Query per Subject/Unit)**

**Current Flow:**
```typescript
// In useMicrocards hook
const { data } = await supabase
  .from('content_microcards')
  .eq('subject', subject)
  .eq('unit_id', unitId)
  .eq('status', 'active')
```

If user has 20 units visible, this triggers 20 separate queries.

**Solution:** Batch microcard fetching:
```typescript
// Fetch all microcards for subjects in plan upfront
const { data: microcards } = await supabase
  .from('content_microcards')
  .in('subject', plan.subjects)
  .eq('status', 'active')

// Store in context or pass as prop
// Components look up microcards from local cache
```

---

#### **3. Dashboard Refresh on Every Focus**

**Current:**
```typescript
useEffect(() => {
  window.addEventListener('focus', refreshData)
  document.addEventListener('visibilitychange', refreshData)
}, [])
```

Every time user switches tabs and returns, 4 queries run:
- `study_streaks`
- `user_progress`
- `quick_check_results`
- `resource_progress`

**Solution:** Add debounce or check if data actually changed:
```typescript
const lastRefresh = useRef(Date.now())

const refreshData = useCallback(async () => {
  // Only refresh if >30 seconds since last refresh
  if (Date.now() - lastRefresh.current < 30000) return

  lastRefresh.current = Date.now()
  // ... fetch data
}, [])
```

---

## 7. Refactor Recommendations

### 7.1 High-Priority Refactors

#### **1. Extract Dashboard State Management**

**Current:** 418-line DashboardClient with complex state logic
**Target:** Clean container + custom hook

**Implementation:**
```typescript
// hooks/useDashboardData.ts
export function useDashboardData(userId, planId, initialData) {
  const [state, setState] = useState({
    streak: initialData.streak,
    progress: initialData.progress,
    weeklySummary: initialData.weeklySummary,
  })

  const refreshData = useCallback(async () => {
    // Centralized data fetching
  }, [userId, planId])

  const handleProgressUpdate = useCallback((payload) => {
    // Centralized progress update logic
  }, [state])

  return { ...state, refreshData, handleProgressUpdate }
}

// components/dashboard/DashboardClient.tsx (simplified)
export default function DashboardClient({ userId, planId, initialData }) {
  const { streak, progress, weeklySummary, handleProgressUpdate } = useDashboardData(
    userId,
    planId,
    initialData
  )

  return (
    <div>
      <StreakHero streak={streak} />
      <TodaysFocus progress={progress} />
      {plan.subjects.map(subject => (
        <SubjectProgressCard
          key={subject}
          subject={subject}
          progress={progress}
          onUpdate={handleProgressUpdate}
        />
      ))}
    </div>
  )
}
```

**Benefits:**
- Testable state logic (hook can be tested in isolation)
- Cleaner component (focuses on UI composition)
- Reusable state logic (could power parent dashboard too)

---

#### **2. Decompose SubjectProgressCard**

**Current:** 515-line monolithic component
**Target:** Composition of smaller components

**Implementation:**
```
components/dashboard/subject-progress/
  ├── SubjectProgressCard.tsx (container, ~100 lines)
  ├── SubjectProgressHeader.tsx (~50 lines)
  ├── SubjectUnitList.tsx (~150 lines)
  ├── UnitCheckboxItem.tsx (~100 lines)
  └── CurriculumAlignmentPanel.tsx (~100 lines)
```

**SubjectProgressCard.tsx:**
```typescript
export function SubjectProgressCard({ subject, progress, units, onUpdate }) {
  const [showCurriculum, setShowCurriculum] = useState(false)

  return (
    <Card>
      <SubjectProgressHeader subject={subject} progress={progress} units={units} />

      <SubjectUnitList
        subject={subject}
        units={units}
        progress={progress}
        onUpdate={onUpdate}
      />

      {showCurriculum && (
        <CurriculumAlignmentPanel subject={subject} units={units} />
      )}
    </Card>
  )
}
```

**Benefits:**
- Each component has single responsibility
- Easier to test individual pieces
- Can reuse SubjectUnitList in other contexts

---

#### **3. Centralize Progress Calculations**

**Current:** Duplicate logic in 3 places
**Target:** Single source of truth

**Implementation:**
```typescript
// lib/utils/progress-calculations.ts

export interface ProgressStats {
  completed: number
  total: number
  percentage: number
}

export function calculateProgress(
  progress: UserProgress[],
  units: UnitItem[],
  subject?: string
): ProgressStats {
  const relevantUnits = subject
    ? units.filter(u => u.subject === subject)
    : units

  const completedIds = new Set(progress.map(p => p.unit_id))
  const completed = relevantUnits.filter(u => completedIds.has(u.unitId)).length
  const total = relevantUnits.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { completed, total, percentage }
}

export function calculateProgressBySubject(
  progress: UserProgress[],
  units: UnitItem[]
): Record<string, ProgressStats> {
  const subjects = Array.from(new Set(units.map(u => u.subject)))
  const result: Record<string, ProgressStats> = {}

  for (const subject of subjects) {
    result[subject] = calculateProgress(progress, units, subject)
  }

  return result
}
```

**Usage:**
```typescript
// In any component
import { calculateProgress } from '@/lib/utils/progress-calculations'

const stats = calculateProgress(progress, units, subject)
console.log(`${stats.percentage}% complete (${stats.completed}/${stats.total})`)
```

**Benefits:**
- Single implementation = fewer bugs
- Easier to test (pure functions)
- Consistent calculations across app

---

#### **4. Batch Microcard Fetching**

**Current:** One query per unit
**Target:** Single query with local cache

**Implementation:**
```typescript
// hooks/usePlanMicrocards.ts
export function usePlanMicrocards(subjects: string[]) {
  const supabase = getSupabaseClient()
  const [microcards, setMicrocards] = useState<ContentMicrocard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabase
        .from('content_microcards')
        .in('subject', subjects)
        .eq('status', 'active')

      setMicrocards(data || [])
      setLoading(false)
    }

    fetchAll()
  }, [subjects])

  const getMicrocardsForUnit = useCallback((subject: string, unitId: string) => {
    return microcards.filter(m => m.subject === subject && m.unit_id === unitId)
  }, [microcards])

  return { microcards, getMicrocardsForUnit, loading }
}

// Usage in DashboardClient
const { getMicrocardsForUnit } = usePlanMicrocards(plan.subjects)

// Pass getter to SubjectProgressCard
<SubjectProgressCard
  getMicrocardsForUnit={getMicrocardsForUnit}
  ...
/>
```

**Benefits:**
- Single query instead of N queries
- Faster dashboard load
- Shared cache across all cards

---

### 7.2 Medium-Priority Refactors

#### **5. API Route Standardization**

**Current:** Inconsistent error handling and response formats
**Target:** Standardized middleware layer

**Implementation:**
```typescript
// lib/api/middleware.ts

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function withErrorHandling(handler: Function) {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code, details: error.details },
          { status: error.status }
        )
      }

      serverLogger.error('Unhandled API error', error)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

export function withValidation<T extends z.ZodSchema>(
  schema: T,
  handler: (request: NextRequest, data: z.infer<T>, context?: any) => Promise<NextResponse>
) {
  return withErrorHandling(async (request: NextRequest, context?: any) => {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid request data', 400, parsed.error.errors)
    }

    return handler(request, parsed.data, context)
  })
}

// Usage
export const POST = withValidation(
  PlanGenerationSchema,
  async (request, data, { supabase, userId }) => {
    if (!isValidSubjectsForGrade(data.grade, data.subjects)) {
      throw new ApiError('INVALID_SUBJECTS', 'One or more subjects are invalid', 400)
    }

    const { data: plan, error } = await supabase.rpc('regenerate_study_plan', {
      ...data
    })

    if (error) {
      throw new ApiError('RPC_ERROR', error.message, 500)
    }

    return NextResponse.json({ success: true, plan })
  }
)
```

**Benefits:**
- Consistent error responses across all routes
- Automatic validation error formatting
- Centralized logging
- Easier to test

---

#### **6. Simplify UnitCheckbox**

**Current:** 442 lines with microcard and quiz logic
**Target:** Simple checkbox + enhanced variant

**Implementation:**
```typescript
// components/plan/UnitCheckbox.tsx (simplified)
export function UnitCheckbox({ unitId, checked, onChange, label }) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(unitId, !checked)}
      />
      <span>{label}</span>
    </label>
  )
}

// components/plan/MicrocardCheckbox.tsx (enhanced)
export function MicrocardCheckbox({ unit, checked, onChange, microcards }) {
  const [showModal, setShowModal] = useState(false)
  const hasMicrocards = microcards.length > 0

  return (
    <div className="flex items-center gap-2">
      <UnitCheckbox
        unitId={unit.unitId}
        checked={checked}
        onChange={onChange}
        label={unit.title}
      />

      {hasMicrocards && (
        <button onClick={() => setShowModal(true)}>
          View Microcards
        </button>
      )}

      {showModal && (
        <MicrocardModal
          microcards={microcards}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

**Benefits:**
- Simple UnitCheckbox is reusable without microcard dependency
- MicrocardCheckbox composes UnitCheckbox (composition over complexity)
- Easier to test each piece

---

#### **7. Settings Card Extraction**

**Current:** 3 large settings cards (420, 426, 278 lines)
**Target:** Reusable patterns

**Implementation:**
```typescript
// components/settings/SettingsCard.tsx (base pattern)
export function SettingsCard({ title, description, children, actions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
      {actions && (
        <CardFooter>
          {actions}
        </CardFooter>
      )}
    </Card>
  )
}

// components/settings/TimezoneSelector.tsx (extracted)
export function TimezoneSelector({ value, onChange }) {
  // Reusable timezone picker logic
}

// components/settings/ConfirmationDialog.tsx (extracted)
export function ConfirmationDialog({ title, message, onConfirm, onCancel }) {
  // Reusable confirmation dialog
}

// settings-account-card.tsx (simplified)
export function SettingsAccountCard({ profile }) {
  return (
    <SettingsCard
      title="Account Settings"
      description="Manage your timezone and account"
    >
      <TimezoneSelector
        value={profile.timezone}
        onChange={handleTimezoneChange}
      />

      <ConfirmationDialog
        title="Delete Account"
        message="Are you sure? This cannot be undone."
        onConfirm={handleDelete}
      />
    </SettingsCard>
  )
}
```

**Benefits:**
- Reusable SettingsCard pattern
- Extracted components can be used elsewhere
- Simpler to test each piece

---

### 7.3 Low-Priority Refactors

#### **8. Type Safety Improvements**

**Current:** Some types use `any` or loose typing
**Target:** Strict TypeScript throughout

**Examples:**
```typescript
// Before
function handleData(data: any) { ... }

// After
import type { StudyPlan, UserProgress } from '@/lib/types'

function handleData(data: { plan: StudyPlan; progress: UserProgress[] }) { ... }
```

---

#### **9. Test Coverage**

**Current:** Limited test coverage (mainly for schedule generation)
**Target:** 80%+ coverage for business logic

**Priority Areas:**
1. Progress calculation utilities (pure functions)
2. Streak calculation logic
3. Schedule generation (already tested)
4. API route handlers (integration tests)
5. Custom hooks (React Testing Library)

---

#### **10. Accessibility Improvements**

**Current:** Some components missing ARIA labels
**Target:** WCAG 2.1 AA compliance

**Focus Areas:**
- Checkbox labels (use `htmlFor` or wrap with `<label>`)
- Modal dialogs (trap focus, ESC to close)
- Keyboard navigation (Tab order, Enter/Space handlers)
- Screen reader announcements (progress updates, celebrations)

---

## 8. Conclusion & Next Steps

### 8.1 Summary of Findings

**Database:**
- 9 tables with well-defined relationships
- 7 RPC functions for complex server-side logic
- Strong RLS policies for security
- Good index coverage for performance

**Components:**
- 80+ components across 7 categories
- High reuse of UI primitives (Button, Card, Toast)
- 5 large components need refactoring (400+ lines)
- No circular dependencies detected

**Data Flow:**
- Clean server → client pattern (SSR + hydration)
- Optimistic UI updates for progress
- RPC functions handle complex transactions
- Some duplicate calculation logic (3 locations)

**Issues:**
- Tight coupling in large components (SubjectProgressCard, DashboardClient)
- Duplicate progress/streak calculation logic
- Inconsistent API error handling
- Potential N+1 microcard queries

---

### 8.2 Refactor Roadmap

#### **Phase 1: Foundation** (High Priority)
1. Extract dashboard state to custom hook
2. Centralize progress calculations
3. Standardize API middleware
4. Batch microcard fetching

**Estimated Effort:** 2-3 days
**Impact:** Reduces complexity, improves performance

---

#### **Phase 2: Component Decomposition** (Medium Priority)
5. Decompose SubjectProgressCard
6. Simplify UnitCheckbox
7. Extract settings components

**Estimated Effort:** 3-4 days
**Impact:** Improves maintainability, testability

---

#### **Phase 3: Polish** (Low Priority)
8. Improve type safety
9. Add test coverage
10. Accessibility audit

**Estimated Effort:** 3-5 days
**Impact:** Improves quality, compliance

---

### 8.3 Migration Strategy

**Approach:** Incremental refactoring (no big rewrite)

1. **Create new utilities** (lib/utils/progress-calculations.ts, etc.)
2. **Update one component at a time** (start with dashboard)
3. **Keep old code working** (parallel implementation)
4. **Switch over when ready** (feature flag if needed)
5. **Remove old code** (once new code is stable)

**Risk Mitigation:**
- Write tests before refactoring
- Use feature flags for risky changes
- Deploy to staging first
- Monitor Sentry for errors

---

### 8.4 Success Metrics

**Code Quality:**
- Reduce average component size from 200 → 150 lines
- Increase test coverage from 15% → 80%
- Eliminate duplicate calculation logic

**Performance:**
- Reduce dashboard initial queries from 4 → 3
- Batch microcard queries (20 queries → 1 query)
- Reduce bundle size by 10% (code splitting)

**Developer Experience:**
- Reduce time to add new feature by 30%
- Improve onboarding (clearer component structure)
- Better error messages (standardized API responses)

---

## Appendix

### A. Quick Reference: Table → Component Mapping

| Table                  | Read By                                  | Written By                    |
|------------------------|------------------------------------------|-------------------------------|
| `profiles`             | Dashboard, Settings, Parent Dashboard    | Plan creation, Settings       |
| `study_plans`          | Dashboard, Plan view, Study mode         | Plan creation, RPC functions  |
| `user_progress`        | Dashboard, Plan view, Parent Dashboard   | Progress API, RPC functions   |
| `study_streaks`        | Dashboard, StreakHero, Parent Dashboard  | RPC functions, Activity API   |
| `parent_access`        | Settings, Parent Dashboard               | Share link API                |
| `resource_progress`    | Dashboard, Study mode, Plan view         | Resource progress API         |
| `events`               | (Analytics only, via Sentry)             | All API routes                |
| `content_microcards`   | Dashboard, Study mode, Curriculum        | Scripts (not app code)        |
| `quick_check_results`  | Dashboard (activity), Study mode         | Quick check API, studyState   |

---

### B. File Structure Reference

```
steadytrack/
├── app/                              # Next.js 14 App Router
│   ├── (auth)/                       # Auth routes
│   │   ├── callback/route.ts         # OAuth callback handler
│   │   └── login/page.tsx            # Login page
│   ├── (dashboard)/                  # Protected routes
│   │   ├── dashboard/page.tsx        # Main dashboard (server component)
│   │   ├── plan/
│   │   │   ├── new/page.tsx          # Plan creation wizard
│   │   │   ├── [id]/page.tsx         # Plan view
│   │   │   └── [id]/study/page.tsx   # Study mode
│   │   ├── settings/page.tsx         # Settings page
│   │   └── onboarding/page.tsx       # Onboarding flow
│   ├── api/                          # API routes
│   │   ├── plan/route.ts             # Plan CRUD
│   │   ├── progress/route.ts         # Progress updates
│   │   ├── progress/bulk/route.ts    # Bulk progress
│   │   ├── share-link/route.ts       # Share link management
│   │   ├── resource-progress/route.ts # Resource tracking
│   │   ├── account/                  # Account management
│   │   └── analytics/route.ts        # Analytics events
│   ├── share/[token]/page.tsx        # Parent dashboard (public)
│   ├── plan/guest/page.tsx           # Guest plan (unauthenticated)
│   ├── curriculum/page.tsx           # Curriculum browser
│   ├── page.tsx                      # Landing page
│   └── layout.tsx                    # Root layout
├── components/
│   ├── ui/                           # Shadcn UI primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── toast.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── dashboard/                    # Dashboard components
│   │   ├── DashboardClient.tsx       # Main orchestrator (418 lines) ⚠️
│   │   ├── SubjectProgressCard.tsx   # Subject card (515 lines) ⚠️
│   │   ├── StreakHero.tsx
│   │   ├── TodaysFocus.tsx
│   │   └── ...
│   ├── plan/                         # Plan components
│   │   ├── PlanDayCard.tsx
│   │   ├── UnitCheckbox.tsx          # Unit checkbox (442 lines) ⚠️
│   │   └── ...
│   ├── study/                        # Study mode components
│   │   ├── StudyModeHeader.tsx
│   │   ├── OutcomeSidebar.tsx
│   │   ├── MicrocardViewer.tsx
│   │   └── ...
│   ├── settings/                     # Settings components
│   │   ├── settings-account-card.tsx (420 lines) ⚠️
│   │   ├── settings-subjects-card.tsx (426 lines) ⚠️
│   │   └── settings-parent-card.tsx
│   ├── microcards/                   # Microcard components
│   │   ├── MicrocardModal.tsx
│   │   ├── MicrocardContent.tsx
│   │   └── QuickCheckCard.tsx
│   ├── parent/                       # Parent dashboard components
│   │   └── ParentDashboard.tsx
│   ├── landing/                      # Landing page components
│   │   ├── Hero.tsx
│   │   ├── Footer.tsx (shared)
│   │   └── ...
│   └── curriculum/                   # Curriculum browser components
├── lib/
│   ├── supabase/                     # Supabase client factories
│   │   ├── server.ts                 # Server-side client
│   │   ├── client.ts                 # Browser client
│   │   ├── middleware.ts             # Middleware client
│   │   └── admin.ts                  # Admin client (service role)
│   ├── services/
│   │   └── progress.ts               # Progress service (server-only)
│   ├── shared/                       # Shared logic (client + server)
│   │   ├── generateStudySchedule.ts  # Schedule generation (pure)
│   │   └── distributeResources.ts    # Resource distribution (pure)
│   ├── utils/                        # Utility functions
│   │   ├── unit-completion.ts
│   │   ├── curriculum.ts
│   │   └── title.ts
│   ├── validation/                   # Zod schemas
│   │   ├── plan.ts
│   │   └── progress.ts
│   ├── api/                          # API utilities
│   │   ├── route-helpers.ts          # withAuthRateLimit
│   │   └── sharing.ts
│   ├── guest/                        # Guest plan logic
│   │   ├── storage.ts
│   │   └── analytics.ts
│   ├── date.ts                       # Date utilities
│   ├── utils.ts                      # General utilities (cn)
│   ├── logger.ts                     # Structured logging
│   ├── ratelimit.ts                  # Rate limiting
│   └── types.ts                      # Shared TypeScript types
├── hooks/
│   ├── getSupabaseClient.ts                # Supabase client hook
│   ├── useMicrocards.ts              # Microcard fetching
│   └── useQuickCheck.ts              # Quiz state management
├── contexts/
│   └── GuestPlanContext.tsx          # Guest plan context
├── data/
│   └── curriculum/                   # Static curriculum data
├── supabase/
│   ├── migrations/                   # Database migrations
│   │   ├── 20250101000000_initial_schema.sql
│   │   ├── 20251007000001_add_parent_dashboard_overview_rpc.sql
│   │   ├── ... (30 total migrations)
│   │   └── 20251013050000_weekend_aware_streaks.sql
│   └── functions/                    # Supabase Edge Functions
│       └── daily-digest/             # Daily digest cron job
├── docs/
│   ├── refactor/                     # 🆕 Refactor documentation
│   │   └── DEPENDENCY_MAP.md         # This document
│   ├── ARCHITECTURE.md               # Architecture overview
│   ├── CONTRIBUTING.md               # Contributing guide
│   └── ...
├── middleware.ts                     # Next.js middleware (auth)
├── package.json
└── next.config.ts
```

**Legend:**
- ⚠️ = Refactor candidate (400+ lines)
- 🆕 = New directory/file

---

### C. Common Patterns Cheat Sheet

#### **Server Component Pattern**
```typescript
// app/(dashboard)/dashboard/page.tsx
export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: plan } = await supabase.from('study_plans').select()

  return <DashboardClient plan={plan} />
}
```

#### **Client Component with Supabase**
```typescript
'use client'

import { getSupabaseClient } from '@/hooks/getSupabaseClient'

export function MyComponent() {
  const supabase = getSupabaseClient()

  async function fetchData() {
    const { data } = await supabase.from('table').select()
  }
}
```

#### **API Route Pattern**
```typescript
import { withAuthRateLimit } from '@/lib/api/route-helpers'
import { RateLimitPresets } from '@/lib/ratelimit'

async function handler(request, { supabase, userId }) {
  const { data } = await supabase.from('table').select()
  return NextResponse.json({ data })
}

export const POST = withAuthRateLimit(RateLimitPresets.PERMISSIVE, handler)
```

#### **RPC Call Pattern**
```typescript
const { data, error } = await supabase.rpc('function_name', {
  p_param1: value1,
  p_param2: value2,
})

if (error) throw error
return data
```

---

**End of Document**
