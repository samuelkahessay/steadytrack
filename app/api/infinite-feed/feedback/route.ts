import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { serverLogger } from '@/lib/logger';

/**
 * POST /api/infinite-feed/feedback
 * Submit anonymous feedback on microcard quality (thumbs up/down)
 * No auth required - local-first app with anonymous feedback tracking
 *
 * Request body:
 * - microcard_id: UUID of the microcard
 * - feedback_type: 'helpful' | 'not_helpful'
 * - was_correct: boolean | null (whether user answered correctly)
 * - session_id: string (anonymous session ID from localStorage)
 */
export const POST = withApiRateLimit(
  { ...RateLimitPresets.MODERATE, prefix: 'infinite-feedback' },
  async (request: NextRequest, { supabase }) => {
    try {
      // Parse request body
      const body = await request.json();
      const { microcard_id, feedback_type, was_correct, session_id } = body;

      // Validate required fields
      if (!microcard_id) {
        return NextResponse.json({ error: 'microcard_id is required' }, { status: 400 });
      }

      if (!feedback_type) {
        return NextResponse.json({ error: 'feedback_type is required' }, { status: 400 });
      }

      if (!session_id) {
        return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
      }

      // Validate feedback_type
      if (feedback_type !== 'helpful' && feedback_type !== 'not_helpful') {
        return NextResponse.json(
          { error: 'feedback_type must be "helpful" or "not_helpful"' },
          { status: 400 }
        );
      }

      // Validate UUID format for microcard_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(microcard_id)) {
        return NextResponse.json({ error: 'microcard_id must be a valid UUID' }, { status: 400 });
      }

      // Insert feedback into database
      // user_id is null for anonymous users in infinite learn mode
      const { error } = await supabase
        .from('microcard_feedback')
        .insert({
          microcard_id,
          feedback_type,
          was_correct: was_correct ?? null,
          user_id: null, // Anonymous user
          session_id
        });

      if (error) {
        serverLogger.error('Failed to insert feedback into database', error, {
          microcard_id,
          feedback_type,
          session_id
        });
        return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      serverLogger.error('Feedback API error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
