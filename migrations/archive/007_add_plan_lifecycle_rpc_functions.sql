-- ================================================
-- Migration 007: Plan Lifecycle RPC Functions
-- Add RPC functions for day progression and status management
-- ================================================
-- Run after 006_add_plan_lifecycle_step3_constraints.sql

-- ================================================
-- Function: get_effective_day_index
-- Computes the effective current day for a plan
-- ================================================
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

  -- Fetch plan and verify ownership
  SELECT * INTO plan_row
  FROM study_plans
  WHERE id = p_plan_id AND user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  -- Timezone hierarchy: locked > profile > UTC
  user_tz := COALESCE(
    plan_row.locked_timezone,
    (SELECT timezone FROM profiles WHERE id = uid),
    'UTC'
  );

  -- Calculate auto day based on timezone
  local_today := (NOW() AT TIME ZONE user_tz)::date;
  auto_day := GREATEST(0, local_today - plan_row.start_date);

  -- Manual override
  manual_day := GREATEST(COALESCE(plan_row.current_day_index, 0), 0);

  -- Total days (guard against invalid JSON)
  total_days := CASE
    WHEN jsonb_typeof(plan_row.schedule->'days') = 'array'
    THEN jsonb_array_length(plan_row.schedule->'days')
    ELSE 0
  END;

  last_day := GREATEST(total_days - 1, 0);

  -- Effective day = max(auto, manual), clamped to last
  RETURN LEAST(GREATEST(auto_day, manual_day), last_day);
END;
$$;

REVOKE ALL ON FUNCTION get_effective_day_index(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_effective_day_index(UUID) TO authenticated;

COMMENT ON FUNCTION get_effective_day_index(UUID) IS 'Computes effective current day index for a plan based on timezone and manual override';

-- ================================================
-- Function: advance_plan_day
-- Manually advance the plan to the next day
-- ================================================
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

  -- Fetch plan and verify ownership
  SELECT * INTO plan_row
  FROM study_plans
  WHERE id = p_plan_id AND user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  -- Calculate total days
  total_days := CASE
    WHEN jsonb_typeof(plan_row.schedule->'days') = 'array'
    THEN jsonb_array_length(plan_row.schedule->'days')
    ELSE 0
  END;
  last_day := GREATEST(total_days - 1, 0);

  -- Increment and clamp
  new_index := LEAST(
    COALESCE(plan_row.current_day_index, 0) + 1,
    last_day
  );

  -- Check completion (only count completed=true records)
  SELECT COUNT(*) INTO completed_count
  FROM user_progress
  WHERE user_id = uid
    AND plan_id = p_plan_id
    AND completed = TRUE;

  all_complete := (completed_count >= plan_row.total_units);

  -- Determine local today based on plan timezone (locked > profile > UTC)
  user_tz := COALESCE(
    plan_row.locked_timezone,
    (SELECT timezone FROM profiles WHERE id = uid),
    'UTC'
  );
  local_today := (NOW() AT TIME ZONE user_tz)::date;

  -- Determine new status and update
  IF plan_row.status = 'archived' THEN
    -- Don't change archived status or progression; reflect actual DB value
    new_status := 'archived';
    new_index := COALESCE(plan_row.current_day_index, 0);
  ELSIF all_complete THEN
    UPDATE study_plans SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      current_day_index = new_index
    WHERE id = p_plan_id
    RETURNING status INTO new_status;
  ELSIF local_today > plan_row.end_date THEN
    UPDATE study_plans SET
      status = 'expired',
      expired_at = COALESCE(expired_at, NOW()),
      current_day_index = new_index
    WHERE id = p_plan_id
    RETURNING status INTO new_status;
  ELSE
    UPDATE study_plans SET
      current_day_index = new_index
    WHERE id = p_plan_id
    RETURNING status INTO new_status;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'new_day_index', new_index,
    'status', new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION advance_plan_day(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_plan_day(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION advance_plan_day(UUID, TEXT) IS 'Manually advance plan to next day and update status if needed';

-- ================================================
-- Function: update_plan_status
-- Idempotent status checker and updater
-- ================================================
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

  SELECT * INTO plan_row
  FROM study_plans
  WHERE id = p_plan_id AND user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found or access denied' USING ERRCODE = 'P0010';
  END IF;

  -- Check completion
  SELECT COUNT(*) INTO completed_count
  FROM user_progress
  WHERE user_id = uid
    AND plan_id = p_plan_id
    AND completed = TRUE;

  -- Local date based on plan timezone (locked > profile > UTC)
  user_tz := COALESCE(
    plan_row.locked_timezone,
    (SELECT timezone FROM profiles WHERE id = uid),
    'UTC'
  );
  local_today := (NOW() AT TIME ZONE user_tz)::date;

  -- Determine status (don't override archived)
  IF plan_row.status = 'archived' THEN
    RETURN 'archived';
  ELSIF completed_count >= plan_row.total_units THEN
    UPDATE study_plans SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW())
    WHERE id = p_plan_id
    RETURNING status INTO new_status;
    RETURN new_status;
  ELSIF local_today > plan_row.end_date THEN
    UPDATE study_plans SET
      status = 'expired',
      expired_at = COALESCE(expired_at, NOW())
    WHERE id = p_plan_id
    RETURNING status INTO new_status;
    RETURN new_status;
  ELSE
    RETURN 'active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION update_plan_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_plan_status(UUID) TO authenticated;

COMMENT ON FUNCTION update_plan_status(UUID) IS 'Idempotently check and update plan status based on completion and expiry';

-- ================================================
-- Function: regenerate_study_plan (UPDATED)
-- Enhanced version with lifecycle fields
-- ================================================
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
  user_tz TEXT;
  computed_start DATE;
  computed_end DATE;
  total_days INTEGER;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Get user timezone
  SELECT COALESCE(timezone, 'UTC') INTO user_tz
  FROM profiles WHERE id = uid;

  -- Derive dates from schedule
  total_days := CASE
    WHEN jsonb_typeof(p_schedule->'days') = 'array'
    THEN jsonb_array_length(p_schedule->'days')
    ELSE 0
  END;

  computed_start := COALESCE(
    CASE
      WHEN total_days > 0
        AND (p_schedule->'days'->0->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (p_schedule->'days'->0->>'date')::date
      ELSE NULL
    END,
    CURRENT_DATE
  );

  computed_end := COALESCE(
    CASE
      WHEN total_days > 0
        AND (p_schedule->'days'->(total_days-1)->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (p_schedule->'days'->(total_days-1)->>'date')::date
      ELSE NULL
    END,
    computed_start + GREATEST(total_days - 1, 0)
  );

  -- Upsert plan (preserves single-plan-per-user constraint)
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

  -- Reset progress/streak if requested
  IF p_reset THEN
    DELETE FROM user_progress
     WHERE user_id = uid AND plan_id = plan_row.id;

    INSERT INTO study_streaks (user_id, current_streak, longest_streak, last_study_date, total_study_days, updated_at)
    VALUES (uid, 0, 0, NULL, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET current_streak = 0,
        longest_streak = 0,
        last_study_date = NULL,
        total_study_days = 0,
        updated_at = NOW();
  ELSE
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

-- Drop old function signature (if exists)
DROP FUNCTION IF EXISTS regenerate_study_plan(TEXT[], JSONB, INTEGER, BOOLEAN);

REVOKE ALL ON FUNCTION regenerate_study_plan(TEXT[], JSONB, INTEGER, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION regenerate_study_plan(TEXT[], JSONB, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION regenerate_study_plan(TEXT[], JSONB, INTEGER, INTEGER, BOOLEAN, BOOLEAN) IS 'Create or regenerate study plan with lifecycle fields';
