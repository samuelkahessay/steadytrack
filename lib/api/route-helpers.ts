import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getServerContentClient } from '@/lib/content/server';
import { withRateLimit, RateLimitConfig, RateLimitPresets } from '@/lib/ratelimit';
import { serverLogger } from '@/lib/logger';

// Use the return type from our server client factory
type ServerContentClient = ReturnType<typeof getServerContentClient>;

/**
 * API context passed to handlers.
 */
export interface ApiContext {
  content: ServerContentClient;
}

/**
 * API handler function signature
 */
export type ApiHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse>;

/**
 * Wraps an API handler with the local content client.
 *
 * @param handler - API handler function
 * @returns Wrapped handler
 *
 * @example
 * ```ts
 * export const GET = withApi(async (request, { content }) => {
 *   // Local read access to content
 *   const { data, error } = await content
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
      const content = getServerContentClient();
      return handler(request, { content });
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
 *   async (request, { content }) => {
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
      const content = getServerContentClient();

      // Create handler with local content context
      const apiHandler = async (req: NextRequest) => {
        return handler(req, { content });
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
