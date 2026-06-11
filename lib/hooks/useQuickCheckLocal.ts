'use client';

import { useState } from 'react';
import * as quickCheckStorage from '@/lib/storage/quick-checks';
import * as activityStorage from '@/lib/storage/activity';

interface SubmitQuickCheckParams {
  microcardId: string;
  outcomeCode: string;
  subject: string;
  unitId: string;
  planId?: string;
  correct: boolean;
  selected: string;
}

interface UseQuickCheckResult {
  submitResult: (params: SubmitQuickCheckParams) => Promise<boolean>;
  submitting: boolean;
  error: Error | null;
}

/**
 * Hook for submitting quick check results (localStorage version)
 *
 * No authentication required - stores results in localStorage
 * Automatically tracks activity for streak calculation
 *
 * @example
 * ```tsx
 * const { submitResult, submitting } = useQuickCheckLocal();
 *
 * const handleSubmit = async () => {
 *   const success = await submitResult({
 *     microcardId: 'card-123',
 *     outcomeCode: 'A',
 *     subject: 'math-30-1',
 *     unitId: 'unit-1',
 *     planId: 'plan-abc',
 *     correct: true,
 *     selected: 'optionA'
 *   });
 * };
 * ```
 */
export function useQuickCheckLocal(): UseQuickCheckResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function submitResult(params: SubmitQuickCheckParams): Promise<boolean> {
    try {
      setSubmitting(true);
      setError(null);

      // Save result to localStorage
      quickCheckStorage.addResult({
        microcard_id: params.microcardId,
        outcome_code: params.outcomeCode,
        subject: params.subject,
        unit_id: params.unitId,
        plan_id: params.planId || null,
        correct: params.correct,
        selected: params.selected,
      });

      // Record activity for streak tracking
      // This will increment streak if it's the first activity of the day
      activityStorage.recordQuickCheckAttempt(
        params.planId || null,
        params.subject,
        params.unitId || null,
        params.microcardId,
        params.correct
      );

      return true;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to submit result');
      setError(errorObj);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitResult, submitting, error };
}
