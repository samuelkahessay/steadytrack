-- Migration: Fix parent_dashboard_overview ORDER BY bug
-- Date: 2025-10-07
-- Purpose: Fix SQL syntax error - ORDER BY must be inside jsonb_agg(), not after FROM clause
--
-- Error: column "up.completed_at" must appear in the GROUP BY clause or be used in an aggregate function
-- Solution: Move ORDER BY inside the jsonb_agg() aggregate function

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS parent_dashboard_overview(text);

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
  -- FIX: ORDER BY must be inside jsonb_agg() when using aggregate functions
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
    -- Note: ORDER BY removed from here, now inside jsonb_agg() above

  -- Return complete dashboard data
  RETURN jsonb_build_object(
    'student_user_id', link_record.student_user_id,
    'plan', plan_record,
    'streak', streak_record,
    'progress', progress_payload
  );
END;
$$;

-- Re-grant permissions
REVOKE ALL ON FUNCTION parent_dashboard_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION parent_dashboard_overview(text) TO anon, authenticated;

-- Test the fix (replace with your actual token to verify)
-- SELECT parent_dashboard_overview('your-token-here');
