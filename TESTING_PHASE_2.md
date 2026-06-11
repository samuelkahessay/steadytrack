# Phase 2 Testing Plan: Auth Removal

## Current Status

**Phase 1 (localStorage):** ✅ Complete
**Phase 2 (Auth Removal):** ✅ Complete
**Phase 3 (API Routes):** ⏳ Required for full testing

---

## What Can Be Tested Now

### ✅ Phase 1: localStorage Infrastructure

**Test Page:** `/test/storage`

```bash
npm run dev
# Visit: http://localhost:3000/test/storage
```

**Tests to run (in order):**
1. ✅ Create Plan → Should create and store plan
2. ✅ Get Plan → Should retrieve plan
3. ✅ Mark Unit Complete → Should track completion
4. ✅ Get Progress → Should show 10% complete
5. ✅ Increment Streak → Should start 1-day streak
6. ✅ Get Streak → Should show current streak
7. ✅ Create Session → Should create infinite learning session
8. ✅ Add Quick Check → Should record quiz result (UUID fixed)
9. ✅ Check Storage Size → Should show ~2-3KB usage
10. ✅ Export Data → Should dump all localStorage as JSON
11. ✅ Clear All → Should wipe everything

**NEW Activity Tracking (tests 12-14):**
12. ✅ Record Resource View → Should increment streak
13. ✅ Record Quick Check → Streak stays same (already counted today)
14. ✅ Get Activity Summary → Shows all tracked activity

**Manual DevTools Check:**
- Open DevTools → Application → Local Storage
- Should see keys: `steadytrack:v1:plan`, `steadytrack:v1:streak`, etc.
- All data persists after refresh
- Cross-tab sync: Open 2 tabs, update in one, see in other

---

### ✅ Phase 2: Auth Removal

**Middleware Test:**
```bash
# All routes should be accessible (no redirects to /login)
curl http://localhost:3000/dashboard  # Should load (not redirect)
curl http://localhost:3000/plan/new   # Should load
curl http://localhost:3000/settings   # Should load
```

**Deleted Pages Test:**
```bash
# These should 404 (correctly deleted)
curl http://localhost:3000/login                    # 404
curl http://localhost:3000/auth/callback           # 404
curl http://localhost:3000/auth/callback/infinite  # 404
```

**Supabase Anonymous Access:**
- Client should work for reading public content
- No auth, no sessions, no cookies

---

## What CANNOT Be Tested Yet (Needs Phase 3)

### ❌ API Routes (Use Old Auth)

These routes will **fail with TypeScript errors** until Phase 3:

**Auth-dependent routes to remove/update:**
- `/api/account/delete` - Uses `withAuthRateLimit` + admin client
- `/api/account/export` - Uses `withAuthRateLimit`
- `/api/activity` - Uses `withAuthRateLimit`
- `/api/analytics` - Uses admin client + `getUserIdFromRequest`
- `/api/plan` - Uses `withAuthRateLimit`
- `/api/plan/merge-guest` - Uses `withAuthRateLimit`
- `/api/plan/migrate-guest` - Uses `withAuthRateLimit`
- `/api/progress` - Uses `withAuthRateLimit`
- `/api/progress/bulk` - Uses `withAuthRateLimit`
- `/api/resource-progress` - Uses `withAuthRateLimit`
- `/api/resource-progress/start` - Uses `withAuthRateLimit`
- `/api/share-link/**` - All sharing endpoints (will be removed)
- `/api/infinite-feed/feedback` - Uses `getUserIdFromRequest`

**What Phase 3 will do:**
1. **Remove** auth-dependent routes (account, sharing, etc.)
2. **Simplify** content routes to use `withApi()` instead
3. **Update** rate limiting to use `withApiRateLimit()` (IP-based)

---

## TypeScript Errors (Expected)

Current `tsc --noEmit` shows ~50+ errors from:
1. ❌ API routes using `withAuthRateLimit` → Will fix in Phase 3
2. ❌ API routes using `AuthContext` → Will fix in Phase 3
3. ❌ API routes importing deleted `admin.ts` → Will fix in Phase 3
4. ❌ Stale `.next` cache → ✅ **FIXED** (cache cleared)

**These are expected and will be resolved in Phase 3.**

---

## Quick Smoke Test

### Test Phase 1 + 2 Together

```bash
# 1. Clear cache (done)
rm -rf .next

# 2. Start dev server
npm run dev

# 3. Test localStorage infrastructure
open http://localhost:3000/test/storage
# Run tests 1-14 in order
# All should pass ✅

# 4. Test auth removal
# Visit dashboard (should load without login redirect)
open http://localhost:3000/dashboard

# 5. Check DevTools
# Application → Local Storage → steadytrack:v1:*
# Should see all your test data
```

---

## What's Working Now

✅ **localStorage Layer:**
- Plan storage
- Progress tracking
- Streak calculations
- Infinite learning sessions
- Quick check results
- Activity tracking (ANY activity counts)
- Export/import functionality
- Cross-tab sync

✅ **Auth Removal:**
- No login page
- No auth callbacks
- No middleware checks
- No session cookies
- Anonymous Supabase client only
- Simplified API helpers

❌ **What's Broken (Expected):**
- API routes (Phase 3 will fix)
- UI using API routes (Phase 4 will fix)
- React Query hooks (Phase 3 will fix)

---

## Next Steps

1. **Phase 3:** Update API routes & React Query hooks
2. **Phase 4:** Update UI to use localStorage
3. **Phase 5:** Convert infinite learning
4. **Phase 7:** Add export/import UI
5. **Phase 8:** Full integration testing

---

## Test Checklist

**Phase 1 localStorage:**
- [ ] Test page loads at `/test/storage`
- [ ] Can create plan
- [ ] Can mark progress
- [ ] Can increment streak
- [ ] Data persists after refresh
- [ ] Activity tracking works (new tests 12-14)
- [ ] Export/import works
- [ ] Cross-tab sync works

**Phase 2 Auth Removal:**
- [ ] Dashboard loads without login
- [ ] No redirects to /login
- [ ] Login page returns 404
- [ ] Auth callbacks return 404
- [ ] Supabase client is anonymous
- [ ] Middleware is pass-through

**Known Issues (To Fix in Phase 3):**
- [ ] TypeScript errors in API routes (~50 errors)
- [ ] API routes using old auth wrappers
- [ ] Some routes need removal (account, sharing)
