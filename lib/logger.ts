/**
 * Production-safe logging utility with PII scrubbing and Sentry integration
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('Failed to fetch user', error, { userId: '123' });
 */

interface LogContext {
  [key: string]: unknown;
}

// PII patterns to scrub from logs
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  token: /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
};

/**
 * Scrub personally identifiable information from log contexts
 */
function scrubPII(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const scrubbed: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      let cleaned = value;

      // Scrub emails
      cleaned = cleaned.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');

      // Scrub JWT tokens
      cleaned = cleaned.replace(PII_PATTERNS.token, '[TOKEN_REDACTED]');

      // Partially redact UUIDs (keep first 8 chars for debugging)
      cleaned = cleaned.replace(PII_PATTERNS.uuid, (match) =>
        `${match.slice(0, 8)}...[UUID_REDACTED]`
      );

      scrubbed[key] = cleaned;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively scrub nested objects
      scrubbed[key] = scrubPII(value as LogContext);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

/**
 * Check if we're running in production
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Centralized logger with environment-aware behavior
 */
export const logger = {
  /**
   * Informational messages - no-op in production, console.log in dev
   */
  info(message: string, context?: LogContext): void {
    if (!isProduction) {
      console.log(`[INFO] ${message}`, context || '');
    }
    // In production: silent (or send to analytics if needed)
  },

  /**
   * Warning messages - sent to Sentry in production
   */
  warn(message: string, context?: LogContext): void {
    const scrubbedContext = scrubPII(context);

    if (isProduction) {
      // Will be integrated with Sentry
      if (typeof window !== 'undefined') {
        const globalWindow = window as typeof window & { Sentry?: { captureMessage: (msg: string, opts: unknown) => void } };
        if (globalWindow.Sentry) {
          globalWindow.Sentry.captureMessage(message, {
            level: 'warning',
            contexts: { custom: scrubbedContext },
          });
        }
      }
    } else {
      console.warn(`[WARN] ${message}`, scrubbedContext || '');
    }
  },

  /**
   * Error messages - always captured in Sentry (production)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const scrubbedContext = scrubPII(context);

    if (isProduction) {
      // Sentry integration (works in browser and server)
      if (typeof window !== 'undefined') {
        const globalWindow = window as typeof window & { Sentry?: { captureException: (err: unknown, opts: unknown) => void } };
        if (globalWindow.Sentry) {
          globalWindow.Sentry.captureException(error || new Error(message), {
            contexts: { custom: scrubbedContext },
          });
        }
      } else if (typeof global !== 'undefined') {
        const globalNode = global as typeof global & { Sentry?: { captureException: (err: unknown, opts: unknown) => void } };
        if (globalNode.Sentry) {
          globalNode.Sentry.captureException(error || new Error(message), {
            contexts: { custom: scrubbedContext },
          });
        }
      }
    } else {
      console.error(`[ERROR] ${message}`, error || '', scrubbedContext || '');
    }
  },

  /**
   * Debug messages - only in development
   */
  debug(message: string, context?: LogContext): void {
    if (!isProduction) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  },
};

/**
 * Server-side logger for API routes and server components
 * Uses direct Sentry import when available
 */
export const serverLogger = {
  info(message: string, context?: LogContext): void {
    logger.info(message, context);
  },

  warn(message: string, context?: LogContext): void {
    logger.warn(message, context);
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const scrubbedContext = scrubPII(context);

    if (isProduction) {
      try {
        // Dynamic import for server-side Sentry
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/nextjs') as { captureException: (err: unknown, opts: unknown) => void };
        Sentry.captureException(error || new Error(message), {
          contexts: { custom: scrubbedContext },
        });
      } catch {
        // Sentry not available yet - fallback to console
        console.error(`[ERROR] ${message}`, error || '', scrubbedContext || '');
      }
    } else {
      console.error(`[ERROR] ${message}`, error || '', scrubbedContext || '');
    }
  },

  debug(message: string, context?: LogContext): void {
    logger.debug(message, context);
  },
};
