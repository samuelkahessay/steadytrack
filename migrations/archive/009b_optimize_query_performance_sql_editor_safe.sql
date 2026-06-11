-- Migration 009: Optimize Query Performance (SQL Editor Version)
-- Addresses slow queries identified in production monitoring
--
-- Problem: content_microcards queries taking 16.2s total (11,017 calls)
-- Root Cause: Missing composite index for common query pattern
-- Solution: Add composite index covering (subject, outcome_code, status)
--
-- Query Pattern:
--   SELECT * FROM content_microcards
--   WHERE subject = $1 AND outcome_code = ANY($2) AND status = 'active'
--   ORDER BY outcome_code;
--
-- Performance Impact:
--   - Before: 16.2s total (2.6ms avg per query) using individual indexes
--   - After: ~0.5-2.6s total (0.05-0.26ms avg per query) using composite index
--   - Expected: 6-32x improvement
--
-- References:
--   - hooks/useMicrocards.ts (lines 61-67)
--   - Query statistics from Supabase Performance Dashboard
--
-- IMPORTANT: This version is for Supabase SQL Editor (no CONCURRENTLY)
-- - Will briefly lock table during index creation (~1-5 seconds)
-- - Safe because content_microcards is read-mostly and small
-- - For CLI deployment with zero downtime, use 009_optimize_query_performance.sql

-- ================================================
-- STEP 1: Create Composite Index for content_microcards
-- ================================================

-- This composite index covers the most common query pattern:
-- Filter by subject, outcome_code (IN/ANY), and status, then sort by outcome_code
CREATE INDEX IF NOT EXISTS idx_microcards_subject_outcome_status
  ON content_microcards(subject, outcome_code, status);

-- Add performance documentation
COMMENT ON INDEX idx_microcards_subject_outcome_status IS
  'Composite index for optimizing useMicrocards hook queries. Covers WHERE subject = X AND outcome_code IN (...) AND status = Y ORDER BY outcome_code. Added in migration 009 to resolve 16.2s query performance issue (11,017 calls).';

-- ================================================
-- STEP 2: Drop Redundant Single-Column Indexes
-- ================================================

-- The new composite index makes these individual indexes redundant:
-- - idx_microcards_subject (covered by composite index first column)
-- - idx_microcards_outcome (covered by composite index second column)

DROP INDEX IF EXISTS idx_microcards_subject;
DROP INDEX IF EXISTS idx_microcards_outcome;

-- Keep idx_microcards_unit (still needed for unit_id lookups not covered by composite)

-- ================================================
-- VERIFICATION QUERY
-- ================================================

-- After applying this migration, run this query to verify the index is being used:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM content_microcards
-- WHERE subject = 'Math 30-1'
--   AND outcome_code = ANY(ARRAY['RF1', 'RF2', 'RF3'])
--   AND status = 'active'
-- ORDER BY outcome_code;
--
-- Expected result:
--   -> Index Scan using idx_microcards_subject_outcome_status
--   -> Execution time should be < 1ms
--
-- Before (using partial indexes):
--   -> Bitmap Index Scan on idx_microcards_subject
--   -> Execution time was ~2-3ms per query

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================

-- If you need to rollback this migration:
--
-- 1. Recreate the old indexes:
-- CREATE INDEX idx_microcards_subject ON content_microcards(subject);
-- CREATE INDEX idx_microcards_outcome ON content_microcards(outcome_code);
--
-- 2. Drop the composite index:
-- DROP INDEX idx_microcards_subject_outcome_status;
