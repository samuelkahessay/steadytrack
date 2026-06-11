# Feature Analysis: Curriculum Browser (Public)

**Priority:** P1-High | **Complexity:** ⭐⭐⭐ (3/5) | **Effort:** 6-8 hours

## 1. Files Involved

```
app/curriculum/
├── page.tsx - Subject listing page
└── [slug]/page.tsx - Subject detail page

components/curriculum/
├── SubjectCard.tsx (294 lines) - Subject overview cards
├── UnitAccordion.tsx (312 lines) - Expandable unit list
├── OutcomeMicrocardCard.tsx (160 lines) - Microcard previews
├── CurriculumFilters.tsx (236 lines) - Grade/category filters
├── CurriculumSearch.tsx (224 lines) - Search with Fuse.js
└── SubjectShareButton.tsx - Share subject to social media

data/curriculum/ - Static JSON files (20+ subjects)
```

## 2. Copy vs Refactor

**✅ Copy As-Is:**
- All components are well-structured
- No auth dependencies (public feature)
- Good separation of concerns

**🔧 Minor Improvements:**
- Add SEO metadata (title, description, OG tags)
- Pre-build subject index for faster validation
- Consider static generation (ISR) for performance

## 3. New File Structure

```
src/
├── app/curriculum/
│   ├── page.tsx ✅ + SEO metadata
│   └── [slug]/page.tsx ✅ + SEO metadata
│
├── components/curriculum/ ✅ (copy all as-is)
│
└── data/curriculum/ ✅ (copy all static JSON)
```

## 4. Supabase Queries

```typescript
// Optional: Fetch microcards for outcome previews
const { data } = await supabase
  .from('content_microcards')
  .select('summary, pitfall')
  .eq('subject', subject)
  .eq('unit_id', unitId)
  .eq('status', 'active');
```

**Optimization:** Add caching (React Query or SWR) for microcard previews.

## 5. Porting Guide (6 hours)

### Phase 1: Static Data (1 hour)
1. Copy all curriculum JSON files
2. Verify data structure matches types
3. Test `getCurriculumData()` utility

### Phase 2: Pages (2 hours)
1. Port subject listing page
2. Port subject detail page
3. Add SEO metadata:
```typescript
export const metadata = {
  title: 'Browse Alberta Curriculum - SteadyTrack',
  description: 'Explore curriculum content for grades 11-12',
  openGraph: { title: '...', description: '...', images: [...] }
};
```

### Phase 3: Components (3 hours)
1. Copy all curriculum components
2. Test accordion expand/collapse
3. Test search functionality
4. Test filters (grade, category)

## 6. Testing Checklist

- [ ] Subject listing displays all 20+ subjects
- [ ] Filters work (grade 11, grade 12, categories)
- [ ] Search finds matching units/outcomes
- [ ] Accordion expands/collapses
- [ ] Microcard previews load
- [ ] No auth required (public access)
- [ ] SEO metadata present

## 7. Success Criteria

✅ Public users can browse all curriculum content
✅ Search returns relevant results
✅ Filters work correctly
✅ SEO optimized (title, description, OG tags)

**Next:** [05-microcards-quick-checks.md](./05-microcards-quick-checks.md)
