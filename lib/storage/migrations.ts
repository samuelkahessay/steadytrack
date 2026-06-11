/**
 * localStorage Data Migrations
 *
 * Handles versioned schema migrations for localStorage data.
 * Run migrations once on app initialization to ensure data compatibility.
 */

import * as storage from './local';
import { getCurriculumData } from '@/data/curriculum';

const MIGRATION_VERSION_KEY = 'migration_version';
const CURRENT_VERSION = 4; // Version 4: Add lastViewedCardId to infinite session

/**
 * Get current migration version from localStorage
 */
function getCurrentVersion(): number {
  return storage.get<number>(MIGRATION_VERSION_KEY, 0);
}

/**
 * Set migration version in localStorage
 */
function setCurrentVersion(version: number): void {
  storage.set(MIGRATION_VERSION_KEY, version);
}

/**
 * Migration v1 → v2: Rename completed_at to started_at
 *
 * This migration updates all progress and resource progress records
 * to use the new `started_at` field name instead of `completed_at`.
 */
function migrateV1toV2(): boolean {
  try {
    console.log('[Migration] Running v1 → v2 migration (completed_at → started_at)');

    let migratedCount = 0;

    // Get all keys from localStorage
    const allKeys = storage.getAllKeys();

    // Migrate progress records (keys like "progress:plan-id")
    const progressKeys = allKeys.filter(k => k.startsWith('progress:'));
    for (const key of progressKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progressRecords = storage.get<any[]>(key, []);

      if (progressRecords.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const migrated = progressRecords.map((record: any) => {
          // If record has old field but not new field, migrate it
          if (record.completed_at && !record.started_at) {
            migratedCount++;
            const { completed_at, ...rest } = record;
            return {
              ...rest,
              started_at: completed_at,
            };
          }
          return record;
        });

        storage.set(key, migrated);
      }
    }

    // Migrate resource progress records (keys like "resources:plan-id")
    const resourceKeys = allKeys.filter(k => k.startsWith('resources:'));
    for (const key of resourceKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resourceRecords = storage.get<any[]>(key, []);

      if (resourceRecords.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const migrated = resourceRecords.map((record: any) => {
          // If record has old field but not new field, migrate it
          if (record.completed_at && !record.started_at) {
            migratedCount++;
            const { completed_at, ...rest } = record;
            return {
              ...rest,
              started_at: completed_at,
            };
          }
          return record;
        });

        storage.set(key, migrated);
      }
    }

    console.log(`[Migration] ✓ Migrated ${migratedCount} records from completed_at to started_at`);
    return true;
  } catch (error) {
    console.error('[Migration] ✗ Failed to migrate v1 → v2:', error);
    return false;
  }
}

/**
 * Migration v2 → v3: Transform unit-based plans to outcome-based plans
 *
 * This migration updates the plan schedule structure from:
 *   schedule.days[].units[] → schedule.days[].outcomes[]
 *
 * Each unit is transformed into one or more outcome objects based on:
 * - If unit has outcomeCodes: create an outcome for each code
 * - If unit has no outcomeCodes: create a synthetic outcome
 */
function migrateV2toV3(): boolean {
  try {
    console.log('[Migration] Running v2 → v3 migration (units[] → outcomes[])');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = storage.get<any>('plan', null);

    if (!plan) {
      console.log('[Migration] No plan found, skipping migration');
      return true;
    }

    // Check if plan already has outcome-based structure
    if (plan.schedule?.days?.[0]?.outcomes !== undefined) {
      console.log('[Migration] Plan already has outcome-based structure, skipping');
      return true;
    }

    // Check if plan structure is valid
    if (!plan.schedule?.days || !Array.isArray(plan.schedule.days)) {
      console.log('[Migration] Plan has no valid schedule.days array, skipping');
      return true;
    }

    console.log('[Migration] Transforming unit-based plan to outcome-based plan');

    // Transform each day's units to outcomes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const migratedDays = plan.schedule.days.map((day: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outcomes: any[] = [];

      // Handle days with no units (edge case: malformed data)
      if (!day.units || !Array.isArray(day.units)) {
        console.log(`[Migration] Day ${day.dayIndex} has no units array, creating empty outcomes`);
        return {
          dayIndex: day.dayIndex,
          dayLabel: day.dayLabel || `Day ${day.dayIndex + 1}`,
          date: day.date,
          isWeekend: day.isWeekend,
          outcomes: [],
        };
      }

      for (const unit of day.units) {
        const { subject, unitId, title, outcomeCodes } = unit;

        // Get curriculum data to find unit resources
        const curriculum = getCurriculumData(subject);
        const curriculumUnit = curriculum?.units.find(u => u.id === unitId);

        // Get resources for this unit
        const unitResources = curriculumUnit?.resources || [];

        // Sort resources by type for optimal learning progression
        const sortedResources = [...unitResources].sort((a, b) => {
          const typeOrder: Record<string, number> = {
            video: 1,
            article: 2,
            practice: 3,
            simulation: 2,
            reference: 4,
          };
          const aOrder = typeOrder[a.type] || 99;
          const bOrder = typeOrder[b.type] || 99;
          return aOrder - bOrder;
        });

        // Case 1: Unit has outcome codes - create outcome for each code
        if (outcomeCodes && outcomeCodes.length > 0) {
          for (const outcomeCode of outcomeCodes) {
            // Filter resources aligned to this outcome
            const outcomeResources = sortedResources.filter(
              r => r.alignedOutcomes?.includes(outcomeCode)
            );

            outcomes.push({
              subject,
              unitId,
              unitTitle: title,
              outcomeCode,
              isSynthetic: false,
              fallbackResources: outcomeResources,
            });
          }
        }
        // Case 2: No outcome codes - create synthetic outcome
        else {
          outcomes.push({
            subject,
            unitId,
            unitTitle: title,
            outcomeCode: `${unitId}-content`,
            isSynthetic: true,
            fallbackResources: sortedResources,
          });
        }
      }

      // Return migrated day structure
      return {
        dayIndex: day.dayIndex,
        dayLabel: day.dayLabel,
        date: day.date,
        isWeekend: day.isWeekend,
        outcomes,
      };
    });

    // Update plan with migrated structure
    const migratedPlan = {
      ...plan,
      schedule: {
        days: migratedDays,
      },
    };

    // Save migrated plan
    storage.set('plan', migratedPlan);

    console.log(`[Migration] ✓ Migrated plan from units[] to outcomes[] (${migratedDays.length} days)`);
    return true;
  } catch (error) {
    console.error('[Migration] ✗ Failed to migrate v2 → v3:', error);
    return false;
  }
}

/**
 * Migration v3 → v4: Add lastViewedCardId to infinite session
 *
 * This migration adds the new optional lastViewedCardId field to existing
 * infinite learning sessions. This field enables accurate scroll resume
 * by storing the ID of the last viewed card.
 */
function migrateV3toV4(): boolean {
  try {
    console.log('[Migration] Running v3 → v4 migration (add lastViewedCardId to infinite session)');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = storage.get<any>('infinite', null);

    if (!session) {
      console.log('[Migration] No infinite session found, skipping migration');
      return true;
    }

    // Check if session already has lastViewedCardId field
    if (session.lastViewedCardId !== undefined) {
      console.log('[Migration] Infinite session already has lastViewedCardId field, skipping');
      return true;
    }

    // Add lastViewedCardId field (set to undefined/null for backward compatibility)
    const migratedSession = {
      ...session,
      lastViewedCardId: undefined,
    };

    // Save migrated session
    storage.set('infinite', migratedSession);

    console.log('[Migration] ✓ Added lastViewedCardId field to infinite session');
    return true;
  } catch (error) {
    console.error('[Migration] ✗ Failed to migrate v3 → v4:', error);
    return false;
  }
}

/**
 * Run all pending migrations
 *
 * This function should be called once during app initialization.
 * It's idempotent - safe to call multiple times.
 */
export function runMigrations(): void {
  const currentVersion = getCurrentVersion();

  if (currentVersion >= CURRENT_VERSION) {
    // Already up to date
    console.log(`[Migration] Data is up to date (version ${currentVersion})`);
    return;
  }

  console.log(`[Migration] Starting migrations from version ${currentVersion} to ${CURRENT_VERSION}`);

  // Run migrations in sequence
  if (currentVersion < 2) {
    if (migrateV1toV2()) {
      setCurrentVersion(2);
    } else {
      console.error('[Migration] Migration v1 → v2 failed, stopping');
      return;
    }
  }

  if (currentVersion < 3) {
    if (migrateV2toV3()) {
      setCurrentVersion(3);
    } else {
      console.error('[Migration] Migration v2 → v3 failed, stopping');
      return;
    }
  }

  if (currentVersion < 4) {
    if (migrateV3toV4()) {
      setCurrentVersion(4);
    } else {
      console.error('[Migration] Migration v3 → v4 failed, stopping');
      return;
    }
  }

  // Future migrations would go here
  // if (currentVersion < 5) {
  //   if (migrateV4toV5()) {
  //     setCurrentVersion(5);
  //   }
  // }

  console.log(`[Migration] ✓ All migrations complete (version ${CURRENT_VERSION})`);
}

/**
 * Reset migration version (for testing purposes)
 * WARNING: This does not revert data, only resets the version tracker
 */
export function resetMigrationVersion(): void {
  storage.remove(MIGRATION_VERSION_KEY);
  console.log('[Migration] Migration version reset');
}

/**
 * Get migration status for debugging
 */
export function getMigrationStatus(): {
  currentVersion: number;
  targetVersion: number;
  needsMigration: boolean;
} {
  const currentVersion = getCurrentVersion();

  return {
    currentVersion,
    targetVersion: CURRENT_VERSION,
    needsMigration: currentVersion < CURRENT_VERSION,
  };
}
