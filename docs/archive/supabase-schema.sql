-- SteadyTrack Database Schema
-- Based on PRD Section 6: Data Model
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- ================================================
-- TABLE 1: profiles (extends auth.users)
-- ================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  grade INTEGER CHECK (grade IN (11, 12)),
  timezone TEXT NOT NULL DEFAULT 'UTC', -- IANA TZ name, e.g., 'America/Edmonton'
  display_name TEXT, -- Optional student-chosen name for parent dashboard
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For existing databases where profiles already existed without timezone or display_name
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ================================================
-- ================================================
-- TABLE 2: study_plans
-- ================================================
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT[] NOT NULL CHECK (array_length(subjects, 1) BETWEEN 2 AND 12),
  schedule JSONB NOT NULL, -- Flexible schedule structure: { days: [{ dayIndex, dayLabel, units: [...] }] }
  total_units INTEGER NOT NULL,
  duration_weeks INTEGER NOT NULL DEFAULT 1, -- Number of weeks for the plan (1-12)
  includes_weekends BOOLEAN NOT NULL DEFAULT FALSE, -- Whether weekends are included
  -- Plan lifecycle fields
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_day_index INTEGER NOT NULL DEFAULT 0,
  locked_timezone TEXT NOT NULL DEFAULT 'UTC',
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_plan_status CHECK (status IN ('active', 'completed', 'expired', 'archived')),
  CONSTRAINT check_plan_day_index CHECK (current_day_index >= 0),
  CONSTRAINT check_plan_dates CHECK (end_date >= start_date)
);

-- Column documentation
COMMENT ON COLUMN study_plans.start_date IS 'Plan start date (locked at creation)';
COMMENT ON COLUMN study_plans.end_date IS 'Plan end date (computed from schedule or duration)';
COMMENT ON COLUMN study_plans.status IS 'Lifecycle state: active, completed, expired, archived';
COMMENT ON COLUMN study_plans.current_day_index IS 'Manual day override (0-based)';
COMMENT ON COLUMN study_plans.locked_timezone IS 'IANA timezone locked at creation (e.g., America/Edmonton). Prevents day boundary shifts if user changes profile timezone. Hierarchy: locked > profile.timezone > UTC';
COMMENT ON COLUMN study_plans.completed_at IS 'Timestamp when all units completed';
COMMENT ON COLUMN study_plans.expired_at IS 'Timestamp when plan expired (passed end_date)';
COMMENT ON COLUMN study_plans.archived_at IS 'Timestamp when user archived plan';

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_plans_user_id_unique
  ON study_plans(user_id);

-- Indexes for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_study_plans_user_status
  ON study_plans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_study_plans_user_end_date
  ON study_plans(user_id, end_date);

-- ================================================
-- ================================================
-- TABLE 3: user_progress
-- ================================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMPTZ DEFAULT NOW(), -- Used for streak & weekly summary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, unit_id) -- Prevent duplicate completions
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_plan_unit
  ON user_progress (user_id, plan_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_completed_at ON user_progress(completed_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_plan_id ON user_progress(plan_id);
-- Composite index to accelerate per-user date-window scans
CREATE INDEX IF NOT EXISTS user_progress_user_date_idx
  ON user_progress(user_id, completed_at DESC);

-- Drop redundant single-column index; composite covers user_id filters
DROP INDEX IF EXISTS idx_user_progress_user_id;

-- ================================================
-- ================================================
-- TABLE 4: study_streaks
-- ================================================
CREATE TABLE IF NOT EXISTS study_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  total_study_days INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON study_streaks(user_id);

-- ================================================
-- ================================================
-- TABLE 5: parent_access
-- ================================================
CREATE TABLE IF NOT EXISTS parent_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_access_share_token ON parent_access(share_token);
CREATE INDEX IF NOT EXISTS idx_parent_access_student_id ON parent_access(student_user_id);

-- ================================================
-- ================================================
-- TABLE 6: resource_progress
-- ================================================
CREATE TABLE IF NOT EXISTS resource_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  resource_url TEXT NOT NULL, -- URL serves as unique identifier for resource
  completed BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, unit_id, resource_url)
);

CREATE INDEX IF NOT EXISTS idx_resource_progress_user_plan ON resource_progress(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_resource_progress_unit ON resource_progress(user_id, unit_id);

-- ================================================
-- ================================================
-- TABLE 7: events (analytics)
-- ================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_streaks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;

-- Profiles: students own a single row each
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;

CREATE POLICY profiles_select_own
  ON profiles
  FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY profiles_insert_own
  ON profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own
  ON profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Study plans: students manage their own plan(s)
DROP POLICY IF EXISTS study_plans_select_own ON study_plans;
DROP POLICY IF EXISTS study_plans_insert_own ON study_plans;
DROP POLICY IF EXISTS study_plans_update_own ON study_plans;
DROP POLICY IF EXISTS study_plans_delete_own ON study_plans;

CREATE POLICY study_plans_select_own
  ON study_plans
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY study_plans_insert_own
  ON study_plans
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY study_plans_update_own
  ON study_plans
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY study_plans_delete_own
  ON study_plans
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- User progress: students record their own completions
DROP POLICY IF EXISTS user_progress_select_own ON user_progress;
DROP POLICY IF EXISTS user_progress_insert_own ON user_progress;
DROP POLICY IF EXISTS user_progress_update_own ON user_progress;
DROP POLICY IF EXISTS user_progress_delete_own ON user_progress;

CREATE POLICY user_progress_select_own
  ON user_progress
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_progress_insert_own
  ON user_progress
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_progress_update_own
  ON user_progress
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_progress_delete_own
  ON user_progress
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- Study streaks: students maintain their streak counters
DROP POLICY IF EXISTS study_streaks_select_own ON study_streaks;
DROP POLICY IF EXISTS study_streaks_insert_own ON study_streaks;
DROP POLICY IF EXISTS study_streaks_update_own ON study_streaks;

CREATE POLICY study_streaks_select_own
  ON study_streaks
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY study_streaks_insert_own
  ON study_streaks
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY study_streaks_update_own
  ON study_streaks
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Parent links: students manage links; parents read via secure RPC
DROP POLICY IF EXISTS parent_access_select_owner ON parent_access;
DROP POLICY IF EXISTS parent_access_insert_owner ON parent_access;
DROP POLICY IF EXISTS parent_access_update_owner ON parent_access;
DROP POLICY IF EXISTS parent_access_delete_owner ON parent_access;

CREATE POLICY parent_access_select_owner
  ON parent_access
  FOR SELECT
  USING ((SELECT auth.uid()) = student_user_id);

CREATE POLICY parent_access_insert_owner
  ON parent_access
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = student_user_id);

CREATE POLICY parent_access_update_owner
  ON parent_access
  FOR UPDATE
  USING ((SELECT auth.uid()) = student_user_id)
  WITH CHECK ((SELECT auth.uid()) = student_user_id);

CREATE POLICY parent_access_delete_owner
  ON parent_access
  FOR DELETE
  USING ((SELECT auth.uid()) = student_user_id);

-- Resource progress: students track their own resource completions
DROP POLICY IF EXISTS resource_progress_select_own ON resource_progress;
DROP POLICY IF EXISTS resource_progress_insert_own ON resource_progress;
DROP POLICY IF EXISTS resource_progress_update_own ON resource_progress;
DROP POLICY IF EXISTS resource_progress_delete_own ON resource_progress;

CREATE POLICY resource_progress_select_own
  ON resource_progress
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY resource_progress_insert_own
  ON resource_progress
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY resource_progress_update_own
  ON resource_progress
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY resource_progress_delete_own
  ON resource_progress
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- Analytics events: clients can only insert their own events
DROP POLICY IF EXISTS events_insert_client ON events;
DROP POLICY IF EXISTS events_select_reporting ON events;
DROP POLICY IF EXISTS events_delete_reporting ON events;

CREATE POLICY events_insert_client
  ON events
  FOR INSERT
  WITH CHECK (
    (SELECT auth.role()) = 'authenticated'
    AND (user_id IS NULL OR (SELECT auth.uid()) = user_id)
  );

CREATE POLICY events_select_reporting
  ON events
  FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY events_delete_reporting
  ON events
  FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

-- Tighten default grants so policies govern access
REVOKE ALL ON TABLE profiles          FROM PUBLIC;
REVOKE ALL ON TABLE study_plans       FROM PUBLIC;
REVOKE ALL ON TABLE user_progress     FROM PUBLIC;
REVOKE ALL ON TABLE study_streaks     FROM PUBLIC;
REVOKE ALL ON TABLE parent_access     FROM PUBLIC;
REVOKE ALL ON TABLE resource_progress FROM PUBLIC;
REVOKE ALL ON TABLE events            FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Schema + RPC for parent dashboards via share token
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO postgres;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION parent_dashboard_overview(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record parent_access%ROWTYPE;
  plan_record study_plans%ROWTYPE;
  streak_record study_streaks%ROWTYPE;
  progress_payload jsonb;
BEGIN
  SELECT *
    INTO link_record
    FROM parent_access
    WHERE share_token = p_share_token
      AND is_active = TRUE
    LIMIT 1;

  IF link_record.student_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO plan_record
    FROM study_plans
    WHERE user_id = link_record.student_user_id
    ORDER BY created_at DESC
    LIMIT 1;

  SELECT *
    INTO streak_record
    FROM study_streaks
    WHERE user_id = link_record.student_user_id
    LIMIT 1;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', up.id,
               'plan_id', up.plan_id,
               'subject', up.subject,
               'unit_id', up.unit_id,
               'completed', up.completed,
               'completed_at', up.completed_at,
               'created_at', up.created_at
             )
             ORDER BY up.completed_at DESC
           ),
           '[]'::jsonb
         )
    INTO progress_payload
    FROM user_progress up
    WHERE up.user_id = link_record.student_user_id;

  RETURN jsonb_build_object(
    'student_user_id', link_record.student_user_id,
    'plan', plan_record,
    'streak', streak_record,
    'progress', progress_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION parent_dashboard_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION parent_dashboard_overview(text) TO anon, authenticated;

-- ================================================
-- Helper Function: count_missed_study_days
-- Counts how many required study days are in the gap between two dates
-- ================================================
CREATE OR REPLACE FUNCTION count_missed_study_days(
  p_last_study_date DATE,
  p_today DATE,
  p_includes_weekends BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  gap_days INTEGER;
  missed_days INTEGER := 0;
  check_date DATE;
  day_of_week INTEGER;
BEGIN
  -- Calculate gap (number of days between, exclusive of endpoints)
  gap_days := p_today - p_last_study_date - 1;

  -- No gap = streak continues
  IF gap_days <= 0 THEN
    RETURN 0;
  END IF;

  -- If weekends are included, every day in the gap is a missed day
  IF p_includes_weekends THEN
    RETURN gap_days;
  END IF;

  -- If weekends are excluded, count only weekdays in the gap
  check_date := p_last_study_date + 1;
  WHILE check_date < p_today LOOP
    day_of_week := EXTRACT(ISODOW FROM check_date); -- 1=Monday, 7=Sunday
    IF day_of_week <= 5 THEN
      -- Weekday (Mon-Fri) counts as a missed study day
      missed_days := missed_days + 1;
    END IF;
    check_date := check_date + 1;
  END LOOP;

  RETURN missed_days;
END;
$$;

COMMENT ON FUNCTION count_missed_study_days(DATE, DATE, BOOLEAN) IS
  'Count missed required study days between last_study_date and today. Returns 0 if streak should continue, >0 if broken.';

-- Mark a unit complete in a single transactional RPC
CREATE OR REPLACE FUNCTION mark_unit_complete(p_plan_id uuid, p_subject text, p_unit_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  plan_record study_plans%ROWTYPE;
  inserted boolean := false;
  todays_count integer := 0;
  streak_increased boolean := false;
  new_current_streak integer := 0;
  total_units integer := 0;
  completed_count integer := 0;
  current_percentage integer := 0;
  previous_percentage integer := 0;
  milestone_value integer := NULL;
  milestones integer[] := ARRAY[25, 50, 75, 100];
  milestone_candidate integer;
  tz text := 'UTC';
  local_now timestamp;
  local_today_start timestamp;
  utc_today_start timestamptz;
  utc_tomorrow_start timestamptz;
  today_local_date date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO plan_record
    FROM study_plans
    WHERE id = p_plan_id
      AND user_id = uid
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study plan not found' USING ERRCODE = 'P0010';
  END IF;

  IF p_subject IS NULL OR NOT (plan_record.subjects @> ARRAY[p_subject]) THEN
    RAISE EXCEPTION 'Subject not part of plan' USING ERRCODE = 'P0011';
  END IF;

  -- Determine user's timezone and compute local day boundaries
  SELECT COALESCE(timezone, 'UTC') INTO tz FROM profiles WHERE id = uid LIMIT 1;
  local_now := (NOW() AT TIME ZONE tz);
  local_today_start := date_trunc('day', local_now);
  utc_today_start := local_today_start AT TIME ZONE tz;
  utc_tomorrow_start := (local_today_start + INTERVAL '1 day') AT TIME ZONE tz;
  today_local_date := local_today_start::date;

  INSERT INTO user_progress (
    user_id,
    plan_id,
    subject,
    unit_id,
    completed,
    completed_at
  )
  VALUES (
    uid,
    p_plan_id,
    p_subject,
    p_unit_id,
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id, plan_id, unit_id) DO NOTHING;

  inserted := FOUND;

  IF inserted THEN
    SELECT COUNT(*)
      INTO todays_count
      FROM user_progress
      WHERE user_id = uid
        AND completed_at >= utc_today_start
        AND completed_at <  utc_tomorrow_start;

    IF todays_count = 1 THEN
      streak_increased := TRUE;

      INSERT INTO study_streaks (
        user_id,
        current_streak,
        longest_streak,
        last_study_date,
        total_study_days,
        updated_at
      )
      VALUES (
        uid,
        1,
        1,
        today_local_date,
        1,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET current_streak = CASE
            WHEN study_streaks.last_study_date = today_local_date
              THEN study_streaks.current_streak -- already counted today via other activity
            WHEN count_missed_study_days(
                   study_streaks.last_study_date,
                   today_local_date,
                   COALESCE(plan_record.includes_weekends, false)
                 ) = 0
              THEN study_streaks.current_streak + 1 -- no missed required days, streak continues!
            ELSE 1 -- missed one or more required study days, restart streak
          END,
          longest_streak = GREATEST(
            study_streaks.longest_streak,
            CASE
              WHEN study_streaks.last_study_date = today_local_date
                THEN study_streaks.current_streak
              WHEN count_missed_study_days(
                     study_streaks.last_study_date,
                     today_local_date,
                     COALESCE(plan_record.includes_weekends, false)
                   ) = 0
                THEN study_streaks.current_streak + 1
              ELSE 1
            END
          ),
          last_study_date = today_local_date,
          total_study_days = CASE
            WHEN study_streaks.last_study_date = today_local_date THEN study_streaks.total_study_days
            ELSE study_streaks.total_study_days + 1
          END,
          updated_at = NOW()
      RETURNING current_streak INTO new_current_streak;
    ELSE
      UPDATE study_streaks
        SET updated_at = NOW()
        WHERE user_id = uid
      RETURNING current_streak INTO new_current_streak;
    END IF;
  ELSE
    SELECT COALESCE(current_streak, 0)
      INTO new_current_streak
      FROM study_streaks
      WHERE user_id = uid
      LIMIT 1;
  END IF;

  -- Use precomputed total_units from study_plans to avoid scanning JSON per toggle
  SELECT COALESCE(plan_record.total_units, 0)
    INTO total_units;

  SELECT COUNT(*)
    INTO completed_count
    FROM user_progress
    WHERE user_id = uid
      AND plan_id = p_plan_id;

  IF total_units > 0 THEN
    current_percentage := ROUND((completed_count::numeric / total_units) * 100);

    IF inserted THEN
      previous_percentage := ROUND(((completed_count - 1)::numeric / total_units) * 100);
    ELSE
      previous_percentage := current_percentage;
    END IF;

    FOREACH milestone_candidate IN ARRAY milestones LOOP
      IF current_percentage >= milestone_candidate
         AND previous_percentage < milestone_candidate THEN
        milestone_value := milestone_candidate;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF inserted THEN
    INSERT INTO events (user_id, event_name, event_data)
    VALUES (
      uid,
      'progress_updated',
      jsonb_build_object(
        'plan_id', p_plan_id,
        'subject', p_subject,
        'unit_id', p_unit_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'streakIncreased', streak_increased,
    'newStreak', new_current_streak,
    'milestone', milestone_value
  );
END;
$$;

REVOKE ALL ON FUNCTION mark_unit_complete(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_unit_complete(uuid, text, text) TO anon, authenticated;

COMMENT ON FUNCTION mark_unit_complete(uuid, text, text) IS
  'Mark a unit as complete and update streak using gap-based weekend-aware logic. Respects plan includes_weekends setting. Handles weekend study sessions correctly.';

-- Undo unit completion and recalculate streaks server-side
CREATE OR REPLACE FUNCTION undo_unit_progress(p_plan_id uuid, p_unit_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  plan_record study_plans%ROWTYPE;
  deleted_count integer := 0;
  date_list DATE[];
  idx integer;
  lower_idx integer;
  upper_idx integer;
  day DATE;
  prev_day DATE;
  running integer := 0;
  longest integer := 0;
  total_days integer := 0;
  current_streak integer := 0;
  check_day DATE;
  tz text := 'UTC';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO plan_record
    FROM study_plans
    WHERE id = p_plan_id
      AND user_id = uid
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study plan not found' USING ERRCODE = 'P0010';
  END IF;

  DELETE FROM user_progress
    WHERE user_id = uid
      AND plan_id = p_plan_id
      AND unit_id = p_unit_id
    RETURNING 1
    INTO deleted_count;

  IF deleted_count = 0 THEN
    SELECT COALESCE(current_streak, 0)
      INTO current_streak
      FROM study_streaks
      WHERE user_id = uid
      LIMIT 1;

    RETURN jsonb_build_object(
      'success', TRUE,
      'streakIncreased', FALSE,
      'newStreak', current_streak,
      'milestone', NULL
    );
  END IF;

  -- Use local-day mapping for streak recomputation
  SELECT COALESCE(timezone, 'UTC') INTO tz FROM profiles WHERE id = uid LIMIT 1;
  SELECT ARRAY_AGG(DISTINCT (completed_at AT TIME ZONE tz)::date
                   ORDER BY (completed_at AT TIME ZONE tz)::date)
    INTO date_list
    FROM user_progress
    WHERE user_id = uid;

  IF date_list IS NULL THEN
    current_streak := 0;
    longest := 0;
    total_days := 0;
    prev_day := NULL;
  ELSE
    lower_idx := array_lower(date_list, 1);
    upper_idx := array_upper(date_list, 1);
    total_days := array_length(date_list, 1);
    prev_day := NULL;
    running := 0;
    longest := 0;

    -- Calculate longest streak using gap-based logic
    FOR idx IN lower_idx..upper_idx LOOP
      day := date_list[idx];
      IF prev_day IS NULL THEN
        running := 1;
      ELSIF count_missed_study_days(prev_day, day, COALESCE(plan_record.includes_weekends, false)) = 0 THEN
        running := running + 1;
      ELSE
        running := 1;
      END IF;

      IF running > longest THEN
        longest := running;
      END IF;

      prev_day := day;
    END LOOP;

    -- Calculate current streak working backwards from today using gap-based logic
    current_streak := 0;
    check_day := (NOW() AT TIME ZONE tz)::date;
    prev_day := NULL;

    -- Find the most recent study date at or before today
    FOR idx IN REVERSE lower_idx..upper_idx LOOP
      IF date_list[idx] <= check_day THEN
        -- Check if this date should count towards streak
        IF prev_day IS NULL THEN
          -- First date found (most recent)
          IF count_missed_study_days(date_list[idx], check_day, COALESCE(plan_record.includes_weekends, false)) = 0 THEN
            current_streak := 1;
            prev_day := date_list[idx];
          ELSE
            -- Gap between today and last study date, no current streak
            EXIT;
          END IF;
        ELSIF count_missed_study_days(date_list[idx], prev_day, COALESCE(plan_record.includes_weekends, false)) = 0 THEN
          -- Streak continues
          current_streak := current_streak + 1;
          prev_day := date_list[idx];
        ELSE
          -- Gap found, stop
          EXIT;
        END IF;
      END IF;
    END LOOP;

    prev_day := date_list[upper_idx];
  END IF;

  INSERT INTO study_streaks (
    user_id,
    current_streak,
    longest_streak,
    last_study_date,
    total_study_days,
    updated_at
  )
  VALUES (
    uid,
    current_streak,
    longest,
    prev_day,
    total_days,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET current_streak = EXCLUDED.current_streak,
      longest_streak = EXCLUDED.longest_streak,
      last_study_date = EXCLUDED.last_study_date,
      total_study_days = EXCLUDED.total_study_days,
      updated_at = NOW();

  INSERT INTO events (user_id, event_name, event_data)
  VALUES (
    uid,
    'progress_undone',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'unit_id', p_unit_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'streakIncreased', FALSE,
    'newStreak', current_streak,
    'milestone', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION undo_unit_progress(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION undo_unit_progress(uuid, text) TO anon, authenticated;

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to get weekly summary
CREATE OR REPLACE FUNCTION get_weekly_summary(p_user_id UUID)
RETURNS TABLE (
  days_studied BIGINT,
  units_completed BIGINT,
  study_pulse NUMERIC
) AS $$
DECLARE
  tz text := 'UTC';
  local_now timestamp;
  local_cutoff timestamp;
  utc_cutoff timestamptz;
  today_local date;
BEGIN
  SELECT COALESCE(timezone, 'UTC') INTO tz FROM profiles WHERE id = p_user_id LIMIT 1;
  local_now := (NOW() AT TIME ZONE tz);
  local_cutoff := local_now - INTERVAL '7 days';
  utc_cutoff := local_cutoff AT TIME ZONE tz;
  today_local := local_now::date;

  RETURN QUERY
  WITH recent_progress AS (
    SELECT
      (completed_at AT TIME ZONE tz)::date as study_date,
      COUNT(*) as units
    FROM user_progress
    WHERE user_id = p_user_id
      AND completed_at >= utc_cutoff
    GROUP BY (completed_at AT TIME ZONE tz)::date
  ),
  last_four_days AS (
    SELECT COUNT(DISTINCT study_date) as days
    FROM recent_progress
    WHERE study_date >= (today_local - 4)
  )
  SELECT
    COUNT(DISTINCT rp.study_date)::BIGINT as days_studied,
    COALESCE(SUM(rp.units), 0)::BIGINT as units_completed,
    ROUND((lfd.days::NUMERIC / 4.0) * 100, 0) as study_pulse
  FROM recent_progress rp
  CROSS JOIN last_four_days lfd;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ==================================================
-- ==================================================
-- RPC: regenerate_study_plan
-- Atomically upsert the user's study plan with lifecycle fields
-- ==================================================
CREATE OR REPLACE FUNCTION regenerate_study_plan(
  p_subjects TEXT[],
  p_schedule JSONB,
  p_total_units INTEGER,
  p_duration_weeks INTEGER DEFAULT 1,
  p_includes_weekends BOOLEAN DEFAULT FALSE,
  p_reset BOOLEAN DEFAULT TRUE
)
RETURNS study_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  plan_row study_plans%ROWTYPE;
  user_tz TEXT := 'UTC';
  computed_start DATE;
  computed_end DATE;
  total_days INTEGER;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Get user timezone
  SELECT COALESCE(timezone, 'UTC') INTO user_tz FROM profiles WHERE id = uid;
  user_tz := COALESCE(user_tz, 'UTC');

  -- Derive dates from schedule
  total_days := CASE
    WHEN jsonb_typeof(p_schedule->'days') = 'array'
    THEN jsonb_array_length(p_schedule->'days')
    ELSE 0
  END;

  computed_start := COALESCE(
    CASE
      WHEN total_days > 0 AND (p_schedule->'days'->0->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (p_schedule->'days'->0->>'date')::date
      ELSE NULL
    END,
    CURRENT_DATE
  );

  computed_end := COALESCE(
    CASE
      WHEN total_days > 0 AND (p_schedule->'days'->(total_days-1)->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (p_schedule->'days'->(total_days-1)->>'date')::date
      ELSE NULL
    END,
    computed_start + GREATEST(total_days - 1, 0)
  );

  -- Upsert the plan in-place keyed by user_id
  INSERT INTO study_plans (
    user_id,
    subjects,
    schedule,
    total_units,
    duration_weeks,
    includes_weekends,
    start_date,
    end_date,
    status,
    locked_timezone,
    current_day_index
  )
  VALUES (
    uid,
    p_subjects,
    p_schedule,
    p_total_units,
    p_duration_weeks,
    p_includes_weekends,
    computed_start,
    computed_end,
    'active',
    user_tz,
    0
  )
  ON CONFLICT (user_id) DO UPDATE
  SET subjects = EXCLUDED.subjects,
      schedule = EXCLUDED.schedule,
      total_units = EXCLUDED.total_units,
      duration_weeks = EXCLUDED.duration_weeks,
      includes_weekends = EXCLUDED.includes_weekends,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      status = 'active',
      locked_timezone = EXCLUDED.locked_timezone,
      current_day_index = 0,
      completed_at = NULL,
      expired_at = NULL,
      archived_at = NULL
  RETURNING * INTO plan_row;

  -- Optionally clear prior progress for a true fresh start
  IF p_reset THEN
    DELETE FROM user_progress WHERE user_id = uid AND plan_id = plan_row.id;

    -- Reset streak state
    INSERT INTO study_streaks (user_id, current_streak, longest_streak, last_study_date, total_study_days, updated_at)
    VALUES (uid, 0, 0, NULL, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET current_streak = 0,
        longest_streak = 0,
        last_study_date = NULL,
        total_study_days = 0,
        updated_at = NOW();
  ELSE
    -- Ensure streak row exists (no reset)
    INSERT INTO study_streaks (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Analytics event
  INSERT INTO events (user_id, event_name, event_data)
  VALUES (uid, 'plan_created', jsonb_build_object(
    'subjects', p_subjects,
    'duration_weeks', p_duration_weeks,
    'includes_weekends', p_includes_weekends,
    'start_date', computed_start,
    'end_date', computed_end,
    'locked_timezone', user_tz,
    'total_units', p_total_units
  ));

  RETURN plan_row;
END;
$$;

-- Drop old function signature and grant permissions on new one
DROP FUNCTION IF EXISTS regenerate_study_plan(TEXT[], JSONB, INTEGER, BOOLEAN);
REVOKE ALL ON FUNCTION regenerate_study_plan(TEXT[], JSONB, INTEGER, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION regenerate_study_plan(TEXT[], JSONB, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;

-- ==================================================
-- RPC: get_effective_day_index
-- Computes the effective current day for a plan
-- ==================================================
CREATE OR REPLACE FUNCTION get_effective_day_index(p_plan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  plan_row study_plans%ROWTYPE;
  user_tz TEXT;
  auto_day INTEGER;
  manual_day INTEGER;
  total_days INTEGER;
  last_day INTEGER;
  local_today DATE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO plan_row FROM study_plans WHERE id = p_plan_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  user_tz := COALESCE(plan_row.locked_timezone, (SELECT timezone FROM profiles WHERE id = uid), 'UTC');
  local_today := (NOW() AT TIME ZONE user_tz)::date;
  auto_day := GREATEST(0, local_today - plan_row.start_date);
  manual_day := GREATEST(COALESCE(plan_row.current_day_index, 0), 0);

  total_days := CASE WHEN jsonb_typeof(plan_row.schedule->'days') = 'array' THEN jsonb_array_length(plan_row.schedule->'days') ELSE 0 END;
  last_day := GREATEST(total_days - 1, 0);

  RETURN LEAST(GREATEST(auto_day, manual_day), last_day);
END;
$$;

REVOKE ALL ON FUNCTION get_effective_day_index(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_effective_day_index(UUID) TO authenticated;

-- ==================================================
-- RPC: advance_plan_day
-- Manually advance the plan to the next day
-- ==================================================
CREATE OR REPLACE FUNCTION advance_plan_day(
  p_plan_id UUID,
  p_mode TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  plan_row study_plans%ROWTYPE;
  new_index INTEGER;
  total_days INTEGER;
  last_day INTEGER;
  completed_count INTEGER;
  all_complete BOOLEAN;
  new_status TEXT;
  user_tz TEXT;
  local_today DATE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO plan_row FROM study_plans WHERE id = p_plan_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  total_days := CASE WHEN jsonb_typeof(plan_row.schedule->'days') = 'array' THEN jsonb_array_length(plan_row.schedule->'days') ELSE 0 END;
  last_day := GREATEST(total_days - 1, 0);

  new_index := LEAST(COALESCE(plan_row.current_day_index, 0) + 1, last_day);

  SELECT COUNT(*) INTO completed_count FROM user_progress WHERE user_id = uid AND plan_id = p_plan_id AND completed = TRUE;
  all_complete := (completed_count >= plan_row.total_units);

  user_tz := COALESCE(plan_row.locked_timezone, (SELECT timezone FROM profiles WHERE id = uid), 'UTC');
  local_today := (NOW() AT TIME ZONE user_tz)::date;

  IF plan_row.status = 'archived' THEN
    new_status := 'archived';
    new_index := COALESCE(plan_row.current_day_index, 0);
  ELSIF all_complete THEN
    UPDATE study_plans SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), current_day_index = new_index
    WHERE id = p_plan_id RETURNING status INTO new_status;
  ELSIF local_today > plan_row.end_date THEN
    UPDATE study_plans SET status = 'expired', expired_at = COALESCE(expired_at, NOW()), current_day_index = new_index
    WHERE id = p_plan_id RETURNING status INTO new_status;
  ELSE
    UPDATE study_plans SET current_day_index = new_index WHERE id = p_plan_id RETURNING status INTO new_status;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'new_day_index', new_index, 'status', new_status);
END;
$$;

REVOKE ALL ON FUNCTION advance_plan_day(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_plan_day(UUID, TEXT) TO authenticated;

-- ==================================================
-- RPC: update_plan_status
-- Idempotent status checker and updater
-- ==================================================
CREATE OR REPLACE FUNCTION update_plan_status(p_plan_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  plan_row study_plans%ROWTYPE;
  completed_count INTEGER;
  new_status TEXT;
  user_tz TEXT;
  local_today DATE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO plan_row FROM study_plans WHERE id = p_plan_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  SELECT COUNT(*) INTO completed_count FROM user_progress WHERE user_id = uid AND plan_id = p_plan_id AND completed = TRUE;

  user_tz := COALESCE(plan_row.locked_timezone, (SELECT timezone FROM profiles WHERE id = uid), 'UTC');
  local_today := (NOW() AT TIME ZONE user_tz)::date;

  IF plan_row.status = 'archived' THEN
    RETURN 'archived';
  ELSIF completed_count >= plan_row.total_units THEN
    UPDATE study_plans SET status = 'completed', completed_at = COALESCE(completed_at, NOW())
    WHERE id = p_plan_id RETURNING status INTO new_status; RETURN new_status;
  ELSIF local_today > plan_row.end_date THEN
    UPDATE study_plans SET status = 'expired', expired_at = COALESCE(expired_at, NOW())
    WHERE id = p_plan_id RETURNING status INTO new_status; RETURN new_status;
  ELSE
    RETURN 'active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION update_plan_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_plan_status(UUID) TO authenticated;

-- ==================================================
-- RPC: apply_bulk_progress
-- Perform many progress updates in one server-side roundtrip
-- operations JSONB should be an array of objects with shape:
--   { type: 'completed', planId: uuid, subject: text, unitId: text }
--   { type: 'undone',    planId: uuid,                unitId: text }
-- Returns: { results: [ { unitId, type, ok, payload? | error? } ] }
-- ==================================================
CREATE OR REPLACE FUNCTION apply_bulk_progress(p_operations JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  op JSONB;
  results JSONB := '[]'::jsonb;
  payload JSONB;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_operations IS NULL OR jsonb_typeof(p_operations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: operations must be JSON array' USING ERRCODE = '22P02';
  END IF;

  FOR op IN SELECT jsonb_array_elements(p_operations) LOOP
    BEGIN
      IF op->>'type' = 'completed' THEN
        payload := mark_unit_complete((op->>'planId')::uuid, op->>'subject', op->>'unitId');
        results := results || jsonb_build_array(jsonb_build_object(
          'unitId', op->>'unitId',
          'type', 'completed',
          'ok', TRUE,
          'payload', payload
        ));
      ELSIF op->>'type' = 'undone' THEN
        payload := undo_unit_progress((op->>'planId')::uuid, op->>'unitId');
        results := results || jsonb_build_array(jsonb_build_object(
          'unitId', op->>'unitId',
          'type', 'undone',
          'ok', TRUE,
          'payload', payload
        ));
      ELSE
        results := results || jsonb_build_array(jsonb_build_object(
          'unitId', op->>'unitId',
          'type', op->>'type',
          'ok', FALSE,
          'error', 'Unknown operation type'
        ));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'unitId', op->>'unitId',
        'type', op->>'type',
        'ok', FALSE,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object('results', results);
END;
$$;

REVOKE ALL ON FUNCTION apply_bulk_progress(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_bulk_progress(JSONB) TO anon, authenticated;

-- ================================================
-- ANALYTICS QUERIES (for dashboard)
-- ================================================

-- Daily Active Users
-- SELECT COUNT(DISTINCT user_id)
-- FROM events
-- WHERE created_at > NOW() - INTERVAL '24 hours';

-- Average Streak Length
-- SELECT AVG(current_streak)
-- FROM study_streaks
-- WHERE current_streak > 0;

-- Parent Engagement Rate
-- SELECT
--   COUNT(DISTINCT student_user_id) as links_created,
--   COUNT(*) as total_accesses
-- FROM parent_access
-- WHERE created_at > NOW() - INTERVAL '7 days';
