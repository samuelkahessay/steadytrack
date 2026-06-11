# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for recovering from catastrophic failures affecting SteadyTrack production systems.

---

## Prerequisites

**Required Access:**
- Supabase dashboard admin access
- Vercel dashboard admin access
- GitHub repository admin access
- DNS provider access (Cloudflare/domain registrar)

**Required Information:**
- Production Supabase project ID
- Backup retention policy: **7 days PITR / 30 days daily backups**
- Last known good deployment SHA
- Environment variable backup location

---

## Scenario 1: Database Corruption / Data Loss

### Detection
- Users report missing or incorrect data
- Sentry errors showing database query failures
- Supabase dashboard shows corruption warnings

### Recovery Steps

#### 1. Assess Impact (5 min)
```bash
# Check Supabase dashboard
1. Go to: https://app.supabase.com/project/[project-id]
2. Navigate to: Database → Backups
3. Identify: Last known good backup timestamp
4. Note: Affected tables/time range
```

#### 2. Put Site in Maintenance Mode (2 min)
```bash
# Option A: Vercel environment variable
1. Go to Vercel dashboard → Settings → Environment Variables
2. Add: MAINTENANCE_MODE=true (Production)
3. Redeploy: main branch

# Option B: Middleware redirect
# Uncomment maintenance mode in middleware.ts
```

#### 3. Restore Database from Backup (15-30 min)

**Option A: Point-in-Time Recovery (PITR)**
```bash
# In Supabase Dashboard
1. Database → Backups → Point in Time Recovery
2. Select timestamp (up to 7 days ago)
3. Confirm restore → Wait for completion
4. Verify: Run sample queries
```

**Option B: Daily Backup Restore**
```bash
# In Supabase Dashboard
1. Database → Backups → Daily Backups
2. Select backup (up to 30 days ago)
3. Download or restore to new project
4. If new project: Update connection strings
```

#### 4. Verify Data Integrity (10 min)
```sql
-- Run these queries in Supabase SQL Editor

-- Check table counts
SELECT
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'study_plans', COUNT(*) FROM study_plans
UNION ALL
SELECT 'user_progress', COUNT(*) FROM user_progress
UNION ALL
SELECT 'events', COUNT(*) FROM events;

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Test a sample authenticated query
-- (Login as test user, verify data loads)
```

#### 5. Rotate Secrets (if new project) (10 min)
```bash
# If restored to new Supabase project:
1. Copy new SUPABASE_URL and ANON_KEY
2. Update Vercel environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
3. Redeploy main branch
4. Verify /api/health returns 200
```

#### 6. Remove Maintenance Mode (2 min)
```bash
# Revert changes from Step 2
1. Remove MAINTENANCE_MODE env var (or set to false)
2. Redeploy
3. Monitor Sentry for errors
```

#### 7. Post-Recovery Validation (15 min)
```bash
# Test critical flows
1. User login (Google OAuth)
2. Create study plan
3. Mark unit complete
4. View parent dashboard
5. Check analytics tracking

# Monitor for 1 hour
- Sentry error rate
- Vercel Analytics traffic
- /api/health endpoint
```

### Expected Recovery Time
- **PITR**: ~30 minutes
- **Daily Backup**: ~45 minutes
- **New Project**: ~60 minutes

### Communication
```markdown
**User-facing message:**
"We experienced a temporary database issue and have restored from backup.
Data from [TIME] to [TIME] may have been lost. We're monitoring closely."

**Post-mortem:**
- Document root cause
- Update monitoring to catch earlier
- Review backup strategy
```

---

## Scenario 2: Complete Supabase Project Loss

### Detection
- Supabase dashboard inaccessible
- All API calls failing
- Database connection timeouts

### Recovery Steps

#### 1. Create New Supabase Project (10 min)
```bash
1. Go to: https://app.supabase.com
2. Create new project: steadytrack-production-v2
3. Select region: us-west-1 (or closest to users)
4. Wait for provisioning
```

#### 2. Restore Database Schema (5 min)
```bash
# In new project SQL Editor, run:
cat supabase-schema.sql

# Verify tables created:
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

#### 3. Restore Data from Latest Backup (30 min)
```bash
# If daily backups were downloaded:
1. Use pg_restore or psql to import data
2. Or manually restore critical tables via CSV export/import

# Critical tables priority:
1. profiles (user accounts)
2. study_plans (user plans)
3. user_progress (completion data)
4. study_streaks (streak data)
```

#### 4. Update Application Configuration (15 min)
```bash
# Update all environment variables in:
1. Vercel (Production + Preview)
2. GitHub Secrets (for CI)
3. Local .env.local (for development)

# Variables to update:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

# Redeploy main branch
```

#### 5. Reconfigure OAuth (10 min)
```bash
# In new Supabase project:
1. Authentication → Providers → Google
2. Add client ID and secret
3. Update callback URLs:
   - https://steadytrack.ca/callback
   - http://localhost:3000/callback (dev)
```

#### 6. Verify and Monitor (30 min)
```bash
# Full system test
1. Create test account
2. Complete full user flow
3. Test all API routes
4. Verify parent dashboard access
5. Check analytics tracking

# Monitor for 24 hours
- Higher alert threshold for errors
- User support queue
- Performance metrics
```

### Expected Recovery Time
- **Complete rebuild**: ~2 hours
- **With recent backup**: ~1.5 hours

---

## Scenario 3: Vercel Deployment Failure / Outage

### Detection
- Deployment failing in Vercel dashboard
- 500/502 errors site-wide
- /api/health returning 503

### Recovery Steps

#### 1. Identify Bad Deployment (2 min)
```bash
# In Vercel dashboard:
1. Go to Deployments
2. Identify failing deployment
3. Check build logs for errors
```

#### 2. Instant Rollback (1 min)
```bash
# In Vercel dashboard:
1. Find last working deployment
2. Click "..." → "Promote to Production"
3. Wait for deployment (30 seconds)
4. Verify /api/health returns 200
```

#### 3. Fix Root Cause (variable)
```bash
# Common causes:
- Bad code merge → Revert PR, create fix
- Missing env var → Add in Vercel settings
- Dependency issue → Lock versions, redeploy
- Build timeout → Optimize build, increase timeout
```

#### 4. Redeploy Fix (5 min)
```bash
# After fix:
1. Merge fix to main (via PR)
2. Wait for CI checks
3. Merge → auto-deploy
4. Monitor deployment logs
5. Verify /api/health
```

### Expected Recovery Time
- **Rollback**: ~2 minutes
- **With fix**: ~15 minutes

---

## Scenario 4: DNS / Domain Issues

### Detection
- Domain not resolving
- SSL certificate errors
- Users can't access site

### Recovery Steps

#### 1. Verify DNS Configuration (5 min)
```bash
# Check DNS records
dig steadytrack.ca
dig www.steadytrack.ca

# Expected records:
# A record: 76.76.21.21 (Vercel)
# CNAME: cname.vercel-dns.com
```

#### 2. Check Vercel Domain Settings (5 min)
```bash
# In Vercel dashboard:
1. Project → Settings → Domains
2. Verify domain is connected
3. Check SSL certificate status
4. Re-validate if needed
```

#### 3. Contact DNS Provider (if needed)
```bash
# If DNS propagation issue:
- Wait up to 48 hours for propagation
- Use CloudFlare DNS for faster propagation
- Provide temporary access via Vercel URL:
  https://steadytrack.vercel.app
```

### Expected Recovery Time
- **DNS misconfiguration**: ~10 minutes
- **Propagation delay**: 24-48 hours

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary Admin | (your email/phone) | 24/7 |
| Supabase Support | support@supabase.com | 24/7 (paid plan) |
| Vercel Support | support@vercel.com | 24/7 (pro plan) |
| Domain Registrar | (registrar support) | Business hours |

---

## Post-Incident Checklist

After any disaster recovery:

- [ ] Document timeline in incident report
- [ ] Update this runbook with learnings
- [ ] Test backup restore procedure
- [ ] Review monitoring alerts
- [ ] Communicate with affected users
- [ ] Schedule post-mortem meeting
- [ ] Update disaster recovery plan
- [ ] Verify all systems operational
- [ ] Resume normal operations

---

## Testing Schedule

**Monthly:**
- [ ] Test database backup restore to staging
- [ ] Verify /api/health monitoring alerts
- [ ] Review disaster recovery contacts
- [ ] Update documentation

**Quarterly:**
- [ ] Full disaster recovery drill
- [ ] Time-to-restore measurement
- [ ] Update emergency procedures
- [ ] Train team members

---

## Related Documentation

- [Incident Response Playbook](./incident-response.md)
- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups)
- [Vercel Rollback Guide](https://vercel.com/docs/deployments/rollback)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)

---

**Last Updated:** 2025-10-11
**Next Review:** 2025-11-11
**Owner:** Platform Team
