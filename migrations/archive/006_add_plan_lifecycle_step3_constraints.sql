-- ================================================
-- Migration 006: Plan Lifecycle - Step 3
-- Add constraints and indexes after backfill verification
-- ================================================
-- Run this ONLY after verifying backfill completed successfully.
-- Verify no NULLs exist in required columns before running.
-- Run after 005_add_plan_lifecycle_step2_backfill.sql

-- IMPORTANT: Verify no NULLs before running!
-- Run these queries manually first:
--   SELECT COUNT(*) FROM study_plans WHERE start_date IS NULL;      -- Should be 0
--   SELECT COUNT(*) FROM study_plans WHERE end_date IS NULL;        -- Should be 0
--   SELECT COUNT(*) FROM study_plans WHERE status IS NULL;          -- Should be 0
--   SELECT COUNT(*) FROM study_plans WHERE locked_timezone IS NULL; -- Should be 0

-- Step 3.1: Set NOT NULL constraints
ALTER TABLE study_plans
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN locked_timezone SET NOT NULL;

-- Step 3.2: Add CHECK constraints
ALTER TABLE study_plans
  ADD CONSTRAINT check_plan_status
    CHECK (status IN ('active', 'completed', 'expired', 'archived')),
  ADD CONSTRAINT check_plan_day_index
    CHECK (current_day_index >= 0),
  ADD CONSTRAINT check_plan_dates
    CHECK (end_date >= start_date);

-- Step 3.3: Add indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_study_plans_user_status
  ON study_plans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_study_plans_user_end_date
  ON study_plans(user_id, end_date);

-- Add comments on new indexes
COMMENT ON INDEX idx_study_plans_user_status IS 'Query plans by user and lifecycle status';
COMMENT ON INDEX idx_study_plans_user_end_date IS 'Query plans by user and end date for expiry checks';
