-- ================================================
-- Migration 005: Plan Lifecycle - Step 2
-- Backfill existing plans with computed dates and status
-- ================================================
-- This migration populates the new lifecycle columns for existing plans
-- using defensive logic to handle malformed or missing schedule data.
-- Run after 004_add_plan_lifecycle_step1_add_columns.sql

-- Step 2.1: Backfill locked_timezone from user profiles
UPDATE study_plans sp
SET locked_timezone = COALESCE(
  (SELECT timezone FROM profiles p WHERE p.id = sp.user_id),
  'UTC'
)
WHERE locked_timezone IS NULL;

-- Step 2.2: Backfill start_date
-- Priority: First scheduled day's date > created_at
UPDATE study_plans sp
SET start_date = COALESCE(
  -- Try to extract first day's date from schedule
  CASE
    WHEN jsonb_typeof(schedule->'days') = 'array'
      AND jsonb_array_length(schedule->'days') > 0
      AND (schedule->'days'->0->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (schedule->'days'->0->>'date')::date
    ELSE NULL
  END,
  -- Fallback to created_at
  created_at::date
)
WHERE start_date IS NULL;

-- Step 2.3: Backfill end_date
-- Priority: Last scheduled day's date > computed from schedule length > computed from duration_weeks
UPDATE study_plans sp
SET end_date = COALESCE(
  -- Try to extract last day's date from schedule
  CASE
    WHEN jsonb_typeof(schedule->'days') = 'array'
      AND jsonb_array_length(schedule->'days') > 0
      AND (schedule->'days'->(jsonb_array_length(schedule->'days')-1)->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (schedule->'days'->(jsonb_array_length(schedule->'days')-1)->>'date')::date
    ELSE NULL
  END,
  -- Fallback: compute from start + schedule length
  (COALESCE(
    -- Use start_date if already set
    start_date,
    -- Otherwise compute from schedule or created_at
    CASE
      WHEN (schedule->'days'->0->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (schedule->'days'->0->>'date')::date
      ELSE created_at::date
    END
  ) + GREATEST(
    CASE
      WHEN jsonb_typeof(schedule->'days') = 'array'
      THEN jsonb_array_length(schedule->'days') - 1
      ELSE 0
    END,
    0
  )),
  -- Ultimate fallback: use duration_weeks
  (COALESCE(start_date, created_at::date) + (
    duration_weeks *
    CASE WHEN includes_weekends THEN 7 ELSE 5 END - 1
  ))
)
WHERE end_date IS NULL;

-- Step 2.4: Set initial status based on end_date (timezone-aware, consistent with RPCs)
UPDATE study_plans
SET status = CASE
  WHEN end_date < (NOW() AT TIME ZONE locked_timezone)::date THEN 'expired'
  ELSE 'active'
END
WHERE status IS NULL OR status = 'active';

-- Step 2.5: Set expired_at for already-expired plans (audit trail)
UPDATE study_plans
SET expired_at = end_date::timestamptz
WHERE status = 'expired' AND expired_at IS NULL;

-- Step 2.6: Initialize current_day_index to 0 for all plans
UPDATE study_plans
SET current_day_index = 0
WHERE current_day_index IS NULL;

-- Verification queries (commented out - run manually to verify)
-- SELECT COUNT(*) FROM study_plans WHERE start_date IS NULL;
-- SELECT COUNT(*) FROM study_plans WHERE end_date IS NULL;
-- SELECT COUNT(*) FROM study_plans WHERE status IS NULL;
-- SELECT COUNT(*) FROM study_plans WHERE locked_timezone IS NULL;
-- SELECT status, COUNT(*) FROM study_plans GROUP BY status;
