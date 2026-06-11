/**
 * Lightweight in-memory rate limiting for the local archive.
 *
 * This is intentionally dependency-free. It gives public/self-hosted demos a
 * basic abuse guard without requiring a hosted cache or external service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '@/lib/logger';

const buckets = new Map<string, number[]>();

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
   * Optional identifier prefix (e.g., 'api:progress')
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
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  return 'local';
}

/**
 * Create a rate limit key for the request
 */
function createRateLimitKey(
  request: NextRequest,
  userId?: string,
  prefix?: string
): string {
  const path = request.nextUrl.pathname;
  const prefixPart = prefix ? `${prefix}:` : '';

  if (userId) {
    return `${prefixPart}user:${userId}:${path}`;
  }

  return `${prefixPart}ip:${getClientIP(request)}:${path}`;
}

function checkBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) || []).filter((timestamp) => timestamp > cutoff);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return {
      success: false,
      remaining: 0,
      reset: recent[0] + windowMs,
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  return {
    success: true,
    remaining: Math.max(0, limit - recent.length),
    reset: recent[0] + windowMs,
  };
}

/**
 * Apply rate limiting to an API route handler
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>,
  opts?: { getUserId?: (request: NextRequest) => Promise<string | undefined> }
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const windowMs = parseWindow(config.window);

    let userId: string | undefined;
    try {
      userId = opts?.getUserId ? await opts.getUserId(request) : undefined;
    } catch {
      userId = undefined;
    }

    const key = createRateLimitKey(request, userId, config.prefix);
    const { success, remaining, reset } = checkBucket(key, config.limit, windowMs);

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      serverLogger.warn('Rate limit exceeded', {
        path: request.nextUrl.pathname,
        limit: config.limit,
        retryAfter,
      });

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          limit: config.limit,
          remaining: 0,
          reset: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }

    const response = await handler(request);
    response.headers.set('X-RateLimit-Limit', config.limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
  };
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RateLimitPresets = {
  STRICT: { limit: 3, window: '1h' } as RateLimitConfig,
  MODERATE: { limit: 100, window: '1m' } as RateLimitConfig,
  PERMISSIVE: { limit: 100, window: '1m' } as RateLimitConfig,
  BULK: { limit: 20, window: '1m' } as RateLimitConfig,
};
