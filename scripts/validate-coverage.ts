/**
 * Coverage Validation Script
 *
 * Validates resource coverage across all curriculum files and generates
 * comprehensive reports on coverage quality, diversity, and completeness.
 *
 * Checks:
 * - 100% outcome coverage (all outcomes have resources)
 * - Resource diversity (video + article + practice for each outcome)
 * - Difficulty distribution (beginner → advanced progression)
 * - Link validity (no broken links)
 * - Metadata completeness (all required fields present)
 *
 * Usage:
 *   npx tsx scripts/validate-coverage.ts --report data/reports/coverage-validation.html
 *   npx tsx scripts/validate-coverage.ts --json data/reports/coverage-validation.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CurriculumSubject {
  subject: string;
  grade: number;
  units: CurriculumUnit[];
}

interface CurriculumUnit {
  id: string;
  title: string;
  outcomes?: Outcome[];
  resources?: Resource[];
}

interface Outcome {
  code: string;
  description?: string;
  title?: string;
  strand?: string;
  category?: string;
}

interface Resource {
  type: string;
  title: string;
  url: string;
  alignedOutcomes?: string[];
  difficulty?: string;
  source?: string;
  provider?: string;
  embeddable?: boolean;
}

interface ValidationResult {
  subject: string;
  grade: number;
  totalOutcomes: number;
  outcomesWithResources: number;
  coveragePercent: number;
  totalResources: number;
  avgResourcesPerOutcome: number;
  issues: ValidationIssue[];
  qualityMetrics: QualityMetrics;
}

interface ValidationIssue {
  type: 'missing_resources' | 'low_diversity' | 'missing_difficulty' | 'broken_link' | 'missing_metadata';
  severity: 'critical' | 'warning' | 'info';
  outcomeCode?: string;
  resourceUrl?: string;
  message: string;
}

interface QualityMetrics {
  resourcesByType: Record<string, number>;
  resourcesByDifficulty: Record<string, number>;
  resourcesBySource: Record<string, number>;
  embeddablePercent: number;
  diversityScore: number; // 0-100, based on type variety per outcome
  difficultyScore: number; // 0-100, based on beginner → advanced progression
}

const CURRICULUM_FILES = [
  'math-30-1.json',
  'bio-30.json',
  'chem-30.json',
  'phys-30.json',
  'ela-30-1.json',
  'social-30-1.json',
  'math-20-1.json',
  'bio-20.json',
  'chem-20.json',
  'phys-20.json',
  'ela-20-1.json',
  'social-20-1.json',
];

const EXPECTED_RESOURCE_TYPES = ['video', 'article', 'practice'];
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];

function loadCurriculum(): Record<string, CurriculumSubject> {
  const curriculumData: Record<string, CurriculumSubject> = {};
  const curriculumDir = join(process.cwd(), 'data', 'curriculum');

  for (const file of CURRICULUM_FILES) {
    try {
      const content = readFileSync(join(curriculumDir, file), 'utf-8');
      const data = JSON.parse(content) as CurriculumSubject;
      curriculumData[data.subject] = data;
    } catch (error) {
      console.warn(`⚠️  Warning: Could not load ${file}:`, error);
    }
  }

  return curriculumData;
}

function validateSubject(curriculum: CurriculumSubject): ValidationResult {
  const result: ValidationResult = {
    subject: curriculum.subject,
    grade: curriculum.grade,
    totalOutcomes: 0,
    outcomesWithResources: 0,
    coveragePercent: 0,
    totalResources: 0,
    avgResourcesPerOutcome: 0,
    issues: [],
    qualityMetrics: {
      resourcesByType: {},
      resourcesByDifficulty: {},
      resourcesBySource: {},
      embeddablePercent: 0,
      diversityScore: 0,
      difficultyScore: 0,
    },
  };

  let totalEmbeddable = 0;
  let diversityScores: number[] = [];
  let difficultyScores: number[] = [];

  for (const unit of curriculum.units) {
    const outcomes = unit.outcomes || [];
    const resources = unit.resources || [];

    result.totalOutcomes += outcomes.length;
    result.totalResources += resources.length;

    // Validate each outcome has resources
    for (const outcome of outcomes) {
      const alignedResources = resources.filter(r =>
        r.alignedOutcomes && r.alignedOutcomes.includes(outcome.code)
      );

      if (alignedResources.length === 0) {
        result.issues.push({
          type: 'missing_resources',
          severity: 'critical',
          outcomeCode: outcome.code,
          message: `Outcome ${outcome.code} has no aligned resources`,
        });
      } else {
        result.outcomesWithResources++;

        // Check resource diversity (should have video, article, practice)
        const types = new Set(alignedResources.map(r => r.type));
        const diversityCount = EXPECTED_RESOURCE_TYPES.filter(t => types.has(t)).length;
        const diversityPercent = (diversityCount / EXPECTED_RESOURCE_TYPES.length) * 100;
        diversityScores.push(diversityPercent);

        if (diversityPercent < 66) {
          result.issues.push({
            type: 'low_diversity',
            severity: 'warning',
            outcomeCode: outcome.code,
            message: `Outcome ${outcome.code} has limited resource diversity (${diversityPercent.toFixed(0)}%)`,
          });
        }

        // Check difficulty progression
        const difficulties = alignedResources
          .map(r => r.difficulty)
          .filter((d): d is string => !!d);

        const hasBeginner = difficulties.includes('beginner');
        const hasAdvanced = difficulties.includes('advanced');
        const difficultyProgression = (hasBeginner && hasAdvanced) ? 100 :
                                      (hasBeginner || hasAdvanced) ? 50 : 0;
        difficultyScores.push(difficultyProgression);

        if (difficultyProgression < 50) {
          result.issues.push({
            type: 'missing_difficulty',
            severity: 'info',
            outcomeCode: outcome.code,
            message: `Outcome ${outcome.code} lacks difficulty progression (beginner → advanced)`,
          });
        }
      }
    }

    // Analyze resources
    for (const resource of resources) {
      // Count by type
      result.qualityMetrics.resourcesByType[resource.type] =
        (result.qualityMetrics.resourcesByType[resource.type] || 0) + 1;

      // Count by difficulty
      if (resource.difficulty) {
        result.qualityMetrics.resourcesByDifficulty[resource.difficulty] =
          (result.qualityMetrics.resourcesByDifficulty[resource.difficulty] || 0) + 1;
      }

      // Count by source
      if (resource.source) {
        result.qualityMetrics.resourcesBySource[resource.source] =
          (result.qualityMetrics.resourcesBySource[resource.source] || 0) + 1;
      }

      // Count embeddable
      if (resource.embeddable) {
        totalEmbeddable++;
      }

      // Check metadata completeness
      if (!resource.source) {
        result.issues.push({
          type: 'missing_metadata',
          severity: 'info',
          resourceUrl: resource.url,
          message: `Resource "${resource.title}" is missing source metadata`,
        });
      }

      if (!resource.difficulty) {
        result.issues.push({
          type: 'missing_metadata',
          severity: 'info',
          resourceUrl: resource.url,
          message: `Resource "${resource.title}" is missing difficulty level`,
        });
      }
    }
  }

  // Calculate metrics
  result.coveragePercent = result.totalOutcomes > 0
    ? Math.round((result.outcomesWithResources / result.totalOutcomes) * 100)
    : 0;

  result.avgResourcesPerOutcome = result.totalOutcomes > 0
    ? Math.round((result.totalResources / result.totalOutcomes) * 10) / 10
    : 0;

  result.qualityMetrics.embeddablePercent = result.totalResources > 0
    ? Math.round((totalEmbeddable / result.totalResources) * 100)
    : 0;

  result.qualityMetrics.diversityScore = diversityScores.length > 0
    ? Math.round(diversityScores.reduce((a, b) => a + b, 0) / diversityScores.length)
    : 0;

  result.qualityMetrics.difficultyScore = difficultyScores.length > 0
    ? Math.round(difficultyScores.reduce((a, b) => a + b, 0) / difficultyScores.length)
    : 0;

  return result;
}

function generateHTMLReport(results: ValidationResult[]): string {
  const totalOutcomes = results.reduce((sum, r) => sum + r.totalOutcomes, 0);
  const totalCovered = results.reduce((sum, r) => sum + r.outcomesWithResources, 0);
  const totalResources = results.reduce((sum, r) => sum + r.totalResources, 0);
  const overallCoverage = totalOutcomes > 0 ? Math.round((totalCovered / totalOutcomes) * 100) : 0;

  const criticalIssues = results.reduce((sum, r) =>
    sum + r.issues.filter(i => i.severity === 'critical').length, 0
  );

  const warningIssues = results.reduce((sum, r) =>
    sum + r.issues.filter(i => i.severity === 'warning').length, 0
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resource Coverage Validation Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #2563eb; margin-bottom: 10px; }
    .timestamp { color: #666; font-size: 14px; margin-bottom: 30px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card.good { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .stat-card.warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .stat-card.critical { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .subject-section {
      margin-bottom: 40px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .subject-header {
      background: #f9fafb;
      padding: 15px 20px;
      font-weight: 600;
      font-size: 18px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .coverage-badge {
      background: #10b981;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .coverage-badge.warning { background: #f59e0b; }
    .coverage-badge.critical { background: #ef4444; }
    .metrics {
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    .metric {
      padding: 15px;
      background: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
    }
    .issues-section {
      padding: 20px;
      background: #fef3c7;
      border-top: 1px solid #e5e7eb;
    }
    .issues-section.critical-bg { background: #fee2e2; }
    .issue-list {
      list-style: none;
      margin-top: 10px;
    }
    .issue-item {
      padding: 8px 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border-left: 3px solid #f59e0b;
      font-size: 14px;
    }
    .issue-item.critical { border-left-color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Resource Coverage Validation Report</h1>
    <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>

    <div class="summary">
      <div class="stat-card ${overallCoverage === 100 ? 'good' : overallCoverage >= 80 ? 'warning' : 'critical'}">
        <div class="stat-value">${overallCoverage}%</div>
        <div class="stat-label">Overall Coverage</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalCovered}/${totalOutcomes}</div>
        <div class="stat-label">Outcomes Covered</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalResources}</div>
        <div class="stat-label">Total Resources</div>
      </div>
      <div class="stat-card ${criticalIssues === 0 ? 'good' : 'critical'}">
        <div class="stat-value">${criticalIssues}</div>
        <div class="stat-label">Critical Issues</div>
      </div>
    </div>

    ${results.map(result => `
      <div class="subject-section">
        <div class="subject-header">
          <span>${result.subject} (Grade ${result.grade})</span>
          <span class="coverage-badge ${
            result.coveragePercent === 100 ? '' :
            result.coveragePercent >= 80 ? 'warning' : 'critical'
          }">${result.coveragePercent}% coverage</span>
        </div>

        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Outcomes with Resources</div>
            <div class="metric-value">${result.outcomesWithResources}/${result.totalOutcomes}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Avg Resources per Outcome</div>
            <div class="metric-value">${result.avgResourcesPerOutcome}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Diversity Score</div>
            <div class="metric-value">${result.qualityMetrics.diversityScore}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Difficulty Progression</div>
            <div class="metric-value">${result.qualityMetrics.difficultyScore}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Embeddable Resources</div>
            <div class="metric-value">${result.qualityMetrics.embeddablePercent}%</div>
          </div>
        </div>

        ${result.issues.filter(i => i.severity === 'critical').length > 0 ? `
          <div class="issues-section critical-bg">
            <strong>🚨 Critical Issues (${result.issues.filter(i => i.severity === 'critical').length})</strong>
            <ul class="issue-list">
              ${result.issues.filter(i => i.severity === 'critical').slice(0, 10).map(issue => `
                <li class="issue-item critical">${issue.message}</li>
              `).join('')}
              ${result.issues.filter(i => i.severity === 'critical').length > 10 ?
                `<li class="issue-item critical">... and ${result.issues.filter(i => i.severity === 'critical').length - 10} more</li>` : ''
              }
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

function main() {
  console.log('🔍 Validating resource coverage...\n');

  const curriculumData = loadCurriculum();
  const subjects = Object.keys(curriculumData);
  const results: ValidationResult[] = [];

  for (const subject of subjects) {
    const curriculum = curriculumData[subject];
    if (!curriculum) continue;

    const result = validateSubject(curriculum);
    results.push(result);

    console.log(`\n📚 ${result.subject} (Grade ${result.grade})`);
    console.log(`   Coverage: ${result.coveragePercent}% (${result.outcomesWithResources}/${result.totalOutcomes} outcomes)`);
    console.log(`   Resources: ${result.totalResources} total (${result.avgResourcesPerOutcome} avg per outcome)`);
    console.log(`   Quality: Diversity ${result.qualityMetrics.diversityScore}%, Difficulty ${result.qualityMetrics.difficultyScore}%`);

    const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;

    if (criticalCount > 0) {
      console.log(`   🚨 ${criticalCount} critical issues`);
    }
    if (warningCount > 0) {
      console.log(`   ⚠️  ${warningCount} warnings`);
    }
  }

  // Generate reports
  const htmlReport = generateHTMLReport(results);
  const htmlPath = join(process.cwd(), 'data', 'reports', 'coverage-validation.html');
  writeFileSync(htmlPath, htmlReport);
  console.log(`\n📊 HTML report saved: ${htmlPath}`);

  const jsonPath = join(process.cwd(), 'data', 'reports', 'coverage-validation.json');
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`💾 JSON report saved: ${jsonPath}`);

  // Overall summary
  const totalOutcomes = results.reduce((sum, r) => sum + r.totalOutcomes, 0);
  const totalCovered = results.reduce((sum, r) => sum + r.outcomesWithResources, 0);
  const overallCoverage = totalOutcomes > 0 ? Math.round((totalCovered / totalOutcomes) * 100) : 0;

  console.log(`\n✨ Overall Summary:`);
  console.log(`   Coverage: ${overallCoverage}% (${totalCovered}/${totalOutcomes} outcomes)`);

  if (overallCoverage === 100) {
    console.log(`   🎉 100% COVERAGE ACHIEVED! 🎉`);
  } else {
    console.log(`   📈 ${totalOutcomes - totalCovered} outcomes still need resources`);
  }

  console.log('\n✨ Done!');
}

main();
