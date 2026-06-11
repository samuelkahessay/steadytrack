# Feature Analysis: Microcards & Quick Check System

**Priority:** P1-High | **Complexity:** ⭐⭐⭐⭐ (4/5) | **Effort:** 8-10 hours

## 1. Files Involved

```
components/microcards/
├── MicrocardViewer.tsx - Main viewer component
├── MicrocardContent.tsx - Content display (summary, steps, pitfall)
├── MicrocardModal.tsx - Modal wrapper
├── QuickCheckCard.tsx - Quiz interface
├── MicrocardBadge.tsx - Availability indicator
└── QuickCheckResult.tsx - Result display

components/study/
└── MicrocardViewer.tsx - Embedded version for study mode

app/api/ (may need for saving results)
└── Could add dedicated route or use inline Supabase calls
```

## 2. Database Tables

```sql
content_microcards (
  id UUID,
  subject TEXT,
  unit_id TEXT,
  outcome_code TEXT,
  summary TEXT,
  steps JSONB, -- Array of step objects
  pitfall TEXT,
  quick_check JSONB, -- { question, choices, answer, explanation }
  recommended_resource_url TEXT,
  sources JSONB,
  version INT,
  status TEXT -- 'active', 'draft', 'archived'
)

quick_check_results (
  id UUID,
  user_id UUID,
  plan_id UUID,
  subject TEXT,
  unit_id TEXT,
  outcome_code TEXT,
  microcard_id UUID,
  correct BOOLEAN,
  selected TEXT, -- User's choice
  created_at TIMESTAMPTZ
)
```

## 3. Copy vs Refactor

**✅ Copy As-Is:**
- MicrocardContent, MicrocardBadge - Pure presentation
- MicrocardModal - Simple wrapper

**🔧 Refactor:**
- **QuickCheckCard** - Extract quiz logic to `useQuickCheck` hook
- **MicrocardViewer** - Consider React Query for data fetching

## 4. New File Structure

```
src/
├── components/microcards/
│   ├── MicrocardViewer.tsx 🔧 (add React Query)
│   ├── MicrocardContent.tsx ✅
│   ├── MicrocardModal.tsx ✅
│   ├── QuickCheckCard.tsx 🔧 (extract hook)
│   └── MicrocardBadge.tsx ✅
│
└── lib/hooks/
    └── useQuickCheck.ts 🆕 (quiz state + submission)
```

## 5. Queries

```typescript
// Fetch microcards for unit
const { data } = await supabase
  .from('content_microcards')
  .select('*')
  .eq('subject', subject)
  .eq('unit_id', unitId)
  .eq('status', 'active')
  .order('outcome_code');

// Save quiz result
await supabase
  .from('quick_check_results')
  .insert({
    user_id: userId,
    plan_id: planId,
    subject,
    unit_id: unitId,
    outcome_code: outcomeCode,
    microcard_id: microcardId,
    correct: isCorrect,
    selected: userAnswer
  });
```

**Optimization:** Cache microcards by subject+unit for dashboard (avoid N queries).

## 6. Porting Guide (8 hours)

### Phase 1: Data Layer (2 hours)
1. Copy microcard components (as-is)
2. Create `useQuickCheck` hook:
```typescript
export function useQuickCheck(microcardId, quickCheck) {
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const submit = async () => {
    const correct = selected === quickCheck.answer;
    await saveResult({ microcardId, correct, selected });
    setShowResult(true);
  };

  return { selected, setSelected, showResult, submit };
}
```

### Phase 2: UI Integration (3 hours)
1. Integrate into dashboard (SubjectProgressCard)
2. Integrate into study mode
3. Test modal vs inline modes

### Phase 3: Testing (3 hours)
- [ ] Microcards load from DB
- [ ] Summary, steps, pitfall display
- [ ] Quiz interface works
- [ ] Answer validation correct
- [ ] Results save to DB
- [ ] Recommended resources link

## 7. Success Criteria

✅ Microcards fetch from database
✅ Quiz works (select answer → submit → see result)
✅ Results save to quick_check_results table
✅ Recommended resources link correctly

**Next:** [06-resource-progress-tracking.md](./06-resource-progress-tracking.md)
