-- ================================================
-- Migration 004: Plan Lifecycle - Step 1
-- Add nullable columns for plan lifecycle management
-- ================================================
-- This migration adds new columns to support plan lifecycle states,
-- day progression tracking, and timezone locking. All columns are
-- nullable initially to allow safe backfill in Step 2.

-- Add lifecycle columns to study_plans table
ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_day_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_timezone TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN study_plans.start_date IS 'Plan start date (explicit, locked at creation)';
COMMENT ON COLUMN study_plans.end_date IS 'Plan end date (computed from schedule or duration)';
COMMENT ON COLUMN study_plans.status IS 'Plan lifecycle state: active, completed, expired, or archived';
COMMENT ON COLUMN study_plans.current_day_index IS 'Manual day override for plan progression (0-based)';
COMMENT ON COLUMN study_plans.locked_timezone IS 'Timezone locked at plan creation (prevents day boundary shifts)';
COMMENT ON COLUMN study_plans.completed_at IS 'Timestamp when all units were completed';
COMMENT ON COLUMN study_plans.expired_at IS 'Timestamp when plan expired (passed end_date)';
COMMENT ON COLUMN study_plans.archived_at IS 'Timestamp when user manually archived the plan';
