/**
 * useDashboardQueryLocal Hook
 *
 * localStorage-based version of useDashboardQuery for local-first architecture.
 * Reads all dashboard data from localStorage.
 *
 * Features:
 * - Reads from Phase 1 localStorage adapters
 * - No API calls, no auth required
 * - Automatic reactivity with window focus
 * - Compatible with existing DashboardClient interface
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useDashboardQueryLocal(planId);
 *
 * const streak = data?.streak;
 * const progress = data?.progress;
 * const weeklySummary = data?.weeklySummary;
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import type { StudyStreak, UserProgress, WeeklySummaryStats } from '@/lib/types';
import * as progressStorage from '@/lib/storage/progress';
import * as streakStorage from '@/lib/storage/streak';

interface DashboardData {
  streak: StudyStreak | null;
  progress: UserProgress[];
  weeklySummary: WeeklySummaryStats;
}

/**
 * Fetch all dashboard data from localStorage
 */
function fetchDashboardDataLocal(planId: string): DashboardData {
  // Get streak from localStorage
  const localStreak = streakStorage.getStreak();

  // Get progress from localStorage
  const localProgress = progressStorage.getProgress(planId);

  // Convert LocalUserProgress to UserProgress for compatibility
  const progress: UserProgress[] = localProgress.map((p) => ({
    id: p.id,
    user_id: '', // No user ID in local-first
    plan_id: p.plan_id,
    unit_id: p.unit_id,
    subject: p.subject,
    completed: p.completed,
    completed_at: p.started_at, // Map to old field name for compatibility
    created_at: p.created_at,
  }));

  // Convert LocalStreak to StudyStreak for compatibility
  const streak: StudyStreak | null = {
    id: 'local-streak',
    user_id: '', // No user ID in local-first
    current_streak: localStreak.current_streak,
    longest_streak: localStreak.longest_streak,
    last_study_date: localStreak.last_study_date,
    total_study_days: localStreak.total_study_days,
    updated_at: localStreak.updated_at,
  };

  // Build weekly summary from activity data
  const weeklyDates = streakStorage.getWeeklyActivityDates();
  const activityDates = new Set<string>(weeklyDates);

  // Filter progress to last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentUnits = localProgress.filter((p) => new Date(p.started_at) >= sevenDaysAgo);

  const weeklySummary: WeeklySummaryStats = {
    activityDates: Array.from(activityDates),
    totalUnits: recentUnits.length,
  };

  return {
    streak,
    progress,
    weeklySummary,
  };
}

/**
 * Hook for fetching all dashboard data from localStorage
 *
 * Replaces useDashboardQuery for local-first architecture
 */
export function useDashboardQueryLocal(planId: string) {
  return useQuery<DashboardData, Error>({
    queryKey: ['dashboard-local', planId],
    queryFn: () => fetchDashboardDataLocal(planId),
    enabled: !!planId,
    // Refetch on window focus to catch localStorage changes from other tabs
    refetchOnWindowFocus: true,
    // Keep data fresh
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
