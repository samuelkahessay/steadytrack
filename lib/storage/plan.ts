/**
 * Study Plan localStorage adapter
 * Provides CRUD operations for study plans
 */

import { v4 as uuidv4 } from 'uuid';
import * as storage from './local';
import {
  LocalPlan,
  LocalPlanInput,
  LocalPlanSchema,
} from '@/types/storage';

const PLAN_KEY = 'plan';

/**
 * Get the current active plan
 */
export function getPlan(): LocalPlan | null {
  const plan = storage.get<LocalPlan | null>(PLAN_KEY, null);

  if (!plan) return null;

  try {
    // Validate schema
    return LocalPlanSchema.parse(plan);
  } catch (error) {
    console.error('Invalid plan data in storage:', error);
    console.warn('Clearing corrupted plan data. You may need to create a new plan.');

    // Clear corrupted plan data to prevent repeated validation errors
    storage.remove(PLAN_KEY);

    // Also clear any associated progress data
    if (plan.id) {
      storage.clear(`progress:${plan.id}`);
      storage.clear(`resources:${plan.id}`);
    }

    return null;
  }
}

/**
 * Create a new plan
 */
export function createPlan(input: LocalPlanInput): LocalPlan {
  const now = new Date().toISOString();

  const plan: LocalPlan = {
    ...input,
    id: uuidv4(),
    created_at: now,
    completed_at: null,
    expired_at: null,
    archived_at: null,
  };

  // Validate before saving
  const validated = LocalPlanSchema.parse(plan);

  storage.set(PLAN_KEY, validated);

  return validated;
}

/**
 * Update an existing plan
 */
export function updatePlan(updates: Partial<Omit<LocalPlan, 'id' | 'created_at'>>): LocalPlan | null {
  const current = getPlan();

  if (!current) {
    console.error('No plan found to update');
    return null;
  }

  const updated: LocalPlan = {
    ...current,
    ...updates,
  };

  // Validate before saving
  const validated = LocalPlanSchema.parse(updated);

  storage.set(PLAN_KEY, validated);

  return validated;
}

/**
 * Mark plan as completed
 */
export function completePlan(): LocalPlan | null {
  return updatePlan({
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark plan as expired
 */
export function expirePlan(): LocalPlan | null {
  return updatePlan({
    status: 'expired',
    expired_at: new Date().toISOString(),
  });
}

/**
 * Archive the current plan
 */
export function archivePlan(): LocalPlan | null {
  return updatePlan({
    status: 'archived',
    archived_at: new Date().toISOString(),
  });
}

/**
 * Delete the current plan (and all associated data)
 */
export function deletePlan(): void {
  const plan = getPlan();

  if (!plan) return;

  // Clear plan
  storage.remove(PLAN_KEY);

  // Clear all progress for this plan
  storage.clear(`progress:${plan.id}`);
  storage.clear(`resources:${plan.id}`);
}

/**
 * Check if a plan exists
 */
export function hasPlan(): boolean {
  return getPlan() !== null;
}

/**
 * Get plan status
 */
export function getPlanStatus(): 'active' | 'completed' | 'expired' | 'archived' | null {
  const plan = getPlan();
  return plan?.status ?? null;
}

/**
 * Update current day index
 */
export function updateDayIndex(dayIndex: number): LocalPlan | null {
  return updatePlan({ current_day_index: dayIndex });
}

/**
 * Check if plan is expired based on end_date
 */
export function isPlanExpired(plan: LocalPlan): boolean {
  const endDate = new Date(plan.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return endDate < today;
}

/**
 * Auto-update plan status if needed (e.g., check for expiry)
 */
export function refreshPlanStatus(): LocalPlan | null {
  const plan = getPlan();

  if (!plan) return null;

  // If plan is active but past end date, mark as expired
  if (plan.status === 'active' && isPlanExpired(plan)) {
    return expirePlan();
  }

  return plan;
}
