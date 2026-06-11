/**
 * Plan Generator - Outcome-Based Distribution
 *
 * Core Principle: Outcomes are the atomic unit of learning.
 * This module distributes learning outcomes evenly across study days,
 * letting the UI handle content discovery (microcards vs fallback resources).
 *
 * Key Features:
 * - Outcome-based distribution (not resource-based)
 * - Synthetic outcomes for units without Alberta-mandated outcomes
 * - Load balancing using Longest Processing Time (LPT) heuristic
 * - Realistic day count (capped by available content)
 * - Development diagnostics for debugging
 */

import { CurriculumResource } from '@/types/database';
import { getCurriculumData } from '@/data/curriculum';
import { addDays, startOfLocalDay, isWeekend } from '@/lib/date';
import { format } from 'date-fns';

/**
 * A learning outcome with metadata for scheduling and rendering
 */
export interface LearningOutcome {
  subject: string;
  unitId: string;
  unitTitle: string;
  outcomeCode: string;
  isSynthetic: boolean; // True for units without Alberta outcomes (e.g., supplemental content)
  fallbackResources: CurriculumResource[]; // External resources if no microcards exist
}

/**
 * A single day in the study plan
 */
export interface PlanDay {
  dayIndex: number; // 0-based index
  dayLabel: string; // e.g., "Monday, Jan 8" or "Week 2 - Tuesday, Jan 15"
  date: string; // YYYY-MM-DD format
  isWeekend: boolean;
  outcomes: LearningOutcome[]; // Learning outcomes assigned to this day
}

/**
 * The complete study plan
 */
export interface StudyPlan {
  days: PlanDay[];
}

/**
 * Generate a study plan from selected subjects
 *
 * @param subjects - Array of subject names (e.g., ["Math 30-1", "Chemistry 30"])
 * @param durationWeeks - Number of weeks for the plan (1-12)
 * @param includesWeekends - Whether to include Saturday and Sunday
 * @param startDate - Optional start date (defaults to today)
 * @returns A study plan with outcomes distributed across days
 */
export function generatePlan(
  subjects: string[],
  durationWeeks: number,
  includesWeekends: boolean,
  startDate?: Date | string
): StudyPlan {
  // Step 1: Collect all learning outcomes from selected subjects
  const allOutcomes = collectOutcomes(subjects);

  // Step 2: Calculate realistic day count
  // Don't create more days than we have content to fill
  const requestedDays = durationWeeks * (includesWeekends ? 7 : 5);
  const actualDays = Math.min(requestedDays, Math.max(1, allOutcomes.length));

  // Step 3: Create day structure with proper date sequencing
  const days = createDayStructure(actualDays, includesWeekends, durationWeeks, startDate);

  // Step 4: Distribute outcomes across days using load balancing
  return distributeOutcomes(allOutcomes, days);
}

/**
 * Collect all learning outcomes from selected subjects
 *
 * This function:
 * 1. Iterates through each subject's curriculum
 * 2. Extracts outcomes from each unit
 * 3. Creates synthetic outcomes for units without outcomes but with resources
 * 4. Attaches fallback resources aligned to each outcome
 *
 * @param subjects - Array of subject names
 * @returns Array of learning outcomes with metadata
 */
function collectOutcomes(subjects: string[]): LearningOutcome[] {
  const outcomes: LearningOutcome[] = [];

  for (const subject of subjects) {
    const curriculum = getCurriculumData(subject);
    if (!curriculum) {
      // Subject not found in curriculum data - skip silently
      continue;
    }

    for (const unit of curriculum.units) {
      const unitOutcomes = unit.outcomes || [];
      const unitResources = unit.resources || [];

      // Case 1: Unit has no outcomes but has resources
      // Create a synthetic outcome to preserve content (e.g., Math 30-1 Trigonometry)
      if (unitOutcomes.length === 0 && unitResources.length > 0) {
        // Sort resources by type for optimal learning progression
        const sortedResources = sortResourcesByType(unitResources);

        outcomes.push({
          subject,
          unitId: unit.id,
          unitTitle: unit.title,
          outcomeCode: `${unit.id}-content`, // Synthetic code
          isSynthetic: true, // Flag for UI to show "Supplemental Content" badge
          fallbackResources: sortedResources,
        });
        continue;
      }

      // Case 2: Unit has no outcomes and no resources - skip it entirely
      if (unitOutcomes.length === 0) {
        continue;
      }

      // Case 3: Unit has outcomes - use outcome-based distribution
      // Build a map of outcome code → aligned resources
      const outcomeResourceMap = new Map<string, CurriculumResource[]>();

      for (const resource of unitResources) {
        // Only include resources that explicitly declare aligned outcomes
        if (resource.alignedOutcomes && resource.alignedOutcomes.length > 0) {
          for (const outcomeCode of resource.alignedOutcomes) {
            if (!outcomeResourceMap.has(outcomeCode)) {
              outcomeResourceMap.set(outcomeCode, []);
            }
            outcomeResourceMap.get(outcomeCode)!.push(resource);
          }
        }
      }

      // Create a learning outcome entry for each outcome
      for (const outcome of unitOutcomes) {
        const outcomeResources = outcomeResourceMap.get(outcome.code) || [];
        const sortedResources = sortResourcesByType(outcomeResources);

        outcomes.push({
          subject,
          unitId: unit.id,
          unitTitle: unit.title,
          outcomeCode: outcome.code,
          isSynthetic: false, // Real Alberta outcome
          fallbackResources: sortedResources,
        });
      }
    }
  }

  return outcomes;
}

/**
 * Sort curriculum resources by type for optimal learning progression
 * Order: videos → articles → practice → simulations → other
 */
function sortResourcesByType(resources: CurriculumResource[]): CurriculumResource[] {
  const typeOrder: Record<string, number> = {
    video: 1,
    article: 2,
    practice: 3,
    simulation: 2, // Group with articles
    reference: 4,
  };

  return [...resources].sort((a, b) => {
    const aOrder = typeOrder[a.type] || 99;
    const bOrder = typeOrder[b.type] || 99;
    return aOrder - bOrder;
  });
}

/**
 * Create the day structure with proper date sequencing
 *
 * This function:
 * 1. Generates sequential calendar dates
 * 2. Skips weekends if includesWeekends=false
 * 3. Formats day labels (with week numbers for multi-week plans)
 * 4. Marks weekend days
 *
 * @param numDays - Number of study days to create
 * @param includesWeekends - Whether to include weekends
 * @param durationWeeks - Total weeks (for label formatting)
 * @param startDate - Optional start date (defaults to today)
 * @returns Array of empty days with metadata
 */
function createDayStructure(
  numDays: number,
  includesWeekends: boolean,
  durationWeeks: number,
  startDate?: Date | string
): PlanDay[] {
  const days: PlanDay[] = [];

  // Parse and normalize start date
  const planStartDate = (() => {
    if (!startDate) {
      return startOfLocalDay(new Date());
    }
    if (typeof startDate === 'string') {
      // Parse YYYY-MM-DD strings in local time to avoid timezone shifts
      const [year, month, day] = startDate.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    return startOfLocalDay(startDate);
  })();

  let currentDate = planStartDate;
  let daysAdded = 0;
  const daysPerWeek = includesWeekends ? 7 : 5;

  while (daysAdded < numDays) {
    // Skip weekend dates if weekends are not included
    if (!includesWeekends && isWeekend(currentDate)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dayName = format(currentDate, 'EEEE');
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const dateDisplay = format(currentDate, 'MMM d');

    // Calculate week number based on study days added (not calendar weeks)
    const weekNumber = Math.floor(daysAdded / daysPerWeek) + 1;

    // Format display label with date
    // Single week: "Monday, Jan 8"
    // Multi-week: "Week 1 - Monday, Jan 8"
    const dayLabel =
      durationWeeks > 1 ? `Week ${weekNumber} - ${dayName}, ${dateDisplay}` : `${dayName}, ${dateDisplay}`;

    days.push({
      dayIndex: daysAdded,
      dayLabel,
      date: dateString,
      isWeekend: isWeekend(currentDate),
      outcomes: [], // Empty initially, filled by distributeOutcomes
    });

    daysAdded++;
    currentDate = addDays(currentDate, 1);
  }

  return days;
}

/**
 * Distribute outcomes across days using load balancing
 *
 * Uses the Longest Processing Time (LPT) heuristic:
 * - Each outcome has equal weight (1)
 * - Assign each outcome to the day with the fewest outcomes
 * - Tie-breaker: prefer earlier days for sequential flow
 *
 * This ensures balanced workload across all days.
 *
 * @param outcomes - Learning outcomes to distribute
 * @param days - Empty days to fill
 * @returns Study plan with outcomes assigned to days
 */
function distributeOutcomes(outcomes: LearningOutcome[], days: PlanDay[]): StudyPlan {
  if (outcomes.length === 0 || days.length === 0) {
    // No content to distribute
    return { days };
  }

  // Track the load (outcome count) for each day
  const dayLoads = new Array(days.length).fill(0);

  // Distribute each outcome to the day with minimum load
  for (const outcome of outcomes) {
    let minDay = 0;
    let minLoad = Infinity;

    for (let i = 0; i < days.length; i++) {
      if (dayLoads[i] < minLoad) {
        minLoad = dayLoads[i];
        minDay = i;
      } else if (dayLoads[i] === minLoad && i < minDay) {
        // Tie-breaker: prefer earlier days for sequential flow
        minDay = i;
      }
    }

    days[minDay].outcomes.push(outcome);
    dayLoads[minDay] += 1;
  }

  // Development diagnostics: Log distribution statistics
  if (process.env.NODE_ENV !== 'production') {
    logDistributionDiagnostics(outcomes, days, dayLoads);
  }

  return { days };
}

/**
 * Log distribution diagnostics for development debugging
 *
 * This helps developers verify:
 * - Outcomes are distributed evenly
 * - No duplicate outcomes exist
 * - Synthetic outcomes are flagged
 */
function logDistributionDiagnostics(outcomes: LearningOutcome[], days: PlanDay[], dayLoads: number[]): void {
  // Check for duplicate outcomes (should never happen)
  const outcomePairs = days.flatMap((day) =>
    day.outcomes.map((o) => `${o.subject}::${o.outcomeCode}`)
  );
  const uniquePairs = new Set(outcomePairs);

  if (outcomePairs.length !== uniquePairs.size) {
    const duplicates = outcomePairs.filter((item, index) => outcomePairs.indexOf(item) !== index);
    console.error('[planGenerator] Duplicate outcomes detected:', {
      total: outcomePairs.length,
      unique: uniquePairs.size,
      duplicates: [...new Set(duplicates)],
    });
  }

  // Log synthetic outcomes for visibility
  const syntheticCount = outcomes.filter((o) => o.isSynthetic).length;
  if (syntheticCount > 0) {
    console.info('[planGenerator] Synthetic outcomes created:', {
      count: syntheticCount,
      outcomes: outcomes.filter((o) => o.isSynthetic).map((o) => `${o.subject}: ${o.unitTitle}`),
    });
  }

  // Log load distribution
  const minLoad = Math.min(...dayLoads);
  const maxLoad = Math.max(...dayLoads);
  const avgLoad = dayLoads.reduce((a, b) => a + b, 0) / dayLoads.length;

  console.info('[planGenerator] Distribution statistics:', {
    totalOutcomes: outcomes.length,
    totalDays: days.length,
    avgOutcomesPerDay: avgLoad.toFixed(1),
    minOutcomesPerDay: minLoad,
    maxOutcomesPerDay: maxLoad,
    balance: minLoad > 0 ? (minLoad / maxLoad).toFixed(2) : 'N/A',
  });
}
