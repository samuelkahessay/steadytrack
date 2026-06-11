# Database Migration Strategy

## How to Run the Database Linter

### Via Supabase Dashboard (Recommended)

1. **Access the Linter:**
   - Go to https://supabase.com/dashboard
   - Navigate to your project
   - Go to **Database** → **Linter** (in left sidebar)

2. **Run Linter:**
   - The linter automatically scans your database
   - Shows warnings/errors categorized by severity and type

3. **Check for RLS Performance Warnings:**
   - Look for `auth_rls_initplan` warnings
   - After migration 008, all 32 warnings should be **RESOLVED** ✓
   - If you still see warnings, it means migration 008 wasn't applied

### Via SQL Query (Alternative)

You can also query specific issues directly:

```sql
-- Check if RLS policies use optimized pattern
SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN pg_get_expr(polqual, polrelid) LIKE '%SELECT auth.uid()%'
      OR pg_get_expr(polqual, polrelid) LIKE '%SELECT auth.role()%'
    THEN 'OPTIMIZED ✓'
    WHEN pg_get_expr(polqual, polrelid) LIKE '%auth.uid()%'
      OR pg_get_expr(polqual, polrelid) LIKE '%auth.role()%'
    THEN 'NEEDS OPTIMIZATION ⚠️'
    ELSE 'NO AUTH CHECK'
  END as status
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY status DESC, tablename, policyname;
```

---

## Long-Term Migration Strategy

### Current State ✓

Your project is **properly set up**:
- ✓ Migrations tracked in `migrations/` folder (001-008)
- ✓ Base schema in `supabase-schema.sql`
- ✓ Supabase CLI installed and linked
- ✓ Local development environment ready

### Recommended Strategy: Hybrid Approach

#### 1. **Use Migration Files for Changes** (Best Practice)

**For any new database changes:**

```bash
# Create a new migration
supabase migration new descriptive_name

# This creates: migrations/YYYYMMDDHHMMSS_descriptive_name.sql
# Edit the file with your SQL changes

# Test locally
supabase db reset  # Applies all migrations to local DB
supabase start     # If not already running

# Once tested, apply to production
# Option A: Via Dashboard (safer for now)
# - Copy SQL from migration file
# - Run in Supabase SQL Editor

# Option B: Via CLI (advanced, be careful!)
# supabase db push
```

**Benefits:**
- Version controlled
- Reviewable in PRs
- Repeatable
- Testable locally

#### 2. **Migration Naming Convention**

Continue using:
```
migrations/
  001_add_parent_dashboard_overview_rpc.sql
  002_fix_parent_dashboard_overview_order_by.sql
  003_add_content_microcards.sql
  ...
  008_optimize_rls_policies_performance.sql
  009_your_next_change.sql  ← New migrations go here
```

#### 3. **Keep supabase-schema.sql Updated**

Two options:

**Option A: Manual Updates (Current approach)**
- Update `supabase-schema.sql` when making changes
- Keep it as the "canonical" base schema
- New developers run this first, then migrations

**Option B: Generate from Remote (Recommended long-term)**
```bash
# Pull current remote schema
supabase db pull --schema public

# This overwrites supabase-schema.sql with current state
```

**Recommendation:** Use Option B quarterly or after major changes to keep schema file in sync.

#### 4. **Local Development Workflow**

```bash
# Start local Supabase
supabase start

# Work on features...

# Create migration for new changes
supabase migration new add_new_feature

# Edit migrations/YYYYMMDDHHMMSS_add_new_feature.sql

# Apply migration locally
supabase db reset  # Rebuilds from scratch with all migrations

# Test locally
# Run your app against local DB (http://127.0.0.1:54321)

# Commit migration file
git add migrations/YYYYMMDDHHMMSS_add_new_feature.sql
git commit -m "feat: add new feature database schema"

# Deploy to production (via Dashboard for now)
```

#### 5. **Production Deployment Process**

**Current (Manual - Safe for small team):**
1. Create migration file locally
2. Test with `supabase db reset` locally
3. Create PR with migration file
4. Review migration in PR
5. After merge: Manually run in Supabase Dashboard SQL Editor
6. Verify with `supabase db diff --linked`

**Future (Automated - For mature projects):**
1. Same as above through step 4
2. After merge: Use CI/CD to auto-apply migrations
3. Example GitHub Action:
   ```yaml
   - name: Deploy Database Migrations
     run: supabase db push
   ```

**Recommendation:** Stick with manual deployment for now. It's safer and you can review before applying.

#### 6. **Migration Tracking Table (Optional but Recommended)**

Create a table to track which migrations have been applied:

```sql
-- Run this once in production
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
);

-- After each migration, manually log it:
INSERT INTO schema_migrations (version, description)
VALUES ('008', 'Optimize RLS policies for performance');
```

This helps track what's been deployed without relying on Supabase's internal tracking.

---

## Decision Tree: When to Use What

### Use Migration Files When:
- ✓ Adding new tables
- ✓ Adding new columns
- ✓ Creating/modifying indexes
- ✓ Adding/modifying RLS policies
- ✓ Creating/updating functions
- ✓ Any schema change you want version controlled

### Use Direct SQL Editor When:
- Emergency hotfixes (then create migration file after)
- One-time data fixes
- Quick investigations

### Update supabase-schema.sql When:
- After major changes (quarterly)
- Before onboarding new developers
- After deploying multiple migrations

---

## Your Current Migration Files

### Applied ✓
All migrations 001-008 have been applied to production.

### What to Do With Them Now:

**Keep them!** They serve as:
1. **History:** Shows how database evolved
2. **Documentation:** Explains why changes were made
3. **Reproducibility:** New environments can be built from scratch
4. **Testing:** CI can run all migrations on test DB

### File Organization:

```
steadytrack/
├── migrations/
│   ├── README.md                                    ← Keep updated
│   ├── 001_add_parent_dashboard_overview_rpc.sql   ← Applied ✓
│   ├── 002_fix_parent_dashboard_overview_order_by.sql ← Applied ✓
│   ├── 003_add_content_microcards.sql              ← Applied ✓
│   ├── 004_add_plan_lifecycle_step1_add_columns.sql ← Applied ✓
│   ├── 005_add_plan_lifecycle_step2_backfill.sql   ← Applied ✓
│   ├── 006_add_plan_lifecycle_step3_constraints.sql ← Applied ✓
│   ├── 007_add_plan_lifecycle_rpc_functions.sql    ← Applied ✓
│   ├── 008_optimize_rls_policies_performance.sql   ← Applied ✓
│   ├── 009_your_next_migration.sql                 ← Future migrations
│   ├── debug_share_links.sql                       ← Debug scripts (separate folder?)
│   └── verify_database_state.sql                   ← Verification scripts
├── supabase-schema.sql                             ← Base schema (keep updated)
└── supabase/
    └── config.toml                                  ← Supabase CLI config
```

**Recommendation:** Create subdirectories:
```
migrations/
├── applied/          ← Move 001-008 here (already in production)
├── debug/            ← Move debug scripts here
└── pending/          ← New migrations start here
```

---

## Best Practices Going Forward

### 1. Always Test Migrations Locally First
```bash
supabase start
supabase db reset  # Applies all migrations
# Test your app
```

### 2. Make Migrations Idempotent
Use `IF NOT EXISTS`, `OR REPLACE`, etc.:
```sql
-- Good ✓
CREATE TABLE IF NOT EXISTS my_table (...);
DROP POLICY IF EXISTS my_policy ON my_table;
CREATE POLICY my_policy ...

-- Bad ✗
CREATE TABLE my_table (...);  -- Fails if already exists
```

### 3. Add Comments to Complex Migrations
```sql
-- Migration: Add user preferences
-- Purpose: Allow users to customize dashboard view
-- Dependencies: Requires profiles table (migration 001)
-- Rollback: DROP TABLE user_preferences;

CREATE TABLE user_preferences (...);
```

### 4. Use Transactions for Multi-Step Migrations
```sql
BEGIN;

-- Step 1: Add column
ALTER TABLE profiles ADD COLUMN new_field TEXT;

-- Step 2: Backfill data
UPDATE profiles SET new_field = 'default' WHERE new_field IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE profiles ALTER COLUMN new_field SET NOT NULL;

COMMIT;
-- Or ROLLBACK; if something fails
```

### 5. Verify After Deployment
```bash
# After applying migration to production
supabase db diff --linked --schema public

# Should show no changes if migration was applied correctly
```

### 6. Document Breaking Changes
If a migration requires app code changes:
```sql
-- BREAKING CHANGE: Requires app version 2.0+
-- The 'status' field now uses enum instead of text
-- Update application code before applying this migration
```

---

## Quick Reference Commands

### Check Migration Status
```bash
# See what's different between local and remote
supabase db diff --linked --schema public

# If output is empty = databases are in sync ✓
# If output shows SQL = that's what's different
```

### Create New Migration
```bash
# Create migration file
supabase migration new add_feature_name

# Edit: migrations/YYYYMMDDHHMMSS_add_feature_name.sql
```

### Test Locally
```bash
# Start local Supabase (if not running)
supabase start

# Reset database (applies all migrations from scratch)
supabase db reset

# View local Studio
open http://127.0.0.1:54323
```

### Deploy to Production
```bash
# Option 1: Manual (recommended for now)
# 1. Copy SQL from migration file
# 2. Run in Supabase Dashboard SQL Editor

# Option 2: CLI (advanced)
supabase db push  # Be careful! No confirmation prompt
```

### Stop Local Environment
```bash
supabase stop
```

---

## Migration Checklist Template

Before deploying any migration:

- [ ] Migration file created with descriptive name
- [ ] SQL uses idempotent patterns (IF NOT EXISTS, OR REPLACE)
- [ ] Migration tested locally with `supabase db reset`
- [ ] Application code tested against migrated local DB
- [ ] Migration reviewed in PR
- [ ] Breaking changes documented (if any)
- [ ] Rollback strategy documented
- [ ] Applied to production via SQL Editor
- [ ] Verified with `supabase db diff --linked`
- [ ] Monitored Supabase logs for errors
- [ ] Application tested in production

---

## Summary

**Best Long-Term Strategy:**

1. ✅ **Keep all migration files** (001-008 and future)
2. ✅ **Use CLI for local development** (`supabase start`, `supabase migration new`)
3. ✅ **Manual deployment to production** (safer for small teams)
4. ✅ **Version control everything** (migrations in git)
5. ✅ **Verify after deployment** (`supabase db diff --linked`)
6. ✅ **Update supabase-schema.sql quarterly** (`supabase db pull`)

This gives you:
- **Version control** for all schema changes
- **Local testing** before production
- **Reproducible** database setup for new devs
- **Safe** manual review before production deployment
- **Traceable** history of all changes

**You're set up perfectly for long-term success!** 🚀
