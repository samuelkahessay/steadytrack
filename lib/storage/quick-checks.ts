/**
 * Quick Check Results localStorage adapter
 * Tracks user quiz/assessment results
 */

import { v4 as uuidv4 } from 'uuid';
import * as storage from './local';
import {
  LocalQuickCheckResult,
  LocalQuickCheckInput,
  LocalQuickCheckResultSchema,
} from '@/types/storage';

const QUICK_CHECKS_KEY = 'quick-checks';

/**
 * Get all quick check results
 */
export function getAllResults(): LocalQuickCheckResult[] {
  const results = storage.get<LocalQuickCheckResult[]>(QUICK_CHECKS_KEY, []);

  try {
    return results.map(r => LocalQuickCheckResultSchema.parse(r));
  } catch (error) {
    console.error('Invalid quick check results data:', error);
    return [];
  }
}

/**
 * Get results for a specific plan
 */
export function getResultsByPlan(planId: string): LocalQuickCheckResult[] {
  const all = getAllResults();
  return all.filter(r => r.plan_id === planId);
}

/**
 * Get results for a specific subject
 */
export function getResultsBySubject(subject: string): LocalQuickCheckResult[] {
  const all = getAllResults();
  return all.filter(r => r.subject === subject);
}

/**
 * Get results for a specific unit
 */
export function getResultsByUnit(
  planId: string | null,
  subject: string,
  unitId: string
): LocalQuickCheckResult[] {
  const all = getAllResults();
  return all.filter(
    r =>
      r.plan_id === planId &&
      r.subject === subject &&
      r.unit_id === unitId
  );
}

/**
 * Get results for a specific microcard
 */
export function getResultsByMicrocard(microcardId: string): LocalQuickCheckResult[] {
  const all = getAllResults();
  return all.filter(r => r.microcard_id === microcardId);
}

/**
 * Add a quick check result
 */
export function addResult(input: LocalQuickCheckInput): LocalQuickCheckResult {
  const now = new Date().toISOString();

  const result: LocalQuickCheckResult = {
    ...input,
    id: uuidv4(),
    created_at: now,
  };

  const validated = LocalQuickCheckResultSchema.parse(result);

  storage.update<LocalQuickCheckResult[]>(
    QUICK_CHECKS_KEY,
    (current) => [...current, validated],
    []
  );

  return validated;
}

/**
 * Get accuracy for a subject
 */
export function getSubjectAccuracy(subject: string): number {
  const results = getResultsBySubject(subject);

  if (results.length === 0) return 0;

  const correct = results.filter(r => r.correct).length;
  return Math.round((correct / results.length) * 100);
}

/**
 * Get accuracy for a specific unit
 */
export function getUnitAccuracy(
  planId: string | null,
  subject: string,
  unitId: string
): number {
  const results = getResultsByUnit(planId, subject, unitId);

  if (results.length === 0) return 0;

  const correct = results.filter(r => r.correct).length;
  return Math.round((correct / results.length) * 100);
}

/**
 * Get accuracy for a specific microcard (for retry tracking)
 */
export function getMicrocardAccuracy(microcardId: string): number {
  const results = getResultsByMicrocard(microcardId);

  if (results.length === 0) return 0;

  const correct = results.filter(r => r.correct).length;
  return Math.round((correct / results.length) * 100);
}

/**
 * Get total attempts count
 */
export function getTotalAttempts(): number {
  return getAllResults().length;
}

/**
 * Get correct attempts count
 */
export function getCorrectAttempts(): number {
  return getAllResults().filter(r => r.correct).length;
}

/**
 * Get overall accuracy
 */
export function getOverallAccuracy(): number {
  const total = getTotalAttempts();

  if (total === 0) return 0;

  const correct = getCorrectAttempts();
  return Math.round((correct / total) * 100);
}

/**
 * Get recent results (last N)
 */
export function getRecentResults(limit: number = 10): LocalQuickCheckResult[] {
  const all = getAllResults();

  // Sort by created_at descending
  const sorted = [...all].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sorted.slice(0, limit);
}

/**
 * Get stats summary
 */
export function getStatsSummary(): {
  totalAttempts: number;
  correctAttempts: number;
  overallAccuracy: number;
  bySubject: Record<string, { attempts: number; correct: number; accuracy: number }>;
} {
  const all = getAllResults();
  const bySubject: Record<string, { attempts: number; correct: number; accuracy: number }> = {};

  all.forEach(result => {
    if (!bySubject[result.subject]) {
      bySubject[result.subject] = { attempts: 0, correct: 0, accuracy: 0 };
    }

    bySubject[result.subject].attempts++;

    if (result.correct) {
      bySubject[result.subject].correct++;
    }
  });

  // Calculate accuracy for each subject
  Object.keys(bySubject).forEach(subject => {
    const stats = bySubject[subject];
    stats.accuracy = stats.attempts > 0
      ? Math.round((stats.correct / stats.attempts) * 100)
      : 0;
  });

  return {
    totalAttempts: getTotalAttempts(),
    correctAttempts: getCorrectAttempts(),
    overallAccuracy: getOverallAccuracy(),
    bySubject,
  };
}

/**
 * Clear results for a specific plan
 */
export function clearResultsByPlan(planId: string): void {
  storage.update<LocalQuickCheckResult[]>(
    QUICK_CHECKS_KEY,
    (current) => current.filter(r => r.plan_id !== planId),
    []
  );
}

/**
 * Clear all results
 */
export function clearAllResults(): void {
  storage.remove(QUICK_CHECKS_KEY);
}

/**
 * Check if user has attempted a specific microcard
 */
export function hasAttemptedMicrocard(microcardId: string): boolean {
  const results = getResultsByMicrocard(microcardId);
  return results.length > 0;
}

/**
 * Get last attempt for a microcard
 */
export function getLastAttempt(microcardId: string): LocalQuickCheckResult | null {
  const results = getResultsByMicrocard(microcardId);

  if (results.length === 0) return null;

  // Sort by created_at descending
  const sorted = [...results].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sorted[0];
}
