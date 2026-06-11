import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/server';

export async function GET() {
  const startTime = Date.now();

  try {
    const client = getServerClient();
    const { data, error } = await client
      .from('content_microcards')
      .select('subject')
      .eq('status', 'active');

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Local database query failed',
          details: String((error as Error).message || error),
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy',
        checks: {
          api: 'ok',
          database: 'local-sqlite',
          contentCards: data?.length || 0,
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      },
      { status: 503 }
    );
  }
}
