'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getContentClient } from '@/lib/content/client';
import type { ContentMicrocard } from '@/lib/types';

interface UseMicrocardsResult {
  microcards: ContentMicrocard[];
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch microcards for a given subject and outcome codes
 * @param subject - The subject name (e.g., "Math 30-1")
 * @param outcomeCodes - Array of outcome codes (e.g., ["RF1", "RF2"])
 * @returns Object containing microcards, loading state, and error
 */
export function useMicrocards(
  subject: string | null,
  outcomeCodes: string[]
): UseMicrocardsResult {
  // Lazy initialization: only create client on first access
  const contentRef = useRef<ReturnType<typeof getContentClient> | undefined>(undefined);
  if (!contentRef.current) {
    contentRef.current = getContentClient();
  }
  const content = contentRef.current;

  const [microcards, setMicrocards] = useState<ContentMicrocard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create a stable dependency key for outcome codes to prevent
  // the effect from re-running when a new array instance or order is passed
  const outcomeCodesKey = useMemo(() => {
    // Normalize to a sorted unique list and stringify for a stable key
    const normalized = Array.isArray(outcomeCodes)
      ? Array.from(new Set(outcomeCodes)).sort()
      : [];
    return JSON.stringify(normalized);
  }, [outcomeCodes]);

  useEffect(() => {
    // Skip fetch if no subject or no outcome codes
    const codes: string[] = JSON.parse(outcomeCodesKey) as string[];
    if (!subject || codes.length === 0) {
      // Avoid triggering re-renders by not setting a new [] when already empty
      setMicrocards((prev) => (prev.length > 0 ? [] : prev));
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMicrocards() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await content
          .from('content_microcards')
          .select('*')
          .eq('subject', subject)
          .in('outcome_code', codes)
          .eq('status', 'active')
          .order('outcome_code');

        if (cancelled) return;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setMicrocards(data || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch microcards'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchMicrocards();

    return () => {
      cancelled = true;
    };
  }, [subject, outcomeCodesKey, content]);

  return { microcards, loading, error };
}
