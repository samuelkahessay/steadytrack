# Feature Analysis: Settings & Account Management

**Priority:** P2-Medium | **Complexity:** ⭐⭐⭐ (3/5) | **Effort:** 6-8 hours

## 1. Files Involved

```
app/(dashboard)/settings/page.tsx (72 lines) - Settings layout

components/settings/
├── settings-subjects-card.tsx (504 lines) - ⚠️ LARGE - Plan regeneration
├── settings-parent-card.tsx (319 lines) - Share link management
└── settings-account-card.tsx (427 lines) - ⚠️ LARGE - Profile, data export, deletion

app/api/account/
├── export/route.ts - Data export (GDPR compliance)
└── delete/route.ts - Account deletion (soft delete)
```

## 2. Features

### 1. Subjects Card
- Regenerate plan with different subjects
- Duration/weekend options
- Reset progress toggle
- **Uses:** Same plan creation logic as `/plan/new`

### 2. Parent Card
- Generate share link → copy to clipboard
- Regenerate share link → new token
- Deactivate share link → set `is_active = false`

### 3. Account Card
- Update display name
- Update email (via Supabase Auth)
- Export data → Download JSON file
- Delete account → Confirmation modal → cascade delete

## 3. Copy vs Refactor

**🔧 Refactor Needed:**

### Problem: Large Settings Cards
- settings-subjects-card: 504 lines (too many responsibilities)
- settings-account-card: 427 lines (too many responsibilities)

**Proposed Refactor:**
```
SettingsCard (base wrapper) 40 lines
  ├─→ SubjectsSettingsForm 120 lines
  ├─→ ParentLinkManager 100 lines
  ├─→ AccountSettingsForm 80 lines
  ├─→ DataExportSection 60 lines
  └─→ DeleteAccountSection 80 lines
```

## 4. New File Structure

```
src/
├── app/(dashboard)/settings/
│   └── page.tsx ✅
│
├── components/settings/
│   ├── SettingsCard.tsx 🆕 (base wrapper)
│   │
│   ├── subjects/ 🆕 (extracted)
│   │   ├── SubjectsSettingsForm.tsx
│   │   └── PlanRegenerationWarning.tsx
│   │
│   ├── parent/ 🆕 (extracted)
│   │   ├── ShareLinkDisplay.tsx
│   │   └── ShareLinkActions.tsx
│   │
│   └── account/ 🆕 (extracted)
│       ├── ProfileSettingsForm.tsx
│       ├── DataExportButton.tsx
│       └── DeleteAccountButton.tsx
│
└── app/api/account/
    ├── export/route.ts ✅
    └── delete/route.ts ✅
```

## 5. Queries

```typescript
// Update profile
await supabase
  .from('profiles')
  .update({ display_name: displayName })
  .eq('id', userId);

// Generate share link
await supabase
  .from('parent_access')
  .insert({ student_user_id: userId, share_token: crypto.randomUUID() });

// Export data (all user tables)
const [plan, progress, streak, quickChecks, resources] = await Promise.all([
  supabase.from('study_plans').select('*').eq('user_id', userId),
  supabase.from('user_progress').select('*').eq('user_id', userId),
  supabase.from('study_streaks').select('*').eq('user_id', userId),
  supabase.from('quick_check_results').select('*').eq('user_id', userId),
  supabase.from('resource_progress').select('*').eq('user_id', userId)
]);

// Delete account (cascade via FK constraints)
await supabase.auth.admin.deleteUser(userId);
// All related records deleted automatically (ON DELETE CASCADE)
```

## 6. Porting Guide (6 hours)

### Phase 1: Base Components (2 hours)
1. Create SettingsCard wrapper component
2. Copy settings page layout
3. Test navigation

### Phase 2: Extract Settings Sections (3 hours)

**Subjects Settings:**
```typescript
// components/settings/subjects/SubjectsSettingsForm.tsx
export function SubjectsSettingsForm({ profile, plan }) {
  const [selectedSubjects, setSelectedSubjects] = useState(plan.subjects);
  const [durationWeeks, setDurationWeeks] = useState(plan.duration_weeks);

  const handleRegenerate = async () => {
    // Call /api/plan with new subjects
    // Same logic as plan creation
  };

  return (
    <>
      <SubjectSelector subjects={selectedSubjects} onChange={setSelectedSubjects} />
      <DurationSelector weeks={durationWeeks} onChange={setDurationWeeks} />
      <Button onClick={handleRegenerate}>Regenerate Plan</Button>
    </>
  );
}
```

**Parent Link Management:**
```typescript
// components/settings/parent/ShareLinkDisplay.tsx
export function ShareLinkDisplay({ token }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${window.location.origin}/parent/${token}`);
  };

  return (
    <div>
      <Input value={`${origin}/parent/${token}`} readOnly />
      <Button onClick={copyToClipboard}>Copy Link</Button>
    </div>
  );
}
```

**Account Management:**
```typescript
// components/settings/account/DeleteAccountButton.tsx
export function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    await fetch('/api/account/delete', { method: 'DELETE' });
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      <Button onClick={() => setShowConfirm(true)} variant="destructive">
        Delete Account
      </Button>
      {showConfirm && (
        <Dialog>
          <p>Are you sure? This cannot be undone.</p>
          <Button onClick={handleDelete}>Yes, Delete</Button>
        </Dialog>
      )}
    </>
  );
}
```

### Phase 3: API Routes (1 hour)
```bash
cp app/api/account/export/route.ts NEW_PROJECT/app/api/account/export/
cp app/api/account/delete/route.ts NEW_PROJECT/app/api/account/delete/
```

## 7. Testing Checklist

- [ ] **Subjects Settings:**
  - [ ] Can select new subjects
  - [ ] Regeneration works
  - [ ] Warning shows if progress exists
  - [ ] Reset toggle works

- [ ] **Parent Link:**
  - [ ] Can generate link
  - [ ] Copy to clipboard works
  - [ ] Can regenerate link
  - [ ] Can deactivate link

- [ ] **Account Settings:**
  - [ ] Display name saves
  - [ ] Email update works (Supabase Auth)
  - [ ] Data export downloads JSON
  - [ ] Account deletion requires confirmation
  - [ ] Account deletion cascades correctly

## 8. Success Criteria

✅ All settings features work correctly
✅ Plan regeneration preserves/resets progress as configured
✅ Share link management functional
✅ Data export returns complete JSON
✅ Account deletion cascades to all tables
✅ All confirmations/warnings present

**Next:** [10-study-mode.md](./10-study-mode.md)
