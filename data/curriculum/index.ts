import { CurriculumSubject } from '@/lib/types';

// Subject aliases for normalization (to avoid circular dependency)
const SUBJECT_ALIASES: Record<string, string> = {
  'English 20-1': 'English Language Arts 20-1',
  'English 30-1': 'English Language Arts 30-1',
  'ELA 20-1': 'English Language Arts 20-1',
  'ELA 30-1': 'English Language Arts 30-1',
  'Social 20-1': 'Social Studies 20-1',
  'Social 30-1': 'Social Studies 30-1',
};

/**
 * Normalize subject name locally (to avoid circular imports)
 */
function normalizeSubjectName(subject: string): string {
  return SUBJECT_ALIASES[subject] || subject;
}

// Grade 11 subjects
import math201 from './math-20-1.json';
import bio20 from './bio-20.json';
import chem20 from './chem-20.json';
import phys20 from './phys-20.json';
import ela201 from './ela-20-1.json';
import social201 from './social-20-1.json';

// Grade 12 subjects
import math301 from './math-30-1.json';
import bio30 from './bio-30.json';
import chem30 from './chem-30.json';
import phys30 from './phys-30.json';
import ela301 from './ela-30-1.json';
import social301 from './social-30-1.json';

// Type-safe curriculum data
const curriculumData: Record<string, CurriculumSubject> = {
  // Grade 11 (Math 20-1 stream and sciences)
  'Math 20-1': math201 as CurriculumSubject,
  'Biology 20': bio20 as CurriculumSubject,
  'Chemistry 20': chem20 as CurriculumSubject,
  'Physics 20': phys20 as CurriculumSubject,
  'English Language Arts 20-1': ela201 as CurriculumSubject,
  'Social Studies 20-1': social201 as CurriculumSubject,

  // Grade 12 (Math 30-1 stream and sciences)
  'Math 30-1': math301 as CurriculumSubject,
  'Biology 30': bio30 as CurriculumSubject,
  'Chemistry 30': chem30 as CurriculumSubject,
  'Physics 30': phys30 as CurriculumSubject,
  'English Language Arts 30-1': ela301 as CurriculumSubject,
  'Social Studies 30-1': social301 as CurriculumSubject,

  // Legacy mappings (backwards compatibility - for direct access)
  'English 30-1': ela301 as CurriculumSubject,
  'English 20-1': ela201 as CurriculumSubject,
  'ELA 30-1': ela301 as CurriculumSubject,
  'ELA 20-1': ela201 as CurriculumSubject,
  'Social 30-1': social301 as CurriculumSubject,
  'Social 20-1': social201 as CurriculumSubject,
};

/**
 * Retrieves curriculum data for a given subject
 * Automatically normalizes subject names (e.g., "English 30-1" → "English Language Arts 30-1")
 */
export function getCurriculumData(subject: string): CurriculumSubject | null {
  try {
    if (!subject || typeof subject !== 'string') {
      return null;
    }

    // Normalize subject name to handle aliases
    const normalizedSubject = normalizeSubjectName(subject);
    return curriculumData[normalizedSubject] || curriculumData[subject] || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Gets all available subjects (canonical names only, no aliases)
 */
export function getAllSubjects(): string[] {
  try {
    // Filter out alias keys, return only canonical subject names
    const aliases = new Set(['English 30-1', 'English 20-1', 'ELA 30-1', 'ELA 20-1', 'Social 30-1', 'Social 20-1']);
    return Object.keys(curriculumData).filter(key => !aliases.has(key));
  } catch (_error) {
    return [];
  }
}

/**
 * Validates if a subject exists in curriculum (handles aliases)
 */
export function isValidSubject(subject: string): boolean {
  try {
    if (!subject || typeof subject !== 'string') {
      return false;
    }
    const normalizedSubject = normalizeSubjectName(subject);
    return normalizedSubject in curriculumData || subject in curriculumData;
  } catch (_error) {
    return false;
  }
}
