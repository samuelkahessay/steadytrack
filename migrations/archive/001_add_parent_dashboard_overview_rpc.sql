-- Migration: Add parent_dashboard_overview RPC function
-- Date: 2025-10-07
-- Purpose: Fix share link functionality by deploying the missing RPC function
--
-- This function was added to supabase-schema.sql but never deployed to the database,
-- causing all share links to show "Invalid or Expired Link" error.

-- Drop function if it exists (safe for re-runs)
DROP FUNCTION IF EXISTS parent_dashboard_overview(text);

-- Create the parent dashboard overview RPC function
-- This function allows anonymous users to view student progress via share token
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
  -- Verify share token is valid and active
  SELECT *
    INTO link_record
    FROM parent_access
    WHERE share_token = p_share_token
      AND is_active = TRUE
    LIMIT 1;

  -- Return NULL if token not found or inactive
  IF link_record.student_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get student's study plan
  SELECT *
    INTO plan_record
    FROM study_plans
    WHERE user_id = link_record.student_user_id
    ORDER BY created_at DESC
    LIMIT 1;

  -- Get student's streak data
  SELECT *
    INTO streak_record
    FROM study_streaks
    WHERE user_id = link_record.student_user_id
    LIMIT 1;

  -- Get student's progress as JSON array
  -- ORDER BY must be inside jsonb_agg() when using aggregate functions
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
             ORDER BY up.completed_at DESC  -- ORDER BY inside the aggregate
           ),
           '[]'::jsonb
         )
    INTO progress_payload
    FROM user_progress up
    WHERE up.user_id = link_record.student_user_id;

  -- Return complete dashboard data
  RETURN jsonb_build_object(
    'student_user_id', link_record.student_user_id,
    'plan', plan_record,
    'streak', streak_record,
    'progress', progress_payload
  );
END;
$$;

-- Grant permissions
-- IMPORTANT: This grants execute permission to both anonymous (anon) and authenticated users
-- This is required for share links to work without authentication
REVOKE ALL ON FUNCTION parent_dashboard_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION parent_dashboard_overview(text) TO anon, authenticated;

-- Verification query (optional - comment out when running in production)
-- SELECT proname, proowner::regrole, prosecdef, proacl
-- FROM pg_proc
-- WHERE proname = 'parent_dashboard_overview';
