# Database Schema Analysis and Refactoring Proposal

**Date:** 2025-10-13
**Status:** Proposal
**Purpose:** Analyze current Supabase schema and propose normalized improvements for better performance, data integrity, and scalability

---

## Executive Summary

The current schema serves the application well but has several normalization issues stemming from the use of JSONB for the `study_plans.schedule` column. This analysis proposes a normalized schema that:

- Improves query performance through proper indexing
- Ensures referential integrity with foreign keys
- Enables efficient analytics and reporting
- Maintains backward compatibility during migration

**Key Finding:** The application code is already well-optimized with Promise.all() for parallel queries, so no N+1 patterns were found. The main improvements needed are at the schema level.

---

## 1. Current Schema Review

### Tables Overview

| Table | Rows (est.) | Purpose | Primary Issues |
|-------|-------------|---------|----------------|
| `profiles` | ~100s | User profile data | ✅ Well-designed |
| `study_plans` | ~100s | Study plans with JSONB schedule | ⚠️ JSONB prevents normalization |
| `user_progress` | ~10,000s | Unit completion tracking | ⚠️ No FK to units |
| `study_streaks` | ~100s | Streak counters | ✅ Well-designed |
| `parent_access` | ~50s | Parent share tokens | ⚠️ No token validation |
| `resource_progress` | ~50,000s | Resource-level tracking | ⚠️ No FK to units |
| `events` | ~100,000s | Analytics events | ⚠️ JSONB event_data |
| `content_microcards` | ~500s | Learning content | ✅ Recently optimized |
| `quick_check_results` | ~5,000s | Quiz results | ✅ Well-designed |

### Existing Indexes

**Good indexes (recently added):**
```sql
-- user_progress: composite index for date-window scans
CREATE INDEX user_progress_user_date_idx ON user_progress(user_id, completed_at DESC);

-- content_microcards: optimized for outcome queries
CREATE INDEX idx_microcards_subject_outcome_status
  ON content_microcards(subject, outcome_code, status);

-- study_plans: lifecycle queries
CREATE INDEX idx_study_plans_user_status ON study_plans(user_id, status);
```

**Index gaps identified:**
- Missing `resource_progress(user_id, plan_id, unit_id)` composite
- Missing `events(user_id, event_name, created_at)` for event queries
- Redundant `idx_study_streaks_user_id` (UNIQUE constraint already indexes)

### Row-Level Security (RLS)

**Status:** ✅ Already optimized (migration 008)

All policies use subqueries for `auth.uid()` and `auth.role()`:
```sql
-- Good pattern (prevents per-row function calls)
CREATE POLICY user_progress_select_own ON user_progress
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
```

RLS is properly scoped - students own their data, parents access via SECURITY DEFINER RPC.

---

## 2. Normalization Issues

### Issue 1: JSONB Schedule Structure

**Current schema:**
```sql
CREATE TABLE study_plans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  subjects TEXT[] NOT NULL,  -- e.g., ['Math 30-1', 'Biology 30']
  schedule JSONB NOT NULL,   -- { days: [{ dayLabel, units: [...] }] }
  total_units INTEGER NOT NULL,
  -- ... lifecycle fields
);
```

**JSONB schedule structure:**
```json
{
  "days": [
    {
      "dayIndex": 0,
      "dayLabel": "Week 1 - Monday",
      "date": "2025-01-13",
      "units": [
        {
          "subject": "Math 30-1",
          "unitId": "RF",
          "title": "Relations and Functions",
          "resourceUrls": ["https://..."],
          "outcomeCodes": ["RF1", "RF2"]
        }
      ]
    }
  ]
}
```

**Problems:**
1. **No referential integrity** - Can't enforce FK to actual unit definitions
2. **Denormalized `total_units`** - Must be computed from JSONB and stored separately
3. **Hard to query** - Can't efficiently find:
   - "Which plans include Math 30-1 unit RF?"
   - "What's the average plan completion rate per subject?"
   - "Which resources are most commonly scheduled?"
4. **No unit reuse** - Same unit data duplicated across all plans
5. **Large JSONB scans** - Every plan query must parse entire schedule

### Issue 2: No Curriculum Reference Table

**Current:** Units are stored as strings in JSONB:
```typescript
{ subject: "Math 30-1", unitId: "RF", title: "Relations and Functions" }
```

**Problem:** No single source of truth for curriculum units. Application code must:
- Load curriculum from JSON files (`data/curriculum/`)
- Validate unit existence in application layer
- Can't query "all plans using this unit" from database

### Issue 3: Missing Foreign Keys

**user_progress table:**
```sql
CREATE TABLE user_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,      -- ❌ No FK to subjects table
  unit_id TEXT NOT NULL,      -- ❌ No FK to units table
  -- ...
);
```

**Consequences:**
- Can insert progress for non-existent units
- Orphaned records if curriculum changes
- Can't cascade delete related data

**resource_progress table:**
```sql
CREATE TABLE resource_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,      -- ❌ No FK to units table
  resource_url TEXT NOT NULL, -- ❌ No FK to resources table
  -- ...
);
```

Same issues as `user_progress`.

### Issue 4: TEXT Arrays for Subjects

```sql
subjects TEXT[] NOT NULL CHECK (array_length(subjects, 1) BETWEEN 2 AND 12)
```

**Problem:** Subjects stored as arbitrary strings. Should reference a subjects table.

---

## 3. Missing Constraints

### Timezone Validation

```sql
-- Current: accepts any text
timezone TEXT NOT NULL DEFAULT 'UTC'

-- Should validate IANA timezone names
timezone TEXT NOT NULL DEFAULT 'UTC'
  CHECK (timezone ~ '^[A-Z][a-zA-Z_]+/[A-Z][a-zA-Z_]+$')
```

### Share Token Format

```sql
-- Current: no validation
share_token TEXT UNIQUE NOT NULL

-- Should enforce format and length
share_token TEXT UNIQUE NOT NULL
  CHECK (char_length(share_token) = 32 AND share_token ~ '^[a-zA-Z0-9]+$')
```

### Status Transitions

```sql
-- Current: simple enum check
status TEXT CHECK (status IN ('active', 'completed', 'expired', 'archived'))

-- Could add constraint preventing invalid transitions
-- (e.g., can't go from 'completed' back to 'active')
```

---

## 4. Query Pattern Analysis

### Dashboard Page (app/(dashboard)/dashboard/page.tsx)

**Current queries:**
```typescript
// ✅ Good: Parallel queries with Promise.all()
const [
  { data: streak },
  { data: progress }
] = await Promise.all([
  supabase.from('study_streaks').select('*').eq('user_id', user.id).single(),
  supabase.from('user_progress').select('*').eq('user_id', user.id).eq('plan_id', plan.id)
]);
```

**Performance:** Good - no N+1 pattern. Uses composite index `user_progress_user_date_idx`.

### Plan View Page (app/(dashboard)/plan/[id]/page.tsx)

**Current queries:**
```typescript
// ✅ Good: Parallel fetches
const [
  { data: progressData },
  { data: resourceProgressData }
] = await Promise.all([
  supabase.from('user_progress').select('*').eq('user_id', user.id).eq('plan_id', planId),
  supabase.from('resource_progress').select('*').eq('user_id', user.id).eq('plan_id', planId)
]);
```

**Performance:** Good - parallel queries. However, enrichment happens in-memory:
```typescript
// ⚠️ This loop runs for every day in the schedule
for (const day of schedule.days) {
  enrichedDays[day.dayLabel] = day.units.map((unit) => {
    const curriculumData = getCurriculumData(unit.subject);
    const curriculumUnit = curriculumData?.units.find((u) => u.id === unit.unitId);
    // ... complex resource filtering logic
  });
}
```

**Issue:** Curriculum data loaded from JSON files in Node.js memory. Could be moved to database for:
- Consistent querying
- Better caching
- Server-side joins

### Parent Dashboard (app/share/[token]/page.tsx)

**Current query:**
```typescript
// ✅ Excellent: Single RPC call with SECURITY DEFINER
const { data } = await supabase.rpc('parent_dashboard_overview', {
  p_share_token: token
});
```

**RPC function:**
```sql
CREATE OR REPLACE FUNCTION parent_dashboard_overview(p_share_token text)
RETURNS jsonb AS $$
  -- Single query fetching plan, streak, and ALL progress
  -- Returns combined JSONB result
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Performance:** Excellent - optimal single-query pattern. No improvements needed.

### Account Export (app/api/account/export/route.ts)

**Current queries:**
```typescript
// ✅ Good: Parallel fetches of all user data
const [profileRes, plansRes, progressRes, resourceProgressRes, streakRes, parentRes] =
  await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('study_plans').select('*').eq('user_id', userId),
    supabase.from('user_progress').select('*').eq('user_id', userId),
    supabase.from('resource_progress').select('*').eq('user_id', userId),
    supabase.from('study_streaks').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('parent_access').select('*').eq('student_user_id', userId)
  ]);
```

**Performance:** Good - parallel queries with proper indexes.

### Bulk Progress Updates (app/api/progress/bulk/route.ts)

Uses server-side RPC for batching:
```typescript
// ✅ Excellent: Single RPC call for multiple operations
await supabase.rpc('apply_bulk_progress', {
  p_operations: operations
});
```

**Performance:** Optimal - reduces roundtrips, handles streaks server-side.

### Summary: No N+1 Patterns Found

**Verdict:** ✅ Application code is already well-optimized
- Uses `Promise.all()` for parallel queries
- Uses RPC functions for complex operations
- Uses bulk operations where applicable
- Proper use of indexes

**Main bottleneck:** JSONB parsing and in-memory curriculum enrichment, not query patterns.

---

## 5. Proposed New Schema

### Overview

Normalize the JSONB schedule into relational tables while maintaining backward compatibility.

### New Tables

#### 5.1 `curriculum_subjects` - Subject Definitions

```sql
CREATE TABLE curriculum_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_code TEXT UNIQUE NOT NULL,  -- 'math-30-1', 'bio-30'
  subject_name TEXT NOT NULL,         -- 'Math 30-1', 'Biology 30'
  grade INTEGER NOT NULL,             -- 11 or 12
  alberta_docs JSONB DEFAULT '[]',    -- [{ title, url, type }]
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subjects_code ON curriculum_subjects(subject_code);
CREATE INDEX idx_subjects_grade ON curriculum_subjects(grade);

-- Seed with current curriculum data
INSERT INTO curriculum_subjects (subject_code, subject_name, grade) VALUES
  ('math-30-1', 'Math 30-1', 12),
  ('bio-30', 'Biology 30', 12),
  ('chem-30', 'Chemistry 30', 12),
  -- ... etc
;
```

#### 5.2 `curriculum_units` - Unit Definitions

```sql
CREATE TABLE curriculum_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL,              -- 'RF', 'Biochemistry'
  unit_name TEXT NOT NULL,              -- 'Relations and Functions'
  estimated_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  topics TEXT[] DEFAULT '{}',
  outcomes JSONB DEFAULT '[]',          -- [{ code, title, description, strand }]
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, unit_code)
);

CREATE INDEX idx_units_subject ON curriculum_units(subject_id);
CREATE INDEX idx_units_subject_code ON curriculum_units(subject_id, unit_code);

-- Seed with current curriculum units from JSON files
-- (Migration script would parse data/curriculum/*.json)
```

#### 5.3 `curriculum_resources` - Resource Definitions

```sql
CREATE TABLE curriculum_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'video', 'pdf', 'article', 'practice', 'reference',
    'virtual-lab', 'exemplars', 'rubric', 'data-booklet',
    'course', 'simulation', 'diploma-prep', 'worksheet'
  )),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  aligned_outcomes TEXT[] DEFAULT '{}',  -- Outcome codes this resource covers
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_unit ON curriculum_resources(unit_id);
CREATE INDEX idx_resources_url ON curriculum_resources(url);  -- For resource_progress FK
CREATE INDEX idx_resources_type ON curriculum_resources(resource_type);

-- Seed with current resource data from JSON files
```

#### 5.4 `plan_days` - Individual Days in Schedule

```sql
CREATE TABLE plan_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index >= 0),
  day_label TEXT NOT NULL,              -- 'Week 1 - Monday', 'Day 1'
  day_date DATE,                        -- Actual calendar date (optional)
  is_weekend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, day_index)
);

CREATE INDEX idx_plan_days_plan ON plan_days(plan_id, day_index);
CREATE INDEX idx_plan_days_date ON plan_days(day_date);
```

#### 5.5 `plan_day_units` - Units Assigned to Each Day

```sql
CREATE TABLE plan_day_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_day_id UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Optional: specific resources/outcomes for this assignment
  assigned_resource_ids UUID[] DEFAULT '{}',  -- Subset of unit's resources
  assigned_outcome_codes TEXT[] DEFAULT '{}', -- Subset of unit's outcomes

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_day_id, unit_id)  -- Each unit appears once per day
);

CREATE INDEX idx_plan_day_units_day ON plan_day_units(plan_day_id);
CREATE INDEX idx_plan_day_units_unit ON plan_day_units(unit_id);

-- For analytics: which units are most commonly scheduled?
CREATE INDEX idx_plan_day_units_unit_count ON plan_day_units(unit_id);
```

#### 5.6 Updated `study_plans` Table

```sql
-- Keep JSONB schedule for backward compatibility during migration
ALTER TABLE study_plans
  ADD COLUMN schedule_version INTEGER DEFAULT 1;

-- schedule_version = 1: JSONB schedule (legacy)
-- schedule_version = 2: Normalized tables (new)

-- Add comment explaining migration path
COMMENT ON COLUMN study_plans.schedule_version IS
  'Version 1: JSONB schedule (legacy). Version 2: Normalized plan_days/plan_day_units (preferred). During migration, both exist.';
```

#### 5.7 Updated `user_progress` Table

```sql
-- Add foreign key to curriculum_units
ALTER TABLE user_progress
  ADD COLUMN curriculum_unit_id UUID REFERENCES curriculum_units(id) ON DELETE CASCADE;

-- Create index for the new FK
CREATE INDEX idx_user_progress_curriculum_unit ON user_progress(curriculum_unit_id);

-- Backfill using migration:
-- UPDATE user_progress up
-- SET curriculum_unit_id = cu.id
-- FROM curriculum_units cu
-- JOIN curriculum_subjects cs ON cu.subject_id = cs.id
-- WHERE up.subject = cs.subject_name AND up.unit_id = cu.unit_code;

-- After backfill, add NOT NULL constraint
-- ALTER TABLE user_progress ALTER COLUMN curriculum_unit_id SET NOT NULL;
```

#### 5.8 Updated `resource_progress` Table

```sql
-- Add foreign keys to new tables
ALTER TABLE resource_progress
  ADD COLUMN curriculum_unit_id UUID REFERENCES curriculum_units(id) ON DELETE CASCADE,
  ADD COLUMN curriculum_resource_id UUID REFERENCES curriculum_resources(id) ON DELETE CASCADE;

-- Create indexes for the new FKs
CREATE INDEX idx_resource_progress_curriculum_unit
  ON resource_progress(curriculum_unit_id);
CREATE INDEX idx_resource_progress_curriculum_resource
  ON resource_progress(curriculum_resource_id);

-- Composite index for common query pattern
CREATE INDEX idx_resource_progress_user_plan_unit
  ON resource_progress(user_id, plan_id, curriculum_unit_id);
```

---

## 6. Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)

```sql
-- Run migration 001: Add curriculum tables
-- - curriculum_subjects
-- - curriculum_units
-- - curriculum_resources
-- - plan_days
-- - plan_day_units

-- Seed curriculum data from JSON files
-- Application continues using JSONB schedule
```

### Phase 2: Dual-Write (Transition Period)

```sql
-- Update regenerate_study_plan() RPC to write to both:
-- 1. study_plans.schedule (JSONB) - for backward compatibility
-- 2. plan_days + plan_day_units - for new queries

-- Application reads from JSONB, database maintains both structures
```

**Application changes:**
```typescript
// In regenerate_study_plan RPC function:
async function regenerateStudyPlan(schedule: FlexibleSchedule) {
  // 1. Insert into study_plans with JSONB (existing code)
  const plan = await insertPlan({ schedule, schedule_version: 2 });

  // 2. Insert into normalized tables (new code)
  for (const day of schedule.days) {
    const planDay = await insertPlanDay({
      plan_id: plan.id,
      day_index: day.dayIndex,
      day_label: day.dayLabel
    });

    for (const unit of day.units) {
      const curriculumUnit = await findCurriculumUnit(unit.subject, unit.unitId);
      await insertPlanDayUnit({
        plan_day_id: planDay.id,
        unit_id: curriculumUnit.id
      });
    }
  }
}
```

### Phase 3: Migrate Existing Plans

```sql
-- Background job to migrate existing plans from JSONB to normalized tables
CREATE OR REPLACE FUNCTION migrate_plan_schedule(p_plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  plan_row study_plans%ROWTYPE;
  schedule_json JSONB;
  day_obj JSONB;
  unit_obj JSONB;
  day_record plan_days%ROWTYPE;
BEGIN
  SELECT * INTO plan_row FROM study_plans WHERE id = p_plan_id;

  IF plan_row.schedule_version = 2 THEN
    RETURN TRUE; -- Already migrated
  END IF;

  schedule_json := plan_row.schedule;

  -- Parse JSONB and create normalized records
  FOR day_obj IN SELECT jsonb_array_elements(schedule_json->'days')
  LOOP
    INSERT INTO plan_days (plan_id, day_index, day_label, day_date)
    VALUES (
      p_plan_id,
      (day_obj->>'dayIndex')::INTEGER,
      day_obj->>'dayLabel',
      NULLIF(day_obj->>'date', '')::DATE
    )
    RETURNING * INTO day_record;

    FOR unit_obj IN SELECT jsonb_array_elements(day_obj->'units')
    LOOP
      INSERT INTO plan_day_units (plan_day_id, unit_id, assigned_resource_ids, assigned_outcome_codes)
      SELECT
        day_record.id,
        cu.id,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(unit_obj->'resourceUrls', '[]'::jsonb)))::UUID[],
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(unit_obj->'outcomeCodes', '[]'::jsonb)))
      FROM curriculum_units cu
      JOIN curriculum_subjects cs ON cu.subject_id = cs.id
      WHERE cs.subject_name = unit_obj->>'subject'
        AND cu.unit_code = unit_obj->>'unitId';
    END LOOP;
  END LOOP;

  UPDATE study_plans SET schedule_version = 2 WHERE id = p_plan_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Run migration for all existing plans
-- SELECT migrate_plan_schedule(id) FROM study_plans WHERE schedule_version = 1;
```

### Phase 4: Switch Reads to Normalized Tables

**Update queries to use normalized tables:**

```typescript
// Before: Parse JSONB schedule
const schedule = plan.schedule as FlexibleSchedule;
for (const day of schedule.days) {
  for (const unit of day.units) {
    // Process unit
  }
}

// After: Query normalized tables with JOIN
const { data: planDays } = await supabase
  .from('plan_days')
  .select(`
    *,
    plan_day_units (
      *,
      curriculum_unit:curriculum_units (
        *,
        subject:curriculum_subjects (*),
        resources:curriculum_resources (*)
      )
    )
  `)
  .eq('plan_id', planId)
  .order('day_index');
```

**Benefits:**
- Single query with JOINs instead of JSONB parsing
- Automatic curriculum enrichment from database
- Consistent data between application and storage

### Phase 5: Deprecate JSONB Schedule

```sql
-- After all plans migrated and application updated:
ALTER TABLE study_plans DROP COLUMN schedule;
ALTER TABLE study_plans DROP COLUMN schedule_version;

-- JSONB column removed, normalized tables are source of truth
```

---

## 7. Benefits of Normalized Schema

### 7.1 Query Performance

**Before (JSONB):**
```sql
-- Find all plans using Math 30-1 unit RF
SELECT * FROM study_plans
WHERE schedule @> '{"days": [{"units": [{"subject": "Math 30-1", "unitId": "RF"}]}]}';
-- ❌ Full table scan of JSONB, slow
```

**After (Normalized):**
```sql
-- Find all plans using Math 30-1 unit RF
SELECT DISTINCT sp.*
FROM study_plans sp
JOIN plan_days pd ON pd.plan_id = sp.id
JOIN plan_day_units pdu ON pdu.plan_day_id = pd.id
JOIN curriculum_units cu ON cu.id = pdu.unit_id
WHERE cu.unit_code = 'RF' AND cu.subject_id = (
  SELECT id FROM curriculum_subjects WHERE subject_code = 'math-30-1'
);
-- ✅ Uses indexes, fast
```

### 7.2 Referential Integrity

**Before:**
- Could insert progress for non-existent units
- No cascade delete for removed units
- Orphaned records possible

**After:**
```sql
-- Foreign keys ensure data consistency
ALTER TABLE user_progress
  ADD FOREIGN KEY (curriculum_unit_id) REFERENCES curriculum_units(id) ON DELETE CASCADE;

-- Attempting to delete a unit with progress:
DELETE FROM curriculum_units WHERE id = 'some-uuid';
-- ❌ ERROR: unit has dependent records in user_progress
-- ✅ Or CASCADE: automatically cleans up progress records
```

### 7.3 Analytics Queries

**Popular units report:**
```sql
-- Before: Impossible to query efficiently
-- After:
SELECT
  cs.subject_name,
  cu.unit_name,
  COUNT(DISTINCT pdu.plan_day_id) as times_scheduled,
  AVG(cu.estimated_hours) as avg_hours
FROM plan_day_units pdu
JOIN curriculum_units cu ON cu.id = pdu.unit_id
JOIN curriculum_subjects cs ON cs.id = cu.subject_id
GROUP BY cs.subject_name, cu.unit_name
ORDER BY times_scheduled DESC
LIMIT 20;
```

**Completion rates by subject:**
```sql
-- Before: Complex JSONB parsing
-- After:
SELECT
  cs.subject_name,
  COUNT(DISTINCT pdu.id) as total_assigned,
  COUNT(DISTINCT up.id) as total_completed,
  ROUND(COUNT(DISTINCT up.id)::NUMERIC / NULLIF(COUNT(DISTINCT pdu.id), 0) * 100, 2) as completion_rate
FROM plan_day_units pdu
LEFT JOIN user_progress up ON up.curriculum_unit_id = pdu.unit_id
JOIN curriculum_units cu ON cu.id = pdu.unit_id
JOIN curriculum_subjects cs ON cs.id = cu.subject_id
GROUP BY cs.subject_name
ORDER BY completion_rate DESC;
```

**Resource engagement:**
```sql
-- Which resources are most completed?
SELECT
  cr.title,
  cr.resource_type,
  cs.subject_name,
  COUNT(*) as completion_count
FROM resource_progress rp
JOIN curriculum_resources cr ON cr.id = rp.curriculum_resource_id
JOIN curriculum_units cu ON cu.id = cr.unit_id
JOIN curriculum_subjects cs ON cs.id = cu.subject_id
GROUP BY cr.title, cr.resource_type, cs.subject_name
ORDER BY completion_count DESC
LIMIT 20;
```

### 7.4 Data Integrity

**Type safety:**
```typescript
// Before: Strings everywhere, no validation
{ subject: "Math 30-1", unitId: "RF" }  // Typos possible

// After: UUIDs with FK constraints
{ curriculum_unit_id: "123e4567-e89b-12d3-a456-426614174000" }
// ✅ Database guarantees this unit exists
```

**Cascade deletes:**
```sql
-- Delete a deprecated subject and clean up all related data
DELETE FROM curriculum_subjects WHERE subject_code = 'old-course';
-- ✅ Automatically cascades to:
--   - curriculum_units
--   - curriculum_resources
--   - plan_day_units
--   - user_progress
--   - resource_progress
```

### 7.5 Storage Efficiency

**Before:**
- Same unit data duplicated in every plan's JSONB
- Large JSONB documents slow to parse
- No compression benefits

**After:**
- Units defined once, referenced by ID
- Smaller plan_day_units records
- Better Postgres storage compression

**Estimated savings:**
```
Average plan JSONB size: ~10 KB
Average plan normalized size: ~2 KB (plan_days + plan_day_units)
Savings: ~80% per plan
```

---

## 8. New Indexes for Common Queries

### Query 1: User's Active Plan Progress

```sql
-- Get all progress for a user's active plan with curriculum details
CREATE INDEX idx_user_progress_user_plan_curriculum
  ON user_progress(user_id, plan_id, curriculum_unit_id);

-- Query:
SELECT
  up.*,
  cu.unit_name,
  cu.estimated_hours,
  cs.subject_name
FROM user_progress up
JOIN curriculum_units cu ON cu.id = up.curriculum_unit_id
JOIN curriculum_subjects cs ON cs.id = cu.subject_id
WHERE up.user_id = $1 AND up.plan_id = $2;
```

### Query 2: Today's Units for Dashboard

```sql
-- Get today's units for a specific plan
CREATE INDEX idx_plan_days_plan_date
  ON plan_days(plan_id, day_date);

-- Query:
SELECT
  pdu.*,
  cu.unit_name,
  cu.estimated_hours,
  cs.subject_name
FROM plan_days pd
JOIN plan_day_units pdu ON pdu.plan_day_id = pd.id
JOIN curriculum_units cu ON cu.id = pdu.unit_id
JOIN curriculum_subjects cs ON cs.id = cu.subject_id
WHERE pd.plan_id = $1
  AND pd.day_date = CURRENT_DATE;
```

### Query 3: Resource Progress by Unit

```sql
-- Get resource progress for a specific unit
CREATE INDEX idx_resource_progress_user_unit
  ON resource_progress(user_id, curriculum_unit_id, completed);

-- Query:
SELECT
  rp.*,
  cr.title as resource_title,
  cr.resource_type,
  cr.url
FROM resource_progress rp
JOIN curriculum_resources cr ON cr.id = rp.curriculum_resource_id
WHERE rp.user_id = $1
  AND rp.curriculum_unit_id = $2;
```

### Query 4: Streak Calculation

```sql
-- Already well-optimized with composite index
CREATE INDEX user_progress_user_date_idx
  ON user_progress(user_id, completed_at DESC);

-- No changes needed - existing index is optimal
```

---

## 9. Data Validation Constraints

### Timezone Validation

```sql
-- Add constraint to validate IANA timezone format
ALTER TABLE profiles
  ADD CONSTRAINT check_timezone_format
  CHECK (
    timezone = 'UTC' OR
    timezone ~ '^[A-Z][a-zA-Z_]+/[A-Z][a-zA-Z_]+$'
  );

-- Valid: 'UTC', 'America/Edmonton', 'Europe/London'
-- Invalid: 'PST', 'Eastern', 'invalid/timezone'
```

### Share Token Validation

```sql
-- Enforce share token format
ALTER TABLE parent_access
  ADD CONSTRAINT check_share_token_format
  CHECK (
    char_length(share_token) = 32 AND
    share_token ~ '^[a-zA-Z0-9]+$'
  );

-- Valid: 32-character alphanumeric string
-- Invalid: URLs, special characters, wrong length
```

### Subject/Grade Consistency

```sql
-- Ensure users only have plans for their grade level
CREATE OR REPLACE FUNCTION check_plan_grade_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN curriculum_subjects cs ON cs.grade = p.grade
    WHERE p.id = NEW.user_id
      AND cs.id IN (
        SELECT DISTINCT cu.subject_id
        FROM plan_day_units pdu
        JOIN plan_days pd ON pd.id = pdu.plan_day_id
        JOIN curriculum_units cu ON cu.id = pdu.unit_id
        WHERE pd.plan_id = NEW.id
      )
  ) THEN
    RAISE EXCEPTION 'Plan contains subjects not matching user grade';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_plan_grade
  AFTER INSERT OR UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION check_plan_grade_match();
```

---

## 10. Rollback Strategy

### If Migration Fails

**Phase 1-3 (Dual-Write Active):**
```sql
-- Simply stop writing to normalized tables
-- Application continues using JSONB schedule
-- Drop new tables if needed:
DROP TABLE IF EXISTS plan_day_units CASCADE;
DROP TABLE IF EXISTS plan_days CASCADE;
DROP TABLE IF EXISTS curriculum_resources CASCADE;
DROP TABLE IF EXISTS curriculum_units CASCADE;
DROP TABLE IF EXISTS curriculum_subjects CASCADE;
```

**Phase 4-5 (Reads Switched):**
```sql
-- Revert application code to read from JSONB
-- Keep normalized tables for future attempt
-- Or rollback by restoring JSONB from normalized data:

CREATE OR REPLACE FUNCTION restore_jsonb_schedule(p_plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  schedule_json JSONB := '{"days": []}'::JSONB;
  day_json JSONB;
BEGIN
  FOR day_json IN (
    SELECT jsonb_build_object(
      'dayIndex', pd.day_index,
      'dayLabel', pd.day_label,
      'date', pd.day_date,
      'units', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'subject', cs.subject_name,
            'unitId', cu.unit_code,
            'title', cu.unit_name
          )
        )
        FROM plan_day_units pdu
        JOIN curriculum_units cu ON cu.id = pdu.unit_id
        JOIN curriculum_subjects cs ON cs.id = cu.subject_id
        WHERE pdu.plan_day_id = pd.id
      )
    ) as day_data
    FROM plan_days pd
    WHERE pd.plan_id = p_plan_id
    ORDER BY pd.day_index
  )
  LOOP
    schedule_json := jsonb_set(
      schedule_json,
      '{days}',
      (schedule_json->'days') || day_json
    );
  END LOOP;

  UPDATE study_plans
  SET schedule = schedule_json, schedule_version = 1
  WHERE id = p_plan_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. Implementation Timeline

### Week 1: Planning & Validation
- [ ] Review proposal with team
- [ ] Validate migration scripts on staging database
- [ ] Test dual-write performance impact
- [ ] Update application code for Phase 2

### Week 2: Deploy Phase 1-2 (Non-Breaking)
- [ ] Run migration 001: Create new tables
- [ ] Seed curriculum data from JSON files
- [ ] Deploy application update with dual-write
- [ ] Monitor performance and error rates

### Week 3: Migrate Existing Plans (Phase 3)
- [ ] Run background job to migrate plans
- [ ] Validate migrated data against JSONB
- [ ] Fix any migration errors
- [ ] Confirm all plans at schedule_version=2

### Week 4: Switch Reads (Phase 4)
- [ ] Update queries to use normalized tables
- [ ] Deploy application update
- [ ] Monitor query performance
- [ ] Validate correctness of results

### Week 5: Cleanup (Phase 5)
- [ ] Remove JSONB schedule column
- [ ] Drop old indexes
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## 12. Risks & Mitigations

### Risk 1: Migration Downtime

**Risk:** Long-running migration blocks writes to study_plans table.

**Mitigation:**
- Use online migration (dual-write) instead of blocking ALTER TABLE
- Migrate plans in batches with LIMIT/OFFSET
- Run during low-traffic hours

### Risk 2: Data Loss

**Risk:** Bug in migration script corrupts plan data.

**Mitigation:**
- Full database backup before migration
- Validate migrated data against JSONB source
- Keep JSONB column during migration for rollback
- Test on staging with production-like data

### Risk 3: Performance Regression

**Risk:** Normalized queries slower than JSONB parsing.

**Mitigation:**
- Benchmark queries before/after migration
- Add indexes proactively for common patterns
- Use EXPLAIN ANALYZE to validate query plans
- Keep monitoring in place for early detection

### Risk 4: Breaking Client Apps

**Risk:** Mobile app or old web clients break after schema change.

**Mitigation:**
- Use API versioning (/api/v1 → /api/v2)
- Maintain backward-compatible RPC functions
- Dual-write ensures both schemas work during transition
- Gradual rollout with feature flags

---

## 13. Alternative Approaches Considered

### Alternative 1: Keep JSONB, Add Indexes

**Approach:** Use GIN indexes on JSONB for faster queries.

```sql
CREATE INDEX idx_schedule_jsonb ON study_plans USING GIN (schedule jsonb_path_ops);
```

**Pros:**
- No schema migration needed
- Simpler deployment

**Cons:**
- Still no referential integrity
- Complex queries remain slow
- No cascade deletes
- Limited analytics capabilities
- JSONB indexes are less efficient than B-tree

**Verdict:** ❌ Does not address root causes

### Alternative 2: Hybrid Approach

**Approach:** Normalize curriculum tables but keep schedule as JSONB.

**Pros:**
- Curriculum reuse and referential integrity
- Easier analytics on units/resources
- Smaller migration scope

**Cons:**
- Still can't efficiently query "which plans use unit X"
- Still need JSONB parsing in application
- No cascade delete for plan structure

**Verdict:** ⚠️ Partial solution, may be good interim step

### Alternative 3: Event Sourcing

**Approach:** Store plan changes as events, rebuild schedule on read.

**Pros:**
- Full audit trail
- Time-travel queries
- Flexible schema evolution

**Cons:**
- Much higher complexity
- Slower reads (need to replay events)
- Overkill for current requirements

**Verdict:** ❌ Too complex for current needs

---

## 14. SQL Migration Scripts

### Migration 001: Create Curriculum Tables

```sql
-- File: supabase/migrations/20251013000001_create_curriculum_tables.sql

-- ================================================
-- Migration: Create Normalized Curriculum Schema
-- ================================================

BEGIN;

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE: curriculum_subjects
-- ================================================
CREATE TABLE curriculum_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_code TEXT UNIQUE NOT NULL,
  subject_name TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade IN (11, 12)),
  alberta_docs JSONB DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subjects_code ON curriculum_subjects(subject_code);
CREATE INDEX idx_subjects_grade ON curriculum_subjects(grade);
CREATE INDEX idx_subjects_status ON curriculum_subjects(status) WHERE status = 'active';

COMMENT ON TABLE curriculum_subjects IS 'Subject definitions from Alberta curriculum';
COMMENT ON COLUMN curriculum_subjects.subject_code IS 'URL-safe identifier (e.g., math-30-1)';
COMMENT ON COLUMN curriculum_subjects.subject_name IS 'Display name (e.g., Math 30-1)';

-- ================================================
-- TABLE: curriculum_units
-- ================================================
CREATE TABLE curriculum_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES curriculum_subjects(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  estimated_hours DECIMAL(4,2) NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
  topics TEXT[] DEFAULT '{}',
  outcomes JSONB DEFAULT '[]'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, unit_code)
);

CREATE INDEX idx_units_subject ON curriculum_units(subject_id);
CREATE INDEX idx_units_subject_code ON curriculum_units(subject_id, unit_code);
CREATE INDEX idx_units_status ON curriculum_units(status) WHERE status = 'active';

COMMENT ON TABLE curriculum_units IS 'Unit definitions within subjects';
COMMENT ON COLUMN curriculum_units.unit_code IS 'Short identifier (e.g., RF, Biochemistry)';
COMMENT ON COLUMN curriculum_units.outcomes IS '[{code, title, description, strand, type}]';

-- ================================================
-- TABLE: curriculum_resources
-- ================================================
CREATE TABLE curriculum_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'video', 'pdf', 'article', 'practice', 'reference',
    'virtual-lab', 'exemplars', 'rubric', 'data-booklet',
    'course', 'simulation', 'diploma-prep', 'worksheet'
  )),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  aligned_outcomes TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_unit ON curriculum_resources(unit_id);
CREATE INDEX idx_resources_url ON curriculum_resources(url);
CREATE INDEX idx_resources_type ON curriculum_resources(resource_type);
CREATE INDEX idx_resources_status ON curriculum_resources(status) WHERE status = 'active';

COMMENT ON TABLE curriculum_resources IS 'Learning resources for units';
COMMENT ON COLUMN curriculum_resources.aligned_outcomes IS 'Outcome codes this resource addresses';

-- ================================================
-- TABLE: plan_days
-- ================================================
CREATE TABLE plan_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index >= 0),
  day_label TEXT NOT NULL,
  day_date DATE,
  is_weekend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, day_index)
);

CREATE INDEX idx_plan_days_plan ON plan_days(plan_id, day_index);
CREATE INDEX idx_plan_days_date ON plan_days(day_date);
CREATE INDEX idx_plan_days_plan_date ON plan_days(plan_id, day_date);

COMMENT ON TABLE plan_days IS 'Individual days in a study plan schedule';
COMMENT ON COLUMN plan_days.day_date IS 'Actual calendar date (optional)';

-- ================================================
-- TABLE: plan_day_units
-- ================================================
CREATE TABLE plan_day_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_day_id UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 0,
  assigned_resource_ids UUID[] DEFAULT '{}',
  assigned_outcome_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_day_id, unit_id)
);

CREATE INDEX idx_plan_day_units_day ON plan_day_units(plan_day_id);
CREATE INDEX idx_plan_day_units_unit ON plan_day_units(unit_id);
CREATE INDEX idx_plan_day_units_unit_count ON plan_day_units(unit_id);

COMMENT ON TABLE plan_day_units IS 'Units assigned to each plan day';
COMMENT ON COLUMN plan_day_units.assigned_resource_ids IS 'Subset of unit resources for this day';
COMMENT ON COLUMN plan_day_units.assigned_outcome_codes IS 'Subset of outcomes for this day';

-- ================================================
-- Update study_plans table
-- ================================================
ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS schedule_version INTEGER DEFAULT 1;

COMMENT ON COLUMN study_plans.schedule_version IS
  'Version 1: JSONB schedule (legacy). Version 2: Normalized plan_days/plan_day_units. During migration, both exist.';

-- ================================================
-- RLS Policies (inherit from auth.users)
-- ================================================
ALTER TABLE plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_day_units ENABLE ROW LEVEL SECURITY;

-- Students can only access days from their own plans
CREATE POLICY plan_days_select_own ON plan_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM study_plans
      WHERE study_plans.id = plan_days.plan_id
        AND study_plans.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY plan_day_units_select_own ON plan_day_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_days pd
      JOIN study_plans sp ON sp.id = pd.plan_id
      WHERE pd.id = plan_day_units.plan_day_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

-- Curriculum tables are public read-only
ALTER TABLE curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY curriculum_subjects_read_all ON curriculum_subjects FOR SELECT USING (true);
CREATE POLICY curriculum_units_read_all ON curriculum_units FOR SELECT USING (true);
CREATE POLICY curriculum_resources_read_all ON curriculum_resources FOR SELECT USING (true);

GRANT SELECT ON TABLE curriculum_subjects TO anon, authenticated;
GRANT SELECT ON TABLE curriculum_units TO anon, authenticated;
GRANT SELECT ON TABLE curriculum_resources TO anon, authenticated;

COMMIT;
```

### Migration 002: Seed Curriculum Data

```sql
-- File: supabase/migrations/20251013000002_seed_curriculum_data.sql

-- This migration would be generated by parsing data/curriculum/*.json files
-- Example for one subject:

BEGIN;

-- Insert subject
INSERT INTO curriculum_subjects (subject_code, subject_name, grade, alberta_docs, status)
VALUES (
  'math-30-1',
  'Math 30-1',
  12,
  '[
    {"title": "Mathematics 30-1 Program of Studies", "url": "https://...", "type": "program-of-studies"},
    {"title": "Grade 12 Mathematics (30-1) Standards", "url": "https://...", "type": "standards"}
  ]'::JSONB,
  'active'
)
ON CONFLICT (subject_code) DO NOTHING
RETURNING id;

-- Insert units (using subject_id from above)
WITH subject AS (
  SELECT id FROM curriculum_subjects WHERE subject_code = 'math-30-1'
)
INSERT INTO curriculum_units (subject_id, unit_code, unit_name, estimated_hours, outcomes, display_order, status)
SELECT
  subject.id,
  'RF',
  'Relations and Functions',
  15.0,
  '[
    {"code": "RF1", "title": "...", "strand": "Relations and Functions"},
    {"code": "RF2", "title": "...", "strand": "Relations and Functions"}
  ]'::JSONB,
  1,
  'active'
FROM subject
ON CONFLICT (subject_id, unit_code) DO NOTHING;

-- Insert resources for the unit
WITH unit AS (
  SELECT cu.id FROM curriculum_units cu
  JOIN curriculum_subjects cs ON cs.id = cu.subject_id
  WHERE cs.subject_code = 'math-30-1' AND cu.unit_code = 'RF'
)
INSERT INTO curriculum_resources (unit_id, resource_type, title, url, aligned_outcomes, display_order, status)
SELECT
  unit.id,
  'video',
  'Khan Academy: Functions',
  'https://www.khanacademy.org/...',
  ARRAY['RF1', 'RF2'],
  1,
  'active'
FROM unit
ON CONFLICT DO NOTHING;

-- Repeat for all subjects, units, and resources...

COMMIT;
```

### Migration 003: Add Foreign Keys to Progress Tables

```sql
-- File: supabase/migrations/20251013000003_add_progress_foreign_keys.sql

BEGIN;

-- ================================================
-- Add curriculum_unit_id to user_progress
-- ================================================
ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS curriculum_unit_id UUID;

-- Create index for new FK
CREATE INDEX IF NOT EXISTS idx_user_progress_curriculum_unit
  ON user_progress(curriculum_unit_id);

-- Backfill existing records
UPDATE user_progress up
SET curriculum_unit_id = cu.id
FROM curriculum_units cu
JOIN curriculum_subjects cs ON cu.subject_id = cs.id
WHERE up.subject = cs.subject_name
  AND up.unit_id = cu.unit_code
  AND up.curriculum_unit_id IS NULL;

-- Add FK constraint (after backfill completes)
-- Uncomment after verifying backfill success:
-- ALTER TABLE user_progress
--   ADD CONSTRAINT fk_user_progress_curriculum_unit
--   FOREIGN KEY (curriculum_unit_id) REFERENCES curriculum_units(id) ON DELETE CASCADE;

-- ================================================
-- Add curriculum fields to resource_progress
-- ================================================
ALTER TABLE resource_progress
  ADD COLUMN IF NOT EXISTS curriculum_unit_id UUID,
  ADD COLUMN IF NOT EXISTS curriculum_resource_id UUID;

-- Create indexes for new FKs
CREATE INDEX IF NOT EXISTS idx_resource_progress_curriculum_unit
  ON resource_progress(curriculum_unit_id);
CREATE INDEX IF NOT EXISTS idx_resource_progress_curriculum_resource
  ON resource_progress(curriculum_resource_id);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_resource_progress_user_plan_unit
  ON resource_progress(user_id, plan_id, curriculum_unit_id);

-- Backfill curriculum_unit_id
UPDATE resource_progress rp
SET curriculum_unit_id = cu.id
FROM curriculum_units cu
WHERE rp.unit_id = cu.unit_code
  AND rp.curriculum_unit_id IS NULL;

-- Backfill curriculum_resource_id
UPDATE resource_progress rp
SET curriculum_resource_id = cr.id
FROM curriculum_resources cr
WHERE rp.resource_url = cr.url
  AND rp.curriculum_resource_id IS NULL;

-- Add FK constraints (after backfill completes)
-- Uncomment after verifying backfill success:
-- ALTER TABLE resource_progress
--   ADD CONSTRAINT fk_resource_progress_curriculum_unit
--   FOREIGN KEY (curriculum_unit_id) REFERENCES curriculum_units(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_resource_progress_curriculum_resource
--   FOREIGN KEY (curriculum_resource_id) REFERENCES curriculum_resources(id) ON DELETE CASCADE;

COMMIT;
```

### Migration 004: Add Validation Constraints

```sql
-- File: supabase/migrations/20251013000004_add_validation_constraints.sql

BEGIN;

-- ================================================
-- Timezone validation
-- ================================================
ALTER TABLE profiles
  ADD CONSTRAINT check_timezone_format
  CHECK (
    timezone = 'UTC' OR
    timezone ~ '^[A-Z][a-zA-Z_]+/[A-Z][a-zA-Z_]+$'
  );

COMMENT ON CONSTRAINT check_timezone_format ON profiles IS
  'Validates IANA timezone format (e.g., America/Edmonton, Europe/London)';

-- ================================================
-- Share token validation
-- ================================================
ALTER TABLE parent_access
  ADD CONSTRAINT check_share_token_format
  CHECK (
    char_length(share_token) = 32 AND
    share_token ~ '^[a-zA-Z0-9]+$'
  );

COMMENT ON CONSTRAINT check_share_token_format ON parent_access IS
  'Enforces 32-character alphanumeric share token format';

-- ================================================
-- Grade validation for study plans
-- ================================================
CREATE OR REPLACE FUNCTION check_plan_grade_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate plans using normalized schedule (version 2)
  IF NEW.schedule_version = 2 THEN
    IF NOT EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = NEW.user_id
        AND p.grade IN (
          SELECT DISTINCT cs.grade
          FROM plan_days pd
          JOIN plan_day_units pdu ON pdu.plan_day_id = pd.id
          JOIN curriculum_units cu ON cu.id = pdu.unit_id
          JOIN curriculum_subjects cs ON cs.id = cu.subject_id
          WHERE pd.plan_id = NEW.id
        )
    ) THEN
      RAISE EXCEPTION 'Plan contains subjects not matching user grade level';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_plan_grade
  AFTER INSERT OR UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION check_plan_grade_match();

COMMENT ON FUNCTION check_plan_grade_match() IS
  'Ensures study plans only contain subjects appropriate for student grade level';

COMMIT;
```

---

## 15. Monitoring & Success Metrics

### Metrics to Track

1. **Query Performance**
   ```sql
   -- Before migration
   SELECT
     query_id,
     mean_exec_time,
     calls
   FROM pg_stat_statements
   WHERE query LIKE '%study_plans%schedule%'
   ORDER BY mean_exec_time DESC;

   -- After migration
   SELECT
     query_id,
     mean_exec_time,
     calls
   FROM pg_stat_statements
   WHERE query LIKE '%plan_days%plan_day_units%'
   ORDER BY mean_exec_time DESC;
   ```

2. **Storage Usage**
   ```sql
   -- Table sizes before/after
   SELECT
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

3. **Index Usage**
   ```sql
   -- Verify indexes are being used
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan,
     idx_tup_read,
     idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   ORDER BY idx_scan DESC;
   ```

4. **Migration Progress**
   ```sql
   -- Track migration status
   SELECT
     schedule_version,
     COUNT(*) as plan_count,
     ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM study_plans) * 100, 2) as percentage
   FROM study_plans
   GROUP BY schedule_version;
   ```

### Success Criteria

- ✅ All plans migrated to schedule_version=2
- ✅ Query times reduced by >50% for plan queries
- ✅ Zero data integrity errors (FK violations)
- ✅ Storage usage reduced by >30% for plans
- ✅ All indexes showing idx_scan > 100
- ✅ No increase in error rates
- ✅ Application performance maintained or improved

---

## 16. Conclusion

This migration from JSONB to normalized tables addresses fundamental schema design issues while maintaining backward compatibility. The phased approach minimizes risk and allows for incremental validation at each step.

**Key Benefits:**
- 🚀 Better query performance through proper indexing
- 🔒 Referential integrity with foreign keys
- 📊 Powerful analytics capabilities
- 💾 Storage efficiency gains
- 🛡️ Data validation at database level

**Next Steps:**
1. Review proposal with team
2. Test migration on staging environment
3. Begin Phase 1 implementation

**Questions?** Contact the database team or create an issue in the project repo.

---

**Document Metadata:**
- **Author:** Database Team
- **Last Updated:** 2025-10-13
- **Status:** Proposal (Awaiting Review)
- **Related PRs:** TBD
- **Supabase Project:** steadytrack-production
