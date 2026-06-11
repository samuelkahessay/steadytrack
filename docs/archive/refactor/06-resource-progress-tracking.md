# Feature Analysis: Resource-Level Progress Tracking

**Priority:** P1-High | **Complexity:** ⭐⭐⭐ (3/5) | **Effort:** 6-8 hours

## 1. Files Involved

```
components/plan/
└── ResourceAccordion.tsx (161 lines) - Resource list with checkboxes

app/api/resource-progress/
├── route.ts - Mark resource complete/incomplete
└── start/route.ts - Track start time (optional)
```

## 2. Database Table

```sql
resource_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  unit_id TEXT NOT NULL,
  resource_url TEXT NOT NULL, -- Unique identifier
  completed BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, unit_id, resource_url)
)
```

**Key Design:** `resource_url` is the unique identifier (no numeric IDs for resources).

## 3. Copy vs Refactor

**✅ Copy As-Is:**
- ResourceAccordion component (well-structured)
- API routes (simple CRUD)

**🔧 Minor Improvements:**
- Create React Query hooks:
  - `useResourceProgress(planId)` - Fetch all resource progress
  - `useToggleResource()` - Toggle completion with optimistic update

## 4. New File Structure

```
src/
├── components/plan/
│   └── ResourceAccordion.tsx 🔧 (use React Query)
│
├── lib/hooks/
│   ├── useResourceProgress.ts 🆕
│   └── useToggleResource.ts 🆕
│
└── app/api/resource-progress/
    ├── route.ts ✅
    └── start/route.ts ✅
```

## 5. Queries

```typescript
// Fetch resource progress for plan
const { data } = await supabase
  .from('resource_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('plan_id', planId);

// Mark resource complete
await supabase
  .from('resource_progress')
  .upsert({
    user_id: userId,
    plan_id: planId,
    unit_id: unitId,
    resource_url: resourceUrl,
    completed: true
  });
```

## 6. Porting Guide (6 hours)

### Phase 1: API Routes (1 hour)
```bash
cp app/api/resource-progress/route.ts NEW_PROJECT/app/api/resource-progress/
cp app/api/resource-progress/start/route.ts NEW_PROJECT/app/api/resource-progress/start/
```

### Phase 2: React Query Hooks (2 hours)
```typescript
// lib/hooks/useResourceProgress.ts
export function useResourceProgress(planId: string) {
  return useQuery({
    queryKey: ['resource-progress', planId],
    queryFn: async () => {
      const { data } = await supabase
        .from('resource_progress')
        .select('*')
        .eq('plan_id', planId);
      return data;
    }
  });
}

// lib/hooks/useToggleResource.ts
export function useToggleResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, unitId, resourceUrl, completed }) => {
      const response = await fetch('/api/resource-progress', {
        method: 'POST',
        body: JSON.stringify({ planId, unitId, resourceUrl, completed })
      });
      return response.json();
    },
    onMutate: async (variables) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['resource-progress', variables.planId] });
      const previous = queryClient.getQueryData(['resource-progress', variables.planId]);
      queryClient.setQueryData(['resource-progress', variables.planId], (old) => {
        // ... optimistic update logic
      });
      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['resource-progress', variables.planId], context.previous);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['resource-progress', variables.planId] });
    }
  });
}
```

### Phase 3: Component Integration (2 hours)
Update ResourceAccordion to use hooks

### Phase 4: Testing (1 hour)
- [ ] Resource checkboxes toggle
- [ ] Progress saves to DB
- [ ] Optimistic updates work
- [ ] Rollback on error
- [ ] Unique constraint prevents duplicates

## 7. Success Criteria

✅ Resource checkboxes toggle correctly
✅ Progress persists across page reloads
✅ Optimistic updates + rollback work
✅ Start time tracked (optional feature)

**Next:** [07-parent-dashboard-sharing.md](./07-parent-dashboard-sharing.md)
