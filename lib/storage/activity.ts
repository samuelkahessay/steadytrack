/**
 * Activity tracking - ANY study activity counts towards streak
 * This includes: resource views, card attempts, unit completions
 */

import * as streakStorage from './streak';
import * as progressStorage from './progress';
import { DEFAULT_TIMEZONE } from '@/lib/constants';

export type ActivityType =
  | 'resource_viewed'
  | 'resource_completed'
  | 'unit_completed'
  | 'quick_check_attempted'
  | 'microcard_viewed'
  | 'study_session_started';

export interface ActivityRecord {
  type: ActivityType;
  timestamp: string;
  metadata: {
    planId?: string;
    subject?: string;
    unitId?: string;
    resourceUrl?: string;
    microcardId?: string;
    correct?: boolean;
  };
}

/**
 * Record any study activity
 * This will:
 * 1. Update streak (if needed for the day)
 * 2. Track the activity
 * 3. Update relevant progress records
 *
 * Returns whether streak was increased
 */
export function recordActivity(
  type: ActivityType,
  metadata: ActivityRecord['metadata'],
  timezone: string = DEFAULT_TIMEZONE
): { streakIncreased: boolean; currentStreak: number; error?: string } {
  // Update streak (will only increment once per day)
  const streakResult = streakStorage.incrementStreak(timezone);

  // Handle streak update failure
  if (!streakResult.success) {
    console.error('Failed to update streak:', streakResult.error.message);
    // Get current streak to return something useful
    const currentStreak = streakStorage.getStreak();
    return {
      streakIncreased: false,
      currentStreak: currentStreak.current_streak,
      error: streakResult.error.message,
    };
  }

  const { streak, increased } = streakResult.data;

  // Handle type-specific logic
  switch (type) {
    case 'resource_viewed':
      if (metadata.planId && metadata.unitId && metadata.resourceUrl) {
        // Track that resource was started (if not already tracked)
        const existing = progressStorage.getResourceProgressByUrl(
          metadata.planId,
          metadata.unitId,
          metadata.resourceUrl
        );

        if (!existing) {
          const result = progressStorage.markResourceStarted({
            plan_id: metadata.planId,
            unit_id: metadata.unitId,
            resource_url: metadata.resourceUrl,
          });

          if (!result.success) {
            console.error('Failed to mark resource started:', result.error.message);
          }
        }
      }
      break;

    case 'resource_completed':
      if (metadata.planId && metadata.unitId && metadata.resourceUrl) {
        const result = progressStorage.markResourceComplete({
          plan_id: metadata.planId,
          unit_id: metadata.unitId,
          resource_url: metadata.resourceUrl,
        });

        if (!result.success) {
          console.error('Failed to mark resource complete:', result.error.message);
        }
      }
      break;

    case 'unit_completed':
      if (metadata.planId && metadata.subject && metadata.unitId) {
        const result = progressStorage.markUnitComplete({
          plan_id: metadata.planId,
          subject: metadata.subject,
          unit_id: metadata.unitId,
        });

        if (!result.success) {
          console.error('Failed to mark unit complete:', result.error.message);
        }
      }
      break;

    case 'quick_check_attempted':
    case 'microcard_viewed':
    case 'study_session_started':
      // These count towards streak but don't need additional tracking
      // (quick checks are tracked separately in quick-checks.ts)
      break;
  }

  return {
    streakIncreased: increased,
    currentStreak: streak.current_streak,
  };
}

/**
 * Convenience function: Record resource view
 */
export function recordResourceView(
  planId: string,
  unitId: string,
  resourceUrl: string,
  subject?: string,
  timezone?: string
) {
  return recordActivity(
    'resource_viewed',
    {
      planId,
      unitId,
      resourceUrl,
      ...(subject && { subject })
    },
    timezone
  );
}

/**
 * Convenience function: Record resource completion
 */
export function recordResourceCompletion(
  planId: string,
  unitId: string,
  resourceUrl: string,
  subject?: string,
  timezone?: string
) {
  return recordActivity(
    'resource_completed',
    {
      planId,
      unitId,
      resourceUrl,
      ...(subject && { subject })
    },
    timezone
  );
}

/**
 * Convenience function: Record unit completion
 */
export function recordUnitCompletion(
  planId: string,
  subject: string,
  unitId: string,
  timezone?: string
) {
  return recordActivity(
    'unit_completed',
    { planId, subject, unitId },
    timezone
  );
}

/**
 * Convenience function: Record quick check attempt
 */
export function recordQuickCheckAttempt(
  planId: string | null,
  subject: string,
  unitId: string | null,
  microcardId: string | null,
  correct: boolean,
  timezone?: string
) {
  return recordActivity(
    'quick_check_attempted',
    {
      ...(planId && { planId }),
      subject,
      ...(unitId && { unitId }),
      ...(microcardId && { microcardId }),
      correct
    },
    timezone
  );
}

/**
 * Convenience function: Record microcard view
 */
export function recordMicrocardView(
  microcardId: string,
  subject: string,
  unitId: string,
  timezone?: string
) {
  return recordActivity(
    'microcard_viewed',
    { microcardId, subject, unitId },
    timezone
  );
}

/**
 * Convenience function: Record study session start
 */
export function recordStudySessionStart(
  planId?: string,
  timezone?: string
) {
  return recordActivity(
    'study_session_started',
    {
      ...(planId && { planId })
    },
    timezone
  );
}

/**
 * Get combined activity summary
 */
export function getActivitySummary(planId: string, timezone: string = DEFAULT_TIMEZONE): {
  streak: {
    current: number;
    longest: number;
    studiedToday: boolean;
  };
  progress: {
    unitsCompleted: number;
    resourcesViewed: number;
    resourcesCompleted: number;
    completionPercentage: number;
  };
} {
  const streakStatus = streakStorage.getStreakStatus(timezone);
  const unitProgress = progressStorage.getProgress(planId);
  const resourceProgress = progressStorage.getResourceProgress(planId);

  return {
    streak: {
      current: streakStatus.current,
      longest: streakStatus.longest,
      studiedToday: streakStatus.studiedToday,
    },
    progress: {
      unitsCompleted: unitProgress.filter(p => p.completed).length,
      resourcesViewed: resourceProgress.length,
      resourcesCompleted: resourceProgress.filter(r => r.completed).length,
      completionPercentage: 0, // Will be calculated based on plan total_units
    },
  };
}
