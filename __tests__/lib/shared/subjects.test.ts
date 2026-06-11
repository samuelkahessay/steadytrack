import { toDBSubject, toUISubject, getAllUISubjects, getAllDBSubjects } from '@/lib/shared/subjects';

describe('Subject mapping utilities', () => {
  describe('toDBSubject', () => {
    test('converts Math UI names to database names', () => {
      expect(toDBSubject('Math 20-1')).toBe('Mathematics 20-1');
      expect(toDBSubject('Math 30-1')).toBe('Math 30-1'); // DB has "Math 30-1" not "Mathematics 30-1"
    });

    test('keeps Biology names unchanged (1:1 mapping)', () => {
      expect(toDBSubject('Biology 20')).toBe('Biology 20');
      expect(toDBSubject('Biology 30')).toBe('Biology 30');
    });

    test('keeps Chemistry names unchanged (1:1 mapping)', () => {
      expect(toDBSubject('Chemistry 20')).toBe('Chemistry 20');
      expect(toDBSubject('Chemistry 30')).toBe('Chemistry 30');
    });

    test('keeps Physics names unchanged (1:1 mapping)', () => {
      expect(toDBSubject('Physics 20')).toBe('Physics 20');
      expect(toDBSubject('Physics 30')).toBe('Physics 30');
    });

    test('keeps English Language Arts names unchanged (1:1 mapping)', () => {
      expect(toDBSubject('English Language Arts 20-1')).toBe('English Language Arts 20-1');
      expect(toDBSubject('English Language Arts 30-1')).toBe('English Language Arts 30-1');
    });

    test('keeps Social Studies names unchanged (1:1 mapping)', () => {
      expect(toDBSubject('Social Studies 20-1')).toBe('Social Studies 20-1');
      expect(toDBSubject('Social Studies 30-1')).toBe('Social Studies 30-1');
    });

    test('handles unknown subjects gracefully', () => {
      expect(toDBSubject('Unknown Subject')).toBe('Unknown Subject');
      expect(toDBSubject('Math 10-1')).toBe('Math 10-1');
      expect(toDBSubject('')).toBe('');
    });
  });

  describe('toUISubject', () => {
    test('converts database names to Math UI names', () => {
      expect(toUISubject('Mathematics 20-1')).toBe('Math 20-1');
      // Note: 'Mathematics 30-1' doesn't exist in DB; DB has 'Math 30-1' instead
      expect(toUISubject('Math 30-1')).toBe('Math 30-1');
    });

    test('keeps Biology names unchanged (1:1 mapping)', () => {
      expect(toUISubject('Biology 20')).toBe('Biology 20');
      expect(toUISubject('Biology 30')).toBe('Biology 30');
    });

    test('keeps Chemistry names unchanged (1:1 mapping)', () => {
      expect(toUISubject('Chemistry 20')).toBe('Chemistry 20');
      expect(toUISubject('Chemistry 30')).toBe('Chemistry 30');
    });

    test('keeps Physics names unchanged (1:1 mapping)', () => {
      expect(toUISubject('Physics 20')).toBe('Physics 20');
      expect(toUISubject('Physics 30')).toBe('Physics 30');
    });

    test('keeps English Language Arts names unchanged (1:1 mapping)', () => {
      expect(toUISubject('English Language Arts 20-1')).toBe('English Language Arts 20-1');
      expect(toUISubject('English Language Arts 30-1')).toBe('English Language Arts 30-1');
    });

    test('keeps Social Studies names unchanged (1:1 mapping)', () => {
      expect(toUISubject('Social Studies 20-1')).toBe('Social Studies 20-1');
      expect(toUISubject('Social Studies 30-1')).toBe('Social Studies 30-1');
    });

    test('handles unknown subjects gracefully', () => {
      expect(toUISubject('Unknown Subject')).toBe('Unknown Subject');
      expect(toUISubject('Mathematics 10-1')).toBe('Mathematics 10-1');
      expect(toUISubject('')).toBe('');
    });
  });

  describe('bidirectional mapping', () => {
    test('toDBSubject and toUISubject are inverse operations for Math subjects', () => {
      const mathSubjects = ['Math 20-1', 'Math 30-1'];
      mathSubjects.forEach(uiName => {
        const dbName = toDBSubject(uiName);
        expect(toUISubject(dbName)).toBe(uiName);
      });
    });

    test('toDBSubject and toUISubject are inverse operations for all subjects', () => {
      const allUISubjects = getAllUISubjects();
      allUISubjects.forEach(uiName => {
        const dbName = toDBSubject(uiName);
        expect(toUISubject(dbName)).toBe(uiName);
      });
    });

    test('mapping is symmetric for 1:1 subjects', () => {
      const oneToOneSubjects = [
        'Biology 20', 'Biology 30',
        'Chemistry 20', 'Chemistry 30',
        'Physics 20', 'Physics 30',
        'English Language Arts 20-1', 'English Language Arts 30-1',
        'Social Studies 20-1', 'Social Studies 30-1'
      ];

      oneToOneSubjects.forEach(subject => {
        expect(toDBSubject(subject)).toBe(subject);
        expect(toUISubject(subject)).toBe(subject);
      });
    });
  });

  describe('getAllUISubjects', () => {
    test('returns all 12 UI subject names', () => {
      const subjects = getAllUISubjects();
      expect(subjects).toHaveLength(12);
    });

    test('includes all expected subjects', () => {
      const subjects = getAllUISubjects();
      const expectedSubjects = [
        'Math 20-1', 'Math 30-1',
        'Biology 20', 'Biology 30',
        'Chemistry 20', 'Chemistry 30',
        'Physics 20', 'Physics 30',
        'English Language Arts 20-1', 'English Language Arts 30-1',
        'Social Studies 20-1', 'Social Studies 30-1'
      ];

      expectedSubjects.forEach(subject => {
        expect(subjects).toContain(subject);
      });
    });

    test('returns array without duplicates', () => {
      const subjects = getAllUISubjects();
      const uniqueSubjects = [...new Set(subjects)];
      expect(subjects).toEqual(uniqueSubjects);
    });
  });

  describe('getAllDBSubjects', () => {
    test('returns all 12 database subject names', () => {
      const subjects = getAllDBSubjects();
      expect(subjects).toHaveLength(12);
    });

    test('includes Mathematics for 20-1 and Math for 30-1', () => {
      const subjects = getAllDBSubjects();
      expect(subjects).toContain('Mathematics 20-1'); // DB has "Mathematics 20-1"
      expect(subjects).toContain('Math 30-1'); // DB has "Math 30-1" (not "Mathematics 30-1")
      expect(subjects).not.toContain('Math 20-1');
      expect(subjects).not.toContain('Mathematics 30-1');
    });

    test('returns array without duplicates', () => {
      const subjects = getAllDBSubjects();
      const uniqueSubjects = [...new Set(subjects)];
      expect(subjects).toEqual(uniqueSubjects);
    });
  });

  describe('edge cases', () => {
    test('handles empty strings', () => {
      expect(toDBSubject('')).toBe('');
      expect(toUISubject('')).toBe('');
    });

    test('handles null-like strings gracefully', () => {
      expect(toDBSubject('null')).toBe('null');
      expect(toDBSubject('undefined')).toBe('undefined');
      expect(toUISubject('null')).toBe('null');
      expect(toUISubject('undefined')).toBe('undefined');
    });

    test('preserves case for unknown subjects', () => {
      expect(toDBSubject('MATH 20-1')).toBe('MATH 20-1');
      expect(toUISubject('MATHEMATICS 20-1')).toBe('MATHEMATICS 20-1');
    });

    test('is case-sensitive', () => {
      expect(toDBSubject('math 20-1')).toBe('math 20-1');
      expect(toDBSubject('math 20-1')).not.toBe('Mathematics 20-1');
    });
  });
});
