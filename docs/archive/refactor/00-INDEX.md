# SteadyTrack Feature Analysis Index

**Purpose:** Comprehensive incremental porting guides for all features
**Generated:** October 2025
**Branch:** refactor/dependency-analysis

---

## Overview

This directory contains **11 detailed feature analysis documents** that serve as portable action plans for incrementally refactoring the SteadyTrack application. Each document includes:

1. **Complete file inventory** - All files involved in the feature
2. **Copy vs Refactor analysis** - What can be copied as-is vs what needs refactoring
3. **New file structure** - Proposed organization in refactored codebase
4. **Supabase queries & optimizations** - Database interactions with improvement suggestions
5. **Shared components** - Dependencies on reusable components
6. **Step-by-step porting guide** - Detailed migration instructions with estimated time
7. **Testing checklist** - Test cases to validate functionality

---

## Quick Reference: All Features

| # | Feature | Priority | Complexity | Effort | Status |
|---|---------|----------|------------|--------|--------|
| 1 | [Authentication & Profiles](./01-authentication-and-profiles.md) | P0-Critical | ⭐⭐ (2/5) | 3-4 hrs | ✅ Complete |
| 2 | [Study Plan Creation](./02-study-plan-creation.md) | P0-Critical | ⭐⭐⭐⭐ (4/5) | 10-12 hrs | Core Feature |
| 3 | [Dashboard & Progress](./03-student-dashboard-progress.md) | P0-Critical | ⭐⭐⭐⭐⭐ (5/5) | 16-20 hrs | Most Complex |
| 4 | [Curriculum Browser](./04-curriculum-browser.md) | P1-High | ⭐⭐⭐ (3/5) | 6-8 hrs | Public Feature |
| 5 | [Microcards & Quizzes](./05-microcards-quick-checks.md) | P1-High | ⭐⭐⭐⭐ (4/5) | 8-10 hrs | Learning Enhancement |
| 6 | [Resource Progress](./06-resource-progress-tracking.md) | P1-High | ⭐⭐⭐ (3/5) | 6-8 hrs | Fine-grained Progress |
| 7 | [Parent Dashboard](./07-parent-dashboard-sharing.md) | P2-Medium | ⭐⭐⭐ (3/5) | 6-8 hrs | Family Features |
| 8 | [Guest Mode](./08-guest-mode.md) | P2-Medium | ⭐⭐⭐⭐⭐ (5/5) | 12-16 hrs | User Acquisition |
| 9 | [Settings & Account](./09-settings-account-management.md) | P2-Medium | ⭐⭐⭐ (3/5) | 6-8 hrs | User Management |
| 10 | [Study Mode](./10-study-mode.md) | P2-Medium | ⭐⭐⭐ (3/5) | 6-8 hrs | Learning Experience |
| 11 | [Analytics](./11-analytics-tracking.md) | P3-Low | ⭐⭐ (2/5) | 3-4 hrs | Telemetry |

**Total Estimated Effort:** 83-107 hours (~2-3 weeks full-time, 4-6 weeks part-time)

---

## Recommended Porting Order

### Phase 1: Foundation (P0-Critical) - 29-36 hours
Port these features first - everything else depends on them.

1. **[Authentication](./01-authentication-and-profiles.md)** (3-4 hrs) - ✅ **COMPLETE (Jan 2025)**
   - ✅ No dependencies
   - 🎯 Foundation for entire app
   - ✅ AuthContext with onAuthStateChange implemented
   - ✅ Phase 1-4 verified and working

2. **[Study Plan Creation](./02-study-plan-creation.md)** (10-12 hrs)
   - ✅ Depends on: Auth (#1)
   - 🎯 Core feature - users need plans to do anything
   - 🔧 Refactor 385-line wizard into smaller components

3. **[Dashboard & Progress](./03-student-dashboard-progress.md)** (16-20 hrs)
   - ✅ Depends on: Auth (#1), Plans (#2)
   - 🎯 Main user interface
   - ⚠️ **MOST COMPLEX** - 418-line DashboardClient needs major refactor
   - 🔧 Extract state management to custom hooks

**Milestone:** After Phase 1, users can create accounts, create plans, and track progress (MVP).

---

### Phase 2: Enhanced Learning (P1-High) - 20-26 hours
Add rich learning features that enhance the core experience.

4. **[Curriculum Browser](./04-curriculum-browser.md)** (6-8 hrs)
   - ✅ No dependencies (public feature)
   - ✅ Well-structured, minimal refactoring needed
   - 💡 Can port in parallel with other features

5. **[Microcards & Quizzes](./05-microcards-quick-checks.md)** (8-10 hrs)
   - ✅ Depends on: Auth (#1), Curriculum (#4)
   - 🔧 Extract quiz logic to `useQuickCheck` hook
   - 💡 Integrates into dashboard and study mode

6. **[Resource Progress](./06-resource-progress-tracking.md)** (6-8 hrs)
   - ✅ Depends on: Auth (#1), Plans (#2), Progress (#3)
   - 🔧 Add React Query hooks for optimistic updates
   - 💡 Fine-grained tracking complements unit-level progress

**Milestone:** After Phase 2, users have full learning experience with study cards, quizzes, and resource tracking.

---

### Phase 3: Sharing & Multi-User (P2-Medium) - 24-32 hours
Add features for collaboration and guest users.

7. **[Parent Dashboard](./07-parent-dashboard-sharing.md)** (6-8 hrs)
   - ✅ Depends on: Auth (#1), Plans (#2), Progress (#3)
   - ✅ Well-structured, minimal refactoring
   - 🔐 Token-based access (no auth required for parents)

8. **[Guest Mode](./08-guest-mode.md)** (12-16 hrs)
   - ✅ No dependencies (independent feature)
   - ⚠️ **VERY COMPLEX** - Duplicates entire app flow using LocalStorage
   - 🔧 Consider unified storage interface (AuthStorage + GuestStorage)
   - 💡 Critical for user acquisition (try before signup)

9. **[Settings & Account](./09-settings-account-management.md)** (6-8 hrs)
   - ✅ Depends on: Auth (#1), Plans (#2), Parent Dashboard (#7)
   - 🔧 Extract large settings cards into smaller components
   - 💡 Profile management, data export, account deletion

**Milestone:** After Phase 3, app supports parent sharing and guest users (family features + user acquisition).

---

### Phase 4: Polish & Optimization (P2-P3) - 9-13 hours
Final features for complete experience.

10. **[Study Mode](./10-study-mode.md)** (6-8 hrs)
    - ✅ Depends on: Plans (#2), Microcards (#5)
    - ✅ Well-structured, minimal refactoring
    - 💡 Focused study interface with outcome navigation

11. **[Analytics](./11-analytics-tracking.md)** (3-4 hrs)
    - ✅ Depends on: Auth (#1)
    - ✅ Simple to port
    - 🔧 Create unified `track()` function
    - 💡 Telemetry for product insights

**Milestone:** After Phase 4, app has complete feature parity with original.

---

## Key Refactoring Priorities

### 🚨 Critical Refactors

1. ~~**DashboardClient (418 lines) → Extract to Hooks**~~ ✅ **COMPLETE (Jan 2025)**
   - Reduced from 418 → 184 lines (56% reduction)
   - Using React Query: `useDashboardQuery` hook
   - Eliminated manual fetching and race conditions
   - Document: [REACT_QUERY_MIGRATION.md](./REACT_QUERY_MIGRATION.md)

2. ~~**SubjectProgressCard (515 lines)**~~ ✅ **COMPLETE (Jan 2025)**
   - Reduced from 515 → 485 lines
   - Using React Query: `useMicrocardsQuery`, `useUnitCompletionQuery`
   - Proper optimistic updates with rollback
   - Document: [REACT_QUERY_MIGRATION.md](./REACT_QUERY_MIGRATION.md)

3. ~~**Plan View Page (902 lines)**~~ ✅ **COMPLETE (Jan 2025)**
   - Reduced from 902 → 214 lines (76% reduction!)
   - Created 4 custom hooks: `usePlanData`, `usePlanProgress`, `usePlanFilters`, `usePlanNavigation`
   - Created 3 UI components: `PlanHeader`, `PlanFilterBar`, `PlanEmptyState`
   - Document: [REFACTORING_PROGRESS.md](./REFACTORING_PROGRESS.md)

4. ~~**Add React Query for State Management**~~ ✅ **COMPLETE (Jan 2025)**
   - 13 custom hooks created (queries + mutations)
   - All major components using optimistic updates
   - Eliminated race conditions throughout app
   - Document: [REACT_QUERY_MIGRATION.md](./REACT_QUERY_MIGRATION.md)

5. ~~**Add AuthContext with `onAuthStateChange`**~~ ✅ **COMPLETE (Jan 2025)**
   - Created `contexts/AuthContext.tsx` (119 lines)
   - Real-time cross-tab auth synchronization
   - Automatic logout/login detection across tabs
   - **Security fix**: Users no longer stay "logged in" after logout in another tab
   - Document: [REFACTORING_PROGRESS.md](./REFACTORING_PROGRESS.md#6-authcontext-with-onauthstatechange-january-2025)

### 🔧 Medium Priority Refactors

6. **Unified Storage Interface (Guest + Auth)**
   - Create `PlanStorage` interface with `AuthStorage` and `GuestStorage` implementations
   - Eliminates duplicate logic between guest and auth flows
   - Document: [08-guest-mode.md](./08-guest-mode.md)

7. **Settings Cards → Smaller Components**
   - settings-subjects-card (504 lines) → SubjectsSettingsForm (120 lines)
   - settings-account-card (427 lines) → ProfileSettingsForm (80 lines) + DataExportButton + DeleteAccountButton
   - Document: [09-settings-account-management.md](./09-settings-account-management.md)

---

## Testing Strategy

Each feature document includes a testing checklist. Overall strategy:

### Unit Tests
- Pure functions (schedule generation, streak calculation, etc.)
- Custom hooks (useProgressTracking, useStreakCalculation, etc.)
- Validation schemas (Zod)

### Integration Tests
- API routes (with mock Supabase)
- RPC function calls
- Component interactions (click → API call → state update)

### E2E Tests
- Full user journeys (signup → create plan → track progress)
- Guest migration flow
- Parent dashboard access

### Manual Testing
- All UI interactions
- Mobile responsiveness
- Cross-browser compatibility (Chrome, Firefox, Safari)
- Timezone edge cases
- Concurrent tab updates

---

## Architecture Improvements

### Critical Improvements

1. ~~**Install React Query**~~ ✅ **COMPLETE (Jan 2025)**
   - Installed `@tanstack/react-query` and `@tanstack/react-query-devtools`
   - Replaced all manual fetching with queries/mutations
   - Added optimistic updates throughout app
   - **Result:** 40-50% reduction in state management code
   - Document: [REACT_QUERY_MIGRATION.md](./REACT_QUERY_MIGRATION.md)

2. **Create Service Layer** ⏳ **PARTIAL (2/4 complete)**
   ```
   lib/services/
   ├── progress.ts ✅ Complete (10KB, helper functions)
   ├── progress-calculations.ts ✅ Complete (18KB, 70 tests)
   ├── plan-service.ts ⏳ TODO
   ├── resource-progress-service.ts ⏳ TODO
   └── auth-service.ts ⏳ TODO
   ```
   - Progress service complete with 70 unit tests
   - Remaining services needed for full coverage
   - Document: [PROGRESS_CALCULATIONS_CENTRALIZATION.md](./PROGRESS_CALCULATIONS_CENTRALIZATION.md)

3. ~~**Fix Rate Limiting**~~ ✅ **COMPLETE (Jan 2025)** - CRITICAL SECURITY FIX
   - Changed from fail-open to fail-closed in production
   - Redis now required in production (503 if unavailable)
   - Development mode still allows requests (no Redis needed)
   - **Result:** API abuse prevented even if Redis fails
   - Document: [REFACTORING_PROGRESS.md](./REFACTORING_PROGRESS.md)

4. ~~**Add AuthContext with onAuthStateChange**~~ ✅ **COMPLETE (Jan 2025)** - CRITICAL SECURITY FIX
   - Created `contexts/AuthContext.tsx` with real-time auth sync
   - Integrated in root layout with proper server-side initial auth
   - Cross-tab logout/login detection working
   - **Result:** No more "logged in" state after logout in another tab
   - Document: [REFACTORING_PROGRESS.md](./REFACTORING_PROGRESS.md#6-authcontext-with-onauthstatechange-january-2025)

---

## Success Criteria

✅ **Port is successful when:**

### Functional Completeness
- [ ] All 11 features working correctly
- [ ] No feature regressions from original app
- [ ] All user flows functional (signup → plan creation → progress tracking)

### Code Quality
- [ ] Average component size reduced from 200 → 150 lines
- [ ] No components > 300 lines (current: 3 "monster" components)
- [ ] Test coverage > 80% for business logic
- [ ] All duplicate logic consolidated

### Performance
- [ ] Dashboard initial load < 2 seconds
- [ ] Optimistic updates work (no loading spinners on interactions)
- [ ] No N+1 query problems
- [ ] Bundle size reduced by 10% (via code splitting)

### Developer Experience
- [ ] Clear component hierarchy (no deep nesting)
- [ ] Consistent patterns across features
- [ ] Good error messages (standardized API responses)
- [ ] Easy onboarding (clear directory structure)

---

## How to Use These Documents

### For Full Refactor (Recommended)
1. Read [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) for overview
2. Work through features in recommended order (Phase 1 → 2 → 3 → 4)
3. Use each feature document as a detailed implementation guide
4. Check off tasks in testing checklists as you go

### For Targeted Refactor (Specific Feature)
1. Identify feature you want to port
2. Open corresponding document (e.g., `03-student-dashboard-progress.md`)
3. Review dependencies section - ensure prerequisites are ported first
4. Follow step-by-step porting guide
5. Run tests from testing checklist

### For Architecture Planning
1. Review "Key Refactoring Priorities" section above
2. Read architecture improvement sections in each document
3. Create GitHub issues for each refactor
4. Prioritize based on impact and dependencies

---

## Additional Resources

- **[DEPENDENCY_MAP.md](./DEPENDENCY_MAP.md)** - Comprehensive database, component, and API analysis
- **[database-schema-analysis.md](./database-schema-analysis.md)** - Complete database schema documentation
- **[MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)** - GitHub issue format with all tasks
- **[ADR_2025-01-REFACTOR.md](./ADR_2025-01-REFACTOR.md)** - Architecture Decision Record for refactor

---

## Feedback & Questions

If you encounter issues or have questions while using these guides:
1. Check the "Key Challenges & Solutions" section in relevant document
2. Review "Migration Risks & Mitigation" section
3. Consult DEPENDENCY_MAP.md for additional context
4. Create GitHub issue if problem persists

---

**Generated:** October 2025 | **Last Updated:** October 13, 2025
**Maintained by:** SteadyTrack Development Team
