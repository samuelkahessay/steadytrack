'use client';

import { useQuery } from '@tanstack/react-query';
import { getContentClient } from '@/lib/content/client';
import { ResourceItem } from './ResourceItem';
import type { LearningOutcome } from '@/types/database';

interface OutcomeCardProps {
  planId: string;
  outcome: LearningOutcome;
  completedResourceUrls: Set<string>;
  onProgressChange: () => void;
}

/**
 * OutcomeCard - Renders a single learning outcome
 *
 * Displays either:
 * 1. Microcard (interactive quiz) if available locally
 * 2. Fallback resources from curriculum if no microcard
 *
 * Shows "Supplemental Content" badge for synthetic outcomes
 * (units without Alberta-mandated outcomes)
 */
export function OutcomeCard({
  planId,
  outcome,
  completedResourceUrls,
  onProgressChange,
}: OutcomeCardProps) {
  // Query for microcard by outcome code
  const { data: microcard, isLoading } = useQuery({
    queryKey: ['microcard', outcome.outcomeCode],
    queryFn: async () => {
      const content = getContentClient();
      const { data, error } = await content
        .from('content_microcards')
        .select('*')
        .eq('outcome_code', outcome.outcomeCode)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching microcard:', error);
        return null;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
      </div>
    );
  }

  // Case 1: Microcard exists → render interactive quiz
  if (microcard) {
    const microcardResourceUrl = `microcard:${microcard.id}`;

    return (
      <div className="space-y-2">
        {/* Show "Supplemental Content" badge for synthetic outcomes */}
        {outcome.isSynthetic && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
              📚 Supplemental Content
            </span>
          </div>
        )}

        <ResourceItem
          planId={planId}
          unitId={outcome.unitId}
          resource={{
            title: `${outcome.outcomeCode}: ${outcome.unitTitle}`,
            url: microcardResourceUrl,
          }}
          microcard={microcard}
          isCompleted={completedResourceUrls.has(microcardResourceUrl)}
          onProgressChange={onProgressChange}
        />
      </div>
    );
  }

  // Case 2: No microcard → render fallback resources from curriculum
  if (outcome.fallbackResources.length === 0) {
    // Edge case: No microcard AND no fallback resources
    // This shouldn't happen with proper curriculum data, but handle gracefully
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Outcome header with synthetic badge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {outcome.outcomeCode}
            {!outcome.isSynthetic && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                (Alberta Curriculum)
              </span>
            )}
          </h4>
          {outcome.isSynthetic && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                📚 Supplemental Content
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          No interactive quiz available yet. Study using the resources below:
        </p>
      </div>

      {/* Fallback resources */}
      <div className="space-y-2">
        {outcome.fallbackResources.map((resource, index) => (
          <ResourceItem
            key={`${outcome.outcomeCode}-${index}`}
            planId={planId}
            unitId={outcome.unitId}
            resource={{
              title: resource.title,
              url: resource.url,
              type: resource.type,
            }}
            isCompleted={completedResourceUrls.has(resource.url)}
            onProgressChange={onProgressChange}
          />
        ))}
      </div>
    </div>
  );
}
