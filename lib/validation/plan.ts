import { z } from 'zod';
import { getCurriculumData } from '@/data/curriculum';

export const PlanGenerationSchema = z.object({
  grade: z.number().int().min(11).max(12),
  subjects: z.array(z.string().min(1)).min(2).max(12),
  displayName: z
    .string()
    .trim()
    .max(50, 'Display name is too long')
    .nullish(),
  durationWeeks: z.number().int().min(1).max(12).default(1),
  includesWeekends: z.boolean().default(false),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional(),
  distributionMode: z.enum(['unit', 'resource']).default('resource'),
  reset: z.boolean().default(false), // Whether to reset progress (defaults to false to preserve)
});

/**
 * Validates that all subjects exist in the curriculum
 * Students can now select any subject regardless of their grade level
 */
export function isValidSubjects(subjects: string[]) {
  return subjects.every((s) => getCurriculumData(s) !== null);
}

/**
 * @deprecated Use isValidSubjects instead. Kept for backward compatibility.
 * Students can now select subjects from any grade level.
 */
export function isValidSubjectsForGrade(_grade: number, subjects: string[]) {
  return isValidSubjects(subjects);
}

