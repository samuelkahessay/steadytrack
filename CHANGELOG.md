# Changelog

All notable changes to SteadyTrack are documented in this file.

## [1.0.0] - October 2025

### Initial Release

Complete MVP launch with all core features for Alberta students during teacher strike.

---

## Major Features

### Authentication & Onboarding
- ✅ Google OAuth integration via Supabase Auth
- ✅ OAuth callback handling with SSR support
- ✅ Session persistence across devices
- ✅ Grade selection (11 or 12)
- ✅ Subject selection (2-6 subjects)
- ✅ 5-day study plan generation

### Progress Tracking System
- ✅ Unit completion checklist
- ✅ Optimistic UI updates with rollback
- ✅ Undo functionality for mistakes
- ✅ Per-subject progress cards
- ✅ Weekly activity calendar
- ✅ Milestone detection (25%, 50%, 75%, 100%)

### Streak System
- ✅ Daily streak counter
- ✅ Longest streak tracking
- ✅ Dynamic motivational messaging:
  - 🔥 Active streak (green)
  - 🔥 Don't break your streak (orange)
  - ⚡ Start a new streak (red)
- ✅ Server-side streak calculation
- ✅ Automatic recalculation on undo

### Parent Dashboard
- ✅ Shareable read-only progress links
- ✅ Token-based authentication
- ✅ Screenshot-optimized layout
- ✅ Streak badge display
- ✅ Weekly summary visualization
- ✅ Subject progress overview
- ✅ Last updated timestamp

### UI/UX Components
- ✅ Custom toast notification system
  - Success (green)
  - Error (red)
  - Info (blue)
- ✅ Loading skeletons
- ✅ Error boundaries
- ✅ Responsive mobile-first design
- ✅ shadcn/ui component library

### Database & Backend
- ✅ 6 PostgreSQL tables via Supabase
- ✅ 4 RPC functions for server-side logic:
  - `mark_unit_complete()` - Atomic completion + streak update
  - `undo_unit_progress()` - Delete + recalculate streaks
  - `parent_dashboard_overview()` - Secure data fetch
  - `get_weekly_summary()` - Weekly stats
- ✅ Row-Level Security (RLS) enabled
- ✅ User data isolation
- ✅ Analytics event tracking

### Curriculum Data
- ✅ Math 30-1 (6 units, 40+ topics)
- ✅ English 30-1 (4 units, 30+ topics)
- ✅ Chemistry 30 (stub - 5 units)
- ✅ Physics 30 (stub - 5 units)
- ✅ Biology 30 (stub - 5 units)
- ✅ Social Studies 30-1 (stub - 5 units)

---

## Technical Implementation

### API Routes
- `POST /api/progress` - Mark unit complete
- `DELETE /api/progress` - Undo completion
- `POST /api/plan` - Generate study plan
- `POST /api/share-link` - Create parent access
- `POST /api/analytics` - Track events

### API Service Layer (`/lib/api/`)
- **plans.ts** - Study plan management
- **progress.ts** - Progress tracking functions
- **streaks.ts** - Streak calculations
- **sharing.ts** - Share link management
- **analytics.ts** - Event tracking
- **index.ts** - Central export point

### Key Optimizations
- Optimistic UI for instant feedback
- Server-side RPC functions for reliability
- Toast notifications for user engagement
- Atomic database operations
- Efficient streak recalculation algorithm

---

## Implementation History

### OAuth Fix (October 6)
**Problem**: OAuth callback error during Google sign-in
- Error: `Could not parse request body as JSON`
- Root cause: Improper cookie handling in callback route

**Solution**:
- Rewrote callback route with inline Supabase SSR client
- Proper cookie operations using `@supabase/ssr`
- Fixed redirect flow to onboarding/dashboard

**Files Modified**:
- `app/(auth)/callback/route.ts`
- `app/page.tsx` (new landing page)
- `components/auth/GoogleAuthButton.tsx` (loading state)

### Unit Completion Feature (October 6)
**Added**:
- Custom toast notification system
- Unit checklist component with optimistic updates
- Dashboard integration
- Loading states and error handling
- Milestone detection

**Files Created**:
- `components/ui/toast.tsx`
- `components/dashboard/UnitChecklistClient.tsx`

**Files Modified**:
- `app/layout.tsx` (ToastProvider)
- `app/(dashboard)/dashboard/page.tsx`

### Undo Functionality (October 6)
**Added**:
- Database RPC: `undo_unit_progress()`
- DELETE `/api/progress` endpoint
- Client-side undo logic in checkbox handler
- Streak recalculation from remaining dates
- Analytics: `progress_undone` event

**Algorithm**:
1. Delete progress record
2. Get all remaining completion dates
3. Find current streak (consecutive days ending today)
4. Find longest streak (max consecutive ever)
5. Update `study_streaks` table

**Files Modified**:
- `supabase-schema.sql` (new RPC function)
- `app/api/progress/route.ts` (DELETE endpoint)
- `components/dashboard/UnitChecklistClient.tsx`

### RLS Policies Enabled (October 6)
**Security Enhancement**:
- Row-Level Security enabled on all tables
- Users can only access own data
- RPC functions validate ownership
- Service role access for analytics

**Policies Created**:
- `profiles`: SELECT, INSERT, UPDATE own profile
- `study_plans`: Full CRUD on own plans
- `user_progress`: Full CRUD on own progress
- `study_streaks`: SELECT, INSERT, UPDATE own streaks
- `parent_access`: Manage own share links
- `events`: Authenticated insert only

### API Service Layer (October 7)
**Added**:
- Comprehensive client-side API layer
- Consistent `{ data, error }` pattern
- Type-safe function signatures
- Test helpers for development

**Terminology Updates**:
- Renamed `parent` → `share` (inclusive language)
- Updated event names and functions
- Backward-compatible exports

**Files Created**:
- `/lib/api/plans.ts`
- `/lib/api/streaks.ts`
- `/lib/api/analytics.ts`
- `/lib/api/index.ts`
- `/lib/api/README.md`

**Files Modified**:
- `/lib/api/progress.ts` (extended)
- `/lib/api/parent.ts` → `/lib/api/sharing.ts`
- `/lib/utils.ts` (added token generation)

### Analytics Integration (October 6)
**Added**:
- Vercel Analytics component
- Custom event tracking
- Page view monitoring
- Events tracked:
  - `sign_in`
  - `plan_created`
  - `progress_updated`
  - `progress_undone`
  - `share_link_created`
  - `share_link_accessed`

**Files Modified**:
- `app/layout.tsx` (Analytics component)

---

## Breaking Changes

### v1.0.0
- None (initial release)

---

## Known Issues & Limitations

### Streak Recalculation
- Expensive for users with 100+ completions
- **Future**: Add caching or query optimization

### Bulk Operations
- No "undo all today" feature
- Must uncheck units one by one
- **Future**: Batch undo functionality

### Offline Support
- Requires network connection
- No offline queue for updates
- **Future**: Progressive Web App (PWA) features

### Curriculum Coverage
- Full content: Math 30-1, English 30-1
- Stub content: Other diploma subjects
- **Future**: Complete all subject data

---

## Migration Guide

### From Development to Production

#### 1. Database Setup
```sql
-- Run in Supabase SQL Editor
-- Execute supabase-schema.sql
-- Verify RLS policies enabled
```

#### 2. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### 3. OAuth Configuration
- Add production callback URL in Supabase
- Format: `https://yourdomain.com/callback`

#### 4. Vercel Deployment
```bash
git push origin main
# Auto-deploys to Vercel
```

---

## Upcoming Features (Roadmap)

### Phase 2
- Email/SMS notifications
- Real-time sync (Supabase Realtime)
- Social features (study groups)
- AI-powered recommendations
- Bulk progress operations
- Enhanced analytics dashboard

### Phase 3
- Teacher admin portals
- Mobile native apps
- D2L/Google Classroom integration
- Advanced curriculum management
- Performance optimizations

---

## Performance Metrics

### Build Stats
- First Load JS: ~127 kB
- Build Time: ~12 seconds
- Static Pages: 15 routes
- TypeScript: Strict mode, zero errors

### Lighthouse Scores (Target)
- Performance: >90
- Accessibility: >90
- Best Practices: >90
- SEO: >90

---

## Credits

Built with:
- Next.js 15 (App Router)
- Supabase (Database & Auth)
- Tailwind CSS v4
- TypeScript
- shadcn/ui + Radix UI
- Vercel (Deployment)

Inspired by the Alberta teacher strike and the need to help students stay on track.

---

## License

MIT
