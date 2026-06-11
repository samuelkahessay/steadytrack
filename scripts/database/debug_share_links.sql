-- ===============================================
-- Debug Script for Share Link Issues
-- ===============================================
-- Run this in Supabase SQL Editor to diagnose problems

-- Step 1: Check if the RPC function exists
SELECT
  proname as function_name,
  proowner::regrole as owner,
  prosecdef as is_security_definer,
  proacl as permissions
FROM pg_proc
WHERE proname = 'parent_dashboard_overview';

-- Expected result: 1 row with:
-- - is_security_definer = true
-- - permissions should include 'anon' and 'authenticated'
-- If you see 0 rows, the function wasn't created - re-run the migration


-- Step 2: Check if you have any active share tokens
SELECT
  id,
  student_user_id,
  share_token,
  is_active,
  created_at
FROM parent_access
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 5;

-- Expected result: At least 1 row if you've generated a share link
-- If you see 0 rows, you need to generate a share link first
-- Copy one of the share_token values for the next test


-- Step 3: Test the RPC function directly
-- IMPORTANT: Replace 'YOUR_TOKEN_HERE' with an actual token from Step 2
SELECT parent_dashboard_overview('YOUR_TOKEN_HERE');

-- Expected result: JSON object with plan, streak, and progress data
-- If you get an error, note the error message
-- If you get NULL, the token might be invalid or inactive


-- Step 4: Check if the student has data
-- IMPORTANT: Replace 'STUDENT_USER_ID_HERE' with the student_user_id from Step 2
-- Check for study plan
SELECT * FROM study_plans
WHERE user_id = 'STUDENT_USER_ID_HERE';

-- Check for streak
SELECT * FROM study_streaks
WHERE user_id = 'STUDENT_USER_ID_HERE';

-- Check for progress
SELECT * FROM user_progress
WHERE user_id = 'STUDENT_USER_ID_HERE'
LIMIT 10;


-- Step 5: Check RLS policies on parent_access
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'parent_access';

-- The RPC uses SECURITY DEFINER so it bypasses RLS, but good to check


-- Step 6: Test with a known good token (if you have one)
-- This simulates what the app does:
-- 1. Look up the token
-- 2. Get the student_user_id
-- 3. Fetch their data

-- Replace 'YOUR_TOKEN_HERE' with an actual token
DO $$
DECLARE
  test_token TEXT := 'YOUR_TOKEN_HERE';
  result JSONB;
BEGIN
  SELECT parent_dashboard_overview(test_token) INTO result;

  IF result IS NULL THEN
    RAISE NOTICE 'RPC returned NULL - token invalid or no data';
  ELSE
    RAISE NOTICE 'RPC succeeded! Result: %', result::TEXT;
  END IF;
END $$;


-- ===============================================
-- Common Issues & Solutions
-- ===============================================

-- Issue 1: Function doesn't exist (Step 1 returns 0 rows)
-- Solution: Run migrations/001_add_parent_dashboard_overview_rpc.sql

-- Issue 2: No active share tokens (Step 2 returns 0 rows)
-- Solution: Generate a share link from the app's Settings page

-- Issue 3: RPC returns NULL (Step 3 returns NULL)
-- Possible causes:
--   a) Token is invalid or expired (is_active = false)
--   b) Student has no data (check Step 4)
--   c) Student account doesn't exist

-- Issue 4: Permission denied error
-- Solution: Re-run the GRANT statement from the migration:
-- GRANT EXECUTE ON FUNCTION parent_dashboard_overview(text) TO anon, authenticated;

-- Issue 5: RPC returns data but app still shows error
-- Possible causes:
--   a) Frontend code issue - check browser console
--   b) Token not being passed correctly
--   c) Middleware blocking the route
--   d) Build/deployment cache - try redeploying
