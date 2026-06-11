import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit, RateLimitPresets } from '@/lib/api/route-helpers';
import { serverLogger } from '@/lib/logger';
import { toDBSubject } from '@/lib/shared/subjects';
import { getDemoCardsBySubject } from '@/lib/demo/microcards';

/**
 * GET /api/microcards
 * Fetch microcards for Plan Mode (simplified study view)
 * No auth required - local-first app
 *
 * Query params:
 * - subjects: comma-separated list of subjects (required)
 * - units: comma-separated list of unit IDs (optional, filters to specific units)
 */
export const GET = withApiRateLimit(
  { ...RateLimitPresets.MODERATE, prefix: 'microcards' },
  async (request: NextRequest, { supabase }) => {
    try {
      // Parse query parameters
      const { searchParams } = new URL(request.url);
      const subjectsParam = searchParams.get('subjects');
      const unitsParam = searchParams.get('units');

      // Log request for debugging
      serverLogger.info('Microcards API request', {
        subjects: subjectsParam,
        units: unitsParam,
        url: request.url
      });

      if (!subjectsParam) {
        return NextResponse.json({ error: 'subjects parameter required' }, { status: 400 });
      }

      const subjects = subjectsParam.split(',').map(s => s.trim()).filter(s => s.length > 0);

      // Validate at least one subject is selected
      if (subjects.length === 0) {
        return NextResponse.json({ error: 'At least one subject must be selected' }, { status: 400 });
      }

      // Convert UI subject names to database names (e.g., "Math 20-1" → "Mathematics 20-1")
      const normalizedSubjects = subjects.map(s => toDBSubject(s));

      serverLogger.info('Normalized subjects', {
        original: subjects,
        normalized: normalizedSubjects
      });

      // Parse units for filtering
      const units = unitsParam
        ? unitsParam.split(',').map(u => u.trim()).filter(u => u.length > 0)
        : undefined;

      // Try Supabase first, fall back to demo data if unavailable
      try {
        // Validate Supabase client
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }

        // Build query
        let query = supabase
          .from('content_microcards')
          .select('*')
          .in('subject', normalizedSubjects)
          .eq('status', 'active');

        // Filter by units if provided
        if (units && units.length > 0) {
          serverLogger.info('Filtering by units', { units });
          query = query.in('unit_id', units);
        }

        const { data: microcards, error } = await query;

        if (error) {
          throw error;
        }

        serverLogger.info('Microcards fetched successfully', {
          count: microcards?.length || 0,
          subjects: normalizedSubjects
        });

        return NextResponse.json({ microcards: microcards || [] });
      } catch (_dbError) {
        // Fallback to demo data
        serverLogger.info('Using demo data fallback for microcards', { subjects: normalizedSubjects });
        const demoCards = getDemoCardsBySubject(normalizedSubjects, units ? { units } : {});
        return NextResponse.json({ microcards: demoCards });
      }
    } catch (error) {
      serverLogger.error('Microcards API error', error instanceof Error ? error : undefined, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        // Include fetch-specific error details if available
        cause: error instanceof Error && 'cause' in error ? error.cause : undefined
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
