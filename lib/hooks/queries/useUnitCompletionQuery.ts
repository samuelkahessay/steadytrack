/**
 * useUnitCompletionQuery Hook
 *
 * React Query hook for checking unit completion requirements.
 * Replaces manual useEffect in SubjectProgressCard (lines 136-188).
 *
 * Features:
 * - Batch checking for multiple units (efficient!)
 * - Automatic caching
 * - Only runs when enabled
 *
 * Usage:
 * ```tsx
 * const { data: completionStatuses } = useUnitCompletionQuery({
 *   subject,
 *   units: unitsToCheck,
 *   enabled: isExpanded && unitsToCheck.length > 0,
 * });
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { batchCheckUnitCompletionRequirements, type UnitCompletionStatus } from '@/lib/utils/unit-completion';

interface UnitToCheck {
  unitId: string;
  subject: string;
  outcomeCodes?: string[];
  resourceUrls: string[];
}

interface UseUnitCompletionQueryParams {
  subject: string;
  units: UnitToCheck[];
  enabled?: boolean;
}

/**
 * Check completion requirements for multiple units
 *
 * @param params - Query parameters
 * @returns Map of unit IDs to completion statuses
 */
export function useUnitCompletionQuery({
  subject,
  units,
  enabled = true,
}: UseUnitCompletionQueryParams) {
  return useQuery<Map<string, UnitCompletionStatus>, Error>({
    queryKey: [
      ...queryKeys.progress.all,
      'unit-completion',
      subject,
      // Include unit IDs in key for proper cache invalidation
      ...units.map(u => u.unitId).sort(),
    ],
    queryFn: async () => {
      // We don't track individual resources in dashboard view
      const completedResourceUrls = new Set<string>();
      return batchCheckUnitCompletionRequirements(units, completedResourceUrls);
    },
    enabled: enabled && units.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute - completion status can change
  });
}
