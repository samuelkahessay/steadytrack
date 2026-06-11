-- Migration 008: Optimize RLS Policies for Performance
-- Fixes Supabase linter warnings: auth_rls_initplan
--
-- Problem: auth.uid() and auth.role() are re-evaluated for each row
-- Solution: Wrap calls in subqueries to ensure single evaluation per query
--
-- Affects: 32 policies across 9 tables
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ================================================
-- TABLE: profiles (3 policies)
-- ================================================
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

-- ================================================
-- TABLE: study_plans (4 policies)
-- ================================================
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

-- ================================================
-- TABLE: user_progress (4 policies)
-- ================================================
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

-- ================================================
-- TABLE: study_streaks (3 policies)
-- ================================================
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

-- ================================================
-- TABLE: parent_access (4 policies)
-- ================================================
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

-- ================================================
-- TABLE: resource_progress (4 policies)
-- ================================================
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

-- ================================================
-- TABLE: events (3 policies)
-- ================================================
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

-- ================================================
-- TABLE: content_microcards (3 policies)
-- ================================================
DROP POLICY IF EXISTS content_microcards_insert_service ON content_microcards;
DROP POLICY IF EXISTS content_microcards_update_service ON content_microcards;
DROP POLICY IF EXISTS content_microcards_delete_service ON content_microcards;

CREATE POLICY content_microcards_insert_service
  ON content_microcards
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY content_microcards_update_service
  ON content_microcards
  FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY content_microcards_delete_service
  ON content_microcards
  FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

-- ================================================
-- TABLE: quick_check_results (4 policies)
-- ================================================
DROP POLICY IF EXISTS qc_results_select_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_insert_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_update_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_delete_own ON quick_check_results;

CREATE POLICY qc_results_select_own
  ON quick_check_results
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_insert_own
  ON quick_check_results
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_update_own
  ON quick_check_results
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_delete_own
  ON quick_check_results
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
