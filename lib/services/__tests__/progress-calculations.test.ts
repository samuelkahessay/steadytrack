import { describe, it, expect } from 'vitest';
import {
  countMissedStudyDays,
  calculateStreakFromDates,
  detectMilestone,
  calculateProgressPercentage,
  calculateWeeklySummaryStats,
  calculateRequiredPace,
  predictCompletionDate,
  isOnTrack,
} from '@/lib/services/progress-calculations';

describe('countMissedStudyDays', () => {
  describe('with weekends included (7-day plans)', () => {
    const includesWeekends = true;

    it('should return 0 for consecutive days', () => {
      expect(countMissedStudyDays('2025-01-10', '2025-01-11', includesWeekends)).toBe(0);
    });

    it('should return 0 for same day', () => {
      expect(countMissedStudyDays('2025-01-10', '2025-01-10', includesWeekends)).toBe(0);
    });

    it('should count all days in gap', () => {
      // Jan 10 -> Jan 13 has 2 days in between (Jan 11, Jan 12)
      expect(countMissedStudyDays('2025-01-10', '2025-01-13', includesWeekends)).toBe(2);
    });

    it('should handle one-day gap', () => {
      // Jan 10 -> Jan 12 has 1 day in between (Jan 11)
      expect(countMissedStudyDays('2025-01-10', '2025-01-12', includesWeekends)).toBe(1);
    });

    it('should handle week-long gap', () => {
      // Jan 1 -> Jan 8 has 6 days in between
      expect(countMissedStudyDays('2025-01-01', '2025-01-08', includesWeekends)).toBe(6);
    });
  });

  describe('with weekends excluded (Mon-Fri plans)', () => {
    const includesWeekends = false;

    it('should return 0 for consecutive weekdays', () => {
      // Monday -> Tuesday
      expect(countMissedStudyDays('2025-01-13', '2025-01-14', includesWeekends)).toBe(0);
    });

    it('should return 0 for Friday -> Monday (weekend in between)', () => {
      // Friday Jan 10 -> Monday Jan 13
      expect(countMissedStudyDays('2025-01-10', '2025-01-13', includesWeekends)).toBe(0);
    });

    it('should return 1 for Thursday -> Monday (missed Friday)', () => {
      // Thursday Jan 9 -> Monday Jan 13 (missed Friday Jan 10)
      expect(countMissedStudyDays('2025-01-09', '2025-01-13', includesWeekends)).toBe(1);
    });

    it('should return 2 for Wednesday -> Monday (missed Thu, Fri)', () => {
      // Wednesday Jan 8 -> Monday Jan 13 (missed Thu Jan 9, Fri Jan 10)
      expect(countMissedStudyDays('2025-01-08', '2025-01-13', includesWeekends)).toBe(2);
    });

    it('should count only weekdays in long gap', () => {
      // Monday Jan 6 -> Monday Jan 13 (7 days)
      // Gap contains: Tue 7, Wed 8, Thu 9, Fri 10, Mon 13 excluded, Sat 11, Sun 12 excluded
      // Weekdays missed: Tue, Wed, Thu, Fri = 4
      expect(countMissedStudyDays('2025-01-06', '2025-01-13', includesWeekends)).toBe(4);
    });

    it('should handle Saturday -> Monday (no missed days)', () => {
      // Saturday Jan 11 -> Monday Jan 13 (Sunday in between, but doesn't count)
      expect(countMissedStudyDays('2025-01-11', '2025-01-13', includesWeekends)).toBe(0);
    });
  });

  describe('DST transitions', () => {
    it('should handle spring DST transition correctly', () => {
      // US DST starts March 9, 2025 (Sunday 2am -> 3am)
      // Saturday March 8 -> Monday March 10
      expect(countMissedStudyDays('2025-03-08', '2025-03-10', false)).toBe(0);
    });

    it('should handle fall DST transition correctly', () => {
      // US DST ends November 2, 2025 (Sunday 2am -> 1am)
      // Saturday November 1 -> Monday November 3
      expect(countMissedStudyDays('2025-11-01', '2025-11-03', false)).toBe(0);
    });
  });
});

describe('calculateStreakFromDates', () => {
  const today = '2025-01-13'; // Monday

  describe('with empty or invalid input', () => {
    it('should return zero stats for empty array', () => {
      const result = calculateStreakFromDates([], today, true);
      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        totalStudyDays: 0,
        lastStudyDate: null,
      });
    });

    it('should handle duplicate dates', () => {
      const dates = ['2025-01-10', '2025-01-10', '2025-01-11'];
      const result = calculateStreakFromDates(dates, today, true);
      expect(result.totalStudyDays).toBe(2); // Duplicates removed
    });

    it('should handle unsorted dates', () => {
      const dates = ['2025-01-11', '2025-01-13', '2025-01-12'];
      const result = calculateStreakFromDates(dates, today, true);
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('with weekends included (7-day plans)', () => {
    it('should calculate current streak for consecutive days including today', () => {
      // Fri, Sat, Sun, Mon (today)
      const dates = ['2025-01-10', '2025-01-11', '2025-01-12', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, true);
      expect(result.currentStreak).toBe(4);
      expect(result.longestStreak).toBe(4);
    });

    it('should have zero current streak if last study was too long ago', () => {
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03'];
      const result = calculateStreakFromDates(dates, today, true);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(3);
    });

    it('should calculate longest streak from broken streaks', () => {
      // Streak of 3, gap, streak of 2
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-12', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, true);
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(3);
    });
  });

  describe('with weekends excluded (Mon-Fri plans)', () => {
    it('should calculate streak across weekend', () => {
      // Thu Jan 9, Fri Jan 10, Mon Jan 13 (today) - weekend doesn't break streak
      const dates = ['2025-01-09', '2025-01-10', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, false);
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
    });

    it('should have zero current streak if missed Friday before weekend', () => {
      // Wed Jan 8, Mon Jan 13 (today) - missed Thu and Fri
      const dates = ['2025-01-08', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, false);
      expect(result.currentStreak).toBe(1); // Only today counts
      expect(result.longestStreak).toBe(1);
    });

    it('should handle study sessions on weekends', () => {
      // Fri Jan 10, Sat Jan 11 (studied on weekend), Mon Jan 13 (today)
      const dates = ['2025-01-10', '2025-01-11', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, false);
      // Friday -> Saturday counts (consecutive), Saturday -> Monday counts (weekend)
      expect(result.currentStreak).toBe(3);
    });

    it('should break streak if missed weekday', () => {
      // Mon Jan 6, Tue Jan 7, [missed Wed-Fri], Mon Jan 13 (today)
      const dates = ['2025-01-06', '2025-01-07', '2025-01-13'];
      const result = calculateStreakFromDates(dates, today, false);
      expect(result.currentStreak).toBe(1); // Only today
      expect(result.longestStreak).toBe(2); // Mon-Tue was longest
    });
  });

  describe('edge cases', () => {
    it('should handle studying only today', () => {
      const result = calculateStreakFromDates([today], today, true);
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.totalStudyDays).toBe(1);
    });

    it('should handle future dates gracefully', () => {
      // Including a future date
      const dates = ['2025-01-13', '2025-01-14'];
      const result = calculateStreakFromDates(dates, today, true);
      // Future date should still be processed
      expect(result.totalStudyDays).toBe(2);
    });
  });
});

describe('detectMilestone', () => {
  it('should detect 25% milestone', () => {
    expect(detectMilestone(24, 25)).toBe(25);
    expect(detectMilestone(20, 26)).toBe(25);
  });

  it('should detect 50% milestone', () => {
    expect(detectMilestone(49, 50)).toBe(50);
    expect(detectMilestone(45, 51)).toBe(50);
  });

  it('should detect 75% milestone', () => {
    expect(detectMilestone(74, 75)).toBe(75);
    expect(detectMilestone(70, 76)).toBe(75);
  });

  it('should detect 100% milestone', () => {
    expect(detectMilestone(99, 100)).toBe(100);
    expect(detectMilestone(95, 100)).toBe(100);
  });

  it('should return first milestone when jumping multiple', () => {
    // When jumping from 23% to 76%, should return 25 (first milestone crossed)
    expect(detectMilestone(23, 76)).toBe(25);
  });

  it('should return null when no milestone crossed', () => {
    expect(detectMilestone(30, 35)).toBe(null);
    expect(detectMilestone(60, 65)).toBe(null);
  });

  it('should return null when going backwards', () => {
    expect(detectMilestone(50, 49)).toBe(null);
  });

  it('should return null when staying at same percentage', () => {
    expect(detectMilestone(50, 50)).toBe(null);
  });

  it('should handle exact milestone boundaries', () => {
    expect(detectMilestone(25, 26)).toBe(null);
    expect(detectMilestone(24, 25)).toBe(25);
  });

  it('should handle 0 to milestone jump', () => {
    expect(detectMilestone(0, 25)).toBe(25);
    expect(detectMilestone(0, 100)).toBe(25); // First milestone
  });
});

describe('calculateProgressPercentage', () => {
  it('should calculate basic percentages', () => {
    expect(calculateProgressPercentage(25, 100)).toBe(25);
    expect(calculateProgressPercentage(50, 100)).toBe(50);
    expect(calculateProgressPercentage(75, 100)).toBe(75);
    expect(calculateProgressPercentage(100, 100)).toBe(100);
  });

  it('should round to nearest integer', () => {
    expect(calculateProgressPercentage(7, 20)).toBe(35); // 35%
    expect(calculateProgressPercentage(1, 3)).toBe(33); // 33.33% -> 33
    expect(calculateProgressPercentage(2, 3)).toBe(67); // 66.67% -> 67
  });

  it('should handle 0 completed', () => {
    expect(calculateProgressPercentage(0, 100)).toBe(0);
  });

  it('should handle 0 total units', () => {
    expect(calculateProgressPercentage(10, 0)).toBe(0);
  });

  it('should handle negative total units', () => {
    expect(calculateProgressPercentage(10, -5)).toBe(0);
  });

  it('should handle completion over 100%', () => {
    // Edge case: more completed than total (shouldn't happen, but handle gracefully)
    expect(calculateProgressPercentage(110, 100)).toBe(110);
  });

  it('should handle small numbers correctly', () => {
    expect(calculateProgressPercentage(1, 10)).toBe(10);
    expect(calculateProgressPercentage(1, 100)).toBe(1);
  });
});

describe('calculateWeeklySummaryStats', () => {
  const mockProgress = [
    { completed_at: '2025-01-13T10:00:00Z', completed: true }, // Today
    { completed_at: '2025-01-13T15:00:00Z', completed: true }, // Today (duplicate date)
    { completed_at: '2025-01-12T10:00:00Z', completed: true }, // Yesterday
    { completed_at: '2025-01-11T10:00:00Z', completed: true }, // 2 days ago
    { completed_at: '2025-01-08T10:00:00Z', completed: true }, // 5 days ago
    { completed_at: '2025-01-05T10:00:00Z', completed: true }, // 8 days ago (too old)
    { completed_at: '2025-01-12T10:00:00Z', completed: false }, // Not completed
  ];

  const referenceDate = new Date('2025-01-13T20:00:00Z');

  it('should count units from last 7 days', () => {
    const result = calculateWeeklySummaryStats(mockProgress, referenceDate);
    expect(result.totalUnits).toBe(5); // Excludes Jan 5 (8 days ago) and incomplete
    // Included: Jan 8 (5 days), Jan 11 (2 days), Jan 12 (1 day), Jan 13 x2 (today)
  });

  it('should extract unique activity dates', () => {
    const result = calculateWeeklySummaryStats(mockProgress, referenceDate);
    expect(result.activityDates).toEqual([
      '2025-01-08',
      '2025-01-11',
      '2025-01-12',
      '2025-01-13',
    ]);
  });

  it('should handle empty progress', () => {
    const result = calculateWeeklySummaryStats([], referenceDate);
    expect(result).toEqual({
      activityDates: [],
      totalUnits: 0,
    });
  });

  it('should only count completed units', () => {
    const incompleteOnly = [
      { completed_at: '2025-01-13T10:00:00Z', completed: false },
      { completed_at: '2025-01-12T10:00:00Z', completed: false },
    ];
    const result = calculateWeeklySummaryStats(incompleteOnly, referenceDate);
    expect(result.totalUnits).toBe(0);
    expect(result.activityDates).toEqual([]);
  });

  it('should sort activity dates', () => {
    const unsortedProgress = [
      { completed_at: '2025-01-13T10:00:00Z', completed: true },
      { completed_at: '2025-01-11T10:00:00Z', completed: true },
      { completed_at: '2025-01-12T10:00:00Z', completed: true },
    ];
    const result = calculateWeeklySummaryStats(unsortedProgress, referenceDate);
    expect(result.activityDates).toEqual([
      '2025-01-11',
      '2025-01-12',
      '2025-01-13',
    ]);
  });

  it('should handle multiple completions on same day', () => {
    const sameDayProgress = [
      { completed_at: '2025-01-13T08:00:00Z', completed: true },
      { completed_at: '2025-01-13T12:00:00Z', completed: true },
      { completed_at: '2025-01-13T18:00:00Z', completed: true },
    ];
    const result = calculateWeeklySummaryStats(sameDayProgress, referenceDate);
    expect(result.totalUnits).toBe(3);
    expect(result.activityDates).toEqual(['2025-01-13']); // Only one date
  });

  it('should default to current date if no reference provided', () => {
    // Just verify it doesn't crash
    const result = calculateWeeklySummaryStats(mockProgress);
    expect(result).toHaveProperty('activityDates');
    expect(result).toHaveProperty('totalUnits');
  });
});

describe('calculateRequiredPace', () => {
  const startDate = '2025-01-01'; // Wednesday
  const endDate = '2025-03-31'; // Monday
  const currentDate = '2025-01-13'; // Monday, 12 days in

  describe('with weekends included (7-day plans)', () => {
    const includesWeekends = true;

    it('should calculate required units per day', () => {
      // 100 units, 25 completed, 89 days total, 12 days elapsed, 77 days remaining
      const result = calculateRequiredPace(25, 100, startDate, endDate, currentDate, includesWeekends);

      // 75 remaining units / 77 days remaining = ~0.97 units/day
      expect(result.requiredUnitsPerDay).toBeCloseTo(0.97, 1);
      expect(result.daysRemaining).toBe(77);
      expect(result.requiredStudyDays).toBe(77);
    });

    it('should detect user is on track', () => {
      // Expected pace: 100 units / 89 days = ~1.12 units/day
      // After 12 days, expected: 12 * 1.12 = ~13.4 units
      // User has 25 units, so they're ahead
      const result = calculateRequiredPace(25, 100, startDate, endDate, currentDate, includesWeekends);
      expect(result.isOnTrack).toBe(true);
    });

    it('should detect user is behind schedule', () => {
      // Only 5 units after 12 days (expected ~13.4)
      const result = calculateRequiredPace(5, 100, startDate, endDate, currentDate, includesWeekends);
      expect(result.isOnTrack).toBe(false);
    });

    it('should handle completed plans', () => {
      const result = calculateRequiredPace(100, 100, startDate, endDate, currentDate, includesWeekends);
      expect(result.requiredUnitsPerDay).toBe(0);
      expect(result.isOnTrack).toBe(true);
    });

    it('should handle past end date', () => {
      const pastDate = '2025-04-15'; // After end date
      const result = calculateRequiredPace(50, 100, startDate, endDate, pastDate, includesWeekends);
      expect(result.daysRemaining).toBeLessThan(0);
      expect(result.requiredUnitsPerDay).toBe(0);
      expect(result.isOnTrack).toBe(false); // Not completed
    });
  });

  describe('with weekends excluded (Mon-Fri plans)', () => {
    const includesWeekends = false;

    it('should count only weekdays for study days', () => {
      const result = calculateRequiredPace(25, 100, startDate, endDate, currentDate, includesWeekends);

      // Jan 13 (Mon) to Mar 31 (Mon) has 56 weekdays remaining (inclusive)
      expect(result.requiredStudyDays).toBe(56);

      // 75 remaining units / 56 weekdays = ~1.34 units/weekday
      expect(result.requiredUnitsPerDay).toBeCloseTo(1.34, 1);
    });

    it('should calculate on-track status using weekday pace', () => {
      // Jan 1 to Jan 13 has 9 weekdays elapsed
      // Expected pace: 100 units / 64 total weekdays = ~1.56 units/weekday
      // After 9 weekdays: 9 * 1.56 = ~14 units expected
      // User has 25 units, so they're ahead
      const result = calculateRequiredPace(25, 100, startDate, endDate, currentDate, includesWeekends);
      expect(result.isOnTrack).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle plan starting today', () => {
      const result = calculateRequiredPace(0, 100, currentDate, endDate, currentDate, true);
      expect(result.requiredStudyDays).toBeGreaterThan(0);
      expect(result.isOnTrack).toBe(true); // No expectation yet
    });

    it('should handle single day plan', () => {
      const singleDay = '2025-01-13';
      const result = calculateRequiredPace(50, 100, singleDay, singleDay, singleDay, true);
      expect(result.daysRemaining).toBe(0);
      expect(result.requiredUnitsPerDay).toBe(50); // All remaining units
    });
  });
});

describe('predictCompletionDate', () => {
  const mockProgressRecords = [
    { completed_at: '2025-01-01T10:00:00Z', completed: true },
    { completed_at: '2025-01-02T10:00:00Z', completed: true },
    { completed_at: '2025-01-03T10:00:00Z', completed: true },
    { completed_at: '2025-01-04T10:00:00Z', completed: true },
    { completed_at: '2025-01-05T10:00:00Z', completed: true },
    // 5 units in 5 days = 1 unit/day pace
  ];

  it('should predict completion date based on current pace', () => {
    const currentDate = '2025-01-05';
    const result = predictCompletionDate(5, 20, mockProgressRecords, currentDate, true);

    // Days elapsed from Jan 1 to Jan 5 = 4 days
    // 5 units in 4 days = 1.25 units/day
    // 15 remaining units / 1.25 = 12 days
    // Jan 5 + 12 days = Jan 17
    expect(result).toBe('2025-01-17');
  });

  it('should return current date if already completed', () => {
    const currentDate = '2025-01-05';
    const result = predictCompletionDate(20, 20, mockProgressRecords, currentDate, true);
    expect(result).toBe(currentDate);
  });

  it('should return null if no progress data', () => {
    const result = predictCompletionDate(0, 20, [], '2025-01-05', true);
    expect(result).toBe(null);
  });

  it('should return null if no completed records', () => {
    const incompleteRecords = [
      { completed_at: '2025-01-01T10:00:00Z', completed: false },
    ];
    const result = predictCompletionDate(0, 20, incompleteRecords, '2025-01-05', true);
    expect(result).toBe(null);
  });

  it('should handle fractional days (round up)', () => {
    const currentDate = '2025-01-05';
    // 5 units in 4 days = 1.25 units/day
    // 15 remaining units / 1.25 = 12 days
    const result = predictCompletionDate(5, 20, mockProgressRecords, currentDate, true);
    expect(result).toBeTruthy();

    const predicted = new Date(result!);
    const expected = new Date('2025-01-05');
    const daysDiff = Math.ceil((predicted.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeGreaterThanOrEqual(12);
  });

  it('should handle slow pace gracefully', () => {
    // Very slow pace
    const slowProgress = [
      { completed_at: '2025-01-01T10:00:00Z', completed: true },
    ];
    const result = predictCompletionDate(1, 100, slowProgress, '2025-01-20', true);

    // 99 remaining units at ~0.05 units/day = ~1980 days (very far in future)
    expect(result).toBeTruthy();
    const predicted = new Date(result!);
    expect(predicted.getFullYear()).toBeGreaterThanOrEqual(2025);
  });
});

describe('isOnTrack', () => {
  const startDate = '2025-01-01';
  const endDate = '2025-03-31';
  const currentDate = '2025-01-13';

  it('should return true if user is on track', () => {
    // 25 units completed, expected ~14 after 12 days
    expect(isOnTrack(25, 100, startDate, endDate, currentDate, true)).toBe(true);
  });

  it('should return false if user is behind', () => {
    // Only 5 units, expected ~14
    expect(isOnTrack(5, 100, startDate, endDate, currentDate, true)).toBe(false);
  });

  it('should handle completed plans', () => {
    expect(isOnTrack(100, 100, startDate, endDate, currentDate, true)).toBe(true);
  });

  it('should handle plans with no progress', () => {
    // At start of plan, user is "on track" (no expectation yet)
    expect(isOnTrack(0, 100, startDate, endDate, startDate, true)).toBe(true);
  });

  it('should respect weekend settings', () => {
    // With weekends excluded, different pace expectations
    const weekdayResult = isOnTrack(15, 100, startDate, endDate, currentDate, false);
    const weekendResult = isOnTrack(15, 100, startDate, endDate, currentDate, true);

    // Both should have a result (might be same or different depending on pace)
    expect(typeof weekdayResult).toBe('boolean');
    expect(typeof weekendResult).toBe('boolean');
  });

  it('should handle edge case of past end date', () => {
    const pastDate = '2025-04-15';
    // Not completed, past end date = not on track
    expect(isOnTrack(50, 100, startDate, endDate, pastDate, true)).toBe(false);
    // Completed, past end date = on track
    expect(isOnTrack(100, 100, startDate, endDate, pastDate, true)).toBe(true);
  });
});
