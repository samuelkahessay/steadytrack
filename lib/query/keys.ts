/**
 * Query Keys Registry
 *
 * This file defines a centralized, type-safe query key factory for React Query.
 *
 * Benefits:
 * - Consistent key structure across the app
 * - Easy to invalidate related queries
 * - Type-safe key generation
 * - Hierarchical structure for partial invalidation
 *
 * Usage Examples:
 * ```ts
 * // Use in a query
 * useQuery({ queryKey: queryKeys.streaks.byUser(userId), ... })
 *
 * // Invalidate all streak queries
 * queryClient.invalidateQueries({ queryKey: queryKeys.streaks.all })
 *
 * // Invalidate specific user's streak
 * queryClient.invalidateQueries({ queryKey: queryKeys.streaks.byUser(userId) })
 * ```
 */

/**
 * Query key factory for streaks
 */
export const queryKeys = {
  /**
   * Streak-related queries
   */
  streaks: {
    // Invalidate all streak queries: ['streaks']
    all: ['streaks'] as const,

    // Single user's streak: ['streaks', 'user', userId]
    byUser: (userId: string) => [...queryKeys.streaks.all, 'user', userId] as const,
  },

  /**
   * Progress-related queries
   */
  progress: {
    // Invalidate all progress queries: ['progress']
    all: ['progress'] as const,

    // All progress for a plan: ['progress', 'plan', planId]
    byPlan: (planId: string) => [...queryKeys.progress.all, 'plan', planId] as const,

    // Specific user's progress: ['progress', 'user', userId]
    byUser: (userId: string) => [...queryKeys.progress.all, 'user', userId] as const,

    // User progress for specific plan: ['progress', 'user', userId, 'plan', planId]
    byUserAndPlan: (userId: string, planId: string) =>
      [...queryKeys.progress.byUser(userId), 'plan', planId] as const,

    // Weekly summary: ['progress', 'weekly-summary', userId, planId]
    weeklySummary: (userId: string, planId: string) =>
      [...queryKeys.progress.all, 'weekly-summary', userId, planId] as const,
  },

  /**
   * Study plan-related queries
   */
  plans: {
    // Invalidate all plan queries: ['plans']
    all: ['plans'] as const,

    // Specific plan: ['plans', planId]
    byId: (planId: string) => [...queryKeys.plans.all, planId] as const,

    // User's plans: ['plans', 'user', userId]
    byUser: (userId: string) => [...queryKeys.plans.all, 'user', userId] as const,

    // User's active plan: ['plans', 'user', userId, 'active']
    userActive: (userId: string) => [...queryKeys.plans.byUser(userId), 'active'] as const,
  },

  /**
   * Microcard-related queries
   */
  microcards: {
    // Invalidate all microcard queries: ['microcards']
    all: ['microcards'] as const,

    // Microcards for a subject: ['microcards', 'subject', subject]
    bySubject: (subject: string) => [...queryKeys.microcards.all, 'subject', subject] as const,

    // Microcards for specific outcome: ['microcards', 'outcome', outcomeCode]
    byOutcome: (outcomeCode: string) =>
      [...queryKeys.microcards.all, 'outcome', outcomeCode] as const,

    // Microcards for a unit: ['microcards', 'unit', unitId, subject]
    byUnit: (unitId: string, subject: string) =>
      [...queryKeys.microcards.all, 'unit', unitId, subject] as const,

    // Batch fetch for multiple units: ['microcards', 'batch', subject, outcomeCodes...]
    batch: (subject: string, outcomeCodes: string[]) =>
      [...queryKeys.microcards.all, 'batch', subject, ...outcomeCodes.sort()] as const,

    // Microcards for multiple subjects: ['microcards', 'subjects', subject1, subject2, ...]
    bySubjects: (subjects: string[]) =>
      [...queryKeys.microcards.all, 'subjects', ...subjects.sort()] as const,
  },

  /**
   * Quick check-related queries
   */
  quickChecks: {
    // Invalidate all quick check queries: ['quick-checks']
    all: ['quick-checks'] as const,

    // Quick check results for a unit: ['quick-checks', 'unit', unitId, planId]
    byUnit: (unitId: string, planId: string) =>
      [...queryKeys.quickChecks.all, 'unit', unitId, planId] as const,

    // User's quick check results: ['quick-checks', 'user', userId, planId]
    byUser: (userId: string, planId: string) =>
      [...queryKeys.quickChecks.all, 'user', userId, planId] as const,
  },

  /**
   * Resource progress-related queries
   */
  resources: {
    // Invalidate all resource queries: ['resources']
    all: ['resources'] as const,

    // Resource progress for a plan: ['resources', 'plan', planId]
    byPlan: (planId: string) => [...queryKeys.resources.all, 'plan', planId] as const,

    // Specific resource progress: ['resources', 'resource', resourceId, userId]
    byResource: (resourceId: string, userId: string) =>
      [...queryKeys.resources.all, 'resource', resourceId, userId] as const,

    // User's resource progress for plan: ['resources', 'user', userId, planId]
    byUserAndPlan: (userId: string, planId: string) =>
      [...queryKeys.resources.all, 'user', userId, planId] as const,
  },

  /**
   * Parent access-related queries
   */
  parentAccess: {
    // Invalidate all parent access queries: ['parent-access']
    all: ['parent-access'] as const,

    // Parent access for a user: ['parent-access', 'user', userId]
    byUser: (userId: string) => [...queryKeys.parentAccess.all, 'user', userId] as const,

    // Parent access by token: ['parent-access', 'token', token]
    byToken: (token: string) => [...queryKeys.parentAccess.all, 'token', token] as const,
  },

  /**
   * Dashboard-related queries (composite data)
   */
  dashboard: {
    // Invalidate all dashboard queries: ['dashboard']
    all: ['dashboard'] as const,

    // Dashboard data for user and plan: ['dashboard', userId, planId]
    byUserAndPlan: (userId: string, planId: string) =>
      [...queryKeys.dashboard.all, userId, planId] as const,
  },

  /**
   * Profile-related queries
   */
  profiles: {
    // Invalidate all profile queries: ['profiles']
    all: ['profiles'] as const,

    // Specific user profile: ['profiles', userId]
    byUser: (userId: string) => [...queryKeys.profiles.all, userId] as const,
  },

  /**
   * Share link-related queries
   */
  shareLinks: {
    // Invalidate all share link queries: ['share-links']
    all: ['share-links'] as const,

    // Share link for a user: ['share-links', 'user', userId]
    byUser: (userId: string) => [...queryKeys.shareLinks.all, 'user', userId] as const,
  },

  /**
   * Settings-related queries (composite data for settings page)
   */
  settings: {
    // Invalidate all settings queries: ['settings']
    all: ['settings'] as const,

    // Settings plan data for user: ['settings', 'plan', userId]
    plan: (userId: string) => [...queryKeys.settings.all, 'plan', userId] as const,
  },
} as const;

/**
 * Type helper to extract query key type
 *
 * Usage:
 * ```ts
 * type StreakKey = QueryKey<typeof queryKeys.streaks.byUser>;
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryKey<T extends (...args: any[]) => readonly any[]> = ReturnType<T>;
