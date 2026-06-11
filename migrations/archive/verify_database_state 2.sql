-- ============================================
-- Database State Verification Script
-- ============================================
-- Run this in Supabase SQL Editor to verify which migrations have been applied
-- and check if the database is up to date with your migration files

-- ============================================
-- 1. CHECK ALL TABLES EXIST
-- ============================================
SELECT
  'Tables Check' as check_type,
  string_agg(tablename, ', ' ORDER BY tablename) as existing_tables
FROM pg_tables
WHERE schemaname = 'public';

-- Expected: content_microcards, events, parent_access, profiles, quick_check_results,
--           resource_progress, study_plans, study_streaks, user_progress

-- ============================================
-- 2. CHECK ALL RLS POLICIES (Should be 32 total)
-- ============================================
SELECT
  'RLS Policies Count' as check_type,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected counts:
-- profiles: 3, study_plans: 4, user_progress: 4, study_streaks: 3
-- parent_access: 4, resource_progress: 4, events: 3
-- content_microcards: 4 (includes read_all), quick_check_results: 4

-- ============================================
-- 3. CHECK IF RLS POLICIES ARE OPTIMIZED
-- ============================================
-- This checks if policies use (SELECT auth.uid()) pattern
SELECT
  'RLS Optimization Check' as check_type,
  tablename,
  policyname,
  CASE
    WHEN pg_get_expr(polqual, polrelid) LIKE '%SELECT auth.uid()%'
      OR pg_get_expr(polqual, polrelid) LIKE '%SELECT auth.role()%'
      OR pg_get_expr(polwithcheck, polrelid) LIKE '%SELECT auth.uid()%'
      OR pg_get_expr(polwithcheck, polrelid) LIKE '%SELECT auth.role()%'
    THEN 'OPTIMIZED ✓'
    WHEN pg_get_expr(polqual, polrelid) LIKE '%auth.uid()%'
      OR pg_get_expr(polqual, polrelid) LIKE '%auth.role()%'
      OR pg_get_expr(polwithcheck, polrelid) LIKE '%auth.uid()%'
      OR pg_get_expr(polwithcheck, polrelid) LIKE '%auth.role()%'
    THEN 'NEEDS OPTIMIZATION ⚠️'
    ELSE 'NO AUTH CHECK'
  END as optimization_status
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY c.relname, p.polname;

-- All policies using auth functions should show "OPTIMIZED ✓"

-- ============================================
-- 4. CHECK ALL RPC FUNCTIONS EXIST
-- ============================================
SELECT
  'RPC Functions Check' as check_type,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN (
  'mark_unit_complete',
  'undo_unit_progress',
  'parent_dashboard_overview',
  'get_weekly_summary',
  'regenerate_study_plan',
  'get_effective_day_index',
  'advance_plan_day',
  'update_plan_status',
  'apply_bulk_progress'
)
ORDER BY proname;

-- Expected: 9 functions, all with is_security_definer = true

-- ============================================
-- 5. CHECK IMPORTANT INDEXES
-- ============================================
SELECT
  'Indexes Check' as check_type,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'study_plans', 'user_progress', 'study_streaks',
                    'parent_access', 'resource_progress', 'events',
                    'content_microcards', 'quick_check_results')
ORDER BY tablename, indexname;

-- ============================================
-- 6. CHECK STUDY_PLANS TABLE HAS LIFECYCLE COLUMNS
-- ============================================
SELECT
  'Study Plans Lifecycle Columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'study_plans'
  AND column_name IN ('start_date', 'end_date', 'status', 'current_day_index',
                      'locked_timezone', 'completed_at', 'expired_at', 'archived_at')
ORDER BY column_name;

-- Expected: All 8 lifecycle columns should exist

-- ============================================
-- 7. CHECK CONTENT_MICROCARDS TABLE EXISTS
-- ============================================
SELECT
  'Content Microcards Table' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_microcards'
ORDER BY ordinal_position;

-- Expected: id, subject, unit_id, outcome_code, summary, steps, pitfall,
--           quick_check, recommended_resource_url, sources, version, status,
--           created_at, updated_at

-- ============================================
-- 8. CHECK QUICK_CHECK_RESULTS TABLE EXISTS
-- ============================================
SELECT
  'Quick Check Results Table' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quick_check_results'
ORDER BY ordinal_position;

-- Expected: id, user_id, plan_id, subject, unit_id, outcome_code,
--           microcard_id, correct, selected, created_at

-- ============================================
-- 9. SUMMARY - MIGRATION STATUS
-- ============================================
SELECT
  'Migration Status Summary' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as policy_count,
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN (
    'mark_unit_complete', 'undo_unit_progress', 'parent_dashboard_overview',
    'get_weekly_summary', 'regenerate_study_plan', 'get_effective_day_index',
    'advance_plan_day', 'update_plan_status', 'apply_bulk_progress'
  )) as function_count,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') = 9
      AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') >= 32
      AND (SELECT COUNT(*) FROM pg_proc WHERE proname IN (
        'mark_unit_complete', 'undo_unit_progress', 'parent_dashboard_overview',
        'get_weekly_summary', 'regenerate_study_plan', 'get_effective_day_index',
        'advance_plan_day', 'update_plan_status', 'apply_bulk_progress'
      )) = 9
    THEN 'ALL MIGRATIONS APPLIED ✓'
    ELSE 'MISSING MIGRATIONS ⚠️'
  END as migration_status;

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- ✓ 9 tables
-- ✓ 32+ policies (32 from main schema + content_microcards_read_all)
-- ✓ 9 RPC functions
-- ✓ All RLS policies show "OPTIMIZED ✓"
-- ✓ study_plans has 8 lifecycle columns
-- ✓ content_microcards and quick_check_results tables exist

-- ============================================
-- NEXT STEPS IF MISSING:
-- ============================================
-- If migration_status shows "MISSING MIGRATIONS ⚠️":
-- 1. Check which specific items are missing above
-- 2. Run missing migrations in order from migrations/ folder:
--    - 001_add_parent_dashboard_overview_rpc.sql
--    - 002_fix_parent_dashboard_overview_order_by.sql
--    - 003_add_content_microcards.sql
--    - 004_add_plan_lifecycle_step1_add_columns.sql
--    - 005_add_plan_lifecycle_step2_backfill.sql
--    - 006_add_plan_lifecycle_step3_constraints.sql
--    - 007_add_plan_lifecycle_rpc_functions.sql
--    - 008_optimize_rls_policies_performance.sql (NEW - for RLS optimization)
