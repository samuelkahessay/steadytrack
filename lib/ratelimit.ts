/**
 * Rate limiting middleware using Upstash Redis
 * Protects API endpoints from abuse with per-user + IP composite keys
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '@/lib/logger';

// Initialize Redis client (lazy - only when rate limiting is configured)
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window (e.g., '1m', '1h', '1d')
   * Supports: s (seconds), m (minutes), h (hours), d (days)
   */
  window: string;

  /**
   * Optional identifier prefix (e.g., 'api:progress', 'api:account-delete')
   */
  prefix?: string;
}

/**
 * Parse time window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  const multipliers: Record<string, number> = {
    s: 1000, // seconds
    m: 60 * 1000, // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
  };

  return value * multipliers[unit];
}

/**
 * Extract client IP from request headers (Vercel/Next.js)
 */
function getClientIP(request: NextRequest): string {
  // Try Vercel-specific headers first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to other common headers
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  // Fallback to unknown (shouldn't happen on Vercel)
  return 'unknown';
}

/**
 * Create a rate limit key for the request
 * Format: prefix:user:${userId}:${path} or prefix:ip:${ip}:${path}
 */
function createRateLimitKey(
  request: NextRequest,
  userId?: string,
  prefix?: string
): string {
  const path = request.nextUrl.pathname;
  const prefixPart = prefix ? `${prefix}:` : '';

  if (userId) {
    // Authenticated user: key by userId
    return `${prefixPart}user:${userId}:${path}`;
  } else {
    // Anonymous: key by IP
    const ip = getClientIP(request);
    return `${prefixPart}ip:${ip}:${path}`;
  }
}

/**
 * Apply rate limiting to an API route handler
 *
 * @param config - Rate limit configuration
 * @param handler - API route handler function
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(
 *   { limit: 10, window: '1h', prefix: 'account-delete' },
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>,
  opts?: { getUserId?: (request: NextRequest) => Promise<string | undefined> }
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const redisClient = getRedisClient();

    // If Redis is not configured, handle based on environment
    if (!redisClient) {
      // WARNING: Rate limiting is unavailable - allow requests but log warning
      serverLogger.warn('Rate limiting unavailable - Upstash Redis not configured', {
        path: request.nextUrl.pathname,
        message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured',
        environment: process.env.NODE_ENV,
      });
      
      // Log to console for visibility in deployment logs
      console.warn(
        '[RATE_LIMIT_WARNING] Rate limiting unavailable - requests proceeding without rate limits.',
        `Path: ${request.nextUrl.pathname}`,
        `Environment: ${process.env.NODE_ENV}`
      );
      
      // Allow request to proceed without rate limiting
      return handler(request);
    }

    try {
      // Extract user ID from request (if authenticated)
      let userId: string | undefined = undefined;
      try {
        if (opts?.getUserId) {
          userId = await opts.getUserId(request);
        }
      } catch {
        // Ignore getUserId failures; fall back to header/IP-based limiting
      }
      if (!userId) {
        userId = request.headers.get('x-user-id') || undefined; // Fallback if header is set
      }

      // Create rate limiter for this config
      const windowMs = parseWindow(config.window);
      const ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.limit, `${windowMs} ms`),
        analytics: true, // Track rate limit analytics
        prefix: config.prefix || 'ratelimit',
      });

      // Generate rate limit key
      const identifier = createRateLimitKey(request, userId, config.prefix);

      // Check rate limit
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

      if (!success) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);

        serverLogger.warn('Rate limit exceeded', {
          path: request.nextUrl.pathname,
          identifier,
          limit,
          remaining,
          retryAfter,
        });

        return NextResponse.json(
          {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            limit,
            remaining: 0,
            reset: new Date(reset).toISOString(),
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }

      // Rate limit OK - proceed to handler
      const response = await handler(request);

      // Add rate limit headers to successful response
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());

      return response;
    } catch (error) {
      // Rate limiting error - log warning and allow request to proceed
      serverLogger.warn('Rate limit check failed - allowing request', {
        path: request.nextUrl.pathname,
        environment: process.env.NODE_ENV,
        error: error instanceof Error ? error.message : String(error),
      });

      // Log to console for visibility in deployment logs
      console.warn(
        '[RATE_LIMIT_WARNING] Rate limit check failed - request proceeding without rate limiting.',
        `Path: ${request.nextUrl.pathname}`,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Allow request to proceed for availability
      return handler(request);
    }
  };
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RateLimitPresets = {
  /**
   * Strict rate limit for sensitive operations (account deletion, password reset, etc.)
   * 3 requests per hour
   */
  STRICT: { limit: 3, window: '1h' } as RateLimitConfig,

  /**
   * Moderate rate limit for frequently-accessed read endpoints
   * 100 requests per minute
   */
  MODERATE: { limit: 100, window: '1m' } as RateLimitConfig,

  /**
   * Permissive rate limit for frequent operations (progress updates)
   * 100 requests per minute
   */
  PERMISSIVE: { limit: 100, window: '1m' } as RateLimitConfig,

  /**
   * Bulk operation rate limit
   * 20 requests per minute
   */
  BULK: { limit: 20, window: '1m' } as RateLimitConfig,
};
