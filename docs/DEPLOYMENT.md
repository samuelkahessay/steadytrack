# SteadyTrack - Production Deployment Checklist

## 🚀 Pre-Deployment Steps

### 1. Database Setup (Supabase)

#### Run SQL Schema
- [ ] Open Supabase SQL Editor
- [ ] Copy entire `supabase-schema.sql` file
- [ ] Execute in Supabase (should show success)
- [ ] Verify all tables created:
  - [ ] `profiles`
  - [ ] `study_plans`
  - [ ] `user_progress`
  - [ ] `study_streaks`
  - [ ] `parent_access`
  - [ ] `events`

#### Verify RPC Functions
```sql
-- Check functions exist:
SELECT proname FROM pg_proc
WHERE proname IN (
  'mark_unit_complete',
  'undo_unit_progress',
  'parent_dashboard_overview',
  'get_weekly_summary'
);
```
Should return 4 rows.

#### Test RLS Policies
```sql
-- Check RLS is enabled:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```
All tables should show `rowsecurity = true`.

---

### 2. Authentication Setup (Supabase)

#### Google OAuth Configuration
- [ ] Go to Supabase Dashboard → Authentication → Providers
- [ ] Enable Google provider
- [ ] Add OAuth credentials:
  - [ ] Client ID (from Google Cloud Console)
  - [ ] Client Secret (from Google Cloud Console)

#### Redirect URLs
Add these to Supabase Auth settings:
- [ ] `http://localhost:3000/callback` (development)
- [ ] `https://your-domain.vercel.app/callback` (production)
- [ ] `https://your-custom-domain.com/callback` (if using custom domain)

#### Site URL
- [ ] Set in Supabase: `https://your-domain.vercel.app`

---

### 3. Environment Variables

#### Supabase (.env.local → Vercel)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key   # historical live setup only
```

#### Optional (for parent links)
```env
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

**Vercel Setup**:
- [ ] Copy `.env.local` values
- [ ] Go to Vercel → Project → Settings → Environment Variables
- [ ] Add each variable for Production, Preview, Development
- [ ] Redeploy after adding

---

### 4. Code Quality Checks

#### Build Test
```bash
npm run build
```
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All pages compile

#### Type Safety
- [ ] All `any` types removed
- [ ] Database types properly defined
- [ ] API responses typed

#### Performance
- [ ] Bundle size acceptable (<150 kB first load)
- [ ] No unnecessary re-renders
- [ ] Images optimized (if any)

---

### 5. Feature Testing

#### Authentication Flow
- [ ] Sign in with Google works
- [ ] Callback redirects correctly
- [ ] Session persists across refreshes
- [ ] Sign out works
- [ ] Account deletion works (removes user + cascades)

#### Onboarding
- [ ] Grade selection works (11 or 12)
- [ ] Subject selection (2-6 subjects)
- [ ] Plan generation completes
- [ ] Redirects to dashboard

#### Dashboard
- [ ] Streak Hero displays correctly
- [ ] Today's Focus shows next unit
- [ ] Unit checklist renders all units
- [ ] Weekly summary shows calendar
- [ ] Subject progress cards accurate

#### Unit Completion
- [ ] Clicking checkbox marks complete
- [ ] Optimistic update works
- [ ] Toast notification appears
- [ ] Streak updates correctly
- [ ] Progress cards update

#### Undo Feature
- [ ] Unchecking unit removes progress
- [ ] Streak recalculates correctly
- [ ] Toast shows "Progress undone"
- [ ] Dashboard refreshes

#### Parent Dashboard
- [ ] Generate share link works
- [ ] Copy link to clipboard works
- [ ] Opening link shows parent view
- [ ] Data displays correctly
- [ ] No edit capabilities (read-only)

#### Error Handling
- [ ] Network errors show toast
- [ ] Invalid data shows error
- [ ] Rollback on failure works
- [ ] User-friendly messages

---

### 6. Security Verification

#### RLS Policies
Test with different users:
- [ ] User A cannot see User B's data
- [ ] User A cannot modify User B's data
- [ ] Parent links require valid token
- [ ] Expired/invalid tokens fail gracefully

#### API Security
- [ ] All routes check authentication
- [ ] RPC functions validate ownership
- [ ] Error codes don't leak info
- [ ] Rate limiting (if implemented)

#### Data Validation
- [ ] Input validation on all forms
- [ ] SQL injection prevention (RLS + params)
- [ ] XSS prevention (React escapes by default)

---

### 7. Analytics & Monitoring

#### Vercel Analytics
- [ ] `<Analytics />` component added to layout
- [ ] Vercel project has analytics enabled
- [ ] Page views tracking works

#### Supabase Events
- [ ] `sign_in` event tracks
- [ ] `plan_created` event tracks
- [ ] `progress_updated` event tracks
- [ ] `progress_undone` event tracks
- [ ] `parent_link_created` event tracks
- [ ] `parent_link_accessed` event tracks

#### Error Logging
- [ ] Console errors in dev tools
- [ ] Supabase logs (Database → Logs)
- [ ] Vercel logs (Deployments → Logs)

---

### 8. Mobile Responsiveness

#### Test on Devices
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] iPad (tablet view)

#### Key Pages
- [ ] Landing page mobile layout
- [ ] Login page mobile layout
- [ ] Onboarding mobile layout
- [ ] Dashboard mobile layout
- [ ] Unit checklist mobile layout
- [ ] Parent dashboard mobile layout

#### Interactions
- [ ] Touch targets ≥44px
- [ ] Checkboxes easy to tap
- [ ] No horizontal scroll
- [ ] Text readable (≥16px)
- [ ] Toast notifications visible

---

### 9. Performance Optimization

#### Lighthouse Scores (Target)
- [ ] Performance: >90
- [ ] Accessibility: >90
- [ ] Best Practices: >90
- [ ] SEO: >90

#### Core Web Vitals
- [ ] LCP (Largest Contentful Paint): <2.5s
- [ ] FID (First Input Delay): <100ms
- [ ] CLS (Cumulative Layout Shift): <0.1

#### Optimization Checklist
- [ ] Images use Next.js Image component
- [ ] Fonts optimized (Geist loaded efficiently)
- [ ] No blocking scripts
- [ ] CSS minimal and scoped

---

## 📦 Deployment Steps (Vercel)

### Option 1: GitHub Integration (Recommended)

#### 1. Push to GitHub
```bash
git add .
git commit -m "Production ready deployment"
git push origin main
```

#### 2. Connect to Vercel
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Click "Add New Project"
- [ ] Import your GitHub repository
- [ ] Select repository: `steadytrack`

#### 3. Configure Project
- [ ] Framework Preset: Next.js (auto-detected)
- [ ] Root Directory: `./` (default)
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)

#### 4. Add Environment Variables
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Add `NEXT_PUBLIC_APP_URL` (optional)

#### 5. Deploy
- [ ] Click "Deploy"
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Visit deployment URL

---

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## ✅ Post-Deployment Verification

### 1. Smoke Tests

#### Homepage
- [ ] Visit production URL
- [ ] Landing page loads correctly
- [ ] "Get Started" button works
- [ ] Mobile view responsive

#### Authentication
- [ ] Click "Get Started"
- [ ] Redirects to `/login`
- [ ] Click "Continue with Google"
- [ ] Google OAuth popup appears
- [ ] After login, redirects to `/onboarding` or `/dashboard`

#### Complete User Flow
- [ ] Sign in with Google
- [ ] Complete onboarding (grade + subjects)
- [ ] See dashboard with empty progress
- [ ] Complete a unit
- [ ] See streak = 1
- [ ] See toast notification
- [ ] Refresh page, streak persists
- [ ] Undo unit completion
- [ ] See streak = 0
- [ ] Generate parent link
- [ ] Open parent link in new tab/incognito
- [ ] See parent dashboard

### 2. Database Health

#### Check Supabase Dashboard
- [ ] View `profiles` table → has new users
- [ ] View `study_plans` table → has plans
- [ ] View `user_progress` table → has completions
- [ ] View `study_streaks` table → has streaks
- [ ] View `events` table → has analytics events

#### Verify RPC Calls
- [ ] Check Supabase Logs for RPC calls
- [ ] No errors in logs
- [ ] Response times <500ms

### 3. Performance Check

#### Vercel Analytics
- [ ] Go to Vercel → Analytics
- [ ] See page views
- [ ] Check Core Web Vitals
- [ ] Review performance scores

#### Load Test (Optional)
- [ ] Use [PageSpeed Insights](https://pagespeed.web.dev/)
- [ ] Test production URL
- [ ] Verify scores >90

---

## 🐛 Common Issues & Solutions

### Issue 1: OAuth Redirect Error
**Symptom**: "Invalid redirect URL" after Google sign-in

**Solution**:
1. Check Supabase Auth → URL Configuration
2. Add production URL to redirect whitelist
3. Format: `https://your-domain.vercel.app/callback`
4. Redeploy

---

### Issue 2: RLS Policy Blocking Queries
**Symptom**: "Row-level security policy violation" errors

**Solution**:
1. Check Supabase Logs for specific policy
2. Verify `auth.uid()` is set (user authenticated)
3. Check policy conditions match query
4. Test with `service_role` key temporarily (not for production!)

---

### Issue 3: Environment Variables Not Working
**Symptom**: Supabase client errors, blank data

**Solution**:
1. Verify variables in Vercel Settings
2. Check variable names start with `NEXT_PUBLIC_`
3. Redeploy after adding variables
4. Clear browser cache

---

### Issue 4: Build Fails on Vercel
**Symptom**: Build errors in Vercel deployment logs

**Solution**:
1. Run `npm run build` locally
2. Fix any TypeScript/ESLint errors
3. Commit and push fixes
4. Vercel auto-deploys on push

---

### Issue 5: Toast Notifications Not Showing
**Symptom**: No toast after unit completion

**Solution**:
1. Check `<ToastProvider>` in `app/layout.tsx`
2. Verify `useToast()` hook called in client component
3. Check browser console for errors
4. Ensure component is client-side (`'use client'`)

---

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Vercel deployment status (green)
- [ ] Supabase uptime (99.9%+)
- [ ] Error logs empty (or minimal)

### Weekly Checks
- [ ] User signups trending up
- [ ] Active users (DAU/WAU)
- [ ] Streak retention (>40% Day 2 return)
- [ ] Parent link usage (>20% generated)

### Monthly Checks
- [ ] Database size (<1GB for MVP)
- [ ] API response times (<500ms avg)
- [ ] Performance scores (>90)
- [ ] Security updates (dependencies)

### Alerts to Set Up
- [ ] Vercel deployment failures → Email/Slack
- [ ] Supabase errors → Email
- [ ] Database approaching limits → Email
- [ ] Performance degradation → Email

---

## 🎯 Success Metrics (Week 1)

### Signups & Activation
- [ ] 100+ authenticated users
- [ ] 70%+ complete onboarding
- [ ] 70%+ mark at least one unit

### Retention
- [ ] 40%+ return Day 2
- [ ] 25%+ return Day 7
- [ ] 30%+ maintain 3+ day streaks

### Parent Adoption
- [ ] 20%+ generate parent links
- [ ] 70%+ of links accessed
- [ ] 5+ parent dashboard screenshots shared

### Emotional Validation
- [ ] 5+ testimonials mentioning "on track"
- [ ] 3+ testimonials mentioning "peace of mind"
- [ ] Positive feedback in social media

---

## 🚀 Launch Checklist

### Pre-Launch (Day Before)
- [ ] All deployment steps completed
- [ ] All smoke tests passed
- [ ] Team has production access
- [ ] Support plan ready (how to handle issues)

### Launch Day
- [ ] Monitor Vercel deployment (green status)
- [ ] Watch Supabase logs (no errors)
- [ ] Check first signups working
- [ ] Test full user flow live
- [ ] Respond to feedback quickly

### Post-Launch (First Week)
- [ ] Daily metrics review
- [ ] Fix critical bugs immediately
- [ ] Collect user feedback
- [ ] Iterate on pain points
- [ ] Plan next features

---

## 📝 Final Verification

Before marking deployment complete:

- [ ] ✅ Build passes (`npm run build`)
- [ ] ✅ All environment variables set
- [ ] ✅ Supabase schema deployed
- [ ] ✅ RLS policies enabled
- [ ] ✅ Google OAuth configured
- [ ] ✅ Vercel deployment live
- [ ] ✅ Analytics tracking
- [ ] ✅ Mobile responsive
- [ ] ✅ All features working
- [ ] ✅ Error handling robust
- [ ] ✅ Performance >90
- [ ] ✅ Security verified

---

## 🎉 You're Ready to Launch!

**Production URL**: `https://your-domain.vercel.app`

**What to do next**:
1. Share with beta testers
2. Monitor analytics closely
3. Collect feedback
4. Iterate and improve

**Remember**: Launch is just the beginning. Keep iterating based on user feedback and data! 🚀

---

## 📞 Support Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Next.js Discord](https://discord.gg/nextjs)

**Good luck with your launch!** 🎊
