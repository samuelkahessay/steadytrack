/**
 * Date Utilities
 *
 * Handles date formatting and timezone operations for SteadyTrack.
 * Supports timezone-aware date operations for consistent streak/progress tracking.
 */

/**
 * Format a date as YYYY-MM-DD in local timezone
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get start of day (00:00:00.000) in local timezone
 * @param date - Input date
 * @returns New Date at start of day
 */
export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59.999) in local timezone
 * @param date - Input date
 * @returns New Date at end of day
 */
export function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Parse YYYY-MM-DD string into Date in local timezone
 * Avoids timezone shifts by parsing components directly
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get user's timezone (IANA format, e.g., 'America/Edmonton')
 * Falls back to UTC if timezone cannot be determined
 * @returns IANA timezone string
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Format date in a specific timezone
 * @param date - Date to format
 * @param timezone - IANA timezone (e.g., 'America/Edmonton')
 * @param format - Output format ('date' | 'datetime' | 'time')
 * @returns Formatted string
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  format: 'date' | 'datetime' | 'time' = 'date'
): string {
  const options: Intl.DateTimeFormatOptions =
    format === 'date'
      ? { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }
      : format === 'datetime'
      ? {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        }
      : { hour: '2-digit', minute: '2-digit', timeZone: timezone };

  return new Intl.DateTimeFormat('en-CA', options).format(date);
}

/**
 * Check if two dates are on the same day in local timezone
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are on same day
 */
export function isSameLocalDay(date1: Date, date2: Date): boolean {
  return formatLocalDate(date1) === formatLocalDate(date2);
}

/**
 * Get number of days between two dates (inclusive)
 * @param start - Start date
 * @param end - End date
 * @returns Number of days
 */
export function daysBetween(start: Date, end: Date): number {
  const startDay = startOfLocalDay(start);
  const endDay = startOfLocalDay(end);
  const diffMs = endDay.getTime() - startDay.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
}

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add
 * @returns New date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 * @param date - Date to check
 * @returns True if date is Saturday (6) or Sunday (0)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

