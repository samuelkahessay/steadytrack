/**
 * Local-first logging utility with PII scrubbing
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
    // In production: silent by default for routine informational logs.
  },

  /**
   * Warning messages
   */
  warn(message: string, context?: LogContext): void {
    const scrubbedContext = scrubPII(context);

    if (!isProduction) {
      console.warn(`[WARN] ${message}`, scrubbedContext || '');
    }
  },

  /**
   * Error messages
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const scrubbedContext = scrubPII(context);

    if (!isProduction) {
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

    if (!isProduction) {
      console.error(`[ERROR] ${message}`, error || '', scrubbedContext || '');
    }
  },

  debug(message: string, context?: LogContext): void {
    logger.debug(message, context);
  },
};
