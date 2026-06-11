/**
 * API Service Layer - Central Export
 *
 * This module exports the actively used API client functions.
 * The app primarily makes direct REST API calls to /api/* endpoints,
 * with these client helpers used for specific client-side operations.
 */

// Phase 5: All auth and sharing APIs removed - local-first migration complete
// Sharing API (formerly parent.ts) - DELETED
// Analytics API - DELETED (use localStorage activity tracking instead)

// Re-export types for convenience
export type {
  StudyPlan,
  UserProgress,
  StudyStreak,
  ProgressUpdateResponse,
  WeeklySummaryStats,
} from '@/lib/types';

// Re-export EventName type from analytics
export type { EventName } from '@/lib/analytics/events';
