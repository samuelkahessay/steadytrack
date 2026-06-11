/**
 * useMicrocardsForPlanQuery Hook
 *
 * React Query hook for fetching microcards for multiple subjects via API endpoint.
 *
 * Features:
 * - Automatic caching and refetching
 * - Loading and error states
 * - Fetches all active microcards for the provided subjects
 *
 * Usage:
 * ```tsx
 * function PlanView() {
 *   const subjects = ['Biology 20', 'Physics 20'];
 *   const { data: microcards, isLoading, error } = useMicrocardsForPlanQuery(subjects);
 *
 *   if (isLoading) return <div>Loading microcards...</div>;
 *   if (error) return <div>Error loading microcards</div>;
 *
 *   return (
 *     <div>
 *       {microcards?.map((card) => (
 *         <MicrocardItem key={card.id} microcard={card} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { ContentMicrocard } from '@/lib/types';

interface UseMicrocardsForPlanQueryOptions {
  enabled?: boolean;
}

/**
 * Fetch microcards for multiple subjects via API endpoint
 *
 * @param subjects - Array of subject names (e.g., ["Math 30-1", "Biology 20"])
 * @param options - Query options (e.g., enabled)
 * @returns Query result with microcard data
 */
export function useMicrocardsForPlanQuery(
  subjects: string[],
  options?: UseMicrocardsForPlanQueryOptions
) {
  return useQuery<ContentMicrocard[], Error>({
    queryKey: queryKeys.microcards.bySubjects(subjects),
    queryFn: async () => {
      if (subjects.length === 0) {
        return [];
      }

      const params = new URLSearchParams({
        subjects: subjects.join(','),
      });

      const response = await fetch(`/api/microcards?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch microcards');
      }

      const data = await response.json();
      return data.microcards || [];
    },
    enabled: options?.enabled !== undefined
      ? options.enabled
      : subjects.length > 0, // Only run if subjects exist
    staleTime: 10 * 60 * 1000, // Microcards rarely change, consider fresh for 10 minutes
  });
}
