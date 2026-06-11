/**
 * localStorage-specific types
 * These mirror database types but without user_id fields
 */

import { z } from 'zod';
import { FlexibleSchedule } from './database';

// ============================================================================
// STUDY PLAN TYPES
// ============================================================================

export interface LocalPlan {
  id: string;
  subjects: string[];
  schedule: FlexibleSchedule;
  total_units: number;
  duration_weeks: number;
  includes_weekends: boolean;
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string;
  status: 'active' | 'completed' | 'expired' | 'archived';
  current_day_index: number;
  locked_timezone: string;
  completed_at: string | null;
  expired_at: string | null;
  archived_at: string | null;
  created_at: string;
}

// Zod schema for LocalPlan
export const LocalPlanSchema = z.object({
  id: z.string().uuid(),
  subjects: z.array(z.string()).min(1).max(12),
  schedule: z.object({
    days: z.array(
      z.object({
        dayIndex: z.number().int().min(0),
        dayLabel: z.string(),
        date: z.string().optional(),
        isWeekend: z.boolean().optional(),
        outcomes: z.array(
          z.object({
            subject: z.string(),
            unitId: z.string(),
            unitTitle: z.string(),
            outcomeCode: z.string(),
            isSynthetic: z.boolean(),
            fallbackResources: z.array(
              z.object({
                type: z.enum(['video', 'pdf', 'article', 'practice', 'reference', 'virtual-lab', 'exemplars', 'rubric', 'data-booklet', 'course', 'simulation', 'diploma-prep', 'worksheet']),
                title: z.string(),
                url: z.string(),
                alignedOutcomes: z.array(z.string()).optional(),
                difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
              })
            ),
          })
        ),
      })
    ),
  }),
  total_units: z.number().int().min(1),
  duration_weeks: z.number().int().min(1).max(12),
  includes_weekends: z.boolean(),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(['active', 'completed', 'expired', 'archived']),
  current_day_index: z.number().int().min(0),
  locked_timezone: z.string(),
  completed_at: z.string().nullable(),
  expired_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
}).transform((plan) => {
  // Clean up undefined values from optional properties to comply with exactOptionalPropertyTypes
  const cleanedDays = plan.schedule.days.map(day => {
    const cleanedDay: Record<string, unknown> = {
      dayIndex: day.dayIndex,
      dayLabel: day.dayLabel,
      outcomes: day.outcomes,
    };
    if (day.date !== undefined) cleanedDay.date = day.date;
    if (day.isWeekend !== undefined) cleanedDay.isWeekend = day.isWeekend;
    return cleanedDay;
  });

  return {
    ...plan,
    schedule: {
      days: cleanedDays,
    },
  } as unknown as LocalPlan;
});

// ============================================================================
// PROGRESS TYPES
// ============================================================================

export interface LocalProgress {
  id: string;
  plan_id: string;
  subject: string;
  unit_id: string;
  completed: boolean;
  started_at: string; // Renamed from completed_at - represents when started/completed
  created_at: string;
}

export const LocalProgressSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  subject: z.string(),
  unit_id: z.string(),
  completed: z.boolean(),
  started_at: z.string().optional(), // New field name
  completed_at: z.string().optional(), // Old field name for backward compatibility
  created_at: z.string(),
}).transform((data) => {
  // Migration: Handle old data with completed_at field
  const started_at = data.started_at || data.completed_at || new Date().toISOString();

  return {
    id: data.id,
    plan_id: data.plan_id,
    subject: data.subject,
    unit_id: data.unit_id,
    completed: data.completed,
    started_at,
    created_at: data.created_at,
  } as LocalProgress;
});

// ============================================================================
// RESOURCE PROGRESS TYPES
// ============================================================================

export interface LocalResourceProgress {
  id: string;
  plan_id: string;
  unit_id: string;
  resource_url: string;
  completed: boolean;
  started_at: string; // Renamed from completed_at - represents when started/completed
  created_at: string;
}

export const LocalResourceProgressSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  unit_id: z.string(),
  resource_url: z.string().url(),
  completed: z.boolean(),
  started_at: z.string().optional(), // New field name
  completed_at: z.string().optional(), // Old field name for backward compatibility
  created_at: z.string(),
}).transform((data) => {
  // Migration: Handle old data with completed_at field
  const started_at = data.started_at || data.completed_at || new Date().toISOString();

  return {
    id: data.id,
    plan_id: data.plan_id,
    unit_id: data.unit_id,
    resource_url: data.resource_url,
    completed: data.completed,
    started_at,
    created_at: data.created_at,
  } as LocalResourceProgress;
});

// ============================================================================
// STREAK TYPES
// ============================================================================

export interface LocalStreak {
  current_streak: number;
  longest_streak: number;
  last_study_date: string; // YYYY-MM-DD format
  total_study_days: number;
  updated_at: string;
}

export const LocalStreakSchema = z.object({
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  last_study_date: z.string(),
  total_study_days: z.number().int().min(0),
  updated_at: z.string(),
});

// ============================================================================
// INFINITE LEARNING TYPES
// ============================================================================

export interface LocalInfiniteSession {
  id: string;
  selected_subjects: string[];
  cards_viewed: string[];
  current_card_index: number;
  lastViewedCardId?: string | undefined;
  started_at: string;
  last_active_at: string;
  expires_at: string;
}

export const LocalInfiniteSessionSchema = z.object({
  id: z.string().uuid(),
  selected_subjects: z.array(z.string()).min(1),
  cards_viewed: z.array(z.string().uuid()),
  current_card_index: z.number().int().min(0),
  lastViewedCardId: z.string().optional(),
  started_at: z.string(),
  last_active_at: z.string(),
  expires_at: z.string(),
});

// ============================================================================
// QUICK CHECK TYPES
// ============================================================================

export interface LocalQuickCheckResult {
  id: string;
  plan_id: string | null;
  subject: string;
  unit_id: string | null;
  outcome_code: string | null;
  microcard_id: string | null;
  correct: boolean;
  selected: string | null;
  created_at: string;
}

export const LocalQuickCheckResultSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  subject: z.string(),
  unit_id: z.string().nullable(),
  outcome_code: z.string().nullable(),
  microcard_id: z.string().uuid().nullable(),
  correct: z.boolean(),
  selected: z.string().nullable(),
  created_at: z.string(),
});

// ============================================================================
// STORAGE STRUCTURE TYPES
// ============================================================================

/**
 * Complete storage structure for a plan
 */
export interface PlanStorage {
  plan: LocalPlan;
  progress: LocalProgress[];
  resourceProgress: LocalResourceProgress[];
}

/**
 * Complete storage structure for export/import
 */
export interface CompleteLocalStorage {
  plan: LocalPlan | null;
  progress: LocalProgress[];
  resourceProgress: LocalResourceProgress[];
  streak: LocalStreak;
  infiniteSession: LocalInfiniteSession | null;
  quickCheckResults: LocalQuickCheckResult[];
  version: string; // Schema version for migrations
  exportedAt: string;
}

export const CompleteLocalStorageSchema = z.object({
  plan: LocalPlanSchema.nullable(),
  progress: z.array(LocalProgressSchema),
  resourceProgress: z.array(LocalResourceProgressSchema),
  streak: LocalStreakSchema,
  infiniteSession: LocalInfiniteSessionSchema.nullable(),
  quickCheckResults: z.array(LocalQuickCheckResultSchema),
  version: z.string(),
  exportedAt: z.string(),
});

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Plan creation input (without generated fields)
 */
export type LocalPlanInput = Omit<
  LocalPlan,
  'id' | 'created_at' | 'completed_at' | 'expired_at' | 'archived_at'
>;

/**
 * Progress creation input (without generated fields)
 * Note: completed and started_at are added internally by storage functions
 */
export type LocalProgressInput = Omit<LocalProgress, 'id' | 'created_at' | 'completed' | 'started_at'>;

/**
 * Resource progress creation input (without generated fields)
 * Note: completed and started_at are added internally by storage functions
 */
export type LocalResourceProgressInput = Omit<LocalResourceProgress, 'id' | 'created_at' | 'completed' | 'started_at'>;

/**
 * Quick check result creation input (without generated fields)
 */
export type LocalQuickCheckInput = Omit<LocalQuickCheckResult, 'id' | 'created_at'>;
