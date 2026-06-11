/**
 * Progress localStorage adapter
 * Handles unit completion and resource progress tracking
 */

import { v4 as uuidv4 } from 'uuid';
import * as storage from './local';
import {
  LocalProgress,
  LocalProgressInput,
  LocalProgressSchema,
  LocalResourceProgress,
  LocalResourceProgressInput,
  LocalResourceProgressSchema,
} from '@/types/storage';

/**
 * Progress operation result
 */
export type ProgressResult<T> =
  | { success: true; data: T }
  | { success: false; error: storage.StorageError };

/**
 * Build storage key for unit progress
 */
function buildProgressKey(planId: string): string {
  return `progress:${planId}`;
}

/**
 * Build storage key for resource progress
 */
function buildResourceKey(planId: string): string {
  return `resources:${planId}`;
}

// ============================================================================
// UNIT PROGRESS
// ============================================================================

/**
 * Get all unit progress for a plan
 */
export function getProgress(planId: string): LocalProgress[] {
  const key = buildProgressKey(planId);
  const progress = storage.get<LocalProgress[]>(key, []);

  try {
    // Validate each item
    return progress.map(p => LocalProgressSchema.parse(p));
  } catch (error) {
    console.error('Invalid progress data:', error);
    return [];
  }
}

/**
 * Get progress for a specific unit
 */
export function getUnitProgress(planId: string, subject: string, unitId: string): LocalProgress | null {
  const allProgress = getProgress(planId);
  return allProgress.find(
    p => p.subject === subject && p.unit_id === unitId
  ) ?? null;
}

/**
 * Mark a unit as completed
 * @returns ProgressResult with validated progress or error
 */
export function markUnitComplete(input: LocalProgressInput): ProgressResult<LocalProgress> {
  const now = new Date().toISOString();

  const progress: LocalProgress = {
    ...input,
    id: uuidv4(),
    completed: true,
    started_at: now,
    created_at: now,
  };

  try {
    // Validate
    const validated = LocalProgressSchema.parse(progress);

    // Add to storage
    const key = buildProgressKey(input.plan_id);
    const result = storage.update<LocalProgress[]>(
      key,
      (current) => {
        // Remove existing progress for this unit (if any)
        const filtered = current.filter(
          p => !(p.subject === input.subject && p.unit_id === input.unit_id)
        );
        return [...filtered, validated];
      },
      []
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: validated };
  } catch (error) {
    return {
      success: false,
      error: new storage.StorageError(
        storage.StorageErrorType.PARSE_ERROR,
        'Failed to validate progress data',
        error
      ),
    };
  }
}

/**
 * Mark a unit as incomplete (alias for deleteUnitProgress)
 */
export function markUnitIncomplete(planId: string, subject: string, unitId: string): void {
  deleteUnitProgress(planId, unitId);
}

/**
 * Delete unit progress (undo)
 */
export function deleteUnitProgress(planId: string, unitId: string): void {
  const key = buildProgressKey(planId);
  storage.update<LocalProgress[]>(
    key,
    (current) => current.filter(p => p.unit_id !== unitId),
    []
  );
}

/**
 * Check if a unit is completed
 */
export function isUnitCompleted(planId: string, subject: string, unitId: string): boolean {
  const progress = getUnitProgress(planId, subject, unitId);
  return progress?.completed ?? false;
}

/**
 * Get completed units count
 */
export function getCompletedUnitsCount(planId: string): number {
  const progress = getProgress(planId);
  return progress.filter(p => p.completed).length;
}

/**
 * Get progress by subject
 */
export function getProgressBySubject(planId: string, subject: string): LocalProgress[] {
  const allProgress = getProgress(planId);
  return allProgress.filter(p => p.subject === subject);
}

/**
 * Clear all progress for a plan
 */
export function clearProgress(planId: string): void {
  const key = buildProgressKey(planId);
  storage.remove(key);
}

// ============================================================================
// RESOURCE PROGRESS
// ============================================================================

/**
 * Get all resource progress for a plan
 */
export function getResourceProgress(planId: string): LocalResourceProgress[] {
  const key = buildResourceKey(planId);
  const progress = storage.get<LocalResourceProgress[]>(key, []);

  try {
    // Validate each item
    return progress.map(p => LocalResourceProgressSchema.parse(p));
  } catch (error) {
    console.error('Invalid resource progress data:', error);
    return [];
  }
}

/**
 * Get resource progress for a specific resource
 */
export function getResourceProgressByUrl(
  planId: string,
  unitId: string,
  resourceUrl: string
): LocalResourceProgress | null {
  const allProgress = getResourceProgress(planId);
  return allProgress.find(
    p => p.unit_id === unitId && p.resource_url === resourceUrl
  ) ?? null;
}

/**
 * Get all resource progress for a specific unit
 */
export function getResourceProgressByUnit(planId: string, unitId: string): LocalResourceProgress[] {
  const allProgress = getResourceProgress(planId);
  return allProgress.filter(p => p.unit_id === unitId);
}

/**
 * Mark a resource as completed
 * @returns ProgressResult with validated progress or error
 */
export function markResourceComplete(
  input: LocalResourceProgressInput
): ProgressResult<LocalResourceProgress> {
  const now = new Date().toISOString();

  const progress: LocalResourceProgress = {
    ...input,
    id: uuidv4(),
    completed: true,
    started_at: now,
    created_at: now,
  };

  try {
    // Validate
    const validated = LocalResourceProgressSchema.parse(progress);

    // Add to storage
    const key = buildResourceKey(input.plan_id);
    const result = storage.update<LocalResourceProgress[]>(
      key,
      (current) => {
        // Remove existing progress for this resource (if any)
        const filtered = current.filter(
          p => !(p.unit_id === input.unit_id && p.resource_url === input.resource_url)
        );
        return [...filtered, validated];
      },
      []
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: validated };
  } catch (error) {
    return {
      success: false,
      error: new storage.StorageError(
        storage.StorageErrorType.PARSE_ERROR,
        'Failed to validate resource progress data',
        error
      ),
    };
  }
}

/**
 * Mark a resource as incomplete (start/in-progress)
 * Returns the created/updated progress record
 * @returns ProgressResult with validated progress or error
 */
export function markResourceStarted(
  input: LocalResourceProgressInput
): ProgressResult<LocalResourceProgress> {
  const now = new Date().toISOString();

  const progress: LocalResourceProgress = {
    ...input,
    id: uuidv4(),
    completed: false,
    started_at: now, // Track when it was started
    created_at: now,
  };

  try {
    // Validate
    const validated = LocalResourceProgressSchema.parse(progress);

    // Add to storage
    const key = buildResourceKey(input.plan_id);
    const result = storage.update<LocalResourceProgress[]>(
      key,
      (current) => {
        // Check if already exists
        const existing = current.find(
          p => p.unit_id === input.unit_id && p.resource_url === input.resource_url
        );

        if (existing) {
          // Already tracked, return as is
          return current;
        }

        return [...current, validated];
      },
      []
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: validated };
  } catch (error) {
    return {
      success: false,
      error: new storage.StorageError(
        storage.StorageErrorType.PARSE_ERROR,
        'Failed to validate resource progress data',
        error
      ),
    };
  }
}

/**
 * Delete resource progress (undo)
 */
export function deleteResourceProgress(planId: string, unitId: string, resourceUrl: string): void {
  const key = buildResourceKey(planId);
  storage.update<LocalResourceProgress[]>(
    key,
    (current) => current.filter(
      p => !(p.unit_id === unitId && p.resource_url === resourceUrl)
    ),
    []
  );
}

/**
 * Check if a resource is completed
 */
export function isResourceCompleted(planId: string, unitId: string, resourceUrl: string): boolean {
  const progress = getResourceProgressByUrl(planId, unitId, resourceUrl);
  return progress?.completed ?? false;
}

/**
 * Get completed resources count for a unit
 */
export function getCompletedResourcesCount(planId: string, unitId: string): number {
  const progress = getResourceProgressByUnit(planId, unitId);
  return progress.filter(p => p.completed).length;
}

/**
 * Clear all resource progress for a plan
 */
export function clearResourceProgress(planId: string): void {
  const key = buildResourceKey(planId);
  storage.remove(key);
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Clear all progress (both units and resources) for a plan
 */
export function clearAllProgress(planId: string): void {
  clearProgress(planId);
  clearResourceProgress(planId);
}

/**
 * Get completion percentage for a plan
 */
export function getCompletionPercentage(planId: string, totalUnits: number): number {
  if (totalUnits === 0) return 0;

  const completed = getCompletedUnitsCount(planId);
  return Math.round((completed / totalUnits) * 100);
}
