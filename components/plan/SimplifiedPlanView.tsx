'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DayAccordion } from './DayAccordion';
import { QuotaWarning } from '@/components/storage/QuotaWarning';
import { Loader2, AlertCircle } from 'lucide-react';
import * as planStorage from '@/lib/storage/plan';
import * as progressStorage from '@/lib/storage/progress';
import { useMicrocardsForPlanQuery } from '@/lib/hooks/queries/useMicrocardsForPlanQuery';
import type { FlexibleSchedule } from '@/lib/types';

export function SimplifiedPlanView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const plan = planStorage.getPlan();

  // Fetch microcards using React Query
  const {
    isLoading,
    error: queryError,
  } = useMicrocardsForPlanQuery(plan?.subjects || [], {
    enabled: !!plan && plan.subjects.length > 0,
  });

  // Format error message
  const error = queryError
    ? 'Failed to load learning materials. Please refresh the page.'
    : !plan
    ? 'No study plan found'
    : plan.subjects.length === 0
    ? 'No subjects found in plan'
    : null;

  // Trigger refresh when progress changes (for completed resource URLs)
  const handleProgressChange = useCallback(() => {
    // React Query will automatically refetch if needed based on staleTime
    // No manual refresh needed
  }, []);

  // Get completed resource URLs
  const completedResourceUrls = useMemo(() => {
    if (!plan) return new Set<string>();

    const resourceProgress = progressStorage.getResourceProgress(plan.id);
    return new Set(
      resourceProgress
        .filter(p => p.completed)
        .map(p => p.resource_url)
    );
  }, [plan]);

  // Parse schedule into days (already enriched with outcome metadata)
  // Outcomes contain all necessary data: no enrichment needed!
  const days = useMemo(() => {
    if (!plan || !plan.schedule) return [];

    const schedule = plan.schedule as FlexibleSchedule;

    return schedule.days
      .map((day, index) => ({
        dayNumber: index + 1,
        date: day.date || '',
        dayLabel: day.dayLabel,
        outcomes: day.outcomes || [], // Already enriched with metadata
      }))
      .filter(day => day.outcomes.length > 0); // Skip days with no content
  }, [plan]);

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Study Plan Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create a study plan to get started with your learning journey.
          </p>
          <Link
            href="/plan/new"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Create Plan
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your study plan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Plan
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['microcards'] });
              router.refresh();
            }}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Days Scheduled
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your study plan doesn&apos;t have any days scheduled yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quota Warning */}
        <QuotaWarning />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Your Study Plan
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {plan.subjects.join(', ')}
          </p>
        </div>

        {/* Days list */}
        <div className="space-y-4">
          {days.map(day => (
            <DayAccordion
              key={day.dayNumber}
              planId={plan.id}
              dayNumber={day.dayNumber}
              date={day.date}
              dayLabel={day.dayLabel}
              outcomes={day.outcomes}
              completedResourceUrls={completedResourceUrls}
              onProgressChange={handleProgressChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
