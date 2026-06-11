/**
 * Streak localStorage adapter
 * Handles study streak tracking with timezone-safe date calculations
 */

import * as storage from './local';
import { LocalStreak, LocalStreakSchema } from '@/types/storage';
import { DEFAULT_TIMEZONE } from '@/lib/constants';

/**
 * Streak operation result
 */
export type StreakResult<T> =
  | { success: true; data: T }
  | { success: false; error: storage.StorageError };

const STREAK_KEY = 'streak';

/**
 * Get current date in YYYY-MM-DD format for a given timezone
 */
export function getTodayDate(timezone: string): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Initialize or get streak
 */
export function getStreak(): LocalStreak {
  const streak = storage.get<LocalStreak | null>(STREAK_KEY, null);

  if (!streak) {
    const initialStreak: LocalStreak = {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: '',
      total_study_days: 0,
      updated_at: new Date().toISOString(),
    };

    storage.set(STREAK_KEY, initialStreak);
    return initialStreak;
  }

  try {
    return LocalStreakSchema.parse(streak);
  } catch (error) {
    console.error('Invalid streak data:', error);

    // Return fresh streak if validation fails
    const freshStreak: LocalStreak = {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: '',
      total_study_days: 0,
      updated_at: new Date().toISOString(),
    };

    storage.set(STREAK_KEY, freshStreak);
    return freshStreak;
  }
}

/**
 * Increment streak when user completes any unit
 * Returns updated streak and whether it increased
 * @returns StreakResult with streak data or error
 */
export function incrementStreak(
  timezone: string = DEFAULT_TIMEZONE
): StreakResult<{ streak: LocalStreak; increased: boolean }> {
  const current = getStreak();
  const today = getTodayDate(timezone);

  // If already studied today, no change
  if (current.last_study_date === today) {
    return {
      success: true,
      data: { streak: current, increased: false }
    };
  }

  const now = new Date().toISOString();

  // Calculate new streak
  let newCurrentStreak: number;

  if (!current.last_study_date) {
    // First study day ever
    newCurrentStreak = 1;
  } else {
    const daysSinceLastStudy = daysBetween(current.last_study_date, today);

    if (daysSinceLastStudy === 1) {
      // Consecutive day - increment
      newCurrentStreak = current.current_streak + 1;
    } else if (daysSinceLastStudy === 0) {
      // Same day (shouldn't happen due to check above, but just in case)
      newCurrentStreak = current.current_streak;
    } else {
      // Streak broken - reset to 1
      newCurrentStreak = 1;
    }
  }

  const newLongestStreak = Math.max(current.longest_streak, newCurrentStreak);

  const updated: LocalStreak = {
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
    last_study_date: today,
    total_study_days: current.total_study_days + 1,
    updated_at: now,
  };

  try {
    const validated = LocalStreakSchema.parse(updated);

    const result = storage.set(STREAK_KEY, validated);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        streak: validated,
        increased: newCurrentStreak > current.current_streak,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: new storage.StorageError(
        storage.StorageErrorType.PARSE_ERROR,
        'Failed to validate streak data',
        error
      ),
    };
  }
}

/**
 * Reset streak (e.g., for testing or manual reset)
 */
export function resetStreak(): LocalStreak {
  const reset: LocalStreak = {
    current_streak: 0,
    longest_streak: 0,
    last_study_date: '',
    total_study_days: 0,
    updated_at: new Date().toISOString(),
  };

  storage.set(STREAK_KEY, reset);
  return reset;
}

/**
 * Check if streak is still active (studied today or yesterday)
 */
export function isStreakActive(timezone: string = DEFAULT_TIMEZONE): boolean {
  const streak = getStreak();
  const today = getTodayDate(timezone);

  if (!streak.last_study_date) return false;

  const daysSinceLastStudy = daysBetween(streak.last_study_date, today);

  return daysSinceLastStudy <= 1;
}

/**
 * Get streak status (for display)
 */
export function getStreakStatus(
  timezone: string = DEFAULT_TIMEZONE
): {
  current: number;
  longest: number;
  isActive: boolean;
  studiedToday: boolean;
  totalDays: number;
} {
  const streak = getStreak();
  const today = getTodayDate(timezone);

  return {
    current: streak.current_streak,
    longest: streak.longest_streak,
    isActive: isStreakActive(timezone),
    studiedToday: streak.last_study_date === today,
    totalDays: streak.total_study_days,
  };
}

/**
 * Check for milestone achievements (25, 50, 75, 100 days)
 */
export function checkMilestone(streak: LocalStreak): number | null {
  const milestones = [25, 50, 75, 100];

  for (const milestone of milestones) {
    if (streak.current_streak === milestone) {
      return milestone;
    }
  }

  return null;
}

/**
 * Get study dates for weekly summary (last 7 days)
 */
export function getWeeklyActivityDates(
  timezone: string = DEFAULT_TIMEZONE
): string[] {
  const streak = getStreak();
  const today = getTodayDate(timezone);

  if (!streak.last_study_date) return [];

  const dates: string[] = [];
  const lastStudyDate = new Date(streak.last_study_date);

  // If streak is active and includes today
  if (streak.last_study_date === today) {
    dates.push(today);
  }

  // Add consecutive days going back (up to 7 days)
  const currentDate = new Date(lastStudyDate);
  let consecutiveDays = streak.current_streak;

  while (dates.length < 7 && consecutiveDays > 0) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (!dates.includes(dateStr)) {
      dates.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() - 1);
    consecutiveDays--;
  }

  return dates.sort();
}
