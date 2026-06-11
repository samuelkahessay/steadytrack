/**
 * Progress Calculation Utilities
 *
 * Pure TypeScript functions for progress calculations that can be used
 * by both server and client code. These functions have no database dependencies.
 *
 * These functions centralize the business logic that was previously duplicated
 * across database RPC functions and client-side code (GuestPlanContext).
 *
 * ## Architecture Notes
 *
 * **SQL vs TypeScript Implementation:**
 * - SQL functions in `supabase/migrations/` (e.g., `mark_unit_complete`, `count_missed_study_days`)
 *   are the source of truth for database operations and use PL/pgSQL
 * - TypeScript functions here mirror that logic for client/server code and testing
 * - Both implementations must be kept in sync manually
 * - Comprehensive test coverage in `__tests__/progress-calculations.test.ts` helps ensure consistency
 *
 * **Usage:**
 * - Server components: Import from `@/lib/services/progress` for data-fetching helpers
 * - Client components: Import from `@/lib/services/progress-calculations` for pure calculations
 * - Mutations: Use `detectProgressMilestone()` from `useProgressMutation` for client-side milestone detection
 * - Guest mode: `GuestPlanContext` uses `calculateStreakFromDates()` for weekend-aware streaks
 *
 * @see lib/services/progress.ts - Server-side progress service with database access
 * @see lib/hooks/queries/mutations/useProgressMutation.ts - React Query mutations with milestone detection
 * @see contexts/GuestPlanContext.tsx - Guest mode implementation using streak calculations
 */

import type { UserProgress, WeeklySummaryStats } from '@/lib/types';

/**
 * Streak calculation result
 */
export interface StreakCalculation {
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  lastStudyDate: string | null;
}

/**
 * Count how many required study days are in the gap between two dates.
 * This is used for weekend-aware streak calculations.
 *
 * Uses UTC date arithmetic to avoid DST transition issues. During DST transitions,
 * the time difference between consecutive calendar dates can be 23 or 25 hours,
 * which would break millisecond-based calculations.
 *
 * @param lastStudyDate - The last date the user studied (YYYY-MM-DD)
 * @param currentDate - The current date (YYYY-MM-DD)
 * @param includesWeekends - Whether the study plan includes weekends
 * @returns Number of missed required study days (0 = streak continues)
 *
 * @example
 * // Mon-Fri plan: Friday → Monday has 0 missed days (weekend doesn't count)
 * countMissedStudyDays('2025-01-10', '2025-01-13', false) // 0
 *
 * // Mon-Fri plan: Thursday → Monday has 1 missed day (Friday)
 * countMissedStudyDays('2025-01-09', '2025-01-13', false) // 1
 *
 * // 7-day plan: Any gap counts
 * countMissedStudyDays('2025-01-10', '2025-01-13', true) // 2
 *
 * // DST transition: Sat → Mon (7-day plan) = 1 missed day (Sunday)
 * countMissedStudyDays('2024-03-09', '2024-03-11', true) // 1
 */
export function countMissedStudyDays(
  lastStudyDate: string,
  currentDate: string,
  includesWeekends: boolean
): number {
  // Parse ISO date strings as UTC dates at noon to avoid DST edge cases
  // YYYY-MM-DD input becomes YYYY-MM-DDT12:00:00Z
  const last = new Date(lastStudyDate + 'T12:00:00Z');
  const current = new Date(currentDate + 'T12:00:00Z');

  // Calculate calendar days between using UTC timestamps
  // This works correctly across DST transitions
  const lastDayUTC = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const currentDayUTC = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());

  // Gap = number of days between dates, exclusive of endpoints
  // e.g., Jan 1 to Jan 3 has a gap of 1 (Jan 2 is in between)
  const totalDaysBetween = Math.floor((currentDayUTC - lastDayUTC) / (1000 * 60 * 60 * 24));
  const gapDays = totalDaysBetween - 1;

  // No gap = consecutive days or same day, streak continues
  if (gapDays <= 0) {
    return 0;
  }

  // If weekends are included, every day in the gap is a missed day
  if (includesWeekends) {
    return gapDays;
  }

  // If weekends are excluded, count only weekdays in the gap
  // We iterate day by day using UTC date arithmetic
  let missedDays = 0;
  const checkDate = new Date(lastDayUTC);
  checkDate.setUTCDate(checkDate.getUTCDate() + 1); // Start from day after lastStudyDate

  const endDate = new Date(currentDayUTC);
  while (checkDate < endDate) {
    const dayOfWeek = checkDate.getUTCDay(); // 0=Sunday, 6=Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Weekday (Mon-Fri) counts as a missed study day
      missedDays++;
    }
    checkDate.setUTCDate(checkDate.getUTCDate() + 1);
  }

  return missedDays;
}

/**
 * Calculate streak statistics from an array of study dates.
 * This is a pure function that implements the same logic as the database
 * RPC functions but in TypeScript.
 *
 * @param studyDates - Array of dates when the user studied (YYYY-MM-DD format), sorted ascending
 * @param currentDate - The current date (YYYY-MM-DD format)
 * @param includesWeekends - Whether the study plan includes weekends
 * @returns Streak statistics including current streak, longest streak, and total study days
 *
 * @example
 * const dates = ['2025-01-10', '2025-01-11', '2025-01-13']; // Fri, Sat, Mon
 * calculateStreakFromDates(dates, '2025-01-13', false);
 * // { currentStreak: 2, longestStreak: 2, totalStudyDays: 2, lastStudyDate: '2025-01-13' }
 * // Note: Saturday doesn't count for Mon-Fri plans
 */
export function calculateStreakFromDates(
  studyDates: string[],
  currentDate: string,
  includesWeekends: boolean
): StreakCalculation {
  if (!studyDates || studyDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalStudyDays: 0,
      lastStudyDate: null,
    };
  }

  // Remove duplicates and sort
  const uniqueDates = Array.from(new Set(studyDates)).sort();
  const totalStudyDays = uniqueDates.length;

  // Calculate longest streak
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const missedDays = countMissedStudyDays(
      uniqueDates[i - 1],
      uniqueDates[i],
      includesWeekends
    );

    if (missedDays === 0) {
      // Streak continues
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      // Streak broken, restart
      runningStreak = 1;
    }
  }

  // Calculate current streak (working backwards from current date)
  let currentStreak = 0;
  const lastStudyDate = uniqueDates[uniqueDates.length - 1];

  // Check if the most recent study date counts towards current streak
  const daysSinceLastStudy = countMissedStudyDays(
    lastStudyDate,
    currentDate,
    includesWeekends
  );

  if (daysSinceLastStudy === 0) {
    // The last study date is recent enough to count
    currentStreak = 1;

    // Work backwards to find how long the current streak is
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const missedDays = countMissedStudyDays(
        uniqueDates[i],
        uniqueDates[i + 1],
        includesWeekends
      );

      if (missedDays === 0) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalStudyDays,
    lastStudyDate,
  };
}

/**
 * Detect if a milestone has been reached based on progress percentage change.
 * Milestones are at 25%, 50%, 75%, and 100%.
 *
 * @param previousPercentage - The previous completion percentage (0-100)
 * @param currentPercentage - The current completion percentage (0-100)
 * @returns The milestone value (25, 50, 75, or 100) if reached, null otherwise
 *
 * @example
 * detectMilestone(24, 25) // 25
 * detectMilestone(49, 51) // 50
 * detectMilestone(23, 26) // 25 (first milestone crossed)
 * detectMilestone(30, 35) // null (no milestone crossed)
 */
export function detectMilestone(
  previousPercentage: number,
  currentPercentage: number
): number | null {
  const milestones = [25, 50, 75, 100];

  for (const milestone of milestones) {
    if (currentPercentage >= milestone && previousPercentage < milestone) {
      return milestone;
    }
  }

  return null;
}

/**
 * Calculate progress percentage.
 *
 * @param completedCount - Number of completed units
 * @param totalUnits - Total number of units in the plan
 * @returns Percentage complete (0-100), rounded to nearest integer
 *
 * @example
 * calculateProgressPercentage(25, 100) // 25
 * calculateProgressPercentage(7, 20) // 35
 * calculateProgressPercentage(0, 100) // 0
 */
export function calculateProgressPercentage(
  completedCount: number,
  totalUnits: number
): number {
  if (totalUnits <= 0) {
    return 0;
  }
  return Math.round((completedCount / totalUnits) * 100);
}

/**
 * Calculate weekly summary statistics from user progress records.
 * Returns activity dates and total units completed in the last 7 days.
 *
 * @param progressRecords - Array of all user progress records
 * @param referenceDate - The reference date to calculate "last 7 days" from (defaults to now)
 * @returns Weekly summary with activity dates and total units
 *
 * @example
 * const progress = [
 *   { completed_at: '2025-01-10T10:00:00Z', completed: true, ... },
 *   { completed_at: '2025-01-11T15:30:00Z', completed: true, ... },
 * ];
 * calculateWeeklySummaryStats(progress);
 * // { activityDates: ['2025-01-10', '2025-01-11'], totalUnits: 2 }
 */
export function calculateWeeklySummaryStats(
  progressRecords: Pick<UserProgress, 'completed_at' | 'completed'>[],
  referenceDate: Date = new Date()
): WeeklySummaryStats {
  const sevenDaysAgo = new Date(referenceDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filter to only completed records in the last 7 days
  const recentProgress = progressRecords.filter((record) => {
    if (!record.completed) return false;

    const completedAt = new Date(record.completed_at);
    return completedAt >= sevenDaysAgo && completedAt <= referenceDate;
  });

  // Extract unique dates (YYYY-MM-DD format)
  const activityDates = Array.from(
    new Set(
      recentProgress.map((p) => {
        const date = new Date(p.completed_at);
        return date.toISOString().split('T')[0];
      })
    )
  ).sort();

  return {
    activityDates,
    totalUnits: recentProgress.length,
  };
}

/**
 * Progress planning result
 */
export interface ProgressPacing {
  requiredUnitsPerDay: number;
  requiredStudyDays: number;
  daysRemaining: number;
  isOnTrack: boolean;
}

/**
 * Calculate the required pace to complete a plan by a target date
 *
 * This function calculates how many units per day a user needs to complete
 * to finish their study plan by the target end date, considering their
 * study schedule (weekends included or not).
 *
 * @param completedUnits - Number of units already completed
 * @param totalUnits - Total units in the plan
 * @param startDate - Plan start date (YYYY-MM-DD)
 * @param endDate - Plan end date (YYYY-MM-DD)
 * @param currentDate - Current date (YYYY-MM-DD, defaults to today)
 * @param includesWeekends - Whether the study plan includes weekends
 * @returns Required units per day and whether user is on track
 *
 * @example
 * ```ts
 * const pacing = calculateRequiredPace(25, 100, '2025-01-01', '2025-03-31', '2025-01-13', false);
 * console.log(`Need to complete ${pacing.requiredUnitsPerDay.toFixed(1)} units/day`);
 * console.log(`On track: ${pacing.isOnTrack}`);
 * ```
 */
export function calculateRequiredPace(
  completedUnits: number,
  totalUnits: number,
  startDate: string,
  endDate: string,
  currentDate?: string,
  includesWeekends: boolean = true
): ProgressPacing {
  const today = currentDate || new Date().toISOString().split('T')[0];
  const remainingUnits = totalUnits - completedUnits;

  // Parse dates using UTC at noon to avoid DST issues
  const todayDate = new Date(today + 'T12:00:00Z');
  const endDateObj = new Date(endDate + 'T12:00:00Z');
  const startDateObj = new Date(startDate + 'T12:00:00Z');

  // Calculate total days between current date and end date
  const totalDaysRemaining = Math.floor(
    (endDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If past end date, return zero pace
  if (totalDaysRemaining < 0) {
    return {
      requiredUnitsPerDay: 0,
      requiredStudyDays: 0,
      daysRemaining: totalDaysRemaining,
      isOnTrack: completedUnits >= totalUnits,
    };
  }

  // Calculate study days remaining (considering weekend schedule)
  let studyDaysRemaining = 0;
  if (includesWeekends) {
    // All days count
    studyDaysRemaining = totalDaysRemaining;
  } else {
    // Count only weekdays
    const cursor = new Date(todayDate);
    const end = new Date(endDateObj);
    while (cursor <= end) {
      const dayOfWeek = cursor.getUTCDay(); // 0=Sunday, 6=Saturday
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        studyDaysRemaining++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Calculate required units per day
  const requiredUnitsPerDay =
    studyDaysRemaining > 0 ? remainingUnits / studyDaysRemaining : remainingUnits;

  // Calculate actual pace so far
  const totalDaysElapsed = Math.floor(
    (todayDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  let studyDaysElapsed = 0;
  if (includesWeekends) {
    studyDaysElapsed = totalDaysElapsed;
  } else {
    // Count weekdays elapsed
    const cursor = new Date(startDateObj);
    const end = new Date(todayDate);
    while (cursor < end) {
      const dayOfWeek = cursor.getUTCDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        studyDaysElapsed++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Expected pace is total units divided by total study days in plan
  const totalPlanDays = Math.floor(
    (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );
  let totalStudyDays = totalPlanDays;
  if (!includesWeekends) {
    // Count total weekdays in plan
    totalStudyDays = 0;
    const cursor = new Date(startDateObj);
    const end = new Date(endDateObj);
    while (cursor <= end) {
      const dayOfWeek = cursor.getUTCDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        totalStudyDays++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const expectedUnitsPerDay = totalUnits / totalStudyDays;
  const expectedCompletedByNow = studyDaysElapsed * expectedUnitsPerDay;

  // User is on track if they've completed at least as many units as expected
  const isOnTrack = completedUnits >= expectedCompletedByNow;

  return {
    requiredUnitsPerDay,
    requiredStudyDays: studyDaysRemaining,
    daysRemaining: totalDaysRemaining,
    isOnTrack,
  };
}

/**
 * Predict when a user will complete their plan based on current pace
 *
 * Uses the user's average units per day (calculated from actual progress)
 * to predict when they will complete all remaining units.
 *
 * @param completedUnits - Number of units already completed
 * @param totalUnits - Total units in the plan
 * @param progressRecords - Array of completed progress records (to calculate pace)
 * @param currentDate - Current date (YYYY-MM-DD, defaults to today)
 * @param includesWeekends - Whether the study plan includes weekends
 * @returns Predicted completion date (YYYY-MM-DD) or null if no data
 *
 * @example
 * ```ts
 * const completionDate = predictCompletionDate(25, 100, progressRecords, '2025-01-13', false);
 * if (completionDate) {
 *   console.log(`You'll finish around ${completionDate}`);
 * }
 * ```
 */
export function predictCompletionDate(
  completedUnits: number,
  totalUnits: number,
  progressRecords: Pick<UserProgress, 'completed_at' | 'completed'>[],
  currentDate?: string,
  _includesWeekends: boolean = true
): string | null {
  if (completedUnits >= totalUnits) {
    // Already completed
    return currentDate || new Date().toISOString().split('T')[0];
  }

  if (!progressRecords || progressRecords.length === 0) {
    // No progress data to calculate pace
    return null;
  }

  const today = currentDate || new Date().toISOString().split('T')[0];

  // Get unique study dates
  const studyDates = Array.from(
    new Set(
      progressRecords
        .filter((r) => r.completed)
        .map((r) => new Date(r.completed_at).toISOString().split('T')[0])
    )
  ).sort();

  if (studyDates.length === 0) {
    return null;
  }

  // Calculate days elapsed since first study date
  const firstDate = new Date(studyDates[0] + 'T12:00:00Z');
  const todayDate = new Date(today + 'T12:00:00Z');
  const daysElapsed = Math.floor(
    (todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysElapsed <= 0) {
    return null;
  }

  // Calculate average units per day based on actual progress
  const unitsPerDay = completedUnits / daysElapsed;

  if (unitsPerDay <= 0) {
    return null;
  }

  // Calculate days needed to complete remaining units
  const remainingUnits = totalUnits - completedUnits;
  const daysNeeded = Math.ceil(remainingUnits / unitsPerDay);

  // Add days to today to get predicted completion date
  const completionDate = new Date(todayDate);
  completionDate.setUTCDate(completionDate.getUTCDate() + daysNeeded);

  return completionDate.toISOString().split('T')[0];
}

/**
 * Check if a user is on track to complete their plan by the end date
 *
 * This is a convenience function that combines calculateRequiredPace
 * with a simple boolean check.
 *
 * @param completedUnits - Number of units already completed
 * @param totalUnits - Total units in the plan
 * @param startDate - Plan start date (YYYY-MM-DD)
 * @param endDate - Plan end date (YYYY-MM-DD)
 * @param currentDate - Current date (YYYY-MM-DD, defaults to today)
 * @param includesWeekends - Whether the study plan includes weekends
 * @returns True if user is on pace to complete on time
 *
 * @example
 * ```ts
 * const onTrack = isOnTrack(25, 100, '2025-01-01', '2025-03-31', '2025-01-13', false);
 * if (!onTrack) {
 *   console.log('Warning: You need to pick up the pace!');
 * }
 * ```
 */
export function isOnTrack(
  completedUnits: number,
  totalUnits: number,
  startDate: string,
  endDate: string,
  currentDate?: string,
  includesWeekends: boolean = true
): boolean {
  const pacing = calculateRequiredPace(
    completedUnits,
    totalUnits,
    startDate,
    endDate,
    currentDate,
    includesWeekends
  );
  return pacing.isOnTrack;
}
