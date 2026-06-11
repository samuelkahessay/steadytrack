# Product Requirements Document — SteadyTrack

**Version:** 1.0  
**Date:** October 6, 2025  
**Status:** Pre-Development (48-hour sprint)  
**Owner:** Samuel Kahessay

---

## 1. Overview

### Problem Statement
The Alberta teacher strike (started October 6, 2025) has disrupted ~150,000 Grade 11-12 students. Without classroom instruction, feedback, or accountability:
- **Students** experience uncertainty: "Am I doing enough? Will I fall behind?"
- **Parents** lack visibility: "Is my child studying or wasting time?"
- Existing resources (Alberta Ed toolkits, Khan Academy) provide content but no structure or progress tracking

### Solution
SteadyTrack is a web-based momentum engine that helps students **feel on track** and gives parents **peace of mind** through:
- Daily progress tracking with streak-based accountability
- Visual feedback confirming students are making meaningful progress
- Parent dashboard showing consistency without hovering
- Alberta curriculum-aligned study resources

### Core Insight
Students don't need elaborate study plans—they need emotional reassurance they're progressing. Parents don't need detailed analytics—they need simple proof their child is studying consistently.

### Success Definition (48-Hour MVP)
**Functional:** Auth works, plans generate, progress persists, parent links function  
**Emotional:** Students feel "on track," parents feel reassured  
**Engagement:** 100+ signups, 40% Day 2 return rate, 10+ parent links accessed, 5+ testimonials mentioning "on track" or "peace of mind"

---

## 2. Target Users

### Primary: Grade 11-12 Students
**Profile:** University-bound students (16-18 years old) facing diploma exam pressure without teacher support  
**Core Need:** Daily reassurance they're making adequate progress toward exam readiness  
**Pain Points:**
- No external feedback loop (teachers not providing guidance)
- Fear of falling behind peers in other provinces
- Difficulty maintaining self-discipline and structure

**Job-to-Be-Done:** "Help me feel confident I'm studying enough and staying on track for university admission"

**Key Actions:**
1. Mark units complete
2. Check progress daily
3. Maintain study streaks
4. (Optional) Share progress with parents

**Value Received:** Visible momentum, daily motivation, reduced anxiety about falling behind

---

### Secondary: Parents of Grade 11-12 Students
**Profile:** Working parents concerned about strike impact on university preparation  
**Core Need:** Visibility into child's study consistency without constant check-ins  
**Pain Points:**
- Worry about wasted strike weeks
- Unable to verify studying without nagging
- Lack of expertise to guide curriculum

**Job-to-Be-Done:** "Show me my child is staying consistent without me having to ask"

**Key Actions:**
1. Open shared progress link
2. Check weekly summary
3. See study streak status
4. (Optional) Share dashboard screenshot with other parents

**Value Received:** Peace of mind, conversation starter with child, social proof to share

---

## 3. Core Product Objectives

### Functional Goals
- Enable students to track progress across 2-6 Alberta curriculum subjects
- Provide curated resource links (Khan Academy, Alberta Ed materials)
- Support cross-device access (sync via database)
- Allow parent monitoring via shareable links

### Emotional Goals
- **Students:** Feel daily momentum and "on track" reassurance
- **Parents:** Experience relief and confidence in child's consistency
- **Both:** Reduce strike-related anxiety through visible accountability

### Engagement Goals
- **Retention:** Students return daily to maintain streaks
- **Habit Formation:** 30% of users build 3+ day streaks within first week
- **Virality:** Parents share dashboard screenshots in Facebook groups

---

## 4. Core Features (Priority Matrix)

| Feature | Purpose | Priority | Definition of Done |
|---------|---------|----------|-------------------|
| **Google OAuth** | User authentication, cross-device sync | P0 (Must Ship) | Sign in works on localhost + production, sessions persist |
| **Progress Dashboard** | Core retention loop: streaks + visual progress | P0 (Must Ship) | Users can check units, see progress bars, streak counter updates, toast notifications appear |
| **Streak Tracking** | Daily habit formation and accountability | P0 (Must Ship) | Auto-increments on activity, resets if skipped day, shows "Don't break your streak" or "Start a new streak" messages |
| **Parent Dashboard** | Virality driver: screenshot-worthy progress view | P0 (Must Ship) | Token-based access works, shows weekly summary + streak badge + progress bars, readable in 3 seconds |
| **Plan Generator** | Onboarding: quick organization step | P1 (Required) | Users select grade + subjects, 5-day plan generates, redirects to dashboard |
| **Landing Page** | Conversion: communicate emotional value | P1 (Required) | Headline tests well, CTA triggers auth, screenshots visible, mobile-responsive |
| **Resource Library** | Support: curated learning links | P2 (Nice-to-Have) | Accordion by subject, 2-3 links per topic, Math 30-1 complete |
| **Study Pulse Metric** | Parent reassurance: consistency percentage | P3 (Optional) | Shows "X of last 4 days (Y%)" on both dashboards, only if time permits at Hour 32 |

---

## 5. Feature Details

### 5.1 Progress Dashboard (THE HERO FEATURE)
**Emotional Job:** "Am I doing enough?"  
**Components:**
- **Streak Hero Section** (dynamic messaging):
  - Active streak: "🔥 X-Day Streak! You're crushing it!" (green)
  - Not studied today: "🔥 Don't break your X-day streak!" (orange/urgent)
  - Broken streak: "⚡ Start a new streak! Study one unit today." (red)
- **Subject Progress Cards:**
  - Animated progress bars (0-100%)
  - Status badges: "✅ On track" (>70%), "⚠️ Pick up the pace" (<50%), "🎉 Complete!" (100%)
  - Units completed vs. total
- **Weekly Summary:**
  - Visual day checkmarks (Mon ✓ Tue ✓ Wed ✗...)
  - Total units completed this week
- **Today's Focus Widget:**
  - Single suggested unit (~45 min)
  - CTA: "Start Now"
- **Immediate Feedback:**
  - Toast notification on unit completion: "🔥 Day X streak!"
  - Celebration modals at milestones (25%, 50%, 75%, 100%)
  - Optimistic UI (checkbox fills instantly)

**Success Metric:** Users return daily to see progress rise

---

### 5.2 Parent Dashboard (VIRALITY ENGINE)
**Emotional Job:** "Is my child studying?"  
**Design Principle:** Clarity over fancy—screenshot-first layout  
**Components:**
- **Streak Badge** (large, prominent): "🔥 4-Day Study Streak"
- **Weekly Summary:**
  - Days studied: Mon ✓ Tue ✓ Wed ✗ Thu ✓ Fri ✓
  - Units completed: 7 units
  - Study consistency: 75% (if Study Pulse enabled)
  - Reassurance line: "On track for diploma prep ✅"
- **Subject Progress:**
  - Simple progress bars (no animations)
  - Status indicators per subject
- **Metadata:**
  - "Last updated: X hours ago"
  - Read-only (no edit capabilities)

**Technical Notes:**
- NO animations or transitions (clarity is king)
- High contrast, large text (readable in screenshots)
- Must be understood in <5 seconds

**Success Metric:** Parents share screenshots in Facebook groups

---

### 5.3 Streak Tracking System
**Logic:**
- Auto-increments when user completes any unit on a new day
- Resets to 0 if `last_study_date < today - 1`
- Tracks `current_streak` and `longest_streak`
- Updates automatically via `markComplete()` API call

**Emotional Accountability:**
- Broken streak shows red "Start a new streak" message
- Active streak shows urgent "Don't break your streak" messaging

---

### 5.4 Plan Generator (ONBOARDING ONLY)
**Keep Simple—This Is Not The Product**  
**Flow:**
1. Select grade (11 or 12)
2. Select 2-6 subjects (checkboxes)
3. Generate → Algorithm distributes units across 5 days
4. Redirect to dashboard (not plan view)

**Time Investment:** 2 hours max (resist feature creep)

---

## 6. Data Model

### Tables (6 Total)

**1. profiles** (extends auth.users)
```
- id: uuid (FK to auth.users)
- grade: int
- created_at: timestamp
```

**2. study_plans**
```
- id: uuid
- user_id: uuid (FK)
- subjects: text[]
- schedule: jsonb (5-day breakdown)
- created_at: timestamp
```

**3. user_progress** (dual purpose: completion + daily activity)
```
- id: uuid
- user_id: uuid (FK)
- plan_id: uuid (FK)
- subject: text
- unit_id: text
- completed: boolean
- completed_at: timestamp ← Used to compute streaks and weekly summary
- created_at: timestamp
```

**4. study_streaks**
```
- id: uuid
- user_id: uuid (FK, unique)
- current_streak: int (default 0)
- longest_streak: int (default 0)
- last_study_date: date
- total_study_days: int
- updated_at: timestamp
```

**5. parent_access**
```
- id: uuid
- student_user_id: uuid (FK)
- share_token: text (unique)
- is_active: boolean
- created_at: timestamp
```

**6. events** (analytics)
```
- id: uuid
- user_id: uuid (nullable)
- event_name: text
- event_data: jsonb (nullable)
- created_at: timestamp
```

### Key Relationships
- Progress tracking drives streak calculation (via `completed_at` timestamps)
- Weekly summary computed from distinct dates in `user_progress.completed_at`
- Parent dashboard queries student's progress via `share_token`

### RLS Strategy
- **MVP:** Disable Row Level Security on all tables (faster development)
- **Post-Launch:** Re-enable with simple policies (users access only their own data)

---

## 7. Technical Stack

### Frameworks
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Deployment:** Vercel (continuous deployment on git push)
- **Auth:** Supabase Auth (Google OAuth only)

### Key Libraries
- `@supabase/supabase-js` - Database client
- `shadcn/ui` - Component library (skeleton, toast, dialog)
- `framer-motion` (optional) - Progress bar animations if time permits

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Known Constraints
- Browser localStorage NOT available (iframe restrictions) → All state in database
- Must work on mobile (50%+ users on phones)
- JSON curriculum files must be <1MB each (build performance)
- OAuth redirect URLs must include both localhost and production

---

## 8. Core User Flows

### Flow 1: Student Onboarding → Daily Habit
1. Land on homepage → Click "Feel On Track" CTA
2. Sign in with Google OAuth
3. Select grade (11 or 12) → Select subjects
4. Generate plan → Redirected to dashboard
5. See "Start your first unit" prompt → Check one unit complete
6. **Instant feedback:** Toast appears "🔥 Day 1 streak!"
7. **Next day:** Return → See "Don't break your streak!" → Check another unit
8. **Day 3+:** See growing progress bars + "X-day streak" → Habit formed

**Success:** User returns daily, maintains 3+ day streaks

---

### Flow 2: Parent Monitoring
1. Student clicks "Share with Parent" in settings
2. Copy link: `steadytrack.ca/parent/[token]`
3. Share link via text/email
4. Parent opens link → Sign in with Google (verification)
5. See dashboard: Streak badge + weekly checkmarks + progress bars
6. **Reassurance:** "Studied 4 of last 5 days ✅"
7. Take screenshot → Share in parent Facebook group
8. **Virality:** Other parents discover tool

**Success:** Parent checks regularly (not just once), shares with network

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Auth redirect URL mismatch** | Critical | High | Add both `localhost:3000` and production URLs to Supabase whitelist at Hour 1; test immediately |
| **Supabase RLS over-restriction** | High | Medium | Disable RLS entirely for MVP; queries fail → disable table RLS in <2 min |
| **AI-generated hydration bugs** | Medium | Medium | Run `npm run build` at Hours 8, 16, 24; catch errors before deploy |
| **Curriculum JSON too large** | Medium | Medium | Split into separate files (<1MB each); monitor build time (<2 min = good) |
| **Users don't return Day 2** | High | Medium | Streak messaging creates urgency; red "Start a new streak" if broken |
| **Parents never access links** | Medium | Medium | Make share flow prominent; show preview of what parents see |
| **Strike ends early** | Medium | Medium | Pivot messaging to "exam prep tool"; keep product relevant year-round |

---

## 10. Metrics & Analytics

### Events to Track (Supabase)
1. **sign_in** - User authenticates
2. **plan_created** - Generates study plan (activation)
3. **progress_updated** - Marks unit complete (engagement)
4. **parent_link_created** - Shares with parent
5. **parent_link_accessed** - Parent views dashboard (virality)

### Key Queries
```sql
-- Daily active users
SELECT COUNT(DISTINCT user_id) 
FROM events 
WHERE created_at > now() - interval '24 hours';

-- Average streak length
SELECT AVG(current_streak) 
FROM study_streaks 
WHERE current_streak > 0;

-- Parent engagement rate
SELECT 
  COUNT(DISTINCT student_user_id) as links_created,
  COUNT(*) as total_accesses
FROM parent_access 
WHERE created_at > now() - interval '7 days';
```

### Success Metrics (Week 1)
- **Signups:** 500+ authenticated users
- **Activation:** 70%+ mark at least one unit complete
- **Retention:** 40%+ return Day 2, 25%+ return Day 7
- **Habit Formation:** 30%+ maintain 3+ day streaks
- **Parent Adoption:** 20%+ generate parent links, 70%+ of links accessed
- **Emotional Validation:** 5+ testimonials using "on track" or "peace of mind" language

---

## 11. Launch Criteria

### Must Ship (P0)
- [ ] Google OAuth sign-in works on production
- [ ] Users can generate plans
- [ ] Progress tracking persists across sessions
- [ ] Streak counter updates automatically
- [ ] Parent links function (shareable, read-only)
- [ ] Landing page communicates emotional value
- [ ] Site works on mobile (iPhone Safari minimum)
- [ ] No critical bugs (sign-in breaks, data loss)

### Required (P1)
- [ ] Math 30-1 curriculum complete (50+ units)
- [ ] English 30-1 curriculum complete
- [ ] Toast notifications on progress updates
- [ ] Progress bars animate smoothly
- [ ] Parent dashboard readable in screenshots

### Nice-to-Have (P2 - Cut If Behind)
- [ ] Additional 4 subjects stubbed (5 units each)
- [ ] Resource library with accordion UI
- [ ] Celebration modals at milestones
- [ ] Study Pulse metric (75% consistency)

### Cut If Behind Schedule (Hour 30 Decision)
- Apple Sign In (Google only works)
- Real-time sync (reload acceptable)
- Offline support
- Advanced animations
- Search functionality
- Time tracking (units completed sufficient)

### Definition of Launch-Ready
Can a student:
1. Sign in → Generate plan → Mark progress → See streak → Share with parent?
2. Return the next day and continue their streak?

Can a parent:
3. Open link → See progress in <5 seconds → Feel reassured?

If yes to all three → SHIP IT

---

## 12. Out of Scope (Phase 2)

- Email/SMS notifications or reminders
- Social features (study groups, forums)
- AI-powered recommendations
- Teacher/tutor admin portals
- Assignment submission
- Detailed analytics dashboards
- Mobile native apps
- Integration with D2L or Google Classroom
- Payment/subscription features

**Rationale:** 48-hour timeline requires ruthless focus on core emotional loop

---

## 13. Content Requirements

### Curriculum Data Structure
```json
{
  "subject": "Math 30-1",
  "grade": 12,
  "units": [
    {
      "id": "m30_1",
      "title": "Transformations",
      "topics": ["Translations", "Reflections", "Stretches"],
      "estimatedHours": 3,
      "resources": [
        {
          "type": "video",
          "title": "Khan Academy: Transformations",
          "url": "https://..."
        },
        {
          "type": "pdf",
          "title": "Alberta Ed Toolkit",
          "url": "https://..."
        }
      ]
    }
  ]
}
```

### Minimum Viable Content
- **Math 30-1:** Complete (6 units, 40+ topics)
- **English 30-1:** Complete (4 units, 30+ topics)
- **Other subjects:** Stub with 5 units each

### Resource Vetting Criteria
- Freely accessible (no paywalls)
- Alberta curriculum-aligned
- Credible sources only (Khan Academy, Alberta Ed, OpenStax)
- Links verified active

---

## 14. UI/UX Principles

### Design Philosophy
**Students:** Make progress feel satisfying and momentum visible  
**Parents:** Make consistency obvious and reassuring

### Key UI Patterns
- **Immediate Feedback:** Toast notifications on every action
- **Visual Hierarchy:** Streak counter is hero element
- **Progress Visibility:** Large, animated progress bars
- **Emotional Messaging:** "On track ✅" not just "82% complete"
- **Urgency When Needed:** Red "Start a new streak" if broken

### Mobile-First
- 50%+ users on phones
- Touch targets ≥44px
- Readable text (16px minimum)
- Single-column layouts

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- High contrast mode
- Screen reader friendly

---

## 15. Marketing & Positioning

### Tagline Options
1. "When classes stop, consistency shouldn't."
2. "School's paused. Your momentum isn't."

**Test both, pick the one with better rhythm and emotional resonance**

### Value Propositions
**For Students:** "Track your progress. See your momentum. Feel confident."  
**For Parents:** "Check progress anytime. No nagging needed."  
**For Everyone:** "Alberta curriculum-aligned. Free forever."

### Launch Channels
1. Reddit (r/alberta, r/Edmonton, r/Calgary)
2. Facebook parent groups
3. Twitter (tag @ABEd, local news)
4. Word-of-mouth (student networks)

### Messaging Framework
**Lead with empathy, not features:**
- Students: "I know you're worried about falling behind..."
- Parents: "You want peace of mind without hovering..."
- Solution: Visible accountability and momentum

---

## Appendix: API Specifications

### Core Functions

**markComplete(userId, planId, unitId)**
```typescript
// Returns:
{
  success: boolean,
  streakIncreased: boolean,  // Trigger toast
  newStreak: number,
  milestone?: number         // 25, 50, 75, or 100
}
```

**updateStreak(userId)**
```typescript
// Auto-called by markComplete
// Logic:
if (last_study_date === today) return; // Already counted
if (last_study_date === yesterday) increment current_streak;
if (last_study_date < yesterday) reset current_streak = 1;
update longest_streak if needed;
```

**getWeeklySummary(userId)**
```typescript
// Returns:
{
  daysStudied: number,      // Distinct dates in last 7 days
  unitsCompleted: number,   // Total units in last 7 days
  studyPulse?: number       // Optional: % of last 4 days
}
```

---

**End of Document**

---

## Summary

SteadyTrack is a momentum engine disguised as a study planner. The plan generator gets students started, but the progress dashboard with streak tracking is what creates daily retention. The parent dashboard drives virality through screenshot sharing. Success depends on making emotional feedback loops immediate and satisfying—not on building elaborate features.

**Core Loop:** Check box → See streak grow → Feel on track → Return tomorrow  
**Virality Loop:** Parent sees consistency → Takes screenshot → Shares with network  
**Timeline:** 48 hours from start to launch-ready MVP
