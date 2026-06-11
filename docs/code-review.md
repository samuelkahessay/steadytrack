# Code Review

## Summary
- Conducted a static and test-based review of the project.
- Identified functional regressions, data consistency risks, and test coverage gaps.

## Findings

### 1. Defaulting plan generation to resource distribution breaks unit-spacing assumptions
`generateStudySchedule` now defaults `distributionMode` to `'resource'`, which spreads resources across all days before the unit-level spacing logic can run.【F:lib/shared/generateStudySchedule.ts†L16-L125】 The existing unit tests still expect some days to remain empty when there are fewer units than scheduled days, but the new default fills every day and fails the suite (`emptyDays` is zero).【F:lib/shared/__tests__/generateStudySchedule.test.ts†L68-L79】【813c9c†L1-L47】 This indicates a regression relative to the documented behaviour and breaks automated verification. Either the default should remain `'unit'` or the downstream expectations (tests, UI copy) need to be updated in lockstep.

### 2. Guest resource merge can associate completions with the wrong subject
`/api/plan/merge-guest` filters guest `completedResources` using `scheduleUnits` entries shaped like `${subject}::${unitId}` but then only checks `key.endsWith(::${unitId})`.【F:app/api/plan/merge-guest/route.ts†L138-L170】 When two subjects share a unit identifier (common in the data set), a resource from Subject A will match Subject B's unit solely because the IDs match, causing progress to be attributed to the wrong subject. Including the subject in the comparison (or storing subject on the guest payload) would prevent the cross-subject collision.

### 3. Guest migration swallows progress insertion failures without surfacing an error
When bulk migrating guest completions, any `resource_progress` insert failure is logged but the API still returns success (`resErr` short-circuits to a 500 only if the insert call itself fails).【F:app/api/plan/migrate-guest/route.ts†L112-L170】 Because the earlier `user_progress` insert also ignores failures after logging, a user can receive a "success" response even though some or all progress rows were dropped. Consider wrapping the migration in a transaction or surfacing partial-failure details so users can retry instead of silently losing data.

## Recommendations
- Decide on the intended default distribution mode and align tests, docs, and downstream usage accordingly.
- Tighten resource merging subject checks (e.g., by carrying the subject through the guest payload or using a two-part key).
- Make guest migration failure modes explicit (transactional RPC or partial-success reporting) to avoid silently losing user progress.

