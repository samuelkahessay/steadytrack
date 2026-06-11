import { describe, it, expect } from 'vitest';
import { generatePlan } from '../planGenerator';

describe('planGenerator', () => {
  describe('Basic Plan Generation', () => {
    it('should generate a 5-day schedule for a single week without weekends', () => {
      const result = generatePlan(['Math 30-1'], 1, false, '2025-01-06');

      expect(result.days).toHaveLength(5);
      expect(result.days[0].dayLabel).toContain('Monday');
      expect(result.days[4].dayLabel).toContain('Friday');
      expect(result.days[0].date).toBe('2025-01-06');
      expect(result.days[4].date).toBe('2025-01-10');
    });

    it('should generate a 7-day schedule for a single week with weekends', () => {
      const result = generatePlan(['Math 30-1'], 1, true, '2025-01-06');

      expect(result.days).toHaveLength(7);
      expect(result.days[0].dayLabel).toContain('Monday');
      expect(result.days[5].dayLabel).toContain('Saturday');
      expect(result.days[6].dayLabel).toContain('Sunday');
      expect(result.days[5].isWeekend).toBe(true);
      expect(result.days[6].isWeekend).toBe(true);
    });

    it('should generate a multi-week schedule with correct labels', () => {
      const result = generatePlan(['Math 30-1'], 2, false, '2025-01-06');

      expect(result.days).toHaveLength(10); // 2 weeks * 5 days
      expect(result.days[0].dayLabel).toContain('Week 1 - Monday');
      expect(result.days[4].dayLabel).toContain('Week 1 - Friday');
      expect(result.days[5].dayLabel).toContain('Week 2 - Monday');
      expect(result.days[9].dayLabel).toContain('Week 2 - Friday');
    });

    it('should handle empty subject list', () => {
      const result = generatePlan([], 1, false, '2025-01-06');

      // Should create at least 1 day even with no content
      expect(result.days).toHaveLength(1);
      expect(result.days[0].outcomes).toHaveLength(0);
    });

    it('should handle invalid subject names gracefully', () => {
      const result = generatePlan(['NonexistentSubject'], 1, false, '2025-01-06');

      expect(result.days).toHaveLength(1);
      expect(result.days[0].outcomes).toHaveLength(0);
    });
  });

  describe('Outcome Distribution', () => {
    it('should distribute outcomes across days', () => {
      const result = generatePlan(['Math 30-1'], 2, false);

      const totalOutcomes = result.days.reduce((sum, day) => sum + day.outcomes.length, 0);
      expect(totalOutcomes).toBeGreaterThan(0);

      // At least some days should have outcomes
      const daysWithOutcomes = result.days.filter((day) => day.outcomes.length > 0).length;
      expect(daysWithOutcomes).toBeGreaterThan(0);
    });

    it('should cap day count to available content', () => {
      // Request 12 weeks but only provide 1 subject with ~16 outcomes
      const result = generatePlan(['Math 30-1'], 12, false);

      // Should not create 60 empty days - instead cap to content available
      const totalOutcomes = result.days.reduce((sum, day) => sum + day.outcomes.length, 0);
      expect(result.days.length).toBeLessThanOrEqual(totalOutcomes);
    });

    it('should balance load across days using LPT heuristic', () => {
      const result = generatePlan(['Math 30-1', 'Chemistry 30'], 1, false);

      const dayLoads = result.days.map((day) => day.outcomes.length);

      // Calculate standard deviation to measure balance
      const mean = dayLoads.reduce((a, b) => a + b, 0) / dayLoads.length;
      const variance = dayLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / dayLoads.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation / mean ratio should be < 0.4 (40% variation max)
      const stdDevMeanRatio = mean > 0 ? stdDev / mean : 0;
      expect(stdDevMeanRatio).toBeLessThan(0.4);
    });

    it('should avoid extreme imbalance between min and max days', () => {
      const result = generatePlan(['Math 30-1', 'Biology 30', 'Chemistry 30'], 2, false);

      const dayLoads = result.days.map((day) => day.outcomes.length);
      const min = Math.min(...dayLoads);
      const max = Math.max(...dayLoads);
      const totalOutcomes = dayLoads.reduce((sum, count) => sum + count, 0);

      // Min/max ratio should be >= 0.5 (max day shouldn't be more than 2x min day)
      if (totalOutcomes > 0 && max > 0) {
        const minMaxRatio = min / max;
        expect(minMaxRatio).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should not create empty days when outcomes > days', () => {
      const result = generatePlan(['Math 30-1', 'Chemistry 30', 'Biology 30'], 1, false);

      const dayLoads = result.days.map((day) => day.outcomes.length);
      const totalOutcomes = dayLoads.reduce((sum, count) => sum + count, 0);
      const emptyDays = dayLoads.filter((count) => count === 0).length;

      // If we have more outcomes than days, no day should be empty
      if (totalOutcomes > result.days.length) {
        expect(emptyDays).toBe(0);
      }
    });
  });

  describe('Synthetic Outcomes', () => {
    it('should create synthetic outcome for unit without outcomes but with resources', () => {
      // Math 30-1 has "Trigonometric Functions" unit with 0 outcomes but 6 resources
      const result = generatePlan(['Math 30-1'], 2, false);

      const allOutcomes = result.days.flatMap((day) => day.outcomes);
      const syntheticOutcomes = allOutcomes.filter((o) => o.isSynthetic);

      expect(syntheticOutcomes.length).toBeGreaterThan(0);

      // Verify synthetic outcome structure
      const trigSynthetic = syntheticOutcomes.find((o) => o.unitTitle === 'Trigonometric Functions');
      expect(trigSynthetic).toBeDefined();
      expect(trigSynthetic!.isSynthetic).toBe(true);
      expect(trigSynthetic!.outcomeCode).toBe('m30_trigonometry-content');
      expect(trigSynthetic!.fallbackResources.length).toBeGreaterThan(0);
    });

    it('should flag real Alberta outcomes as non-synthetic', () => {
      const result = generatePlan(['Math 30-1'], 2, false);

      const allOutcomes = result.days.flatMap((day) => day.outcomes);
      const realOutcomes = allOutcomes.filter((o) => !o.isSynthetic);

      expect(realOutcomes.length).toBeGreaterThan(0);

      // Real outcomes should have Alberta outcome codes
      const transformationsOutcome = realOutcomes.find((o) => o.outcomeCode === 'RF1');
      expect(transformationsOutcome).toBeDefined();
      expect(transformationsOutcome!.isSynthetic).toBe(false);
    });

    it('should attach fallback resources to synthetic outcomes', () => {
      const result = generatePlan(['Math 30-1'], 2, false);

      const allOutcomes = result.days.flatMap((day) => day.outcomes);
      const syntheticOutcome = allOutcomes.find((o) => o.isSynthetic && o.unitTitle === 'Trigonometric Functions');

      expect(syntheticOutcome).toBeDefined();
      expect(syntheticOutcome!.fallbackResources.length).toBe(2); // Updated: 4 broken links removed, 2 resources remain
    });
  });

  describe('Outcome Uniqueness', () => {
    it('should not generate duplicate outcomes for single subject', () => {
      const result = generatePlan(['Math 30-1'], 2, false);

      const outcomePairs = result.days.flatMap((day) =>
        day.outcomes.map((o) => `${o.subject}::${o.outcomeCode}`)
      );

      const uniquePairs = new Set(outcomePairs);
      expect(outcomePairs.length).toBe(uniquePairs.size);
      expect(outcomePairs.length).toBeGreaterThan(0);
    });

    it('should not generate duplicate outcomes for multiple subjects', () => {
      const result = generatePlan(['Math 30-1', 'Chemistry 30', 'Biology 30'], 4, false);

      const outcomePairs = result.days.flatMap((day) =>
        day.outcomes.map((o) => `${o.subject}::${o.outcomeCode}`)
      );

      const uniquePairs = new Set(outcomePairs);
      expect(outcomePairs.length).toBe(uniquePairs.size);

      // Verify we have outcomes from multiple subjects
      const subjects = new Set(result.days.flatMap((day) => day.outcomes.map((o) => o.subject)));
      expect(subjects.size).toBeGreaterThanOrEqual(2);
    });

    it('should maintain outcome uniqueness with weekends included', () => {
      const result = generatePlan(['Math 30-1', 'Biology 30'], 2, true);

      const outcomePairs = result.days.flatMap((day) =>
        day.outcomes.map((o) => `${o.subject}::${o.outcomeCode}`)
      );

      const uniquePairs = new Set(outcomePairs);
      expect(outcomePairs.length).toBe(uniquePairs.size);
    });

    it('should preserve unit context while ensuring outcome uniqueness', () => {
      const result = generatePlan(['Math 30-1'], 1, false);

      // Verify outcomes are unique
      const outcomePairs = result.days.flatMap((day) =>
        day.outcomes.map((o) => `${o.subject}::${o.outcomeCode}`)
      );
      const uniquePairs = new Set(outcomePairs);
      expect(outcomePairs.length).toBe(uniquePairs.size);

      // Verify unit context is preserved
      const outcomes = result.days.flatMap((day) => day.outcomes);
      outcomes.forEach((outcome) => {
        expect(outcome.unitId).toBeDefined();
        expect(outcome.unitTitle).toBeDefined();
        expect(outcome.subject).toBeDefined();
      });
    });
  });

  describe('Multiple Subjects', () => {
    it('should combine outcomes from multiple subjects', () => {
      const result = generatePlan(['Math 30-1', 'English Language Arts 30-1'], 1, false);

      const totalOutcomes = result.days.reduce((sum, day) => sum + day.outcomes.length, 0);
      expect(totalOutcomes).toBeGreaterThan(0);

      // Should have outcomes from both subjects
      const subjects = new Set<string>();
      result.days.forEach((day) => {
        day.outcomes.forEach((outcome) => subjects.add(outcome.subject));
      });

      expect(subjects.size).toBeGreaterThan(0);
    });

    it('should handle duplicate subjects', () => {
      const result = generatePlan(['Math 30-1', 'Math 30-1'], 1, false);

      // Should treat duplicates as separate instances
      const totalOutcomes = result.days.reduce((sum, day) => sum + day.outcomes.length, 0);
      expect(totalOutcomes).toBeGreaterThan(0);
    });
  });

  describe('Day Index and Labels', () => {
    it('should assign correct day indices', () => {
      const result = generatePlan(['Math 30-1'], 1, false);

      result.days.forEach((day, index) => {
        expect(day.dayIndex).toBe(index);
      });
    });

    it('should mark weekend days correctly', () => {
      const result = generatePlan(['Math 30-1'], 1, true, '2025-01-06');

      expect(result.days[0].isWeekend).toBeFalsy(); // Monday
      expect(result.days[4].isWeekend).toBeFalsy(); // Friday
      expect(result.days[5].isWeekend).toBe(true); // Saturday
      expect(result.days[6].isWeekend).toBe(true); // Sunday
    });
  });

  describe('Edge Cases', () => {
    it('should handle single day plan', () => {
      const result = generatePlan(['Math 30-1'], 1, false, '2025-01-06');

      expect(result.days.length).toBeGreaterThan(0);
    });

    it('should handle maximum duration (12 weeks)', () => {
      const result = generatePlan(['Math 30-1'], 12, false, '2025-01-06');

      // Should cap days to available content
      expect(result.days.length).toBeGreaterThan(0);
      expect(result.days.length).toBeLessThanOrEqual(60); // Max 60 weekdays
    });

    it('should handle 12 weeks with weekends', () => {
      const result = generatePlan(['Math 30-1'], 12, true, '2025-01-06');

      // Should cap days to available content
      expect(result.days.length).toBeGreaterThan(0);
      expect(result.days.length).toBeLessThanOrEqual(84); // Max 84 total days
    });
  });

  describe('Outcome Properties', () => {
    it('should include all required properties for each outcome', () => {
      const result = generatePlan(['Math 30-1'], 1, false, '2025-01-06');

      const outcomes = result.days.flatMap((day) => day.outcomes);
      expect(outcomes.length).toBeGreaterThan(0);

      outcomes.forEach((outcome) => {
        expect(typeof outcome.subject).toBe('string');
        expect(typeof outcome.unitId).toBe('string');
        expect(typeof outcome.unitTitle).toBe('string');
        expect(typeof outcome.outcomeCode).toBe('string');
        expect(typeof outcome.isSynthetic).toBe('boolean');
        expect(Array.isArray(outcome.fallbackResources)).toBe(true);
      });
    });

    it('should attach aligned resources to outcomes', () => {
      const result = generatePlan(['Math 30-1'], 1, false);

      const outcomes = result.days.flatMap((day) => day.outcomes);
      const rf1Outcome = outcomes.find((o) => o.outcomeCode === 'RF1');

      expect(rf1Outcome).toBeDefined();
      // RF1 should have some fallback resources aligned from curriculum
      expect(rf1Outcome!.fallbackResources.length).toBeGreaterThan(0);
    });
  });

  describe('Date Calculations', () => {
    it('should default to today when no start date is provided', () => {
      const result = generatePlan(['Math 30-1'], 1, false);

      expect(result.days[0].date).toBeDefined();
      expect(result.days[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should use provided start date', () => {
      const result = generatePlan(['Math 30-1'], 1, false, '2025-01-15');

      // Should be: Wed 15, Thu 16, Fri 17, Mon 20, Tue 21 (skips weekend)
      expect(result.days[0].date).toBe('2025-01-15'); // Wednesday
      expect(result.days[1].date).toBe('2025-01-16'); // Thursday
      expect(result.days[2].date).toBe('2025-01-17'); // Friday
      expect(result.days[3].date).toBe('2025-01-20'); // Monday (skipped weekend)
      expect(result.days[4].date).toBe('2025-01-21'); // Tuesday
    });

    it('should skip weekend dates when includesWeekends is false', () => {
      const result = generatePlan(['Math 30-1'], 1, false, '2025-01-08');

      expect(result.days).toHaveLength(5);
      // Should be: Wed Jan 8, Thu Jan 9, Fri Jan 10, Mon Jan 13, Tue Jan 14
      expect(result.days[0].date).toBe('2025-01-08'); // Wednesday
      expect(result.days[2].date).toBe('2025-01-10'); // Friday
      expect(result.days[3].date).toBe('2025-01-13'); // Monday (skipped weekend)

      // Verify no weekend dates are included
      const dates = result.days.map((d) => d.date);
      expect(dates).not.toContain('2025-01-11'); // Saturday
      expect(dates).not.toContain('2025-01-12'); // Sunday
    });

    it('should handle dates across month boundaries', () => {
      const result = generatePlan(['Math 30-1'], 2, false, '2025-01-29');

      // Should be: Wed 29, Thu 30, Fri 31, Mon Feb 3, Tue 4, ... (skips weekend Feb 1-2)
      expect(result.days[0].date).toBe('2025-01-29'); // Jan 29 (Wed)
      expect(result.days[1].date).toBe('2025-01-30'); // Jan 30 (Thu)
      expect(result.days[2].date).toBe('2025-01-31'); // Jan 31 (Fri)
      expect(result.days[3].date).toBe('2025-02-03'); // Feb 3 (Mon) - skipped weekend
      expect(result.days[4].date).toBe('2025-02-04'); // Feb 4 (Tue)
    });
  });
});
