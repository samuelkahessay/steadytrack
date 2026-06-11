# Feature Analysis: Parent Dashboard Sharing

**Priority:** P2-Medium | **Complexity:** ⭐⭐⭐ (3/5) | **Effort:** 6-8 hours

## 1. Files Involved

```
app/parent/[token]/page.tsx - Parent dashboard view
app/share/[token]/page.tsx - Alternate route (same feature)

components/parent/
├── ParentDashboard.tsx - Main read-only dashboard
├── SubjectProgressList.tsx - Subject progress display
├── StreakBadge.tsx - Streak visualization
├── WeeklyCheckmarks.tsx - Weekly activity calendar
├── ReassuranceMessage.tsx - Motivational message
├── LastUpdated.tsx - Timestamp display
└── InvalidTokenPage.tsx - Error state

app/api/parent-link/
└── route.ts - Generate/regenerate share link

components/settings/
└── settings-parent-card.tsx - Share link management UI
```

## 2. Database & RPC

```sql
parent_access (
  id UUID PRIMARY KEY,
  student_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ
)

-- RPC Function
parent_dashboard_overview(p_share_token TEXT)
RETURNS JSONB
-- Returns: { student_user_id, plan, streak, progress }
-- SECURITY DEFINER - bypasses RLS
```

**Security:** Token is cryptographically secure (UUID). No auth required for parents (token-based access only).

## 3. Copy vs Refactor

**✅ Copy As-Is:**
- All parent dashboard components (read-only, no complex state)
- API route for link generation
- RPC function already exists

**🔧 Minor Improvements:**
- Add React Query for parent dashboard data fetching
- Consider adding link expiration (optional security enhancement)

## 4. New File Structure

```
src/
├── app/
│   ├── parent/[token]/page.tsx ✅
│   └── share/[token]/page.tsx ✅ (redirect to parent/)
│
├── components/parent/ ✅ (copy all as-is)
│
├── components/settings/
│   └── settings-parent-card.tsx ✅
│
└── app/api/parent-link/
    └── route.ts ✅
```

## 5. Queries

```typescript
// Fetch parent dashboard data (server-side)
const { data } = await supabase.rpc('parent_dashboard_overview', {
  p_share_token: token
});

// Generate share link (authenticated endpoint)
const { data } = await supabase
  .from('parent_access')
  .insert({
    student_user_id: userId,
    share_token: crypto.randomUUID()
  })
  .select()
  .single();

// Regenerate share link
await supabase
  .from('parent_access')
  .update({ share_token: crypto.randomUUID() })
  .eq('student_user_id', userId);

// Deactivate link
await supabase
  .from('parent_access')
  .update({ is_active: false })
  .eq('student_user_id', userId);
```

## 6. Porting Guide (6 hours)

### Phase 1: RPC Function (Already Exists)
Verify `parent_dashboard_overview` RPC function is in migrations.

### Phase 2: Parent Dashboard Pages (2 hours)
1. Copy parent dashboard page
2. Copy all parent components
3. Test token validation flow

### Phase 3: Share Link Management (2 hours)
1. Copy settings-parent-card component
2. Copy API route for link generation
3. Test generate/regenerate/deactivate flows

### Phase 4: Testing (2 hours)
- [ ] Valid token loads student data
- [ ] Invalid token shows error
- [ ] Deactivated link shows error
- [ ] No mutations allowed (read-only)
- [ ] Display name shown if set
- [ ] Streak displays correctly
- [ ] Weekly activity calendar works

## 7. Security Checklist

- [x] Token is UUID (cryptographically secure)
- [x] RPC uses SECURITY DEFINER (bypasses RLS)
- [x] Only active tokens work
- [x] No write operations from parent dashboard
- [x] Open redirect protection (if any redirects)

## 8. Success Criteria

✅ Students can generate share links
✅ Parents can view progress without login
✅ Invalid/deactivated tokens show error
✅ Read-only view (no checkboxes, no mutations)
✅ Display name shown if configured

**Next:** [08-guest-mode.md](./08-guest-mode.md)
