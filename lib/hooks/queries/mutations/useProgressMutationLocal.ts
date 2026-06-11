/**
 * useProgressMutationLocal Hook
 *
 * localStorage-based version of useProgressMutation for local-first architecture.
 * Updates progress in localStorage instead of making API calls.
 *
 * Features:
 * - Uses Phase 1 localStorage adapters
 * - Optimistic updates
 * - Automatic streak tracking via activity storage
 * - Milestone detection
 * - Cache invalidation
 *
 * Usage:
 * ```tsx
 * function UnitCheckbox({ unitId, subject, planId }: Props) {
 *   const markComplete = useMarkUnitCompleteLocal();
 *   const undoProgress = useUndoUnitProgressLocal();
 *
 *   const handleToggle = (checked: boolean) => {
 *     if (checked) {
 *       markComplete.mutate({ planId, subject, unitId });
 *     } else {
 *       undoProgress.mutate({ planId, unitId });
 *     }
 *   };
 *
 *   return (
 *     <input
 *       type="checkbox"
 *       onChange={(e) => handleToggle(e.target.checked)}
 *       disabled={markComplete.isPending || undoProgress.isPending}
 *     />
 *   );
 * }
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserProgress, StudyStreak, WeeklySummaryStats } from '@/lib/types';
import * as progressStorage from '@/lib/storage/progress';
import * as activityStorage from '@/lib/storage/activity';
import * as streakStorage from '@/lib/storage/streak';
import { detectMilestone, calculateProgressPercentage } from '@/lib/services/progress-calculations';

interface MarkCompleteParams {
  planId: string;
  subject: string;
  unitId: string;
}

interface UndoProgressParams {
  planId: string;
  unitId: string;
}

interface MarkCompleteResponse {
  success: boolean;
  streakIncreased: boolean;
  newStreak: number;
  milestone?: number;
  streak: StudyStreak | null;
  weeklySummary: WeeklySummaryStats | null;
}

interface MutationContext {
  previousData: { progress: UserProgress[] } | undefined;
}

/**
 * Mark a unit as complete (localStorage version)
 *
 * This mutation:
 * - Updates localStorage directly
 * - Records activity for streak tracking
 * - Detects milestones
 * - Invalidates React Query cache
 */
export function useMarkUnitCompleteLocal(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<MarkCompleteResponse, Error, MarkCompleteParams, MutationContext>({
    mutationFn: async ({ planId, subject, unitId }) => {
      // Get current progress for milestone detection
      const previousProgress = progressStorage.getProgress(planId);
      const previousCompletedCount = previousProgress.filter(p => p.completed).length;

      // Get plan for total units
      const plan = await import('@/lib/storage/plan').then(m => m.getPlan());
      const totalUnits = plan?.total_units || 0;

      // Mark unit complete in localStorage
      progressStorage.markUnitComplete({ plan_id: planId, unit_id: unitId, subject });

      // Record activity (triggers streak increment if first activity today)
      const activityResult = activityStorage.recordUnitCompletion(planId, unitId, subject);

      // Get new progress count for milestone detection
      const newProgress = progressStorage.getProgress(planId);
      const newCompletedCount = newProgress.filter(p => p.completed).length;

      // Detect milestone
      const previousPercentage = calculateProgressPercentage(previousCompletedCount, totalUnits);
      const currentPercentage = calculateProgressPercentage(newCompletedCount, totalUnits);
      const milestone = detectMilestone(previousPercentage, currentPercentage);

      // Get updated streak
      const localStreak = streakStorage.getStreak();
      const streak: StudyStreak = {
        id: 'local-streak',
        user_id: '',
        current_streak: localStreak.current_streak,
        longest_streak: localStreak.longest_streak,
        last_study_date: localStreak.last_study_date,
        total_study_days: localStreak.total_study_days,
        updated_at: localStreak.updated_at,
      };

      // Get weekly summary
      const weeklyDates = streakStorage.getWeeklyActivityDates();
      const weeklySummary: WeeklySummaryStats = {
        activityDates: weeklyDates,
        totalUnits: newCompletedCount,
      };

      return {
        success: true,
        streakIncreased: activityResult.streakIncreased,
        newStreak: activityResult.currentStreak,
        ...(milestone && { milestone }),
        streak,
        weeklySummary,
      };
    },

    // Optimistic update: immediately update UI
    onMutate: async ({ unitId, subject }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['dashboard-local', planId],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{ progress: UserProgress[] }>(['dashboard-local', planId]);

      // Optimistically update to the new value
      queryClient.setQueryData<{ progress: UserProgress[] }>(['dashboard-local', planId], (old) => {
        if (!old) return old;

        const existingIndex = old.progress.findIndex((p) => p.unit_id === unitId);
        const now = new Date().toISOString();

        if (existingIndex >= 0) {
          // Update existing progress
          const updated = [...old.progress];
          updated[existingIndex] = {
            ...updated[existingIndex],
            completed: true,
            completed_at: now, // Using old field name for UserProgress compatibility
          };
          return { ...old, progress: updated };
        }

        // Add new progress
        return {
          ...old,
          progress: [
            ...old.progress,
            {
              id: `${planId}-${unitId}`,
              user_id: '',
              plan_id: planId,
              subject,
              unit_id: unitId,
              completed: true,
              completed_at: now, // Using old field name for UserProgress compatibility
              created_at: now,
            },
          ],
        };
      });

      return { previousData };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dashboard-local', planId], context.previousData);
      }
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-local', planId] });
    },
  });
}

/**
 * Undo unit progress (localStorage version)
 *
 * This mutation:
 * - Removes progress from localStorage
 * - Invalidates React Query cache
 */
export function useUndoUnitProgressLocal(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UndoProgressParams, MutationContext>({
    mutationFn: async ({ planId, unitId }) => {
      // Delete from localStorage
      progressStorage.deleteUnitProgress(planId, unitId);
    },

    // Optimistic update
    onMutate: async ({ unitId }) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard-local', planId] });

      const previousData = queryClient.getQueryData<{ progress: UserProgress[] }>(['dashboard-local', planId]);

      queryClient.setQueryData<{ progress: UserProgress[] }>(['dashboard-local', planId], (old) => {
        if (!old) return old;
        return {
          ...old,
          progress: old.progress.filter((p) => p.unit_id !== unitId),
        };
      });

      return { previousData };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dashboard-local', planId], context.previousData);
      }
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-local', planId] });
    },
  });
}

/**
 * Helper: Detect if a milestone was reached based on progress change
 */
export function detectProgressMilestone(
  previousCompletedCount: number,
  currentCompletedCount: number,
  totalUnits: number
): number | null {
  if (totalUnits <= 0) return null;

  const previousPercentage = calculateProgressPercentage(previousCompletedCount, totalUnits);
  const currentPercentage = calculateProgressPercentage(currentCompletedCount, totalUnits);

  return detectMilestone(previousPercentage, currentPercentage);
}

// ============================================================================
// RESOURCE PROGRESS MUTATIONS
// ============================================================================

interface MarkResourceCompleteParams {
  planId: string;
  unitId: string;
  resourceUrl: string;
}

interface UndoResourceProgressParams {
  planId: string;
  unitId: string;
  resourceUrl: string;
}

/**
 * Mark a resource as complete (localStorage version)
 */
export function useMarkResourceCompleteLocal(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MarkResourceCompleteParams>({
    mutationFn: async ({ planId, unitId, resourceUrl }) => {
      // Mark resource complete in localStorage
      progressStorage.markResourceComplete({ plan_id: planId, unit_id: unitId, resource_url: resourceUrl });

      // Record activity for streak tracking
      activityStorage.recordResourceCompletion(planId, unitId, resourceUrl);
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-local', planId] });
    },
  });
}

/**
 * Undo resource completion (localStorage version)
 */
export function useUndoResourceProgressLocal(planId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UndoResourceProgressParams>({
    mutationFn: async ({ planId, unitId, resourceUrl }) => {
      // Delete from localStorage
      progressStorage.deleteResourceProgress(planId, unitId, resourceUrl);
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-local', planId] });
    },
  });
}
