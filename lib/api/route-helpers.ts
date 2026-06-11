import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/server';
import { withRateLimit, RateLimitConfig, RateLimitPresets } from '@/lib/ratelimit';
import { serverLogger } from '@/lib/logger';

// Use the return type from our server client factory
type ServerClient = ReturnType<typeof getServerClient>;

/**
 * API context passed to handlers (no auth, just Supabase for content)
 */
export interface ApiContext {
  supabase: ServerClient;
}

/**
 * API handler function signature
 */
export type ApiHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse>;

/**
 * Wraps an API handler with Supabase client (anonymous, for content access)
 *
 * @param handler - API handler function
 * @returns Wrapped handler
 *
 * @example
 * ```ts
 * export const GET = withApi(async (request, { supabase }) => {
 *   // Anonymous read access to content
 *   const { data, error } = await supabase
 *     .from('content_microcards')
 *     .select('*')
 *     .eq('subject', 'math');
 *
 *   if (error) {
 *     return NextResponse.json({ error: error.message }, { status: 500 });
 *   }
 *
 *   return NextResponse.json({ success: true, data });
 * });
 * ```
 */
export function withApi(
  handler: ApiHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = getServerClient();
      return handler(request, { supabase });
    } catch (error) {
      serverLogger.error(
        'API wrapper error',
        error instanceof Error ? error : undefined,
        { path: request.nextUrl.pathname }
      );
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps an API handler with IP-based rate limiting
 *
 * @param config - Rate limit configuration (or preset)
 * @param handler - API handler function
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```ts
 * // Using a preset
 * export const POST = withApiRateLimit(
 *   { ...RateLimitPresets.STRICT, prefix: 'plan-create' },
 *   async (request, { supabase }) => {
 *     // Handler logic...
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withApiRateLimit(
  config: RateLimitConfig,
  handler: ApiHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = getServerClient();

      // Create handler with Supabase context
      const apiHandler = async (req: NextRequest) => {
        return handler(req, { supabase });
      };

      // Wrap with IP-based rate limiting
      const rateLimitedHandler = withRateLimit(config, apiHandler, {
        getUserId: async () => undefined, // IP-based only, no user ID
      });

      return rateLimitedHandler(request);
    } catch (error) {
      serverLogger.error(
        'API rate limit wrapper error',
        error instanceof Error ? error : undefined,
        { path: request.nextUrl.pathname }
      );
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps an API handler with consistent error handling and logging
 *
 * Automatically:
 * - Catches and logs errors
 * - Returns consistent JSON error responses
 * - Adds request context to logs
 *
 * @param name - Descriptive name for logging (e.g., "progress-update")
 * @param handler - API handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * export const POST = withApiHandler(
 *   'plan-creation',
 *   async (request) => {
 *     // If this throws, it's automatically caught and logged
 *     const body = await request.json();
 *     // ... handler logic ...
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withApiHandler(
  name: string,
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (_request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(_request);
    } catch (error) {
      serverLogger.error(
        `API handler error: ${name}`,
        error instanceof Error ? error : undefined,
        {
          path: _request.nextUrl.pathname,
          method: _request.method,
          name,
        }
      );

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Re-export rate limit presets for convenience
export { RateLimitPresets };
