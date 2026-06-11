/**
 * Demo Microcards - Fallback data for the local content adapter
 *
 * This module provides demo microcard data for:
 * - Local development without database
 * - Fallback when the local SQLite adapter is unavailable
 * - Testing and demos
 */

import demoData from '@/data/demo-microcards.json';

export interface DemoMicrocard {
  id: string;
  subject: string;
  unit_id: string;
  outcome_code: string;
  summary: string;
  steps: string[];
  pitfall: string | null;
  quick_check: {
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  };
  quality_score: number;
}

// Cast the imported JSON to typed array
const microcards = demoData as DemoMicrocard[];

/**
 * Get subject counts for available demo cards
 * Returns an array of {subject, cardCount} objects
 */
export function getDemoSubjectCounts(): { subject: string; cardCount: number }[] {
  const counts: Record<string, number> = {};

  for (const card of microcards) {
    counts[card.subject] = (counts[card.subject] || 0) + 1;
  }

  return Object.entries(counts).map(([subject, cardCount]) => ({
    subject,
    cardCount,
  }));
}

/**
 * Get random demo cards for given subjects
 * Mimics the local random-card helper
 */
export function getRandomDemoCards(
  subjects: string[],
  excludeIds: string[],
  limit: number
): { cards: DemoMicrocard[]; has_more: boolean } {
  // Filter cards by subjects and exclude already seen cards
  const eligibleCards = microcards.filter(
    (card) => subjects.includes(card.subject) && !excludeIds.includes(card.id)
  );

  // Shuffle the cards (Fisher-Yates)
  const shuffled = [...eligibleCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return limited cards and whether more are available
  const cards = shuffled.slice(0, limit);
  const has_more = shuffled.length > limit;

  return { cards, has_more };
}

/**
 * Get demo cards by specific IDs
 * Used when restoring a session with previously viewed cards
 */
export function getDemoCardsByIds(
  ids: string[],
  subjects: string[]
): DemoMicrocard[] {
  return microcards.filter(
    (card) => ids.includes(card.id) && subjects.includes(card.subject)
  );
}

/**
 * Get demo cards by subject(s)
 * Used by the microcards API route
 */
export function getDemoCardsBySubject(
  subjects: string | string[],
  options?: { units?: string[] }
): DemoMicrocard[] {
  const subjectList = Array.isArray(subjects) ? subjects : [subjects];

  return microcards.filter((card) => {
    const matchesSubject = subjectList.includes(card.subject);
    const matchesUnit = !options?.units || options.units.includes(card.unit_id);
    return matchesSubject && matchesUnit;
  });
}
