# SteadyTrack Architecture Overview

## Project Summary

SteadyTrack is a **local-first** Next.js 15 application that helps Alberta Grade 11-12 students track their study progress during the teacher strike. All user data is stored in the browser's localStorage with no authentication required.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix UI
- **Database**: Supabase (PostgreSQL) - **anonymous read-only content access only**
- **Authentication**: None (local-first, no user accounts)
- **User Data Storage**: Browser localStorage
- **Deployment**: Vercel

---

## Architecture Philosophy: Local-First

**Key Principle**: User data stays in the browser. No server-side user data storage.

### Data Flow

```
User Action → localStorage (via /lib/storage/*) → React state update → UI refresh
Content Fetch → Supabase (anonymous) → Curriculum display
```

### What Uses Supabase
- ✅ Curriculum content (microcards, units, outcomes) - read-only, anonymous
- ✅ Static reference data

### What Uses localStorage
- ✅ Study plans
- ✅ Progress tracking (completed units)
- ✅ Streaks
- ✅ Infinite mode sessions
- ✅ Quick check results
- ✅ Activity tracking
- ✅ User preferences

---

## Folder Structure

```
steadytrack/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard route group
│   │   ├── dashboard/page.tsx    # Student progress dashboard
│   │   ├── plan/[id]/page.tsx    # View plan
│   │   └── settings/page.tsx     # Settings (local data only)
│   ├── plan/new/                 # Plan creation flow
│   ├── learn/infinite/           # Infinite learn mode
│   ├── curriculum/               # Curriculum browser
│   ├── api/                      # API routes (content only)
│   │   ├── microcards/route.ts   # Fetch curriculum content
│   │   └── health/route.ts       # Health check
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── dashboard/                # Dashboard components
│   │   ├── StreakDisplay.tsx     # Streak counter
│   │   ├── SubjectProgressCard.tsx
│   │   ├── WeeklySummary.tsx
│   │   └── TodaysFocus.tsx
│   ├── landing/                  # Landing page components
│   └── legal/                    # Privacy/Terms components
│
├── lib/                          # Library code
│   ├── storage/                  # localStorage modules (core of local-first)
│   │   ├── local.ts              # Base localStorage wrapper with SSR guards
│   │   ├── plan.ts               # Study plan CRUD
│   │   ├── progress.ts           # Completion tracking
│   │   ├── streak.ts             # Timezone-safe streak logic
│   │   ├── infinite.ts           # Infinite mode sessions
│   │   ├── quick-checks.ts       # Quiz results
│   │   └── activity.ts           # Activity tracking
│   ├── supabase/                 # Supabase clients (content access only)
│   │   ├── client.ts             # Client Component access
│   │   └── server.ts             # Server Component access
│   ├── types.ts                  # TypeScript definitions
│   └── utils.ts                  # Utilities
│
├── data/curriculum/              # Curriculum JSON files
│   ├── math-30-1.json
│   ├── english-30-1.json
│   ├── chemistry-30.json
│   ├── physics-30.json
│   ├── biology-30.json
│   ├── social-30-1.json
│   └── index.ts                  # Curriculum loader
│
├── .env.local                    # Environment variables
├── .env.example                  # Template
└── README.md                     # Quick start guide
```

---

## localStorage Data Model

### Storage Keys

All data is namespaced with `steadytrack:` prefix to avoid conflicts.

```typescript
// Study Plans
'steadytrack:plan:current' → StoredPlan
'steadytrack:plan:history' → StoredPlan[]

// Progress Tracking
'steadytrack:progress:{planId}' → ProgressRecord[]

// Streaks
'steadytrack:streak' → StreakData

// Infinite Mode
'steadytrack:infinite:session' → InfiniteSession

// Quick Checks
'steadytrack:quick-checks:{subject}' → QuickCheckResults

// Activity Log
'steadytrack:activity' → ActivityEntry[]

// Preferences
'steadytrack:preferences' → UserPreferences
```

### Data Structures

**StoredPlan**
```typescript
{
  id: string;              // UUID
  subjects: string[];      // e.g., ["Math 30-1", "Biology 30"]
  schedule: {
    [date: string]: UnitAssignment[];
  };
  startDate: string;       // ISO date
  endDate: string;         // ISO date
  createdAt: string;       // ISO timestamp
  timezone: string;        // e.g., "America/Edmonton"
}
```

**ProgressRecord**
```typescript
{
  unitId: string;
  subject: string;
  completed: boolean;
  completedAt: string;     // ISO timestamp
}
```

**StreakData**
```typescript
{
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;   // ISO date
  totalStudyDays: number;
  timezone: string;
}
```

---

## localStorage Modules (`/lib/storage/*`)

### 1. `local.ts` - Base Storage Layer

Core wrapper with SSR safety guards. All other storage modules use this.

**Key Features:**
- Server-side rendering safety (returns null on server)
- JSON serialization/deserialization
- Error handling and fallbacks
- TypeScript type safety

```typescript
export function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}
```

### 2. `plan.ts` - Study Plan Management

```typescript
createPlan(subjects: string[], schedule: Schedule): StoredPlan
getCurrentPlan(): StoredPlan | null
updatePlan(planId: string, updates: Partial<StoredPlan>): void
deletePlan(planId: string): void
```

### 3. `progress.ts` - Completion Tracking

```typescript
markUnitComplete(planId: string, unitId: string, subject: string): void
undoUnitCompletion(planId: string, unitId: string): void
getProgress(planId: string): ProgressRecord[]
getCompletedUnits(planId: string): Set<string>
```

### 4. `streak.ts` - Timezone-Safe Streak Logic

**Critical:** All streak calculations use locked timezone to handle midnight crossings correctly.

```typescript
updateStreak(completedAt: Date, timezone: string): StreakData
getStreak(): StreakData
isStreakActive(): boolean
```

**Streak Rules:**
- Increments when completing first unit of a new day
- Resets if >24 hours since last study date
- Timezone-locked to prevent edge cases

### 5. `infinite.ts` - Infinite Learn Mode

```typescript
saveInfiniteSession(session: InfiniteSession): void
getInfiniteSession(): InfiniteSession | null
clearInfiniteSession(): void
```

### 6. `quick-checks.ts` - Quiz Results

```typescript
saveQuickCheckResult(subject: string, result: QuizResult): void
getQuickCheckHistory(subject: string): QuizResult[]
```

### 7. `activity.ts` - Activity Tracking

```typescript
logActivity(type: string, metadata: object): void
getActivityLog(): ActivityEntry[]
clearOldActivity(daysToKeep: number): void
```

---

## SSR Safety Pattern

**Problem:** localStorage is only available in the browser, not during server-side rendering.

**Solution:** All localStorage access is guarded:

```typescript
// ❌ WRONG - crashes on server
const plan = JSON.parse(localStorage.getItem('plan'));

// ✅ CORRECT - SSR safe
import { getItem } from '@/lib/storage/local';
const plan = getItem('steadytrack:plan:current', null);
```

**In React Components:**
```typescript
'use client'; // Mark as Client Component

import { useState, useEffect } from 'react';
import { getCurrentPlan } from '@/lib/storage/plan';

export function MyComponent() {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    // Only access localStorage after mount (client-side)
    setPlan(getCurrentPlan());
  }, []);

  if (!plan) return <div>Loading...</div>;
  return <div>{plan.subjects.join(', ')}</div>;
}
```

---

## Core User Flows

### 1. New User → Daily Habit

```
1. Land on homepage → Click "Create Your Study Plan"
2. Select grade (11 or 12)
3. Select subjects (2-6)
4. Generate plan → Saved to localStorage
5. Redirect to /dashboard
6. See "Start your first unit" → Check one unit
7. Toast: "🔥 Day 1 streak!" (stored in localStorage)
8. Next day: Return → "Don't break your streak!"
9. Day 3+: Growing progress bars + streak → Habit formed
```

### 2. Infinite Learn Mode

```
1. Click "Quick Learn" from landing page
2. Select subject
3. Swipe through TikTok-style cards
4. Session progress saved to localStorage
5. Return later → Resume from last card
```

### 3. Data Persistence

```
- User creates plan → Stored in localStorage
- User closes browser → Data persists
- User reopens → Data loads from localStorage
- User clears browser data → All data lost (expected behavior)
```

---

## Supabase Usage (Content Only)

### Anonymous Read-Only Access

Supabase is used ONLY for fetching curriculum content. No user data touches Supabase.

**Enabled Tables:**
- `content_microcards` - Quiz questions/answers
- `content_units` - Curriculum units (future)
- `content_outcomes` - Learning outcomes (future)

**RLS Policies:**
- Anonymous SELECT enabled on all content tables
- No INSERT/UPDATE/DELETE from client

**Client Configuration:**
```typescript
// lib/supabase/client.ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,  // No sessions
      autoRefreshToken: false // No tokens
    }
  }
);
```

---

## API Routes

### Content Access

**GET `/api/microcards`**
Fetch microcards for a subject (anonymous Supabase query)

```typescript
const { data } = await supabase
  .from('content_microcards')
  .select('*')
  .eq('subject', 'Math 30-1');

return NextResponse.json({ data });
```

**GET `/api/health`**
Health check endpoint

### No User Data Endpoints

- ❌ No `/api/progress` (localStorage handles this)
- ❌ No `/api/plan` (localStorage handles this)
- ❌ No `/api/streak` (localStorage handles this)
- ❌ No `/api/auth/*` (no authentication)

---

## Privacy & Data Model

### What Gets Stored Locally
- Study plans and schedules
- Completion timestamps
- Streaks and milestones
- Quiz results
- Preferences

### What Never Leaves the Browser
- Everything listed above
- No telemetry, no analytics, no tracking
- No account creation, no emails collected

### Data Export
Users can export their data as JSON from Settings page:

```typescript
// components/settings/ExportData.tsx
function exportData() {
  const data = {
    plan: getCurrentPlan(),
    progress: getProgress(),
    streak: getStreak()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'steadytrack-export.json';
  a.click();
}
```

---

## Cross-Tab Synchronization

**Challenge:** User has SteadyTrack open in two tabs. Changes in Tab A should reflect in Tab B.

**Solution:** `storage` event listener

```typescript
// hooks/useStorageSync.ts
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key?.startsWith('steadytrack:')) {
      // Reload affected state
      refreshPlan();
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

**Limitation:** `storage` event only fires in OTHER tabs, not the current one.

---

## Testing Strategy

### 1. localStorage Persistence
```bash
# Test: Create plan → Close tab → Reopen → Verify plan exists
npm run dev
# Manually test in browser
```

### 2. Streak Logic
```typescript
// tests/streak.test.ts
test('streak increments on new day', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const streak = updateStreak(yesterday.toISOString(), 'America/Edmonton');
  expect(streak.currentStreak).toBe(2);
});
```

### 3. SSR Safety
```bash
# Verify no localStorage access during build
npm run build
# Should complete without errors
```

### 4. Storage Disabled Fallback
```javascript
// Manually test with localStorage disabled
Object.defineProperty(window, 'localStorage', {
  value: null
});
```

App should show graceful error message.

---

## Migration from Old Architecture

SteadyTrack previously used Supabase Auth + server-side storage. We migrated to local-first in January 2025.

**What Changed:**
- ❌ Removed: Supabase Auth, Google OAuth, user accounts
- ❌ Removed: Server-side user data (study_plans, user_progress tables)
- ❌ Removed: Parent sharing (required auth)
- ✅ Added: localStorage modules in `/lib/storage/*`
- ✅ Added: SSR safety guards
- ✅ Added: Data export functionality

**Migration Scripts:** See `scripts/archive/` for historical migration tools.

---

## Deployment

### Environment Variables

```env
# Supabase (Content Access Only)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Config
NEXT_PUBLIC_APP_URL=https://steadytrack.ca
```

### Vercel Configuration

1. **Build Command:** `npm run build`
2. **Output Directory:** `.next`
3. **Environment Variables:** Add above vars to Vercel dashboard
4. **Edge Functions:** None required (local-first)

### Health Checks

- `/api/health` - Server health
- `/test/connection` - Supabase connection test (anonymous)

---

## Performance Considerations

### localStorage Limits
- **Quota:** ~5-10 MB per origin (browser dependent)
- **SteadyTrack Usage:** ~50-100 KB for typical user (6-month plan)
- **Monitoring:** Check `localStorage.length` in Settings

### Bundle Size
- Core app: ~385 KB First Load JS
- Dashboard: ~455 KB (includes charts)
- Infinite mode: ~302 KB

### Optimization Strategies
- Lazy load components with React.lazy()
- Compress curriculum JSON files
- Use Next.js Image optimization
- Implement service worker for offline support (future)

---

## Known Limitations

1. **Data Portability**: Switching browsers requires manual export/import
2. **No Cloud Backup**: User must manage their own backups
3. **Storage Quota**: Large plans (>1 year) may hit browser limits
4. **Private Browsing**: localStorage cleared on session end
5. **No Multi-Device Sync**: Each device has separate data

**Mitigations:**
- Clear export/import UI in Settings
- Warn users about private browsing mode
- Compress old activity logs to save space

---

## Future Enhancements

### Phase 2 (Optional Cloud Sync)
- Add optional account creation
- Cloud backup via Supabase
- Multi-device sync
- Keep local-first as default (cloud as opt-in)

### Phase 3 (Offline PWA)
- Service worker for full offline support
- Background sync when online
- Install as native app

### Phase 4 (Advanced Features)
- Study groups (requires cloud)
- Teacher portals (requires cloud)
- AI recommendations (requires cloud)

**Philosophy:** Local-first ALWAYS remains the default. Cloud features are opt-in enhancements.

---

## References

- [README.md](../README.md) - Project overview and quick start
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [CONTRIBUTING.md](../CONTRIBUTING.md) - PR workflow
- [Data Curriculum](../data/curriculum/) - Alberta curriculum JSON files
- [Storage Modules](../lib/storage/) - localStorage implementation

---

## Design Principles

### Local-First
- User owns their data
- No lock-in
- Privacy by default
- Works offline

### Students
- Make progress feel satisfying
- Show momentum visually
- Immediate feedback (toast notifications)
- Emotional messaging ("On track ✅" not just "82%")

### Mobile-First
- 50%+ users on phones
- Touch targets ≥44px
- Single-column layouts
- Readable text (16px min)

### Simplicity
- No signup friction
- Instant start
- Progressive disclosure
- Clear data export

---

## Support & Troubleshooting

### Common Issues

**Q: "My data disappeared!"**
A: Check if you're in private browsing mode. localStorage is cleared on session end.

**Q: "Can I use this on multiple devices?"**
A: Not currently. Each browser stores data independently. Use export/import to transfer.

**Q: "How do I backup my data?"**
A: Go to Settings → Export Data → Download JSON file

**Q: "What if I clear my browser data?"**
A: All SteadyTrack data will be lost. Export regularly if you want backups.

---

**Last Updated:** January 2025 (Local-First Migration)
**Architecture Version:** 2.0
**Previous Architecture:** See `docs/archive/ARCHITECTURE-v1.md` for auth-based version
