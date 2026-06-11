import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { serverLogger } from '@/lib/logger';
import { toDBSubject } from '@/lib/shared/subjects';
import { getRandomDemoCards, getDemoCardsByIds } from '@/lib/demo/microcards';

export const revalidate = 300; // Cache for 5 minutes

// Request one extra card to detect if more cards are available without an additional query
const LOOKAHEAD_COUNT = 1;

/**
 * GET /api/infinite-feed/cards
 * Fetch random high-quality microcards for infinite learning mode
 * No auth required - local-first app
 *
 * Query params:
 * - subjects: comma-separated list of subjects
 * - exclude: comma-separated list of card IDs to exclude
 * - ids: comma-separated list of specific card IDs to fetch (overrides random selection)
 * - limit: number of cards to fetch (default 20)
 *
 * Response:
 * - cards: array of microcard objects
 * - has_more: boolean indicating if more cards are available (false for specific ID requests)
 */
export const GET = withApiRateLimit(
  { ...RateLimitPresets.MODERATE, prefix: 'infinite-cards' },
  async (request: NextRequest, { content }) => {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const subjectsParam = searchParams.get('subjects');
    const excludeParam = searchParams.get('exclude');
    const idsParam = searchParams.get('ids');
    const limitParam = searchParams.get('limit');

    if (!subjectsParam) {
      return NextResponse.json({ error: 'subjects parameter required' }, { status: 400 });
    }

    const subjects = subjectsParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const excludeIds = excludeParam ? excludeParam.split(',').map(id => id.trim()).filter(id => id.length > 0) : [];
    const specificIds = idsParam ? idsParam.split(',').map(id => id.trim()).filter(id => id.length > 0) : [];
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 20;

    // Validate at least one subject is selected
    if (subjects.length === 0) {
      return NextResponse.json({ error: 'At least one subject must be selected' }, { status: 400 });
    }

    // Validate limit is a valid number and within bounds
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return NextResponse.json({ error: 'limit must be a number between 1 and 50' }, { status: 400 });
    }

    const limit = parsedLimit;

    // Convert UI subject names to database names (e.g., "Math 20-1" → "Mathematics 20-1")
    const normalizedSubjects = subjects.map(s => toDBSubject(s));

    // If specific IDs are requested, fetch those cards directly
    if (specificIds.length > 0) {
      try {
        const { data: cards, error } = await content
          .from('content_microcards')
          .select('*')
          .in('id', specificIds)
          .in('subject', normalizedSubjects);

        if (error) {
          throw error;
        }

        // Sort cards to match the order of requested IDs
        const sortedCards = specificIds
          .map(id => cards?.find(card => card.id === id))
          .filter((card): card is NonNullable<typeof card> => card !== undefined);

        return NextResponse.json({
          cards: sortedCards,
          has_more: false
        });
      } catch (_dbError) {
        // Fallback to demo data
        serverLogger.info('Using demo data fallback for specific cards', { ids: specificIds });
        const demoCards = getDemoCardsByIds(specificIds, normalizedSubjects);
        return NextResponse.json({
          cards: demoCards,
          has_more: false
        });
      }
    }

    // Otherwise, use the local adapter's random card helper
    try {
      const { data: cards, error } = await content.rpc('get_random_infinite_cards', {
        p_subjects: normalizedSubjects,
        p_exclude_ids: excludeIds,
        p_limit: limit + LOOKAHEAD_COUNT,
        p_min_quality_score: 70
      });

      if (error) {
        throw error;
      }

      // Check if we got more than requested
      const hasMore = cards && cards.length > limit;
      const trimmedCards = hasMore ? cards.slice(0, limit) : (cards || []);

      return NextResponse.json({
        cards: trimmedCards,
        has_more: hasMore
      });
    } catch (_dbError) {
      // Fallback to demo data
      serverLogger.info('Using demo data fallback for infinite cards', { subjects: normalizedSubjects });
      const { cards: demoCards, has_more } = getRandomDemoCards(normalizedSubjects, excludeIds, limit);
      return NextResponse.json({
        cards: demoCards,
        has_more
      });
    }
  }
);
