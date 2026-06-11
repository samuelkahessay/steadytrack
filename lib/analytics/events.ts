/**
 * Analytics Event Catalog
 *
 * Centralized, typed event names for consistent tracking across client and server.
 * This ensures type safety and prevents typos in event tracking.
 */

/**
 * All event names used in the application
 *
 * Organized by category for clarity:
 * - Auth: User authentication events
 * - Plan: Study plan lifecycle events
 * - Progress: Unit completion and progress tracking
 * - Study: Study mode and resource interactions
 * - Share: Share link management
 * - Guest: Guest mode operations
 */
export const EVENT_NAMES = {
  // ===== Authentication Events =====
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',

  // ===== Plan Events =====
  PLAN_CREATED: 'plan_created',
  PLAN_REGENERATED: 'plan_regenerated',
  PLAN_DELETED: 'plan_deleted',

  // ===== Progress Events =====
  PROGRESS_UPDATED: 'progress_updated',
  UNIT_COMPLETED: 'unit_completed',
  UNIT_UNDONE: 'unit_undone',
  MILESTONE_REACHED: 'milestone_reached',

  // ===== Streak Events =====
  STREAK_INCREASED: 'streak_increased',
  STREAK_BROKEN: 'streak_broken',

  // ===== Study Mode Events (Client) =====
  EMBED_ATTEMPT: 'embed_attempt',
  EMBED_SUCCESS: 'embed_success',
  EMBED_FAILED: 'embed_failed',
  ARTICLE_PREVIEW_SHOWN: 'article_preview_shown',
  ARTICLE_OPENED: 'article_opened',
  RESOURCE_VIEW_START: 'resource_view_start',
  RESOURCE_COMPLETED: 'resource_completed',

  // ===== Share Link Events =====
  SHARE_LINK_CREATED: 'share_link_created',
  SHARE_LINK_ACCESSED: 'share_link_accessed',
  SHARE_LINK_DEACTIVATED: 'share_link_deactivated',
  SHARE_LINK_REGENERATED: 'share_link_regenerated',

  // ===== Guest Mode Events =====
  GUEST_PLAN_CREATED: 'guest_plan_created',
  GUEST_MIGRATION_SUCCESS: 'guest_migration_success',
  GUEST_MIGRATION_FAILED: 'guest_migration_failed',
  GUEST_MERGE_SUCCESS: 'guest_merge_success',
  GUEST_MERGE_FAILED: 'guest_merge_failed',

  // ===== Settings Events =====
  SETTINGS_UPDATED: 'settings_updated',
  ACCOUNT_DELETED: 'account_deleted',
  ACCOUNT_EXPORT: 'account_export',

  // ===== Error Events =====
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const;

/**
 * Type-safe event name
 * Use this type for function parameters to ensure only valid event names are used
 */
export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];

/**
 * Event data for specific events
 * Add type-safe event data structures here
 */
export interface EventDataMap {
  [EVENT_NAMES.PLAN_CREATED]: {
    grade: number;
    subjects: string[];
    durationWeeks?: number;
  };
  [EVENT_NAMES.UNIT_COMPLETED]: {
    subject: string;
    unitId: string;
  };
  [EVENT_NAMES.MILESTONE_REACHED]: {
    milestone: 25 | 50 | 75 | 100;
  };
  [EVENT_NAMES.STREAK_INCREASED]: {
    newStreak: number;
  };
  [EVENT_NAMES.EMBED_ATTEMPT]: {
    url: string;
    unitId?: string;
  };
  [EVENT_NAMES.EMBED_FAILED]: {
    url: string;
    reason?: string;
  };
  [EVENT_NAMES.SHARE_LINK_ACCESSED]: {
    share_link_id: string;
  };
  [EVENT_NAMES.ERROR_OCCURRED]: {
    error: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Generic event data for events not in the map
 */
export type GenericEventData = Record<string, unknown>;

/**
 * Get event data type for a specific event name
 */
export type EventDataFor<T extends EventName> = T extends keyof EventDataMap
  ? EventDataMap[T]
  : GenericEventData;

/**
 * Helper to check if an event name is valid
 */
export function isValidEventName(name: string): name is EventName {
  return Object.values(EVENT_NAMES).includes(name as EventName);
}

/**
 * Event categories for filtering/grouping
 */
export const EVENT_CATEGORIES = {
  AUTH: [
    EVENT_NAMES.SIGN_IN,
    EVENT_NAMES.SIGN_OUT,
    EVENT_NAMES.USER_LOGGED_IN,
    EVENT_NAMES.USER_LOGGED_OUT,
  ],
  PLAN: [
    EVENT_NAMES.PLAN_CREATED,
    EVENT_NAMES.PLAN_REGENERATED,
    EVENT_NAMES.PLAN_DELETED,
  ],
  PROGRESS: [
    EVENT_NAMES.PROGRESS_UPDATED,
    EVENT_NAMES.UNIT_COMPLETED,
    EVENT_NAMES.UNIT_UNDONE,
    EVENT_NAMES.MILESTONE_REACHED,
    EVENT_NAMES.STREAK_INCREASED,
    EVENT_NAMES.STREAK_BROKEN,
  ],
  STUDY: [
    EVENT_NAMES.EMBED_ATTEMPT,
    EVENT_NAMES.EMBED_SUCCESS,
    EVENT_NAMES.EMBED_FAILED,
    EVENT_NAMES.ARTICLE_PREVIEW_SHOWN,
    EVENT_NAMES.ARTICLE_OPENED,
    EVENT_NAMES.RESOURCE_VIEW_START,
    EVENT_NAMES.RESOURCE_COMPLETED,
  ],
  SHARE: [
    EVENT_NAMES.SHARE_LINK_CREATED,
    EVENT_NAMES.SHARE_LINK_ACCESSED,
    EVENT_NAMES.SHARE_LINK_DEACTIVATED,
    EVENT_NAMES.SHARE_LINK_REGENERATED,
  ],
  GUEST: [
    EVENT_NAMES.GUEST_PLAN_CREATED,
    EVENT_NAMES.GUEST_MIGRATION_SUCCESS,
    EVENT_NAMES.GUEST_MIGRATION_FAILED,
    EVENT_NAMES.GUEST_MERGE_SUCCESS,
    EVENT_NAMES.GUEST_MERGE_FAILED,
  ],
} as const;
