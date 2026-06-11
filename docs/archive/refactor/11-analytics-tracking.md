# Feature Analysis: Analytics & Event Tracking

**Priority:** P3-Low | **Complexity:** ⭐⭐ (2/5) | **Effort:** 3-4 hours

## 1. Files Involved

```
app/api/analytics/
└── route.ts - Log custom events

app/api/activity/
└── route.ts - Get/update user activity stats

lib/guest/
└── analytics.ts - Guest event tracking (no auth)

lib/analytics/ (may exist)
└── track.ts - Helper functions for tracking

// Analytics integrated into:
- app/api/plan/route.ts (plan_created event)
- app/api/progress/route.ts (progress_updated event)
- app/(auth)/callback/route.ts (sign_in event)
- components/guest/ (guest-specific events)
```

## 2. Database Table

```sql
events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for guest events
  event_name TEXT NOT NULL,
  event_data JSONB, -- Flexible event metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Indexes
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_name ON events(event_name);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
```

## 3. Event Types Tracked

```typescript
// Authenticated Events
'sign_in' - { method: 'google' }
'plan_created' - { grade, subjectCount, durationWeeks }
'plan_regenerated' - { reset, subjectCount }
'progress_updated' - { subject, unitId, milestone }
'progress_undone' - { subject, unitId }
'quick_check_submitted' - { outcomeCode, correct }
'resource_completed' - { unitId, resourceUrl }
'share_link_generated' - {}
'account_deleted' - {}

// Guest Events
'guest_plan_created' - { grade, subjectCount, durationWeeks }
'guest_migration_started' - { hasExistingPlan }
'guest_migration_conflict' - { resolution: 'merge' | 'replace' | 'keep' }
'guest_merge_started' - { guestUnits, existingUnits }
```

## 4. Copy vs Refactor

**✅ Copy As-Is:**
- Analytics API routes (simple)
- Guest analytics utility (simple)

**🔧 Minor Improvements:**
- Create unified `track()` function for both auth + guest
- Add TypeScript types for all events
- Consider analytics provider integration (Vercel Analytics, Plausible, etc.)

## 5. New File Structure

```
src/
├── app/api/
│   ├── analytics/route.ts ✅
│   └── activity/route.ts ✅
│
└── lib/analytics/
    ├── track.ts 🆕 (unified tracking function)
    ├── events.ts 🆕 (event type definitions)
    └── guest.ts ✅ (copy from lib/guest/analytics.ts)
```

## 6. Unified Tracking Function

```typescript
// lib/analytics/track.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function track(
  supabase: SupabaseClient,
  eventName: string,
  eventData?: Record<string, unknown>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('events').insert({
      user_id: user?.id ?? null, // Null for guest events
      event_name: eventName,
      event_data: eventData ?? {}
    });
  } catch (error) {
    // Fail silently - don't block UX for analytics errors
    console.error('Analytics tracking error:', error);
  }
}

// Usage
await track(supabase, 'plan_created', { grade: 11, subjects: 3 });
```

## 7. Event Type Definitions

```typescript
// lib/analytics/events.ts
export interface EventMap {
  sign_in: { method: 'google' };
  plan_created: { grade: number; subjectCount: number; durationWeeks: number };
  plan_regenerated: { reset: boolean; subjectCount: number };
  progress_updated: { subject: string; unitId: string; milestone?: number };
  progress_undone: { subject: string; unitId: string };
  quick_check_submitted: { outcomeCode: string; correct: boolean };
  resource_completed: { unitId: string; resourceUrl: string };
  share_link_generated: {};
  account_deleted: {};
  guest_plan_created: { grade: number; subjectCount: number; durationWeeks: number };
  guest_migration_started: { hasExistingPlan: boolean };
  guest_migration_conflict: { resolution: 'merge' | 'replace' | 'keep' };
  guest_merge_started: { guestUnits: number; existingUnits: number };
}

export type EventName = keyof EventMap;
export type EventData<T extends EventName> = EventMap[T];

// Type-safe track function
export async function trackTyped<T extends EventName>(
  supabase: SupabaseClient,
  eventName: T,
  eventData: EventData<T>
) {
  return track(supabase, eventName, eventData);
}
```

## 8. Porting Guide (3 hours)

### Phase 1: Core Analytics (1 hour)
1. Copy API routes:
```bash
cp app/api/analytics/route.ts NEW_PROJECT/app/api/analytics/
cp app/api/activity/route.ts NEW_PROJECT/app/api/activity/
```

2. Copy guest analytics:
```bash
cp lib/guest/analytics.ts NEW_PROJECT/lib/analytics/guest.ts
```

### Phase 2: Unified Tracking (1 hour)
1. Create `lib/analytics/track.ts` (unified function)
2. Create `lib/analytics/events.ts` (type definitions)
3. Update all existing tracking calls to use new functions

### Phase 3: Integration (1 hour)
Replace inline tracking with unified function:

**Before:**
```typescript
// Inline in app/api/plan/route.ts
await supabase.from('events').insert({
  user_id: userId,
  event_name: 'plan_created',
  event_data: { grade, subjects: subjects.length }
});
```

**After:**
```typescript
// Using unified function
import { trackTyped } from '@/lib/analytics/track';

await trackTyped(supabase, 'plan_created', {
  grade,
  subjectCount: subjects.length,
  durationWeeks
});
```

## 9. Optional: Third-Party Analytics Integration

```typescript
// lib/analytics/providers.ts
export const analytics = {
  track: (eventName: string, properties?: Record<string, unknown>) => {
    // Vercel Analytics
    if (typeof window !== 'undefined' && window.va) {
      window.va('event', eventName, properties);
    }

    // Google Analytics (if needed)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, properties);
    }

    // Custom analytics (Supabase)
    // Handled by track() function
  }
};
```

## 10. Testing Checklist

- [ ] Events save to `events` table
- [ ] Guest events tracked (user_id NULL)
- [ ] Auth events tracked (user_id populated)
- [ ] Event data structure correct (JSON valid)
- [ ] No errors block main UX (fail silently)
- [ ] Type-safe tracking works (TypeScript)

## 11. Analytics Queries (For Reporting)

```sql
-- Most common events
SELECT event_name, COUNT(*) as count
FROM events
GROUP BY event_name
ORDER BY count DESC;

-- Events by day (last 30 days)
SELECT DATE(created_at) as date, event_name, COUNT(*) as count
FROM events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), event_name
ORDER BY date DESC;

-- User activity summary
SELECT
  user_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM events
WHERE user_id IS NOT NULL
GROUP BY user_id;
```

## 12. Success Criteria

✅ All user actions tracked to events table
✅ Guest events tracked (user_id NULL)
✅ Type-safe tracking with TypeScript
✅ Analytics don't block main UX (fail silently)
✅ Event data structure consistent

---

## Final Summary: All 11 Features Documented

**P0-Critical (Foundation & Core):**
1. ✅ Authentication and Profiles
2. ✅ Study Plan Creation
3. ✅ Student Dashboard & Progress

**P1-High (Enhanced Learning):**
4. ✅ Curriculum Browser
5. ✅ Microcards & Quick Checks
6. ✅ Resource Progress Tracking

**P2-Medium (Sharing & Multi-User):**
7. ✅ Parent Dashboard Sharing
8. ✅ Guest Mode
9. ✅ Settings & Account Management
10. ✅ Study Mode

**P3-Low (Polish):**
11. ✅ Analytics & Tracking

**Total Estimated Effort:** 80-100 hours (8-10 days full-time)

---

**All feature analysis documents completed!** Each document provides:
1. Complete file inventory
2. Copy vs refactor analysis
3. New file structure
4. Supabase queries & optimizations
5. Step-by-step porting guide
6. Testing checklists
7. Success criteria

These documents serve as **portable action plans** for systematic incremental refactoring.
