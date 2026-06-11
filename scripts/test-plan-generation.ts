/**
 * Comprehensive Plan Generation Test Script
 *
 * Tests plan generation across all subjects, durations, and combinations
 * to verify correctness, balance, and edge case handling.
 */

import { generatePlan } from '../lib/shared/planGenerator';
import { getCurriculumData } from '../data/curriculum';

interface TestResult {
  name: string;
  subjects: string[];
  duration: number;
  includesWeekends: boolean;
  totalDays: number;
  totalOutcomes: number;
  syntheticOutcomes: number;
  minOutcomesPerDay: number;
  maxOutcomesPerDay: number;
  avgOutcomesPerDay: number;
  balance: number;
  hasDuplicates: boolean;
  status: 'PASS' | 'FAIL';
  issues: string[];
}

// Subject mappings (curriculum key -> display name)
const SUBJECTS = {
  'Biology 20': 'Biology 20',
  'Biology 30': 'Biology 30',
  'Chemistry 20': 'Chemistry 20',
  'Chemistry 30': 'Chemistry 30',
  'English Language Arts 20-1': 'English Language Arts 20-1',
  'English Language Arts 30-1': 'English Language Arts 30-1',
  'Math 20-1': 'Math 20-1',
  'Math 30-1': 'Math 30-1',
  'Physics 20': 'Physics 20',
  'Physics 30': 'Physics 30',
  'Social Studies 20-1': 'Social Studies 20-1',
  'Social Studies 30-1': 'Social Studies 30-1',
};

const GRADE_11_SUBJECTS = [
  'Biology 20',
  'Chemistry 20',
  'English Language Arts 20-1',
  'Math 20-1',
  'Physics 20',
  'Social Studies 20-1',
];

const GRADE_12_SUBJECTS = [
  'Biology 30',
  'Chemistry 30',
  'English Language Arts 30-1',
  'Math 30-1',
  'Physics 30',
  'Social Studies 30-1',
];

const SCIENCE_STREAM = ['Math 30-1', 'Chemistry 30', 'Biology 30', 'Physics 30'];
const HUMANITIES_STREAM = ['Math 30-1', 'English Language Arts 30-1', 'Social Studies 30-1'];

/**
 * Run a single test case and collect metrics
 */
function runTest(
  name: string,
  subjects: string[],
  duration: number,
  includesWeekends: boolean
): TestResult {
  const issues: string[] = [];

  // Generate plan
  const plan = generatePlan(subjects, duration, includesWeekends, '2025-01-06');

  // Calculate metrics
  const totalDays = plan.days.length;
  const totalOutcomes = plan.days.reduce((sum, day) => sum + day.outcomes.length, 0);
  const syntheticOutcomes = plan.days.flatMap(d => d.outcomes).filter(o => o.isSynthetic).length;

  const dayLoads = plan.days.map(d => d.outcomes.length);
  const minOutcomesPerDay = dayLoads.length > 0 ? Math.min(...dayLoads) : 0;
  const maxOutcomesPerDay = dayLoads.length > 0 ? Math.max(...dayLoads) : 0;
  const avgOutcomesPerDay = totalDays > 0 ? totalOutcomes / totalDays : 0;
  const balance = maxOutcomesPerDay > 0 ? minOutcomesPerDay / maxOutcomesPerDay : 1;

  // Check for duplicates
  const outcomePairs = plan.days.flatMap(day =>
    day.outcomes.map(o => `${o.subject}::${o.outcomeCode}`)
  );
  const uniquePairs = new Set(outcomePairs);
  const hasDuplicates = outcomePairs.length !== uniquePairs.size;

  if (hasDuplicates) {
    issues.push('Duplicate outcomes detected');
  }

  // Check for empty days when content exists
  if (totalOutcomes > totalDays) {
    const emptyDays = dayLoads.filter(load => load === 0).length;
    if (emptyDays > 0) {
      issues.push(`${emptyDays} empty days when outcomes available`);
    }
  }

  // Check balance (should be >= 0.5 for good distribution)
  if (balance < 0.5 && totalOutcomes > 1) {
    issues.push(`Poor balance: ${balance.toFixed(2)} (expected >= 0.5)`);
  }

  // Determine status
  const status = issues.length === 0 ? 'PASS' : 'FAIL';

  return {
    name,
    subjects,
    duration,
    includesWeekends,
    totalDays,
    totalOutcomes,
    syntheticOutcomes,
    minOutcomesPerDay,
    maxOutcomesPerDay,
    avgOutcomesPerDay,
    balance,
    hasDuplicates,
    status,
    issues,
  };
}

/**
 * Print results in a formatted table
 */
function printResults(results: TestResult[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('COMPREHENSIVE PLAN GENERATION TEST RESULTS');
  console.log('='.repeat(120) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  // Group results by category
  const categories = [
    { title: 'Individual Subjects', tests: results.filter(r => r.subjects.length === 1) },
    { title: 'Subject Combinations', tests: results.filter(r => r.subjects.length > 1 && r.subjects.length < 6) },
    { title: 'Large Combinations', tests: results.filter(r => r.subjects.length >= 6) },
    { title: 'Edge Cases', tests: results.filter(r => r.name.includes('Edge') || r.name.includes('Invalid')) },
  ];

  categories.forEach(({ title, tests }) => {
    if (tests.length === 0) return;

    console.log(`\n${title}:`);
    console.log('-'.repeat(120));

    tests.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✓' : '✗';
      const subjectNames = result.subjects.length > 3
        ? `${result.subjects.length} subjects`
        : result.subjects.join(', ');

      console.log(`${statusIcon} ${result.name}`);
      console.log(`  Subjects: ${subjectNames}`);
      console.log(`  Duration: ${result.duration} week${result.duration > 1 ? 's' : ''} (${result.includesWeekends ? 'with' : 'without'} weekends)`);
      console.log(`  Days: ${result.totalDays} | Outcomes: ${result.totalOutcomes} | Synthetic: ${result.syntheticOutcomes}`);
      console.log(`  Load: min=${result.minOutcomesPerDay}, avg=${result.avgOutcomesPerDay.toFixed(1)}, max=${result.maxOutcomesPerDay}, balance=${result.balance.toFixed(2)}`);

      if (result.issues.length > 0) {
        console.log(`  ⚠️  Issues: ${result.issues.join(', ')}`);
      }
      console.log('');
    });
  });

  // Summary statistics
  console.log('\n' + '='.repeat(120));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(120) + '\n');

  const totalOutcomes = results.reduce((sum, r) => sum + r.totalOutcomes, 0);
  const totalSynthetic = results.reduce((sum, r) => sum + r.syntheticOutcomes, 0);
  const avgBalance = results.reduce((sum, r) => sum + r.balance, 0) / results.length;

  console.log(`Total Outcomes Generated: ${totalOutcomes}`);
  console.log(`Total Synthetic Outcomes: ${totalSynthetic} (${((totalSynthetic / totalOutcomes) * 100).toFixed(1)}%)`);
  console.log(`Average Balance Score: ${avgBalance.toFixed(2)} (1.0 = perfect balance)`);
  console.log(`Tests with Duplicates: ${results.filter(r => r.hasDuplicates).length}`);
  console.log(`Tests with Issues: ${failed}`);

  // Subject coverage
  console.log('\n' + '='.repeat(120));
  console.log('SUBJECT COVERAGE');
  console.log('='.repeat(120) + '\n');

  const subjectCounts = new Map<string, number>();
  results.forEach(r => {
    r.subjects.forEach(s => {
      subjectCounts.set(s, (subjectCounts.get(s) || 0) + 1);
    });
  });

  Array.from(subjectCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([subject, count]) => {
      console.log(`  ${subject}: ${count} tests`);
    });

  console.log('\n' + '='.repeat(120));

  if (failed > 0) {
    console.log('\n⚠️  SOME TESTS FAILED - Review issues above');
    process.exit(1);
  } else {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  }
}

/**
 * Main test execution
 */
function main(): void {
  const results: TestResult[] = [];

  console.log('Starting comprehensive plan generation tests...\n');

  // Test 1: Individual subjects (all 12)
  console.log('Testing individual subjects...');
  Object.values(SUBJECTS).forEach(subject => {
    results.push(runTest(`Individual - ${subject} (1 week)`, [subject], 1, false));
    results.push(runTest(`Individual - ${subject} (4 weeks)`, [subject], 4, false));
  });

  // Test 2: Grade-level combinations
  console.log('Testing grade-level combinations...');
  results.push(runTest('Grade 11 - All Subjects (8 weeks)', GRADE_11_SUBJECTS, 8, false));
  results.push(runTest('Grade 11 - All Subjects with weekends (8 weeks)', GRADE_11_SUBJECTS, 8, true));
  results.push(runTest('Grade 12 - All Subjects (8 weeks)', GRADE_12_SUBJECTS, 8, false));
  results.push(runTest('Grade 12 - All Subjects with weekends (8 weeks)', GRADE_12_SUBJECTS, 8, true));

  // Test 3: Stream combinations
  console.log('Testing stream combinations...');
  results.push(runTest('Science Stream (4 weeks)', SCIENCE_STREAM, 4, false));
  results.push(runTest('Science Stream (12 weeks)', SCIENCE_STREAM, 12, false));
  results.push(runTest('Humanities Stream (4 weeks)', HUMANITIES_STREAM, 4, false));
  results.push(runTest('Humanities Stream (12 weeks)', HUMANITIES_STREAM, 12, false));

  // Test 4: Duration variations
  console.log('Testing duration variations...');
  results.push(runTest('Math 30-1 (1 week)', ['Math 30-1'], 1, false));
  results.push(runTest('Math 30-1 (4 weeks)', ['Math 30-1'], 4, false));
  results.push(runTest('Math 30-1 (8 weeks)', ['Math 30-1'], 8, false));
  results.push(runTest('Math 30-1 (12 weeks)', ['Math 30-1'], 12, false));
  results.push(runTest('Math 30-1 (12 weeks with weekends)', ['Math 30-1'], 12, true));

  // Test 5: Edge cases
  console.log('Testing edge cases...');
  results.push(runTest('Edge - Empty subjects', [], 1, false));
  results.push(runTest('Edge - Invalid subject', ['NonexistentSubject'], 1, false));
  results.push(runTest('Edge - All 12 subjects (12 weeks)', Object.values(SUBJECTS), 12, false));
  results.push(runTest('Edge - Duplicate subjects', ['Math 30-1', 'Math 30-1'], 2, false));
  results.push(runTest('Edge - Single day (minimal)', ['Math 30-1'], 1, false));

  // Print results
  printResults(results);
}

// Run tests
main();
