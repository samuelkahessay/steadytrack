import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { serverLogger } from '@/lib/logger';

/**
 * POST /api/contribute
 * Submit contributor signup form
 * No auth required - anonymous submissions with rate limiting to prevent spam
 *
 * Request body:
 * - name: string (required)
 * - email: string (required, validated)
 * - interest_areas: string[] (required, at least one)
 * - message: string (optional)
 */
export const POST = withApiRateLimit(
  { ...RateLimitPresets.MODERATE, prefix: 'contribute' },
  async (request: NextRequest, { supabase }) => {
    try {
      // Parse request body
      const body = await request.json();
      const { name, email, interestAreas, message } = body;

      // Validate required fields
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }

      if (!email || typeof email !== 'string' || !email.trim()) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      // Validate interest areas
      if (!Array.isArray(interestAreas) || interestAreas.length === 0) {
        return NextResponse.json(
          { error: 'At least one interest area is required' },
          { status: 400 }
        );
      }

      // Valid interest area IDs
      const validInterestAreas = [
        'testing',
        'content',
        'subject',
        'technical',
        'feedback',
        'other',
      ];

      // Validate each interest area
      for (const area of interestAreas) {
        if (!validInterestAreas.includes(area)) {
          return NextResponse.json(
            { error: `Invalid interest area: ${area}` },
            { status: 400 }
          );
        }
      }

      // Insert contributor signup into database
      const { error } = await supabase.from('contributor_signups').insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        interest_areas: interestAreas,
        message: message?.trim() || null,
      });

      if (error) {
        serverLogger.error('Failed to insert contributor signup', error, {
          name: name.trim(),
          email: email.trim(),
        });
        return NextResponse.json(
          { error: 'Failed to submit. Please try again.' },
          { status: 500 }
        );
      }

      serverLogger.info('New contributor signup', {
        name: name.trim(),
        email: email.trim(),
        interestAreas,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      serverLogger.error(
        'Contribute API error',
        error instanceof Error ? error : undefined
      );
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
