import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { serverLogger } from '@/lib/logger';
import { toUISubject } from '@/lib/shared/subjects';
import { getDemoSubjectCounts } from '@/lib/demo/microcards';

export const revalidate = 300; // Cache for 5 minutes

/**
 * GET /api/infinite-feed/subjects
 * Get list of subjects with available card counts for infinite learning mode
 * Filters out subjects with insufficient cards
 *
 * Query params:
 * - min_cards: minimum number of cards required (default 10)
 */
export const GET = withApiRateLimit(
  { ...RateLimitPresets.PERMISSIVE, prefix: 'infinite-subjects' },
  async (request: NextRequest, { supabase }) => {
    const { searchParams } = new URL(request.url);
    const minCardsParam = searchParams.get('min_cards');
    const minCards = minCardsParam ? parseInt(minCardsParam, 10) : 10;

    try {
      // Query to get subject counts
      const { data, error } = await supabase
        .from('content_microcards')
        .select('subject')
        .eq('status', 'active')
        .gte('quality_score', 70);

      if (error) {
        throw error;
      }

      // Count cards per subject
      const subjectCounts: Record<string, number> = {};
      for (const row of data || []) {
        const subject = String(row.subject || '');
        if (!subject) continue;
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      }

      // Filter subjects with enough cards and convert DB names to UI names
      const availableSubjects = Object.entries(subjectCounts)
        .filter(([_, count]) => count >= minCards)
        .map(([subject, count]) => ({
          subject: toUISubject(subject), // Convert DB name to UI name
          cardCount: count
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));

      return NextResponse.json({ subjects: availableSubjects });
    } catch (_dbError) {
      // Fallback to demo data
      serverLogger.info('Using demo data fallback for subjects');
      const demoSubjects = getDemoSubjectCounts()
        .filter(s => s.cardCount >= minCards)
        .map(s => ({
          subject: toUISubject(s.subject),
          cardCount: s.cardCount
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));

      return NextResponse.json({ subjects: demoSubjects });
    }
  }
);
