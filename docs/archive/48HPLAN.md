# SteadyTrack - 48-Hour Execution Plan (Emotion-First)

**Strike Started:** October 6, 2025  
**Target Launch:** October 8, 2025  
**Mode:** Commander, not coder. AI builds, you triage.  
**Rule:** If stuck >20 min, stub it and move on.

---

## 🎯 Tactical Improvements Applied

**Based on execution feedback, we've optimized for:**

1. **Simplified Database** (Saves 30 min)
   - Dropped `study_sessions` table (compute from `user_progress.completed_at`)
   - 6 tables instead of 7
   - Fewer RLS debugging risks

2. **Immediate Emotional Feedback** (Baked into code)
   - Toast message on every unit completion: "🔥 Day X streak!"
   - Streak status computed in `markComplete()` flow automatically
   - No waiting for dashboard refresh to see progress

3. **Broken Streak Visibility** (Emotional accountability)
   - Red "⚡ Start a new streak!" message when `last_study_date < today - 1`
   - Creates subtle urgency without notifications

4. **Parent Dashboard Clarity** (Screenshot-first design)
   - NO animations (clarity over fancy)
   - Big streak badge + weekly checkmarks
   - One reassuring line: "On track for diploma prep ✅"
   - Designed to be understood in <5 seconds

5. **Better Landing Copy** (Rhythm + urgency)
   - Headline: "When classes stop, consistency shouldn't."
   - Alternative: "School's paused. Your momentum isn't."
   - Test both, pick the one that hits harder

6. **Study Pulse Metric** (Optional power move)
   - "You studied 3 of the last 4 days (75% consistency)"
   - Parents understand percentages
   - Only add if ahead of schedule at Hour 32

**Time Saved:** ~45 min (simpler database + no parent animations)  
**Emotional Impact:** +50% (immediate feedback loops everywhere)

---

## 🚀 Optional Power Move (If You Have 45 Minutes at Hour 32)

### Add "Study Pulse" Consistency Metric

**Why:** Parents understand percentages. Students love progress bars. You already have the data.

**What It Shows:**
```
Study Pulse: 75% (3 of last 4 days)
```

**Implementation (30 min):**
```typescript
// Already in /lib/progress.ts from database setup
function getStudyPulse(userId: string) {
  // Count distinct dates in last 4 days from user_progress.completed_at
  const daysStudied = /* SQL query */;
  const percentage = Math.round((daysStudied / 4) * 100);
  
  return {
    daysStudied,
    total: 4,
    percentage,
    message: getEncouragementMessage(percentage)
  };
}

function getEncouragementMessage(percentage: number) {
  if (percentage >= 75) return "Excellent consistency! 🎯";
  if (percentage >= 50) return "Good momentum! Keep it up!";
  return "Build your consistency—study today!";
}
```

**Where To Show:**
1. **Student Dashboard:**
   ```
   Study Pulse: ████████████░░░░ 75%
   You studied 3 of the last 4 days
   ```

2. **Parent Dashboard:**
   ```
   Study Consistency: 75%
   Emma studied 3 of the last 4 days
   ```

**Why It Works:**
- Simple metric parents can understand
- Shows consistency trend, not just current streak
- Works even if streak was recently broken
- Easy to add (data already exists in user_progress table)

**Add Only If:**
- [ ] Core features done by Hour 32
- [ ] No critical bugs
- [ ] You have 45 min buffer

**Skip If:**
- [ ] Behind schedule
- [ ] Still debugging core features
- [ ] Less than Hour 32

**Impact:** Medium-high for parent reassurance, low effort to add.

---

## ⚡ Critical Insight: We're Not Building a Plan Generator

### The Reframe
**OLD THINKING:** "Students need study plans during the strike"  
**REALITY:** Students need to **feel on track**. Parents need **peace of mind**.

**What This Means:**
- ❌ Plan generator is NOT the product (it's onboarding)
- ✅ Progress tracking + streaks = THE product (daily retention)
- ✅ Parent dashboard = Virality engine (screenshot-worthy)

### Why This Matters for 48-Hour Sprint
**Time allocation changed:**
- Plan generator: 2 hours (was 4 hours) - Keep it simple
- Progress dashboard: 4 hours (was 2 hours) - **Make it amazing**
- Parent dashboard: 3 hours (was 1 hour) - **Screenshot-worthy**
- Landing page: Emotion-first copy, not feature list

### The Core Loop (This is what creates retention)
1. Student signs in → Marks first unit → Sees "Day 1 streak! 🔥"
2. Returns Day 2 → "Don't break your streak!" → Marks progress → Bar rises to 15%
3. Day 3 → "3-day streak!" → Feels momentum → Shares parent link
4. Parent opens link → "Studied 3 days, 2 units done ✅" → Relief → Shares screenshot
5. Day 4 → Student sees "You're on track" → Confidence → Keeps going

**Without this loop:** Users generate plan once, never return  
**With this loop:** Daily habit formation + parent virality

---

## 🚨 Tactical Risks (Real Blockers You'll Hit)

### High-Impact Risks (Will Break Everything)

#### 1. Auth Redirect URL Mismatch
**What Happens:** OAuth callback fails silently. User clicks "Sign in with Google" → redirects to Google → returns to error page.

**Why It Happens:**
- Supabase expects exact redirect URL
- Localhost vs production URLs differ
- Missing trailing slash breaks match

**Prevention (Hour 1):**
```bash
# Add BOTH URLs to Supabase Dashboard:
# Authentication → URL Configuration → Redirect URLs

http://localhost:3000/auth/callback
https://steadytrack.ca/auth/callback
https://steadytrack.vercel.app/auth/callback  # Vercel preview URLs

# In code, use dynamic redirect:
const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL + '/auth/callback'
```

**Test Before Marketing:**
- [ ] Test auth on localhost (npm run dev)
- [ ] Deploy to Vercel → Test on production URL
- [ ] Try in incognito (fresh session)
- [ ] Check Supabase logs for redirect errors

**If It Breaks During Launch:**
1. Check Supabase dashboard → Authentication → Logs
2. Copy the exact URL it's trying to use
3. Add that URL to redirect whitelist
4. Deploy takes 90 seconds

---

#### 2. Supabase RLS Over-Restriction
**What Happens:** Queries return empty even though data exists. User creates plan → can't see it. Progress updates fail silently.

**Why It Happens:**
- RLS policies too strict by default
- User ID doesn't match (uuid vs string)
- Policy checks auth.uid() when user is null

**Prevention (Hour 3):**
```sql
-- START WITH PERMISSIVE POLICIES (DISABLE RLS)
-- You can tighten post-launch

-- Disable RLS on all tables for MVP:
ALTER TABLE study_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE parent_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Only enable on profiles if needed:
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"  
ON profiles FOR UPDATE
USING (auth.uid() = id);
```

**Re-enable After Launch (Week 2):**
```sql
-- Once you verify everything works, add proper RLS:
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own plans"
ON study_plans FOR ALL
USING (auth.uid() = user_id);
```

**If Data Disappears:**
1. Go to Supabase → Database → Tables → study_plans
2. Click "..." → Disable RLS
3. Test query again
4. Re-enable with simpler policy

---

### Medium-Impact Risks (Will Cause Bugs)

#### 3. AI UI Bugs (Layout, Hydration Mismatches)
**What Happens:** App works in dev, crashes in production. Console shows "Hydration failed" errors. Layout breaks on mobile.

**Why It Happens:**
- AI generates `useEffect` that runs only on client
- Server renders one thing, client expects another
- Tailwind classes conflict

**Prevention (Hour 8, 16, 24):**
```bash
# Run production build locally 3 times during sprint:
npm run build
npm run start

# This catches hydration bugs before deploy
```

**Common Hydration Fixes:**
```typescript
// BAD - causes hydration mismatch
function Component() {
  const [time, setTime] = useState(new Date());
  return <div>{time.toString()}</div>
}

// GOOD - only render on client
function Component() {
  const [time, setTime] = useState(null);
  
  useEffect(() => {
    setTime(new Date());
  }, []);
  
  if (!time) return <Skeleton />;
  return <div>{time.toString()}</div>
}
```

**Test Checklist (Before Each Deploy):**
- [ ] `npm run build` succeeds (no TypeScript errors)
- [ ] `npm run start` → App loads without console errors
- [ ] Test on Chrome DevTools mobile viewport
- [ ] Check for hydration warnings in console

**If Hydration Breaks:**
1. Check browser console for exact component name
2. Find `useState` or `Date()` calls in that component
3. Wrap in `useEffect` or add `'use client'` directive
4. Rebuild and test

---

#### 4. Curriculum Data Explosion
**What Happens:** Next.js build takes 5+ minutes. Vercel deploy times out. App loads slowly.

**Why It Happens:**
- Single JSON file > 5MB
- Next.js bundles all `/public` data
- Each subject has hundreds of resource URLs

**Prevention (Hour 18):**
```bash
# Split curriculum into separate files:
/public/data/
  ├── math-30-1.json       # ~500KB
  ├── english-30-1.json    # ~400KB
  ├── biology-30.json      # ~300KB
  ├── chemistry-30.json    # ~300KB
  ├── physics-30.json      # ~300KB
  └── social-30-1.json     # ~300KB

# Total: ~2.1MB (safe)

# Load on-demand:
const curriculum = await fetch(`/data/${subject}.json`).then(r => r.json())
```

**File Size Limits:**
- ✅ Each subject file < 1MB
- ⚠️ Total < 5MB (Next.js happy)
- ❌ Single file > 5MB (build will slow)

**Monitor Build Time:**
```bash
# Each deploy shows build time in Vercel:
✓ Compiled in 12s  # Good
⚠ Compiled in 45s  # Warning (check file sizes)
✗ Build timed out  # Over 5MB, split files
```

**If Build Times Out:**
1. Check file sizes: `ls -lh public/data/`
2. Split largest files into separate subjects
3. Remove unnecessary data (descriptions, thumbnails)
4. Deploy again

---

### Low-Impact Risks (Won't Block Launch)

#### 5. Auth Cold Start Latency
**What Happens:** First sign-in takes 3-5 seconds. Subsequent logins fast.

**Why It Happens:**
- Supabase spins up edge function on first request
- JWT verification calls auth server
- Not a bug, just slow first load

**Mitigation (Optional, Post-Launch):**
```typescript
// Preload user session on app load
// /app/layout.tsx
export default function RootLayout({ children }) {
  useEffect(() => {
    // Warm up auth session
    supabase.auth.getSession();
  }, []);
  
  return children;
}
```

**Why It's Low Priority:**
- Only affects first-ever sign-in
- Users expect OAuth to take a few seconds
- Not worth optimizing in 48-hour sprint

**If Users Complain:**
- Add loading spinner with "Signing you in..." text
- Shows progress, feels intentional

---

## 🛡️ Pre-Flight Checklist (Before Each Phase)

### Before Hour 8 (After Auth + DB Setup)
- [ ] Test sign-in on localhost
- [ ] **Deploy to Vercel** → Test on production URL
- [ ] Sign in on production works
- [ ] Check Supabase logs (no redirect errors)
- [ ] RLS disabled on main tables

### Before Hour 18 (After Core UI)
- [ ] `npm run build` succeeds locally
- [ ] No hydration warnings in console
- [ ] Test on Chrome mobile viewport
- [ ] All forms submit without errors
- [ ] Check JSON file sizes in `/public/data/`

### Before Hour 36 (Before Launch)
- [ ] Smoke test passes (laptop + phone)
- [ ] Auth works on production (incognito)
- [ ] Data persists after refresh
- [ ] Parent link works (test with friend)
- [ ] No console errors on critical pages
- [ ] Supabase has <10k rows (free tier limit)

---

## 🚑 Emergency Debug Commands

### Auth Not Working
```bash
# Check Supabase logs
# Dashboard → Authentication → Logs → Filter "errors"

# Check redirect URLs
# Dashboard → Authentication → URL Configuration

# Test auth flow manually
console.log(await supabase.auth.getSession())
console.log(await supabase.auth.getUser())
```

### Data Not Saving
```bash
# Check RLS policies
# Dashboard → Database → Tables → [table] → Policies

# Test query in SQL editor
SELECT * FROM study_plans WHERE user_id = '[paste-user-id]';

# If empty but should have data → RLS is blocking
ALTER TABLE study_plans DISABLE ROW LEVEL SECURITY;
```

### Build Failing
```bash
# Check TypeScript errors
npm run build 2>&1 | grep "error TS"

# Check file sizes
ls -lh public/data/*.json

# Clear Next.js cache
rm -rf .next
npm run build
```

### Hydration Errors
```bash
# Find exact component causing issue
# Browser console shows: "Hydration failed in <ComponentName>"

# Common fix: Add 'use client' directive
'use client'
import { useState } from 'react'
```

---

## 🎯 Critical Path Only (Everything Else is Sugar)

### MUST SHIP (Core Value Loop)
1. **Auth** - User can sign in (Google OAuth only)
2. **Plan Generation** - Pick subjects → Get 5-day schedule
3. **Progress Tracking** - Check off units, see progress bar
4. **Parent Share** - Generate link, parent views progress
5. **Landing Page** - Clear value prop + working signup

**Definition of "Done" per Feature:**
- Auth: User signs in with Google, sees dashboard, can sign out
- Plan: Submits form → Sees 5 cards with topics + links → Can save
- Progress: Checks box → Progress bar updates → Persists on refresh
- Parent: Student generates link → Parent opens → Sees read-only view
- Landing: Hero + CTA → Click → Auth modal → Works

### CUT If Behind Schedule (Hour 36 Decision Point)
- ❌ Apple Sign In (Google only is fine)
- ❌ Guest mode (just auth gate)
- ❌ Real-time sync (reload works)
- ❌ Streak counter (nice to have)
- ❌ Offline support (defer to v1.1)
- ❌ Daily Focus widget (can add post-launch)
- ❌ Fancy animations/polish

---

## 🏗️ Tech Stack (Simplified)

### Single Source of Truth: Supabase
**Why:** Auth + Database + Realtime in one service. No context switching.

```
Frontend: Next.js 14 + TypeScript + Tailwind
Auth: Supabase Auth (Google OAuth)
Database: Supabase Postgres
Deployment: Vercel
Analytics: Supabase built-in (basic pageviews)
```

**NOT using:**
- ❌ Clerk (redundant with Supabase Auth)
- ❌ Prisma (Supabase client is enough)
- ❌ Separate analytics (Supabase has basic metrics)
- ❌ Google Analytics (tracking overhead, use Supabase events table)

### Environment Variables (Only 2)
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 🚀 Deploy Early, Iterate Live Strategy

### Why Deploy at Hour 1 (Not Hour 36)
1. **Vercel atomic deploys** - Every git push auto-deploys in ~2 min
2. **Test on real URLs** - Share steadytrack.ca/test-route with friends
3. **Trivial rollbacks** - One click to revert bad deploy
4. **No "big launch" pressure** - You're already live, just iterate

### Continuous Deployment Workflow
```bash
# Make changes locally
npm run dev  # Test locally

# Push to production (30 seconds)
git add .
git commit -m "Add progress tracking"
git push origin main
# Vercel auto-deploys in ~90 seconds

# Test production immediately
open https://steadytrack.ca
```

### Deploy Cadence (Recommended)
- **Hours 1-8:** Deploy every 2-3 features (3-4 deploys)
- **Hours 8-18:** Deploy every major feature (4-5 deploys)
- **Hours 18-36:** Deploy every bug fix (10+ deploys)
- **Hour 36+:** Deploy hot-fixes immediately (<5 min)

**You'll deploy ~20-30 times in 48 hours. That's normal and good.**

### Quick Rollback If Needed
1. Go to Vercel dashboard
2. Click "Deployments"
3. Click "..." on previous working deploy
4. Click "Promote to Production"
5. Done (30 seconds)

---

## ⚡ Quick Wins (Minimal Effort, Maximum Impact)

### 1. Loading Skeletons Everywhere
**Cost:** One shadcn component, reused everywhere  
**Impact:** App feels 3x faster, users perceive polish

**Implementation (5 minutes):**
```bash
# Add shadcn skeleton
npx shadcn-ui@latest add skeleton

# Use it everywhere
<Skeleton className="h-4 w-full" /> // Text line
<Skeleton className="h-32 w-full" /> // Card
<Skeleton className="h-8 w-8 rounded-full" /> // Avatar
```

**Where to use:**
- Plan loading (before data arrives)
- Dashboard (while fetching plans)
- Progress bars (before calculation)
- Parent dashboard (while validating token)

**Result:** Users see instant feedback, not blank screens

---

### 2. Simple Analytics (No Tracking Overhead)
**Cost:** One events table + helper function  
**Impact:** See real traction without GA complexity

**Implementation (10 minutes):**
```typescript
// /lib/analytics.ts
export async function trackEvent(
  eventName: string, 
  eventData?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  await supabase.from('events').insert({
    user_id: user?.id,
    event_name: eventName,
    event_data: eventData,
    created_at: new Date().toISOString()
  });
}

// Usage
await trackEvent('sign_in');
await trackEvent('plan_created', { subjects: ['Math 30-1'] });
await trackEvent('progress_updated', { subject: 'Math 30-1', unitId: 'm30_1' });
await trackEvent('parent_link_created');
```

**Track only 5 events:**
1. `sign_in` - User authenticates
2. `plan_created` - Generates study plan
3. `progress_updated` - Marks unit complete
4. `parent_link_created` - Shares with parent
5. `parent_link_accessed` - Parent views dashboard

**Query in Supabase:**
```sql
-- See all activity today
SELECT event_name, count(*) 
FROM events 
WHERE created_at > now() - interval '24 hours'
GROUP BY event_name;

-- Most active users
SELECT user_id, count(*) 
FROM events 
GROUP BY user_id 
ORDER BY count DESC 
LIMIT 10;
```

**Result:** Real-time traction data without analytics bloat

---

### 3. Error Boundaries Everywhere
**Cost:** One component, wrapped around each page  
**Impact:** Halves critical bug reports (graceful failures)

**Implementation (10 minutes):**
```typescript
// /components/ErrorBoundary.tsx (Claude Code generates this)
'use client'

import { Component, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrap every main page
export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
```

**Result:** Users can recover from crashes without losing data

---

### 4. Deploy at Hour 1 (Not Hour 36)
**Cost:** Connect Vercel in 2 minutes  
**Impact:** Test on real URLs, share progress, trivial rollbacks

**Deployment checklist:**
- [ ] Push to GitHub (Hour 1)
- [ ] Connect Vercel (automatic)
- [ ] Add env vars in Vercel dashboard
- [ ] Test steadytrack.ca loads
- [ ] Every future push auto-deploys (~90 sec)

**Deploy frequency:**
- Early (Hours 1-8): Every 2-3 features
- Middle (Hours 8-24): Every feature
- Late (Hours 24-36): Every bug fix
- Post-launch: Hot-fixes immediately

**Result:** You're "in production" from Hour 1, no launch pressure

---

## ⏱️ Revised Timeline (With Debug Buffer)

### **Phase 1: Foundation (Hours 0-8)** 
*Build: 4h | Debug: 2h | Buffer: 2h*

#### Hour 0-1: Scaffold + Early Deploy
**Claude Code Prompt:**
```
Create Next.js 14 app with:
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
- Folder structure: /app, /components, /lib, /types
- Install @supabase/supabase-js
- Create Supabase client singleton in /lib/supabase.ts
- Add shadcn skeleton component
- Create ErrorBoundary component with "Reload page" fallback
- Wrap all main pages in ErrorBoundary
```

**You Do:**
- [ ] Review generated code
- [ ] Create Supabase project (supabase.com)
- [ ] Copy URL + anon key to .env.local
- [ ] Push to GitHub
- [ ] **Connect Vercel immediately** (don't wait)
- [ ] Test production URL works

**Done = `npm run dev` works locally AND deployed to Vercel**

**Why Deploy Now:** Every future push auto-deploys. Test on real URLs from Hour 2 onward.

#### Hour 1-3: Auth (Google OAuth Only)
**Claude Code Prompt:**
```
Set up Supabase Auth with Google OAuth:
1. Auth provider setup (enable Google in Supabase dashboard)
2. Create /app/auth/callback/route.ts for OAuth redirect
3. Create auth context provider with session state
4. Create sign-in button component (triggers supabase.auth.signInWithOAuth)
5. Protected route middleware
6. Sign-out button

No fancy UI - just functional buttons.
```

**You Do:**
- [ ] Enable Google OAuth in Supabase dashboard
- [ ] Add authorized redirect URL
- [ ] Test sign-in flow (laptop only for now)
- [ ] If OAuth breaks, check: redirect URL, env vars, callback route

**Done = Sign in with Google → Redirect → See dashboard → Sign out**

**Debug Budget:** 1 hour for OAuth issues (common problems: redirect URL mismatch, CORS)

#### Hour 3-5: Database Schema (SIMPLIFIED - 4 Tables Only)
**Claude Code Prompt:**
```
Create minimal Supabase tables (NO study_sessions table - we compute from user_progress):

1. profiles (extends auth.users)
   - id (uuid, FK to auth.users)
   - grade (int)
   - created_at

2. study_plans
   - id (uuid)
   - user_id (uuid, FK)
   - subjects (text[])
   - schedule (jsonb)
   - created_at

3. user_progress (DOES DOUBLE DUTY: tracks completion AND daily activity)
   - id (uuid)
   - user_id (uuid, FK)
   - plan_id (uuid, FK)
   - subject (text)
   - unit_id (text)
   - completed (boolean)
   - completed_at (timestamp) -- We use this to compute daily streaks
   - created_at (timestamp)

4. study_streaks (computed from user_progress)
   - id (uuid)
   - user_id (uuid, FK, unique)
   - current_streak (int, default 0)
   - longest_streak (int, default 0)
   - last_study_date (date)
   - total_study_days (int, default 0)
   - updated_at (timestamp)

5. parent_access
   - id (uuid)
   - student_user_id (uuid, FK)
   - share_token (text, unique)
   - is_active (boolean)
   - created_at

6. events (simple analytics)
   - id (uuid)
   - user_id (uuid, nullable)
   - event_name (text)
   - event_data (jsonb, nullable)
   - created_at (timestamp, default now())

Generate SQL migration + TypeScript types.
DISABLE RLS on all tables for MVP (re-enable post-launch).

Create helper functions:
  - trackEvent() in /lib/analytics.ts
  - updateStreak() in /lib/streaks.ts
    * Increments streak if user completes ANY unit today
    * Resets to 0 if last_study_date < today - 1
    * Updates longest_streak if current > longest
  - getWeeklySummary(userId) in /lib/progress.ts
    * Counts DISTINCT dates in user_progress.completed_at (last 7 days) = days studied
    * Counts total units completed (last 7 days)
    * Returns: { daysStudied: 4, unitsCompleted: 7 }
  - getStudyPulse(userId) in /lib/progress.ts
    * Counts days studied in last 4 days
    * Returns: { daysStudied: 3, total: 4, percentage: 75 }
```

**You Do:**
- [ ] Run SQL in Supabase SQL editor
- [ ] Generate TypeScript types
- [ ] Test updateStreak() logic:
  - Complete unit today → streak = 1
  - Complete another unit same day → streak still 1
  - Come back tomorrow, complete unit → streak = 2
  - Skip a day → streak = 0
- [ ] Test getWeeklySummary() returns correct counts
- [ ] Test getStudyPulse() calculates percentage correctly

**Done = 6 tables exist, streak logic works, weekly summary computes correctly**

**Time Saved:** 30 min (one less table, simpler queries)

**Debug Budget:** 20 min (simpler schema = fewer bugs)

#### Hour 5-8: Core API Functions (WITH EMOTIONAL LOOPS BAKED IN)
**Claude Code Prompt:**
```
Create API service layer in /lib/api/:

1. plans.ts
   - createPlan(userId, grade, subjects[]) → generates schedule
   - getPlan(planId) → returns plan
   - Algorithm: distribute units evenly across 5 days

2. progress.ts
   - markComplete(userId, planId, unitId) → CRITICAL FUNCTION
     * Updates user_progress (completed = true, completed_at = now)
     * Calls updateStreak(userId) immediately
     * Returns: { success, newStreak, milestone }
     * If newStreak > oldStreak: return streakIncreased = true (triggers toast)
     * If hit milestone (25%, 50%, 75%, 100%): return milestone = true
   - getProgress(userId, planId) → returns completion % per subject
   - getWeeklySummary(userId) → counts distinct dates from user_progress.completed_at
   - getStudyPulse(userId) → calculates last 4 days consistency

3. streaks.ts
   - updateStreak(userId) → AUTO-CALLED by markComplete
     * If last_study_date = today: do nothing (already counted)
     * If last_study_date = yesterday: increment current_streak
     * If last_study_date < yesterday: reset current_streak = 1 (new streak)
     * Update longest_streak if needed
     * Update last_study_date = today
   - getStreakStatus(userId) → returns { currentStreak, longestStreak, isActive, needsMotivation }
     * isActive = last_study_date === today
     * needsMotivation = last_study_date < today (show "Start a new streak" message)

4. sharing.ts
   - createShareLink(studentUserId) → generates unique token
   - getProgressByToken(token) → returns student progress (read-only)

Include error handling, TypeScript types. Keep it simple.

CRITICAL: markComplete() is the emotional loop trigger. Make it return streak status immediately.
```

**You Do:**
- [ ] Test markComplete with console.log
- [ ] Complete one unit → Should see streak = 1
- [ ] Complete another unit same day → Streak still 1
- [ ] Come back "tomorrow" (mock date) → Complete unit → Streak = 2
- [ ] Skip a day (mock date) → Streak resets to 1
- [ ] Verify milestone detection (hit 25%, 50%, etc.)

**Done = markComplete triggers streak updates automatically**

**Time Budget:** 2.5 hours

**Debug Budget:** 30 min for streak logic edge cases

### **Phase 2: Core UI (Hours 8-18)**
*Build: 6h | Debug: 2h | Buffer: 2h*

#### Hour 8-10: Plan Generator (ONBOARDING ONLY - KEEP SIMPLE)
**This is just the setup step. Don't over-invest.**

**Claude Code Prompt:**
```
Create basic plan generation flow:

/app/plan/new/page.tsx
- Grade selector (11 or 12, big buttons)
- Submit → route to /plan/new/subjects

/app/plan/new/subjects/page.tsx
- Checkbox list: Math 30-1, English 30-1, Biology 30, Chemistry 30, Physics 30, Social 30-1
- Generate button → calls createPlan → redirect to /dashboard (NOT plan view)
- Show loading skeleton while generating ("Creating your plan...")
- Track: trackEvent('plan_created', { subjects })

/app/plan/[id]/page.tsx (Simple reference view)
- Shows 5 day cards with topics
- Links to resources
- Checkboxes to mark complete (feeds into dashboard progress)
- "Back to Dashboard" button (primary action)

Use shadcn/ui components, functional styling (don't obsess over beauty here).
Mobile-responsive.
ErrorBoundary wrapper.
```

**You Do:**
- [ ] Test flow: select grade → subjects → generate → see dashboard
- [ ] Verify redirect goes to dashboard (not plan page)
- [ ] Check on mobile (basic responsive)
- [ ] Push to Vercel → test on production
- [ ] Don't spend >30 min on styling (it's not the product)

**Done = Can create plan, get redirected to dashboard**

**Time Budget:** 2 hours max (resist feature creep)

**Debug Budget:** 30 min for routing issues

---

#### Hour 10-14: Progress Dashboard (EMOTIONAL LOOP ENGINE)
**This is the product. Make the feedback immediate and satisfying.**

**Claude Code Prompt:**
```
Create the momentum dashboard with instant emotional feedback:

/app/dashboard/page.tsx (Main view after sign-in)

Hero Section (Dynamic based on streak status):
- If streak active (studied today):
  * "🔥 X-Day Streak! You're crushing it!"
  * Green background, celebratory tone
  
- If streak exists but not studied today:
  * "🔥 Don't break your X-day streak! Study now."
  * Orange/yellow background, urgent tone
  
- If no streak (last_study_date < today - 1):
  * "⚡ Start a new streak! Study one unit today."
  * Red/attention-grabbing, motivational tone

Subject Progress Cards:
- Large animated progress bars (0-100%)
- Status badges:
  * "✅ On track" (>70%) - green
  * "⚠️ Pick up the pace" (<50%) - orange
  * "🎉 Complete!" (100%) - celebration
- Units completed vs total
- Study Pulse: "You studied 3 of the last 4 days (75% consistency)" [POWER MOVE]

Weekly Summary Card:
- Days studied this week: Mon ✓ Tue ✓ Wed ✗ Thu ✓ Fri ✓ (visual checkmarks)
- Total units completed this week
- Encouraging message: "Great consistency!" or "Keep building momentum"

Today's Focus Widget:
- One suggested unit (pick from incomplete, prioritize Math/English)
- Estimated time: 45 min
- [Start Now] button

Celebration Modals (triggered by markComplete response):
- 25%: "You're making progress! Keep going."
- 50%: "Halfway there! 🎯"
- 75%: "Almost done! You got this!"
- 100%: "🎉 Subject complete! Amazing work!"
- New streak: Small confetti animation (optional, skip if time-pressed)

Add progress tracking to plan view:
- Each unit has large, satisfying checkbox
- onClick → calls markComplete API
- **IMMEDIATE FEEDBACK:**
  * Optimistic UI (checkbox fills instantly)
  * If response.streakIncreased: Show toast "🔥 Day X streak!"
  * If response.milestone: Show celebration modal
  * Progress bar animates smoothly to new percentage
- Track analytics: trackEvent('progress_updated')

Use shadcn toast component for instant feedback.
Framer Motion for smooth progress bar animations (optional if time).
All wrapped in ErrorBoundary.
Loading skeletons everywhere.
```

**You Do:**
- [ ] Test: Check box → See instant toast "🔥 Day 1 streak!"
- [ ] Test: Check another box same day → Toast says "Keep going!" (not new streak)
- [ ] Test: Come back "tomorrow" → Check box → Toast says "🔥 Day 2 streak!"
- [ ] Test: Skip a day → See red "⚡ Start a new streak!" message
- [ ] Test: Hit 25% → See celebration modal
- [ ] **Get friend to test: Does it FEEL good to mark progress?**
- [ ] Push to Vercel → test on production
- [ ] Verify emotional loop is satisfying

**Done = Checking boxes feels rewarding, streak messages create urgency/motivation**

**Time Budget:** 4 hours (worth it - this creates daily habit)

**Debug Budget:** 1 hour for animation/state issues

**CRITICAL:** If toast/modal doesn't work in 30 min, just show text message. Emotional feedback > fancy UI.

#### Hour 14-17: Parent Dashboard (CLARITY > FANCY - SCREENSHOT-WORTHY)
**Make it instantly reassuring. No animations, just clear information.**

**Claude Code Prompt:**
```
Create parent monitoring focused on peace of mind and shareability:

/app/settings/page.tsx
- "Share with Parent" section
- Generate Share Link button → creates token
- Shows: steadytrack.ca/parent/[token]
- Copy to clipboard button with success toast
- "What parents see" preview (shows mock data)
- Track: trackEvent('parent_link_created')
- ErrorBoundary wrapper

/app/parent/[token]/page.tsx
- DESIGN FOR SCREENSHOTS: High contrast, clear layout, big text
- NO animations or fancy transitions (clarity is king)

Layout:
┌─────────────────────────────────────────┐
│ Emma's Progress                         │
│ Last updated: 2 hours ago              │
├─────────────────────────────────────────┤
│                                         │
│ 🔥 4-Day Study Streak                   │
│ Studied 4 of the last 5 days           │
│                                         │
├─────────────────────────────────────────┤
│ This Week (Oct 6-12):                  │
│                                         │
│ Days Studied:                          │
│ Mon ✓  Tue ✓  Wed ✗  Thu ✓  Fri ✓      │
│                                         │
│ • 7 units completed                     │
│ • 75% study consistency                 │
│ • On track for diploma prep ✅          │
│                                         │
├─────────────────────────────────────────┤
│ Subject Progress:                       │
│                                         │
│ Math 30-1          ████████████░ 82%    │
│ ✅ On track                             │
│                                         │
│ English 30-1       ██████░░░░░░ 45%     │
│ ⚠️ Could pick up the pace               │
│                                         │
│ Biology 30         ████████████ 100%    │
│ 🎉 Complete!                            │
│                                         │
└─────────────────────────────────────────┘

Key Requirements:
- Big streak badge (most important element)
- Weekly checkmarks (visual proof)
- Study consistency percentage (75%) [POWER MOVE]
- One reassuring line: "On track for diploma prep ✅"
- Simple progress bars (no animations)
- Last updated timestamp
- Clean typography (readable on phone screenshot)

- Track: trackEvent('parent_link_accessed', { token })
- Read-only (no edit buttons)
- ErrorBoundary with "Invalid link" fallback
- Loading skeleton while validating token

Skip: animations, hover effects, gradients, fancy UI
Focus: clarity, reassurance, screenshot aesthetics
```

**You Do:**
- [ ] Generate link on laptop
- [ ] Open on phone (different device)
- [ ] **Take screenshot → Show to a parent: Is it instantly clear?**
- [ ] Ask: "Can you tell if the kid is studying in 3 seconds?"
- [ ] If not immediately clear: simplify further
- [ ] Check on both light and dark backgrounds
- [ ] Make sure text is readable in screenshot
- [ ] Push to Vercel → test on production
- [ ] Check events table for parent access

**Done = Parent can assess progress in <5 seconds, layout looks good in screenshots**

**Time Budget:** 3 hours (worth it - drives virality)

**Debug Budget:** 30 min for token validation issues

**CRITICAL:** If parent doesn't "get it" immediately, it's too complex. Simplify ruthlessly.

#### Hour 17-20: Landing Page (EMOTION-FIRST, RHYTHM MATTERS)
**Lead with urgency and feeling, not features.**

**Claude Code Prompt:**
```
Create landing page focused on emotional relief:

/app/page.tsx

Hero Section:
- Headline: "When classes stop, consistency shouldn't."
  * Alternative: "School's paused. Your momentum isn't."
  * Pick the one with better rhythm (test both)
- Subheadline: "Stay on track during the strike—and show your parents you're making progress."
- Visual: Screenshot of dashboard with progress bars + streak counter + "🔥 4-Day Streak"
- Primary CTA: "Feel On Track" (not "Get Started" or "Generate Plan")
- Secondary: "See How It Works" (smooth scroll to features)

Problem/Solution (3 cards):
1. For Students:
   - Pain: "Will I fall behind without teachers?"
   - Solution: "See your progress daily. Build momentum. Feel confident."
   - Visual: Progress bar animation or screenshot

2. For Parents:
   - Pain: "Is my kid studying or scrolling?"
   - Solution: "Check progress anytime. No nagging needed."
   - Visual: Parent dashboard screenshot

3. For Everyone:
   - Trust: "Alberta curriculum-aligned. Free forever."
   - Visual: Checkmark or curriculum badge

How It Works (3 steps with visuals):
1. "Get organized" → Generate plan (2 minutes)
2. "Build momentum" → Track daily, maintain streaks
3. "Share progress" → Parents see consistency (optional)

Social Proof:
- "Helping XXX Alberta students stay on track" (updates live)
- Testimonial slot (add after first users): "I finally feel on track"
- Parent testimonial: "Peace of mind without hovering"

FAQ (5 questions):
1. "What if the strike ends?" → Works for exam prep too
2. "Do parents have to see my progress?" → Sharing is optional
3. "Is this Alberta curriculum?" → Yes, official resources
4. "Does it cost anything?" → Free forever
5. "What if I fall behind?" → We show you're on track or need to catch up

Footer:
- Privacy Policy | Terms | Contact
- Built by Samuel (UofC student) [add photo]
- Not affiliated with Alberta Education

Use shadcn/ui, Tailwind.
Mobile-first design.
Skip fancy animations (launch speed > polish).
```

**You Do:**
- [ ] Test both headlines with 2-3 people: Which one hits harder?
- [ ] Replace stock copy with your authentic voice
- [ ] Add your photo + short bio ("I'm Samuel, a UofC student who...")
- [ ] Use REAL screenshots from your app (not mockups)
- [ ] Test CTA flow: click → auth modal → works
- [ ] Read it out loud: Does it flow naturally?
- [ ] Push to Vercel → test on production

**Done = Landing page communicates emotional value in <10 seconds**

**Time Budget:** 3 hours

**Debug Budget:** 30 min for layout issues

---

---

### **Phase 3: Content + Test + Launch (Hours 18-36)**
*Content: 8h | Test: 6h | Launch prep: 4h*

#### Hour 18-26: Curriculum Data (AI-Assisted)
**Strategy:** Start with 2 subjects completely, stub the rest

**Priority Order:**
1. Math 30-1 (COMPLETE - most requested)
2. English 30-1 (COMPLETE - most requested)
3. Biology 30, Chemistry 30, Physics 30, Social 30-1 (STUB - 5 units each)

**Claude Chat Prompt:**
```
Extract Math 30-1 curriculum from Alberta Education.

For each unit, provide:
- Unit ID (m30_1, m30_2, etc.)
- Unit title
- 3-5 topics
- Estimated hours
- 2 resource links per topic:
  * 1 Khan Academy or YouTube video
  * 1 Alberta Ed PDF or worksheet

Output as JSON array.
```

**You Do:**
- [ ] Get Math 30-1 complete (3 hours with AI help)
- [ ] Get English 30-1 complete (3 hours)
- [ ] Stub other subjects (30 min each = 2 hours)
- [ ] Spot-check 20% of links manually
- [ ] Add JSON files to /public/data/

**Done = 2 subjects fully usable, 4 subjects have placeholder content**

**Reality Check:** If curriculum takes >8 hours, launch with Math only and add subjects post-launch

#### Hour 26-32: Testing Blitz
**Smoke Test (DO THIS PATH ONLY):**

**On Laptop (Chrome):**
1. [ ] Go to steadytrack.ca
2. [ ] Click "Get Started"
3. [ ] Sign in with Google
4. [ ] Select Grade 12 + Math 30-1
5. [ ] Generate plan
6. [ ] View plan (verify it renders)
7. [ ] Check 2 units complete
8. [ ] See progress bar update
9. [ ] Generate parent share link
10. [ ] Copy link
11. [ ] Sign out

**On iPhone (Safari):**
12. [ ] Paste parent link (incognito/private)
13. [ ] Sign in as "parent" (different Google account)
14. [ ] View student progress
15. [ ] Verify progress matches

**Critical Bugs Only:**
- Can't sign in → Fix immediately
- Plan doesn't generate → Fix immediately
- Progress doesn't save → Fix immediately
- Parent link breaks → Fix immediately

**Minor Bugs (Log for Post-Launch):**
- Styling issues on mobile
- Typos in content
- Missing links
- Slow load times

**Done = Smoke test passes on 2 devices**

#### Hour 32-36: Deploy + Launch Prep
**Deploy Checklist:**
- [ ] Add steadytrack.ca to Vercel
- [ ] Configure Supabase redirect URLs for production
- [ ] Test production auth flow
- [ ] Add basic error page (404, 500)
- [ ] Add privacy policy (use AI-generated template)
- [ ] Add simple disclaimer on landing page

**Marketing Prep:**
- [ ] Take 5 screenshots (phone + laptop)
- [ ] Write Reddit post (authentic, not salesy)
- [ ] Write Facebook post (parent-focused)
- [ ] Pre-write Twitter thread
- [ ] Prepare email to friends/family

**Done = Production site works, marketing assets ready**

---

### **Hour 36: Launch** 🚀

#### Pre-Launch Check (15 min)
- [ ] Sign in works on production
- [ ] Generate plan works
- [ ] Progress saves
- [ ] Parent link works

**If ANY of these fail, fix before posting**

#### Post Everywhere (30 min)
- [ ] Reddit: r/alberta, r/Edmonton, r/Calgary
- [ ] Facebook: 5 parent groups
- [ ] Twitter: Thread with @ABEd tag
- [ ] Email: 20 people

#### Monitor (Hours 36-48)
- [ ] Reply to every comment <30 min
- [ ] Fix critical bugs <4 hours
- [ ] Screenshot positive feedback
- [ ] Track signups in Supabase dashboard

---

## 🧠 AI Utilization (Realistic)

### What AI Does Great (80% Success Rate)
- Scaffolding projects
- CRUD operations
- Form validation
- Basic UI components
- SQL migrations
- TypeScript types

### What AI Struggles With (50% Success Rate)
- OAuth flows (expect debugging)
- RLS policies (often too restrictive)
- Complex state management
- Race conditions
- Mobile responsive edge cases
- Real-time sync

### The 20-Minute Rule
**If you're debugging >20 minutes:**
1. Check if it's a critical path feature
2. If yes: Try AI fix prompt, search Stack Overflow, check docs
3. If no: Stub it with placeholder, move on

**Example:**
- Stuck on real-time sync for 30 min? → Cut it, use manual refresh
- Stuck on sign-in flow for 30 min? → Critical, must fix

### Prompt Patterns That Work
```bash
# Specific error fix
"Fix this error: [paste exact error]. Here's the code: [paste]. Keep existing functionality."

# Stub feature
"Create placeholder for [feature] that shows 'Coming soon' message."

# Quick win
"Add loading spinner to this button when async action runs."
```

### prompts.md File (Keep This)
```markdown
# Prompts That Worked

## Auth Setup
[paste successful auth prompt]

## Form Generation
[paste successful form prompt]

## Reuse patterns when building similar features
```

---

## 🔒 Auth Decision: Supabase Only

**Why Not Clerk:**
- Adds another service to manage
- More env vars
- Redundant with Supabase Auth
- Apple Sign In costs $99/year on Clerk

**Supabase Auth Advantages:**
- One dashboard (auth + database)
- Free Google OAuth
- Built-in session management
- RLS integrates naturally
- Can add Apple later if needed

**Setup (Supabase Dashboard):**
1. Authentication → Providers → Enable Google
2. Add redirect URL: `https://steadytrack.ca/auth/callback`
3. Done

---

## 🧪 Testing Reality

### What You CAN Test in 48 Hours
- One device smoke test (laptop + phone)
- Critical path only
- Auth, plan generation, progress, parent link

### What You CAN'T Test
- All subjects (test Math 30-1 only)
- All browsers (Chrome + Safari only)
- Edge cases (empty states, error handling)
- Performance under load
- Real-time sync across devices

### Accept This
- Minor bugs will exist
- Some links might be broken
- UI won't be perfect on all devices
- That's fine - you'll fix in v1.1

**Good Enough = Core loop works + no critical bugs**

---

## 💬 Marketing (Humanized)

### Reddit Post (Authentic Tone)
**Title:** "I built a free study tool to help Alberta students during the strike"

**Body:**
```
Hey r/alberta,

I'm a UofC student and today when the strike started, I saw classmates 
freaking out about falling behind. So I spent the weekend building 
SteadyTrack - a simple tool to help Grade 11-12 students stay on track.

What it does:
• Creates a 5-day study plan based on what subjects you're taking
• Links to free resources (Khan Academy, Alberta Ed, etc.)
• Tracks your progress
• Parents can monitor without hovering

It's completely free, no ads, and I'm not selling anything. I just 
wanted to help because I know how stressful this is, especially for 
people applying to university.

Try it: steadytrack.ca

It's not perfect (I built it fast), but it works and I'll keep 
improving it based on feedback.

Hope this helps some of you!

[Screenshot]
```

**Tone:** Helpful peer, not tech bro

### Response Strategy
**When people comment:**
- Thank them genuinely
- Answer questions directly
- If they report a bug: "Thanks! I'll fix this today."
- If they give feedback: "Great idea, adding to roadmap."

**Don't:**
- Over-promise features
- Argue with critics
- Get defensive about bugs
- Spam with links

---

## 📊 Metrics (Supabase Events Only)

### Track in Supabase Dashboard (Zero Config)

**Simple Query to See Everything:**
```sql
-- Real-time activity (last 24 hours)
SELECT 
  event_name, 
  count(*) as total,
  count(DISTINCT user_id) as unique_users
FROM events 
WHERE created_at > now() - interval '24 hours'
GROUP BY event_name
ORDER BY total DESC;

-- Results:
-- sign_in: 127 (83 unique users)
-- plan_created: 89 (71 unique users)
-- progress_updated: 342 (58 unique users)
-- parent_link_created: 23 (23 unique users)
-- parent_link_accessed: 15 (12 unique users)
```

**Key Metrics:**
1. **Signups** = Distinct user_ids in events table
2. **Activation** = Users with 'plan_created' event
3. **Engagement** = Users with 'progress_updated' event
4. **Parent Adoption** = Count of 'parent_link_created' events

**Dashboard View (Optional):**
Create simple `/app/admin/page.tsx` that queries events table:
- Total signups (auth.users count)
- Plans created today
- Progress updates today
- Most active users

**No Google Analytics, Mixpanel, Amplitude needed.**

### Optional: Add Feedback Route
```typescript
// /app/api/feedback/route.ts
export async function POST(request: Request) {
  const { message, userId } = await request.json();
  
  await supabase.from('feedback').insert({
    user_id: userId,
    message,
    created_at: new Date().toISOString()
  });
  
  return Response.json({ success: true });
}
```

One textarea: "What would make this better?"

**Result:** Qualitative + quantitative data in one place (Supabase)

---

## 🚨 Hour 36 Decision Point

**At Hour 36, assess:**

✅ **Ship if you have:**
- Working auth
- Plan generation (even if just Math 30-1)
- Progress tracking
- Basic landing page

❌ **Don't ship if:**
- Auth is completely broken
- Can't generate any plans
- Database isn't working

**If behind schedule at Hour 36:**
1. Cut parent dashboard → Add in v1.1
2. Launch with Math 30-1 only → Add subjects daily
3. Skip fancy UI → Black text on white works
4. Stub features with "Coming soon"

**Remember:** Working ugly MVP > perfect vaporware

---

## 🎯 Post-Launch (Hours 36-48)

### First 2 Hours After Launch
- Monitor Reddit comments every 15 min
- Respond to every comment
- Fix critical bugs immediately (Vercel deploys in 2 min)

### First 12 Hours
- Track signups (check Supabase dashboard)
- Collect positive feedback (screenshot for social proof)
- Note feature requests (spreadsheet or notes)
- Hot-fix only critical bugs

### Hour 48 Retrospective
**Ask:**
- What worked?
- What broke?
- What do users want most?
- What should v1.1 be?

**Plan v1.1 (Week 2):**
- Add most-requested feature
- Fix top 3 bugs
- Add 1-2 more subjects
- Improve mobile experience

---

## 💰 Total Budget

| Item | Cost |
|------|------|
| Domain (steadytrack.ca) | $15 |
| Supabase | $0 (free tier: 50k users) |
| Vercel | $0 (free tier) |
| Claude Pro (optional) | $20 |
| **TOTAL** | **$15-35** |

---

## ✅ Commander Checklist (Print This)

### Phase 1 (Hours 0-8) ✓ = Working
- [ ] ✓ Supabase project created
- [ ] ✓ **Deployed to Vercel** (Hour 1)
- [ ] ✓ Auth works (Google sign-in)
- [ ] ✓ Database tables exist
- [ ] ✓ Can create/read plan data
- [ ] ✓ **Loading skeletons added**
- [ ] ✓ **ErrorBoundary on all pages**
- [ ] ✓ **Analytics trackEvent() works**

### Phase 2 (Hours 8-18) ✓ = UI Functional
- [ ] ✓ Plan generator flow works
- [ ] ✓ Progress tracking saves
- [ ] ✓ Parent link generates
- [ ] ✓ Landing page renders
- [ ] ✓ **Deployed 4-5 times** (iterating live)
- [ ] ✓ **Events logged in Supabase**
- [ ] ✓ **Loading states everywhere**

### Phase 3 (Hours 18-36) ✓ = Launchable
- [ ] ✓ Math 30-1 content complete
- [ ] ✓ Smoke test passes (laptop + phone)
- [ ] ✓ Production deploy works
- [ ] ✓ Marketing posts ready
- [ ] ✓ **Can see traction in events table**
- [ ] ✓ **Error boundaries catch crashes**

### Hour 36 (Launch) ✓ = Live
- [ ] ✓ Post to Reddit
- [ ] ✓ Post to Facebook
- [ ] ✓ Tweet
- [ ] ✓ Email friends
- [ ] ✓ Monitor responses
- [ ] ✓ **Check events table every 30 min**
- [ ] ✓ **Hot-fix deploys in <5 min**

---

## 🔥 Final Reality Check

**What Will Happen:**
- AI will generate buggy code (20-30%)
- OAuth will break at least once
- You'll hit walls and want to debug deeply
- Some features won't work by Hour 36

**What You Must Do:**
- Stay in commander mode (triage, don't code)
- Cut features ruthlessly if behind
- Fix only critical path blockers
- Ship ugly working product over perfect nothing

**What Success Looks Like:**
- 50+ signups in first 24 hours
- Core loop works for most users
- Zero critical bugs (sign-in breaks, data loss)
- Some positive feedback

**You're Not Building:**
- Perfect product
- Bug-free experience
- Beautiful UI
- Complete curriculum

**You're Building:**
- Helpful tool
- Working core loop
- Foundation to iterate on
- Something students can use TODAY

---

## 💎 Quick Wins Impact Summary

These 4 optimizations add ~30 minutes total but transform the product:

| Optimization | Time Investment | User Impact | Your Benefit |
|--------------|----------------|-------------|--------------|
| **Loading Skeletons** | 5 min (one component) | App feels 3x faster | Fewer "is this working?" complaints |
| **Supabase Events** | 10 min (one table + helper) | None (invisible to users) | Real-time traction data without GA |
| **Error Boundaries** | 10 min (one component) | Crashes don't break everything | 50% fewer "it's broken" reports |
| **Deploy at Hour 1** | 5 min (connect Vercel) | Test on real URLs early | Find bugs early, trivial rollbacks |
| **TOTAL** | **30 minutes** | **Feels professional** | **Ship with confidence** |

### Why This Matters for 48-Hour Launch

**Without these:**
- Blank screens while loading (users think it's broken)
- No idea if anyone is using it (blind launch)
- One crash breaks entire app (critical bug)
- First deploy at Hour 36 (high stakes, scary)

**With these:**
- Instant feedback (users see progress)
- See signups in real-time (motivating)
- Graceful degradation (users can recover)
- Iterating live from Hour 1 (low stakes)

**ROI: 30 minutes → 10x confidence + professional feel**

---

**Current Time:** October 6, 2025, Evening  
**Launch:** October 8, 2025, Morning (36 hours away)  
**Status:** Commander mode activated

## Execute. 🎯

---

## 🆘 Emergency Quick Reference Card (Print This)

### Auth Broken? (Most Common)
```bash
1. Check: Supabase → Authentication → Logs
2. Look for: "redirect_uri_mismatch" 
3. Fix: Add exact URL to redirect whitelist
4. Test: Incognito window
5. Deploy: git push (90 sec)
```

### Data Not Saving?
```bash
1. Check: Supabase → Database → study_plans → Policies
2. Fix: ALTER TABLE study_plans DISABLE ROW LEVEL SECURITY;
3. Test: INSERT query in SQL editor
4. Deploy: Already fixed (DB change is live)
```

### Build Failing?
```bash
1. Check: npm run build output for errors
2. Common: Hydration mismatch or TypeScript error
3. Fix: Add 'use client' to component with useState
4. Test: npm run build succeeds
5. Deploy: git push
```

### App Crashes?
```bash
1. Check: Browser console for error
2. Fix: ErrorBoundary should catch it
3. If not caught: Wrap component in ErrorBoundary
4. Test: Reproduce error, see "Reload page" button
5. Deploy: git push
```

### Too Slow to Load?
```bash
1. Check: ls -lh public/data/*.json
2. If >1MB: Split file by subject
3. Update: Import paths in components
4. Test: npm run build (watch time)
5. Deploy: git push
```

### Can't Debug in 20 Min?
```bash
1. Stub feature: Show "Coming soon" message
2. Log issue: Add to GitHub issues
3. Move on: Ship without that feature
4. Fix later: Can deploy hot-fix post-launch
```

**Remember:** Working 80% > broken 100%. Ship it.

---

## 💭 How to Know If Emotional Positioning Is Working

### Signals You're Hitting The Right Notes

**For Students (Look for these behaviors):**
- ✅ They return daily (not just once)
- ✅ They check dashboard before checking plan (progress > planning)
- ✅ They complete at least one unit per session (taking action)
- ✅ They maintain streaks 3+ days (habit forming)
- ✅ Testimonials mention: "on track," "confident," "motivated," "less stressed"

**Red Flags:**
- ❌ Users generate plan but never mark progress (plan isn't the product)
- ❌ High signup but low return rate (no retention loop)
- ❌ Comments: "Cool tool but..." (missing emotional hook)

**For Parents (Look for these behaviors):**
- ✅ They check dashboard multiple times per week (ongoing reassurance)
- ✅ They share screenshots in groups (virality)
- ✅ Testimonials mention: "peace of mind," "can see progress," "no more nagging"
- ✅ They ask: "Can my other kid use this too?" (word of mouth)

**Red Flags:**
- ❌ Parent link generated but never accessed (feature without value)
- ❌ Parents check once and never return (not providing ongoing relief)
- ❌ Comments: "Interesting but..." (not solving pain)

### First 72 Hours: Watch For

**Hour 24 (First Day Post-Launch):**
- Are users returning the next day? (Retention signal)
- Are they marking progress or just browsing? (Engagement signal)
- Are any parents accessing dashboards? (Parent validation)

**Hour 48 (Day 2):**
- Do any users have 2-day streaks? (Habit loop starting)
- Are users checking progress or just plan? (What they value)
- Any parent testimonials yet? (Emotional payoff working)

**Hour 72 (Day 3):**
- Do any users have 3-day streaks? (Habit formed)
- Are parents checking regularly or just once? (Ongoing value)
- What are users saying in feedback? (Emotional language)

### Language to Listen For

**Student Testimonials That Signal Success:**
- "Finally I feel like I'm on track"
- "I know I'm not falling behind anymore"
- "Seeing my progress go up makes me want to keep going"
- "My parents can see I'm working without me having to explain"
- "The streak keeps me consistent"

**Parent Testimonials That Signal Success:**
- "I have peace of mind now"
- "I can see she's studying without hovering"
- "No more asking 'did you study today?'"
- "I can finally relax about the strike"
- "Other parents need to know about this"

**Red Flag Language:**
- "Cool tool" (not emotional)
- "Nice to have" (not solving pain)
- "Interesting but..." (missing the point)
- "I wish it had..." (focusing on features, not relief)

### Adjust Based on Feedback

**If students love plan generator but don't use progress:**
→ Make dashboard the default landing page after auth
→ Add interstitial: "Mark your progress to stay motivated"

**If parents access link once but don't return:**
→ Add weekly email summary ("Your child studied 4 days this week")
→ Make dashboard more visual/celebratory

**If users create streaks but lose motivation after 7 days:**
→ Add milestone celebrations at 2 weeks, 1 month
→ Add "You're ahead of schedule" messaging

**If engagement is high but parent sharing is low:**
→ Make share link more prominent
→ Add prompt: "Show your parents you're staying on track"

---
