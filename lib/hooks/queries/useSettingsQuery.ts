/**
 * useSettingsQuery Hook
 *
 * localStorage-based query for Settings page to fetch plan and user grade.
 * Since there's no user profile in local-first mode, grade is inferred from subjects.
 *
 * Features:
 * - Reads plan from localStorage
 * - Infers grade from first subject (20-level = Grade 11, 30-level = Grade 12)
 * - Automatic reactivity with window focus
 *
 * Usage:
 * ```tsx
 * function SettingsSubjectsCard() {
 *   const { data, isLoading } = useSettingsPlanQuery('');
 *
 *   const plan = data?.plan;
 *   const grade = data?.grade;
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import * as planStorage from '@/lib/storage/plan';
import { getCurriculumData } from '@/data/curriculum';

interface SettingsPlanData {
  plan: ReturnType<typeof planStorage.getPlan>;
  grade: number | null;
}

/**
 * Hook for fetching plan and grade from localStorage
 *
 * Grade is inferred from the first subject in the plan:
 * - Subjects ending in "20" or "20-1" are Grade 11
 * - Subjects ending in "30" or "30-1" are Grade 12
 *
 * @param userId - Not used in local-first mode, kept for API compatibility
 */
export function useSettingsPlanQuery(_userId: string) {
  return useQuery<SettingsPlanData, Error>({
    queryKey: ['settings-plan'],
    queryFn: () => {
      const plan = planStorage.getPlan();

      // Infer grade from first subject
      let grade: number | null = null;
      if (plan && plan.subjects.length > 0) {
        const firstSubject = plan.subjects[0];
        const curriculum = getCurriculumData(firstSubject);
        grade = curriculum?.grade ?? null;
      }

      return { plan, grade };
    },
    // Refetch on window focus to catch localStorage changes from other tabs
    refetchOnWindowFocus: true,
    // Keep data fresh
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
