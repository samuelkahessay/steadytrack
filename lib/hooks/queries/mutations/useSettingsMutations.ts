/**
 * useSettingsMutations Hook
 *
 * localStorage-based mutation for updating study plan settings.
 * Regenerates schedule with new subjects/duration and optionally preserves progress.
 *
 * Features:
 * - Generates new schedule using generateStudySchedule
 * - Updates plan in localStorage
 * - Optional progress preservation (or reset)
 * - Cache invalidation
 *
 * Usage:
 * ```tsx
 * function SettingsSubjectsCard() {
 *   const updatePlan = useUpdatePlanMutation('');
 *
 *   updatePlan.mutate({
 *     grade: 11,
 *     subjects: ['Math 20-1', 'Biology 20'],
 *     displayName: null,
 *     durationWeeks: 2,
 *     includesWeekends: false,
 *     reset: false, // Preserve progress
 *   });
 * }
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as planStorage from '@/lib/storage/plan';
import * as progressStorage from '@/lib/storage/progress';
import * as streakStorage from '@/lib/storage/streak';
import { generatePlan } from '@/lib/shared/planGenerator';
import { formatLocalDate } from '@/lib/date';

interface UpdatePlanParams {
  grade: number;
  subjects: string[];
  displayName: string | null; // Not used in local-first mode
  durationWeeks: number;
  includesWeekends: boolean;
  reset: boolean; // If true, clear all progress and streak
}

/**
 * Calculate end date from schedule
 */
function calculateEndDate(schedule: ReturnType<typeof generatePlan>): string {
  if (schedule.days.length === 0) {
    // Fallback: return today
    return formatLocalDate(new Date());
  }

  // Get the last day's date from the schedule
  const lastDay = schedule.days[schedule.days.length - 1];
  return lastDay.date || formatLocalDate(new Date());
}

/**
 * Mutation for updating plan settings
 *
 * This regenerates the study schedule with new parameters and updates localStorage.
 * Can optionally preserve progress or reset everything.
 *
 * @param userId - Not used in local-first mode, kept for API compatibility
 */
export function useUpdatePlanMutation(_userId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdatePlanParams>({
    mutationFn: async ({
      grade: _grade,
      subjects,
      displayName: _displayName,
      durationWeeks,
      includesWeekends,
      reset,
    }) => {
      const currentPlan = planStorage.getPlan();

      // Generate new schedule with updated parameters
      const today = new Date();
      const startDateString = formatLocalDate(today);

      const schedule = generatePlan(
        subjects,
        durationWeeks,
        includesWeekends,
        startDateString
      );

      // Calculate total outcomes from generated schedule
      const total_units = schedule.days.reduce(
        (sum, day) => sum + day.outcomes.length,
        0
      );

      const endDate = calculateEndDate(schedule);

      // If no plan exists, create new one
      if (!currentPlan) {
        planStorage.createPlan({
          subjects,
          schedule,
          total_units,
          duration_weeks: durationWeeks,
          includes_weekends: includesWeekends,
          start_date: startDateString,
          end_date: endDate,
          status: 'active',
          current_day_index: 0,
          locked_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else {
        // Update existing plan
        planStorage.updatePlan({
          subjects,
          schedule,
          total_units,
          duration_weeks: durationWeeks,
          includes_weekends: includesWeekends,
          start_date: startDateString,
          end_date: endDate,
          status: 'active',
          current_day_index: 0,
        });
      }

      // Clear progress if reset requested
      if (reset && currentPlan) {
        // Delete all progress for the plan
        progressStorage.clearProgress(currentPlan.id);

        // Reset streak
        streakStorage.resetStreak();
      }
    },

    // Invalidate relevant queries on success
    onSuccess: () => {
      // Invalidate settings query
      queryClient.invalidateQueries({ queryKey: ['settings-plan'] });

      // Invalidate dashboard query (since plan changed)
      queryClient.invalidateQueries({ queryKey: ['dashboard-local'] });
    },

    // Log errors
    onError: (error) => {
      console.error('Failed to update plan:', error);
    },
  });
}
