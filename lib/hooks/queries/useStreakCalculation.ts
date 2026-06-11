/**
 * useStreakCalculation Hook
 *
 * Calculate streak statistics from progress records without making a backend call.
 * Useful when you already have progress data loaded and want to compute streaks
 * client-side for display purposes.
 *
 * This hook uses pure calculation functions from progress-calculations.ts,
 * which mirror the database logic for consistency.
 *
 * @example
 * ```tsx
 * function StreakDisplay({ userId, planId }: Props) {
 *   const { data: progress } = useProgressQuery(userId, planId);
 *   const { data: plan } = usePlanQuery(planId);
 *
 *   // Calculate streak from cached progress data
 *   const streakStats = useStreakCalculation(
 *     progress || [],
 *     plan?.includes_weekends ?? true
 *   );
 *
 *   return (
 *     <div>
 *       <p>Current Streak: {streakStats.currentStreak} days</p>
 *       <p>Longest Streak: {streakStats.longestStreak} days</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useMemo } from 'react';
import type { UserProgress } from '@/lib/types';
import { calculateStreakFromDates, type StreakCalculation } from '@/lib/services/progress-calculations';

/**
 * Calculate streak statistics from progress records
 *
 * @param progressRecords - Array of user progress records
 * @param includesWeekends - Whether the study plan includes weekends
 * @param currentDate - Optional current date (defaults to today, useful for testing)
 * @returns Streak calculation including current streak, longest streak, total study days
 */
export function useStreakCalculation(
  progressRecords: UserProgress[] | undefined,
  includesWeekends: boolean,
  currentDate?: string
): StreakCalculation {
  return useMemo(() => {
    // Return zero stats if no progress data
    if (!progressRecords || progressRecords.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalStudyDays: 0,
        lastStudyDate: null,
      };
    }

    // Extract unique study dates from completed progress records
    const studyDates = Array.from(
      new Set(
        progressRecords
          .filter((record) => record.completed)
          .map((record) => {
            // Extract YYYY-MM-DD date from ISO timestamp
            return new Date(record.completed_at).toISOString().split('T')[0];
          })
      )
    ).sort();

    // Use provided date or default to today
    const today = currentDate || new Date().toISOString().split('T')[0];

    // Calculate streak using pure function
    return calculateStreakFromDates(studyDates, today, includesWeekends);
  }, [progressRecords, includesWeekends, currentDate]);
}

/**
 * Calculate if a streak is currently active
 *
 * @param streakData - Streak calculation result from useStreakCalculation
 * @returns True if the streak is active (current streak > 0)
 */
export function useIsStreakActive(streakData: StreakCalculation): boolean {
  return useMemo(() => {
    return streakData.currentStreak > 0;
  }, [streakData.currentStreak]);
}
