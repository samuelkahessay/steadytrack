# Database Migrations

This directory contains SQL migration scripts for the SteadyTrack database.

## Quick Status Check

```bash
# Check if your database is in sync with migrations
supabase db diff --linked --schema public

# Empty output = all migrations applied ✓
# SQL output = differences detected
```

## Current Status

✅ **All migrations (001-008) applied to production**
✅ **Database linter warnings resolved** (RLS optimization complete)
✅ **Supabase CLI configured and linked**

For detailed migration strategy, see: [`docs/database-migration-strategy.md`](../docs/database-migration-strategy.md)

## How to Apply Migrations

### Using Supabase Dashboard (Recommended)

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project
3. Go to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy the contents of the migration file you want to run
6. Paste into the editor
7. Click **Run** (or press `Cmd/Ctrl + Enter`)
8. Verify the success message appears

### Using Supabase CLI (Advanced)

```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migration
supabase db push
```

## Migration Status

Migrations 001-008 have been **APPLIED** to production database ✓
Migration 009 is **PENDING** - ready to apply

## Migration Files

### 001_add_parent_dashboard_overview_rpc.sql

**Status:** ✅ **APPLIED**

**Purpose:** Fixes broken share link functionality by deploying the `parent_dashboard_overview` RPC function.

**Background:**
- The function was added to `supabase-schema.sql` but never deployed to the database
- Recent code changes (commit 9f30f5a) updated the share page to use this RPC
- Without this function, all share links show "Invalid or Expired Link"

**How to deploy:**
1. Open Supabase SQL Editor
2. Copy entire contents of `001_add_parent_dashboard_overview_rpc.sql`
3. Paste and run in SQL Editor
4. Verify success message
5. Test a share link to confirm it works

**Verification:**
After running the migration, you can verify the function exists by running:

```sql
SELECT proname, proowner::regrole, prosecdef, proacl
FROM pg_proc
WHERE proname = 'parent_dashboard_overview';
```

You should see one row with:
- `proname`: parent_dashboard_overview
- `prosecdef`: true (SECURITY DEFINER)
- `proacl`: Contains grants for anon and authenticated roles

**Testing:**
1. Go to your app → Settings → Share Your Progress
2. Generate a share link (or use existing one)
3. Click "Preview" or open the share link in a new incognito window
4. You should see the parent dashboard with student progress
5. If you still see "Invalid or Expired Link", follow the debug steps below

**If it still doesn't work:**
1. Run `migrations/debug_share_links.sql` in Supabase SQL Editor
2. Follow each step in that file to diagnose the issue
3. Check your terminal/console logs for error messages (we added logging)
4. Rebuild and redeploy your app if needed: `npm run build` then redeploy to Vercel

---

### 002_fix_parent_dashboard_overview_order_by.sql

**Status:** ✅ **APPLIED**

**Purpose:** Fixes the ORDER BY clause in the parent_dashboard_overview function to ensure progress is sorted correctly by completion time.

---

### 003_add_content_microcards.sql

**Status:** ✅ **APPLIED**

**Purpose:** Adds content_microcards and quick_check_results tables for storing derived learning content and user quiz results.

**Tables Created:**
- `content_microcards` - Stores AI-generated learning content (summaries, examples, quick checks)
- `quick_check_results` - Tracks user performance on quick check questions

---

### 004-007: Plan Lifecycle Migrations

**Status:** ✅ **APPLIED**

**Purpose:** Multi-step migration to add plan lifecycle management (status tracking, timezone handling, dates).

**Steps:**
- 004: Add new columns (start_date, end_date, status, locked_timezone, etc.)
- 005: Backfill existing data with sensible defaults
- 006: Add constraints and validation rules
- 007: Add RPC functions for plan lifecycle management

---

### 008_optimize_rls_policies_performance.sql

**Status:** ✅ **APPLIED**

**Purpose:** Optimizes RLS policies to eliminate auth.uid()/auth.role() re-evaluation per row.

**Impact:** Resolved 32 `auth_rls_initplan` warnings in Supabase linter

**Tables Updated:** All 9 tables with RLS policies (profiles, study_plans, user_progress, study_streaks, parent_access, resource_progress, events, content_microcards, quick_check_results)

---

### 009 & 009b: Optimize Query Performance (2 versions)

**Status:** ⏳ **PENDING** (Ready to apply)

**Purpose:** Optimizes content_microcards query performance with composite index.

**Problem:**
- Query taking 16.2 seconds total across 11,017 calls
- Average 2.6ms per query with single-column indexes
- Primary bottleneck in production monitoring

**Solution:**
- Add composite index: `idx_microcards_subject_outcome_status`
- Covers query pattern: `WHERE subject = X AND outcome_code IN (...) AND status = Y ORDER BY outcome_code`
- Drop redundant single-column indexes: `idx_microcards_subject`, `idx_microcards_outcome`

**Expected Impact:**
- 6-32x performance improvement
- Query time: 2.6ms → 0.05-0.26ms per query
- Total time: 16.2s → ~0.5-2.6s

**How to Deploy:**

**Option A: 009b - SQL Editor Safe (Recommended)**
- File: `009b_optimize_query_performance_sql_editor_safe.sql`
- Use this in Supabase SQL Editor
- Brief table lock (~1-5 seconds) during index creation
- Safe for production (content_microcards is read-mostly)

**Option B: 009 - Zero Downtime (Advanced)**
- File: `009_optimize_query_performance.sql`
- Requires psql CLI (not SQL Editor)
- Uses CONCURRENTLY for zero downtime
- No table locks

**Verification Query:**
```sql
EXPLAIN ANALYZE
SELECT * FROM content_microcards
WHERE subject = 'Math 30-1'
  AND outcome_code = ANY(ARRAY['RF1'])
  AND status = 'active';
```
Expected: `Index Scan using idx_microcards_subject_outcome_status`

---

## Best Practices

1. **Always test migrations in development first** (if you have a dev Supabase project)
2. **Backup your database** before running migrations on production
3. **Run migrations during low-traffic periods** to minimize user impact
4. **Check Supabase logs** after deployment to catch any issues
5. **Keep this README updated** when adding new migrations

## Migration Naming Convention

Migrations follow the pattern: `###_description.sql`

- `###`: Sequential number (001, 002, etc.)
- `description`: Brief description using underscores instead of spaces
- `.sql`: SQL file extension

Examples:
- `001_add_parent_dashboard_overview_rpc.sql`
- `002_add_user_preferences_table.sql`
- `003_update_streak_calculation_logic.sql`

## Troubleshooting

### "Function already exists" error
The migration includes `DROP FUNCTION IF EXISTS`, so this shouldn't happen. If it does, run:
```sql
DROP FUNCTION IF EXISTS parent_dashboard_overview(text);
```
Then re-run the migration.

### "Permission denied" error
Make sure you're running the migration with a user that has sufficient privileges (usually the project owner or service role).

### "Cannot find function" after deployment
1. Check the function was created: `SELECT * FROM pg_proc WHERE proname = 'parent_dashboard_overview';`
2. Check permissions: `SELECT proacl FROM pg_proc WHERE proname = 'parent_dashboard_overview';`
3. Verify the search_path is correct (should be `public`)

---

Need help? Check the [Supabase SQL Editor docs](https://supabase.com/docs/guides/database/overview).
