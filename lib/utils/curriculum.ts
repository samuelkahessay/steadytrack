import { CurriculumSubject } from '@/types/database';
import { getAllSubjects, getCurriculumData } from '@/data/curriculum';

export interface SubjectMetadata {
  name: string;
  slug: string;
  subject: string;
  grade: number;
  icon: string;
  color: string;
  category: 'science' | 'math' | 'humanities';
  hasDiploma: boolean;
  totalOutcomes: number;
  totalResources: number;
  totalHours: number;
  data: CurriculumSubject;
}

export interface CurriculumStats {
  totalSubjects: number;
  totalOutcomes: number;
  totalResources: number;
  totalHours: number;
  subjectsByGrade: Record<number, number>;
  subjectsByCategory: Record<string, number>;
}

// Subject aliases for common shorthand names
const SUBJECT_ALIASES: Record<string, string> = {
  'English 20-1': 'English Language Arts 20-1',
  'English 30-1': 'English Language Arts 30-1',
  'ELA 20-1': 'English Language Arts 20-1',
  'ELA 30-1': 'English Language Arts 30-1',
  'Social 20-1': 'Social Studies 20-1',
  'Social 30-1': 'Social Studies 30-1',
};

/**
 * Normalize subject name to canonical form
 * Maps common aliases to full official names
 */
export function normalizeSubjectName(subject: string): string {
  return SUBJECT_ALIASES[subject] || subject;
}

/**
 * Subject color themes with full Tailwind class support
 * Consolidated from lib/utils/subject-colors.ts for single source of truth
 */
export interface SubjectColorTheme {
  bg: string;
  border: string;
  text: string;
  dot: string;
  hover: string;
}

export const SUBJECT_COLORS: Record<string, SubjectColorTheme> = {
  // Math subjects - Orange/Amber palette
  'Math 20-1': {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    hover: 'hover:bg-orange-100',
  },
  'Math 30-1': {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    hover: 'hover:bg-orange-100',
  },
  'Math 20-2': {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    hover: 'hover:bg-amber-100',
  },
  'Math 30-2': {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    hover: 'hover:bg-amber-100',
  },

  // Science subjects
  'Biology 20': {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    hover: 'hover:bg-green-100',
  },
  'Biology 30': {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    hover: 'hover:bg-green-100',
  },
  'Chemistry 20': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
    hover: 'hover:bg-purple-100',
  },
  'Chemistry 30': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
    hover: 'hover:bg-purple-100',
  },
  'Physics 20': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    hover: 'hover:bg-blue-100',
  },
  'Physics 30': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    hover: 'hover:bg-blue-100',
  },

  // Humanities subjects
  'Social Studies 20-1': {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    hover: 'hover:bg-red-100',
  },
  'Social Studies 30-1': {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    hover: 'hover:bg-red-100',
  },
  'English Language Arts 20-1': {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    dot: 'bg-pink-500',
    hover: 'hover:bg-pink-100',
  },
  'ELA 20-1': {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    dot: 'bg-pink-500',
    hover: 'hover:bg-pink-100',
  },
  'English Language Arts 30-1': {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    dot: 'bg-pink-500',
    hover: 'hover:bg-pink-100',
  },
  'ELA 30-1': {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    dot: 'bg-pink-500',
    hover: 'hover:bg-pink-100',
  },

  // Default fallback
  default: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
    hover: 'hover:bg-gray-100',
  },
} as const;

/**
 * Get Tailwind color theme for a subject
 * Supports full subject names and common aliases
 *
 * @param subject - Subject name (e.g., "Math 30-1", "Biology 20")
 * @returns Tailwind color class object
 */
export function getSubjectColors(subject: string): SubjectColorTheme {
  // Normalize subject name first (handles aliases)
  const normalized = normalizeSubjectName(subject);
  return SUBJECT_COLORS[normalized] || SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
}

/**
 * Standardized subject emoji mapping
 * Consolidated from lib/utils/subject-emoji.ts for visual consistency
 *
 * Design choices:
 * - Math: 📐 (ruler/triangle - geometric/mathematical)
 * - Physics: ⚛️ (atom - fundamental physics)
 * - Social: 🌍 (globe - global studies)
 * - Biology: 🧬 (DNA - life sciences)
 * - Chemistry: ⚗️ (beaker - chemical reactions)
 * - English: 📚 (books - literature/language)
 */
const SUBJECT_EMOJIS: Record<string, string> = {
  Math: '📐',
  Physics: '⚛️',
  Social: '🌍',
  Biology: '🧬',
  Chemistry: '⚗️',
  English: '📚',
  ELA: '📚',
  default: '📖',
} as const;

/**
 * Get emoji icon for a subject
 * Handles partial matches (e.g., "Math 30-1" matches "Math")
 *
 * @param subject - Subject name
 * @returns Unicode emoji character
 */
export function getSubjectIcon(subject: string): string {
  // Normalize for matching
  const normalized = subject.toLowerCase();

  // Check for keyword matches
  if (normalized.includes('math')) return SUBJECT_EMOJIS.Math;
  if (normalized.includes('physics') || normalized.includes('phys')) return SUBJECT_EMOJIS.Physics;
  if (normalized.includes('social')) return SUBJECT_EMOJIS.Social;
  if (normalized.includes('biology') || normalized.includes('bio')) return SUBJECT_EMOJIS.Biology;
  if (normalized.includes('chemistry') || normalized.includes('chem')) return SUBJECT_EMOJIS.Chemistry;
  if (normalized.includes('english') || normalized.includes('ela')) return SUBJECT_EMOJIS.English;

  return SUBJECT_EMOJIS.default;
}

// Subject configuration with metadata
const SUBJECT_CONFIG: Record<string, Omit<SubjectMetadata, 'totalOutcomes' | 'totalResources' | 'totalHours' | 'data'>> = {
  'Math 20-1': { name: 'Math 20-1', slug: 'math-20-1', subject: 'Math 20-1', grade: 11, icon: '📐', color: 'blue', category: 'math', hasDiploma: false },
  'Biology 20': { name: 'Biology 20', slug: 'biology-20', subject: 'Biology 20', grade: 11, icon: '🧬', color: 'green', category: 'science', hasDiploma: false },
  'Chemistry 20': { name: 'Chemistry 20', slug: 'chemistry-20', subject: 'Chemistry 20', grade: 11, icon: '⚗️', color: 'orange', category: 'science', hasDiploma: false },
  'Physics 20': { name: 'Physics 20', slug: 'physics-20', subject: 'Physics 20', grade: 11, icon: '⚛️', color: 'purple', category: 'science', hasDiploma: false },
  'English Language Arts 20-1': { name: 'English Language Arts 20-1', slug: 'english-20-1', subject: 'English Language Arts 20-1', grade: 11, icon: '📚', color: 'indigo', category: 'humanities', hasDiploma: false },
  'Social Studies 20-1': { name: 'Social Studies 20-1', slug: 'social-studies-20-1', subject: 'Social Studies 20-1', grade: 11, icon: '🌍', color: 'yellow', category: 'humanities', hasDiploma: false },

  'Math 30-1': { name: 'Math 30-1', slug: 'math-30-1', subject: 'Math 30-1', grade: 12, icon: '📐', color: 'blue', category: 'math', hasDiploma: true },
  'Biology 30': { name: 'Biology 30', slug: 'biology-30', subject: 'Biology 30', grade: 12, icon: '🧬', color: 'green', category: 'science', hasDiploma: true },
  'Chemistry 30': { name: 'Chemistry 30', slug: 'chemistry-30', subject: 'Chemistry 30', grade: 12, icon: '⚗️', color: 'orange', category: 'science', hasDiploma: true },
  'Physics 30': { name: 'Physics 30', slug: 'physics-30', subject: 'Physics 30', grade: 12, icon: '⚛️', color: 'purple', category: 'science', hasDiploma: true },
  'English Language Arts 30-1': { name: 'English Language Arts 30-1', slug: 'english-30-1', subject: 'English Language Arts 30-1', grade: 12, icon: '📚', color: 'indigo', category: 'humanities', hasDiploma: true },
  'Social Studies 30-1': { name: 'Social Studies 30-1', slug: 'social-studies-30-1', subject: 'Social Studies 30-1', grade: 12, icon: '🌍', color: 'yellow', category: 'humanities', hasDiploma: true },
};

/**
 * Calculate statistics for a curriculum subject
 */
function calculateSubjectStats(data: CurriculumSubject): { totalOutcomes: number; totalResources: number; totalHours: number } {
  let totalOutcomes = 0;
  let totalResources = 0;
  let totalHours = 0;

  data.units.forEach((unit) => {
    totalOutcomes += unit.outcomes?.length || 0;
    totalResources += unit.resources?.length || 0;
    totalHours += unit.estimatedHours || 0;
  });

  return { totalOutcomes, totalResources, totalHours };
}

/**
 * Get all subjects with enhanced metadata
 */
export function getAllSubjectsWithMetadata(): SubjectMetadata[] {
  const subjects = getAllSubjects();

  return subjects.map((subjectName) => {
    // Normalize subject name for data lookup (e.g., "English 30-1" → "English Language Arts 30-1")
    const normalizedName = normalizeSubjectName(subjectName);
    const data = getCurriculumData(normalizedName);
    // Use original subjectName for config lookup (config keys match getAllSubjects() keys)
    const config = SUBJECT_CONFIG[subjectName];

    if (!data || !config) {
      console.warn(`Missing data or config for subject: ${subjectName} (normalized: ${normalizedName})`);
      return null;
    }

    const stats = calculateSubjectStats(data);

    return {
      ...config,
      ...stats,
      data,
    };
  }).filter(Boolean) as SubjectMetadata[];
}

/**
 * Get a single subject by slug
 */
export function getSubjectBySlug(slug: string): SubjectMetadata | null {
  const subjects = getAllSubjectsWithMetadata();
  return subjects.find((s) => s.slug === slug) || null;
}

/**
 * Calculate overall curriculum statistics
 */
export function getCurriculumStats(): CurriculumStats {
  const subjects = getAllSubjectsWithMetadata();

  const stats: CurriculumStats = {
    totalSubjects: subjects.length,
    totalOutcomes: 0,
    totalResources: 0,
    totalHours: 0,
    subjectsByGrade: {},
    subjectsByCategory: {},
  };

  subjects.forEach((subject) => {
    stats.totalOutcomes += subject.totalOutcomes;
    stats.totalResources += subject.totalResources;
    stats.totalHours += subject.totalHours;

    stats.subjectsByGrade[subject.grade] = (stats.subjectsByGrade[subject.grade] || 0) + 1;
    stats.subjectsByCategory[subject.category] = (stats.subjectsByCategory[subject.category] || 0) + 1;
  });

  return stats;
}

/**
 * Filter subjects based on criteria
 */
export interface FilterCriteria {
  grades?: number[];
  categories?: string[];
  diplomaOnly?: boolean;
  minOutcomes?: number;
  maxHours?: number;
}

export function filterSubjects(criteria: FilterCriteria): SubjectMetadata[] {
  let subjects = getAllSubjectsWithMetadata();

  if (criteria.grades && criteria.grades.length > 0) {
    subjects = subjects.filter((s) => criteria.grades!.includes(s.grade));
  }

  if (criteria.categories && criteria.categories.length > 0) {
    subjects = subjects.filter((s) => criteria.categories!.includes(s.category));
  }

  if (criteria.diplomaOnly) {
    subjects = subjects.filter((s) => s.hasDiploma);
  }

  if (criteria.minOutcomes !== undefined) {
    subjects = subjects.filter((s) => s.totalOutcomes >= criteria.minOutcomes!);
  }

  if (criteria.maxHours !== undefined) {
    subjects = subjects.filter((s) => s.totalHours <= criteria.maxHours!);
  }

  return subjects;
}

/**
 * Create search index for fuzzy search
 */
export interface SearchableItem {
  type: 'subject' | 'unit' | 'outcome' | 'resource';
  subjectName: string;
  subjectSlug: string;
  title: string;
  description?: string;
  code?: string;
  url?: string;
  unitId?: string;
  grade: number;
  category: string;
}

export function createSearchIndex(): SearchableItem[] {
  const subjects = getAllSubjectsWithMetadata();
  const index: SearchableItem[] = [];

  subjects.forEach((subject) => {
    // Add subject itself
    index.push({
      type: 'subject',
      subjectName: subject.name,
      subjectSlug: subject.slug,
      title: subject.name,
      description: `${subject.totalOutcomes} outcomes, ${subject.totalResources} resources`,
      grade: subject.grade,
      category: subject.category,
    });

    // Add units
    subject.data.units.forEach((unit) => {
      index.push({
        type: 'unit',
        subjectName: subject.name,
        subjectSlug: subject.slug,
        unitId: unit.id,
        title: unit.title,
        description: unit.topics?.join(', ') || '',
        grade: subject.grade,
        category: subject.category,
      });

      // Add outcomes
      unit.outcomes?.forEach((outcome) => {
        index.push({
          type: 'outcome',
          subjectName: subject.name,
          subjectSlug: subject.slug,
          unitId: unit.id,
          title: outcome.description || outcome.title || '',
          code: outcome.code,
          description: outcome.description || outcome.title || '',
          grade: subject.grade,
          category: subject.category,
        });
      });

      // Add resources
      unit.resources?.forEach((resource) => {
        index.push({
          type: 'resource',
          subjectName: subject.name,
          subjectSlug: subject.slug,
          unitId: unit.id,
          title: resource.title,
          url: resource.url,
          description: `${resource.type} resource`,
          grade: subject.grade,
          category: subject.category,
        });
      });
    });
  });

  return index;
}

/**
 * Get related subjects based on category and grade
 */
export function getRelatedSubjects(subjectSlug: string, limit: number = 3): SubjectMetadata[] {
  const currentSubject = getSubjectBySlug(subjectSlug);
  if (!currentSubject) return [];

  const allSubjects = getAllSubjectsWithMetadata();

  // Filter out current subject and prioritize same category or same grade
  return allSubjects
    .filter((s) => s.slug !== subjectSlug)
    .sort((a, b) => {
      const aScore =
        (a.category === currentSubject.category ? 10 : 0) +
        (a.grade === currentSubject.grade ? 5 : 0);
      const bScore =
        (b.category === currentSubject.category ? 10 : 0) +
        (b.grade === currentSubject.grade ? 5 : 0);
      return bScore - aScore;
    })
    .slice(0, limit);
}
