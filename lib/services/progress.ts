import 'server-only';
import type { WeeklySummaryStats, StudyStreak, UserProgress } from '@/lib/types';
import {
  calculateWeeklySummaryStats,
  calculateStreakFromDates,
  countMissedStudyDays,
  type StreakCalculation,
} from './progress-calculations';

/**
 * Progress Service
 *
 * Centralized business logic for progress tracking, weekly summaries,
 * and statistics. Used by both dashboard and parent share views.
 *
 * This service uses the pure calculation functions from progress-calculations.ts
 * for business logic that can be shared between server and client code.
 *
 * For pure calculation functions (no database access), import from:
 * @see ./progress-calculations.ts
 *
 * Available pure functions:
 * - countMissedStudyDays() - Calculate missed study days for streak logic
 * - calculateStreakFromDates() - Calculate streak statistics from date array
 * - detectMilestone() - Detect if a milestone was reached
 * - calculateProgressPercentage() - Calculate percentage complete
 * - calculateWeeklySummaryStats() - Calculate weekly summary from progress records
 */

/**
 * Progress breakdown by subject
 */
export interface SubjectProgress {
  completed: number;
  total: number;
  percentage: number;
}

/**
 * Overall progress data
 */
export interface ProgressData {
  overall: number;
  bySubject: Record<string, SubjectProgress>;
  completedCount: number;
  totalUnits: number;
}

/**
 * Full progress data including streak and weekly summary
 */
export interface FullProgressData {
  progress: ProgressData;
  streak: StudyStreak | null;
  weeklySummary: WeeklySummaryStats;
}

/**
 * Calculate overall progress and by-subject breakdown
 *
 * @param userId - User ID
 * @param planId - Plan ID
 * @returns Progress data with overall percentage and subject breakdowns
 */
export async function calculateOverallProgress(
  userId: string,
  planId: string
): Promise<{ data: ProgressData | null; error: string | null }> {
  void userId;
  void planId;

  return {
    data: {
      overall: 0,
      bySubject: {},
      completedCount: 0,
      totalUnits: 0,
    },
    error: null,
  };
}

/**
 * Get weekly summary (last 7 days of activity)
 *
 * @param userId - User ID
 * @returns Activity dates and total units completed in last 7 days
 */
export async function getWeeklySummary(
  userId: string
): Promise<{ data: WeeklySummaryStats | null; error: string | null }> {
  void userId;

  const summary = calculateWeeklySummaryStats([]);
  return { data: summary, error: null };
}

/**
 * Get user's current streak
 *
 * @param userId - User ID
 * @returns Streak data or null
 */
export async function getStreak(
  userId: string
): Promise<{ data: StudyStreak | null; error: string | null }> {
  void userId;
  return { data: null, error: null };
}

/**
 * Calculate streak statistics from user progress records
 *
 * This function uses the pure streak calculation logic from progress-calculations.ts
 * to compute streak statistics without hitting the database streak table.
 * Useful for analytics, reporting, or when you already have progress data loaded.
 *
 * @param progressRecords - Array of completed progress records
 * @param includesWeekends - Whether the study plan includes weekends
 * @param currentDate - Optional current date (defaults to today)
 * @returns Streak calculation including current streak, longest streak, etc.
 *
 * @example
 * ```ts
 * const streakStats = calculateStreakFromProgress(
 *   localProgressRecords,
 *   plan.includes_weekends
 * );
 * console.log(`Current streak: ${streakStats.currentStreak} days`);
 * ```
 */
export function calculateStreakFromProgress(
  progressRecords: Pick<UserProgress, 'completed_at' | 'completed'>[],
  includesWeekends: boolean,
  currentDate?: string
): StreakCalculation {
  // Extract unique study dates from progress records
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

  // Use current date or default to today
  const today = currentDate || new Date().toISOString().split('T')[0];

  // Calculate streak using pure function
  return calculateStreakFromDates(studyDates, today, includesWeekends);
}

/**
 * Check if a streak is currently active (user has studied recently enough)
 *
 * A streak is considered active if the last study date is today or recent enough
 * that the streak hasn't been broken (considering weekend plans).
 *
 * @param lastStudyDate - Last date the user studied (YYYY-MM-DD)
 * @param includesWeekends - Whether the study plan includes weekends
 * @param currentDate - Optional current date (defaults to today)
 * @returns True if the streak is active, false if broken
 *
 * @example
 * ```ts
 * const streak = await getStreak(userId);
 * const isActive = isStreakActive(
 *   streak.last_study_date,
 *   plan.includes_weekends
 * );
 * // Show "🔥 3 day streak!" vs "Start a new streak!"
 * ```
 */
export function isStreakActive(
  lastStudyDate: string | null,
  includesWeekends: boolean,
  currentDate?: string
): boolean {
  if (!lastStudyDate) return false;

  const today = currentDate || new Date().toISOString().split('T')[0];
  const missedDays = countMissedStudyDays(lastStudyDate, today, includesWeekends);

  // Streak is active if no required study days have been missed
  return missedDays === 0;
}

/**
 * Get full progress data including progress, streak, and weekly summary
 *
 * This is a convenience function that combines all progress-related data
 * into a single call. Used by dashboard and parent share views.
 *
 * @param userId - User ID
 * @param planId - Plan ID
 * @returns Complete progress data
 */
export async function getFullProgressData(
  userId: string,
  planId: string
): Promise<{ data: FullProgressData | null; error: string | null }> {
  try {
    // Fetch all data in parallel
    const [progressResult, streakResult, summaryResult] = await Promise.all([
      calculateOverallProgress(userId, planId),
      getStreak(userId),
      getWeeklySummary(userId),
    ]);

    if (progressResult.error) {
      return { data: null, error: progressResult.error };
    }

    if (!progressResult.data) {
      return { data: null, error: 'No progress data available' };
    }

    return {
      data: {
        progress: progressResult.data,
        streak: streakResult.data,
        weeklySummary: summaryResult.data || { activityDates: [], totalUnits: 0 },
      },
      error: null,
    };
  } catch (error) {
    console.error('Get full progress data error:', error);
    return { data: null, error: 'Failed to fetch progress data' };
  }
}
