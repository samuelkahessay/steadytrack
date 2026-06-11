# Feature Analysis: Study Mode (Focused Study Interface)

**Priority:** P2-Medium | **Complexity:** ⭐⭐⭐ (3/5) | **Effort:** 6-8 hours

## 1. Files Involved

```
app/(dashboard)/plan/[id]/study/
├── page.tsx - Study mode page (outcome list + viewer)
└── [resourceId]/page.tsx - Individual resource viewer (optional)

components/study/
├── StudyModeHeader.tsx - Header with navigation
├── OutcomeSidebar.tsx - Outcome list (desktop sidebar)
├── MicrocardViewer.tsx - Microcard content display
├── MobileSidebarDrawer.tsx - Mobile drawer for outcomes
├── MobileBottomNav.tsx - Mobile navigation
└── ContentViewer.tsx - External resource iframe/embed
```

## 2. Features

### Core Features:
1. **Outcome List** - Show all outcomes for the plan (sidebar on desktop, drawer on mobile)
2. **Microcard Viewer** - Display microcard when outcome selected (URL param: `?outcome={code}`)
3. **Quick Check Quiz** - Embedded in microcard viewer
4. **Resource Links** - Show recommended resources for outcome
5. **Progress Tracking** - Mark outcomes as studied
6. **Mobile-Optimized** - Drawer + bottom nav for mobile

## 3. Copy vs Refactor

**✅ Copy As-Is:**
- All study mode components are well-structured
- Clean separation of concerns
- Good mobile/desktop responsiveness

**🔧 Minor Improvements:**
- Add keyboard navigation (arrow keys to move between outcomes)
- Add progress indicator (X of Y outcomes studied)
- Consider adding "Mark all as read" button

## 4. New File Structure

```
src/
├── app/(dashboard)/plan/[id]/study/
│   ├── page.tsx ✅
│   └── [resourceId]/page.tsx ✅ (optional)
│
└── components/study/ ✅ (copy all as-is)
    ├── StudyModeHeader.tsx
    ├── OutcomeSidebar.tsx
    ├── MicrocardViewer.tsx
    ├── MobileSidebarDrawer.tsx
    ├── MobileBottomNav.tsx
    └── ContentViewer.tsx
```

## 5. Queries

```typescript
// Fetch plan + microcards for study mode
const [planRes, microcardsRes] = await Promise.all([
  supabase.from('study_plans').select('*').eq('id', planId).single(),
  supabase.from('content_microcards')
    .select('*')
    .in('subject', plan.subjects)
    .eq('status', 'active')
    .order('subject, unit_id, outcome_code')
]);

// Get user's quick check attempts
const { data: quickChecks } = await supabase
  .from('quick_check_results')
  .select('outcome_code, correct, created_at')
  .eq('user_id', userId)
  .eq('plan_id', planId);

// Mark outcome as studied (optional - not currently implemented)
// Could track via resource_progress or new table
```

## 6. URL Params & Navigation

```typescript
// URL structure: /plan/{planId}/study?outcome={outcomeCode}

// Navigate to outcome
router.push(`/plan/${planId}/study?outcome=MATH20.1.1`);

// Read current outcome from URL
const searchParams = useSearchParams();
const currentOutcome = searchParams.get('outcome');

// Mobile: Drawer opens to show outcome list
const [sidebarOpen, setSidebarOpen] = useState(false);
```

## 7. Porting Guide (6 hours)

### Phase 1: Pages (2 hours)
1. Copy study mode page
2. Copy resource viewer page (if used)
3. Test page navigation

### Phase 2: Components (3 hours)
1. Copy all study components:
```bash
cp -r components/study NEW_PROJECT/components/
```

2. Test desktop layout (sidebar)
3. Test mobile layout (drawer + bottom nav)
4. Test outcome selection (URL updates)
5. Test microcard display
6. Test quick check integration

### Phase 3: Enhancements (1 hour)
Add keyboard navigation:
```typescript
// In OutcomeSidebar or study page
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      // Navigate to previous outcome
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        router.push(`/plan/${planId}/study?outcome=${outcomes[prevIndex].code}`);
      }
    } else if (e.key === 'ArrowDown') {
      // Navigate to next outcome
      const nextIndex = currentIndex + 1;
      if (nextIndex < outcomes.length) {
        router.push(`/plan/${planId}/study?outcome=${outcomes[nextIndex].code}`);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentIndex, outcomes, planId, router]);
```

## 8. Testing Checklist

- [ ] **Outcome List:**
  - [ ] All outcomes display in sidebar
  - [ ] Grouped by subject/unit
  - [ ] Current outcome highlighted
  - [ ] Click outcome → URL updates → microcard loads

- [ ] **Microcard Viewer:**
  - [ ] Summary displays
  - [ ] Steps display
  - [ ] Pitfall displays (if present)
  - [ ] Quick check quiz works
  - [ ] Recommended resources link correctly

- [ ] **Mobile:**
  - [ ] Drawer opens/closes
  - [ ] Bottom nav works
  - [ ] Swipe gestures work (if implemented)

- [ ] **Keyboard Navigation:**
  - [ ] Arrow up/down navigate outcomes
  - [ ] Esc closes drawer (mobile)

## 9. Success Criteria

✅ Outcome sidebar displays all outcomes for plan
✅ Selecting outcome updates URL and loads microcard
✅ Quick check quiz works in study mode
✅ Mobile drawer and bottom nav functional
✅ Desktop sidebar layout works
✅ Keyboard navigation (arrow keys) works

**Next:** [11-analytics-tracking.md](./11-analytics-tracking.md)
