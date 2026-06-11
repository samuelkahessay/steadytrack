/**
 * useMicrocardsQuery Hook
 *
 * React Query hook for fetching microcards for a subject and outcome codes.
 *
 * Features:
 * - Automatic caching and refetching
 * - Loading and error states
 * - Batch fetching for multiple outcome codes
 *
 * Usage:
 * ```tsx
 * function MicrocardsList({ subject, outcomeCodes }: Props) {
 *   const { data: microcards, isLoading, error } = useMicrocardsQuery(subject, outcomeCodes);
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
import { getSupabaseClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { ContentMicrocard } from '@/lib/types';

interface UseMicrocardsQueryOptions {
  enabled?: boolean;
}

/**
 * Fetch microcards for a subject and outcome codes
 *
 * @param subject - Subject name (e.g., "Math 30-1")
 * @param outcomeCodes - Array of outcome codes to fetch microcards for
 * @param options - Query options (e.g., enabled)
 * @returns Query result with microcard data
 */
export function useMicrocardsQuery(
  subject: string,
  outcomeCodes: string[],
  options?: UseMicrocardsQueryOptions
) {
  const supabase = getSupabaseClient();

  return useQuery<ContentMicrocard[], Error>({
    queryKey: queryKeys.microcards.batch(subject, outcomeCodes),
    queryFn: async () => {
      if (outcomeCodes.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('content_microcards')
        .select('*')
        .eq('subject', subject)
        .in('outcome_code', outcomeCodes)
        .eq('status', 'active')
        .order('outcome_code');

      if (error) {
        throw new Error(`Failed to fetch microcards: ${error.message}`);
      }

      return data || [];
    },
    enabled: options?.enabled !== undefined
      ? options.enabled
      : !!subject && outcomeCodes.length > 0, // Only run if subject and codes exist
    staleTime: 10 * 60 * 1000, // Microcards rarely change, consider fresh for 10 minutes
  });
}
