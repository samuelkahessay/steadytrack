import 'server-only';
import { getServerClient } from '@/lib/supabase/server';
import type { WeeklySummaryStats, StudyStreak, UserProgress } from '@/lib/types';
import {
  calculateProgressPercentage,
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
  try {
    const supabase = await getServerClient();

    // Get the plan schedule
    const { data: plan, error: planError } = await supabase
      .from('study_plans')
      .select('id, schedule, total_units')
      .eq('id', planId)
      .eq('user_id', userId)
      .single();

    if (planError || !plan) {
      return { data: null, error: 'Plan not found' };
    }

    // Get completed progress records
    const { data: progressRecords, error: progressError } = await supabase
      .from('user_progress')
      .select('subject, unit_id, completed')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('completed', true);

    if (progressError) {
      return { data: null, error: progressError.message };
    }

    const completedCount = progressRecords?.length || 0;
    const totalUnits = plan.total_units || 0;
    const overall = calculateProgressPercentage(completedCount, totalUnits);

    // Calculate by-subject breakdown
    const bySubject: Record<string, SubjectProgress> = {};
    const schedule = plan.schedule as { days?: Array<{ units?: { subject: string; unitId: string }[] }> };
    const allUnits = (schedule?.days ?? []).flatMap((d) => d?.units ?? []);

    // Count total units per subject
    for (const unit of allUnits) {
      if (!bySubject[unit.subject]) {
        bySubject[unit.subject] = { completed: 0, total: 0, percentage: 0 };
      }
      bySubject[unit.subject].total++;
    }

    // Count completed units per subject
    for (const record of progressRecords || []) {
      if (bySubject[record.subject]) {
        bySubject[record.subject].completed++;
      }
    }

    // Calculate percentages
    for (const subject in bySubject) {
      const { completed, total } = bySubject[subject];
      bySubject[subject].percentage = calculateProgressPercentage(completed, total);
    }

    return {
      data: {
        overall,
        bySubject,
        completedCount,
        totalUnits,
      },
      error: null,
    };
  } catch (error) {
    console.error('Calculate overall progress error:', error);
    return { data: null, error: 'Failed to calculate progress' };
  }
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
  try {
    const supabase = await getServerClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentProgress, error } = await supabase
      .from('user_progress')
      .select('completed_at, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('completed_at', sevenDaysAgo.toISOString());

    if (error) {
      return { data: null, error: error.message };
    }

    // Use the pure calculation function
    const summary = calculateWeeklySummaryStats(
      (recentProgress || []) as unknown as Pick<UserProgress, 'completed_at' | 'completed'>[]
    );

    return {
      data: summary,
      error: null,
    };
  } catch (error) {
    console.error('Get weekly summary error:', error);
    return { data: null, error: 'Failed to fetch weekly summary' };
  }
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
  try {
    const supabase = await getServerClient();

    const { data: streak, error } = await supabase
      .from('study_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // User might not have a streak yet
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data: streak as unknown as StudyStreak | null, error: null };
  } catch (error) {
    console.error('Get streak error:', error);
    return { data: null, error: 'Failed to fetch streak' };
  }
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
 * const { data: progress } = await supabase
 *   .from('user_progress')
 *   .select('*')
 *   .eq('user_id', userId)
 *   .eq('completed', true);
 *
 * const streakStats = calculateStreakFromProgress(
 *   progress,
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
