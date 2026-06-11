/**
 * Resource Gap Detection Utility
 *
 * Scans curriculum data to identify outcomes that lack aligned resources
 * Generates an HTML report highlighting gaps to prioritize resource additions
 *
 * Usage:
 *   npm run detect-gaps
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { CurriculumSubject } from '../lib/types';

interface OutcomeGap {
  subject: string;
  grade: number;
  unitId: string;
  unitTitle: string;
  outcomeCode: string;
  outcomeDescription: string;
  strand: string | undefined;
  hasResources: boolean;
  alignedResourceCount: number;
  resourceTypes: string[];
}

interface GapReport {
  summary: {
    totalOutcomes: number;
    outcomesWithResources: number;
    outcomesWithoutResources: number;
    totalUnits: number;
    unitsWithGaps: number;
  };
  gaps: OutcomeGap[];
  generatedAt: string;
}

function loadCurriculum(): Record<string, CurriculumSubject> {
  const curriculumData: Record<string, CurriculumSubject> = {};

  // Load all curriculum JSON files
  const curriculumDir = join(process.cwd(), 'data', 'curriculum');
  const files = [
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

  for (const file of files) {
    try {
      const content = readFileSync(join(curriculumDir, file), 'utf-8');
      const data = JSON.parse(content) as CurriculumSubject;
      curriculumData[data.subject] = data;
    } catch (error) {
      console.warn(`Warning: Could not load ${file}:`, error);
    }
  }

  return curriculumData;
}

function detectResourceGaps(): GapReport {
  const gaps: OutcomeGap[] = [];
  let totalOutcomes = 0;
  let outcomesWithResources = 0;
  let totalUnits = 0;
  const unitsWithGapsSet = new Set<string>();

  const curriculumData = loadCurriculum();
  const subjects = Object.keys(curriculumData);

  for (const subject of subjects) {
    const curriculum = curriculumData[subject];
    if (!curriculum) continue;

    for (const unit of curriculum.units) {
      totalUnits++;

      if (!unit.outcomes || unit.outcomes.length === 0) {
        console.log(`⚠️  Unit ${unit.id} in ${subject} has no outcomes defined`);
        continue;
      }

      for (const outcome of unit.outcomes) {
        totalOutcomes++;

        // Find resources aligned to this outcome
        const alignedResources = (unit.resources || []).filter(resource =>
          resource.alignedOutcomes && resource.alignedOutcomes.includes(outcome.code)
        );

        const resourceTypes = [...new Set(alignedResources.map(r => r.type))];
        const hasResources = alignedResources.length > 0;

        if (!hasResources) {
          unitsWithGapsSet.add(unit.id);
        } else {
          outcomesWithResources++;
        }

        gaps.push({
          subject,
          grade: curriculum.grade,
          unitId: unit.id,
          unitTitle: unit.title,
          outcomeCode: outcome.code,
          outcomeDescription: outcome.description || outcome.title || '',
          strand: outcome.strand,
          hasResources,
          alignedResourceCount: alignedResources.length,
          resourceTypes
        });
      }
    }
  }

  return {
    summary: {
      totalOutcomes,
      outcomesWithResources,
      outcomesWithoutResources: totalOutcomes - outcomesWithResources,
      totalUnits,
      unitsWithGaps: unitsWithGapsSet.size
    },
    gaps,
    generatedAt: new Date().toISOString()
  };
}

function generateHTMLReport(report: GapReport): string {
  const gapsWithoutResources = report.gaps.filter(g => !g.hasResources);
  const gapsBySubject = new Map<string, OutcomeGap[]>();

  gapsWithoutResources.forEach(gap => {
    if (!gapsBySubject.has(gap.subject)) {
      gapsBySubject.set(gap.subject, []);
    }
    gapsBySubject.get(gap.subject)!.push(gap);
  });

  const coveragePercentage = report.summary.totalOutcomes > 0
    ? Math.round((report.summary.outcomesWithResources / report.summary.totalOutcomes) * 100)
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SteadyTrack Resource Gap Report</title>
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
    .stat-card.bad { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
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
    }
    .gap-table {
      width: 100%;
      border-collapse: collapse;
    }
    .gap-table th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    .gap-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .gap-table tr:last-child td {
      border-bottom: none;
    }
    .gap-table tr:hover {
      background: #f9fafb;
    }
    .outcome-code {
      font-weight: 600;
      color: #2563eb;
      font-family: monospace;
    }
    .strand-badge {
      background: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .coverage-bar {
      width: 100%;
      height: 24px;
      background: #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      margin: 10px 0;
    }
    .coverage-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Resource Gap Report</h1>
    <div class="timestamp">Generated: ${new Date(report.generatedAt).toLocaleString()}</div>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${report.summary.totalOutcomes}</div>
        <div class="stat-label">Total Outcomes</div>
      </div>
      <div class="stat-card good">
        <div class="stat-value">${report.summary.outcomesWithResources}</div>
        <div class="stat-label">With Resources</div>
      </div>
      <div class="stat-card ${report.summary.outcomesWithoutResources > 0 ? 'warning' : 'good'}">
        <div class="stat-value">${report.summary.outcomesWithoutResources}</div>
        <div class="stat-label">Without Resources</div>
      </div>
      <div class="stat-card ${coveragePercentage >= 80 ? 'good' : coveragePercentage >= 50 ? 'warning' : 'bad'}">
        <div class="stat-value">${coveragePercentage}%</div>
        <div class="stat-label">Coverage</div>
      </div>
    </div>

    <div style="margin-bottom: 30px;">
      <h3 style="margin-bottom: 10px;">Overall Resource Coverage</h3>
      <div class="coverage-bar">
        <div class="coverage-fill" style="width: ${coveragePercentage}%;">
          ${coveragePercentage}% covered
        </div>
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 5px;">
        ${report.summary.outcomesWithResources} out of ${report.summary.totalOutcomes} outcomes have aligned resources
      </p>
    </div>

    ${gapsWithoutResources.length > 0 ? `
      <h2 style="margin-bottom: 20px;">Outcomes Without Resources</h2>
      ${Array.from(gapsBySubject.entries()).map(([subject, subjectGaps]) => `
        <div class="subject-section">
          <div class="subject-header">
            ${subject} (Grade ${subjectGaps[0].grade}) - ${subjectGaps.length} outcomes without resources
          </div>
          <table class="gap-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Outcome Code</th>
                <th>Description</th>
                <th>Strand</th>
              </tr>
            </thead>
            <tbody>
              ${subjectGaps.map(gap => `
                <tr>
                  <td>${gap.unitTitle}</td>
                  <td><span class="outcome-code">${gap.outcomeCode}</span></td>
                  <td>${gap.outcomeDescription}</td>
                  <td>${gap.strand ? `<span class="strand-badge">${gap.strand}</span>` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    ` : `
      <div style="text-align: center; padding: 40px; background: #f0fdf4; border-radius: 8px; border: 2px solid #10b981;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <h2 style="color: #059669;">All Outcomes Have Resources!</h2>
        <p style="color: #047857; margin-top: 10px;">
          Every curriculum outcome has at least one aligned resource.
        </p>
      </div>
    `}
  </div>
</body>
</html>`;
}

function main() {
  console.log('🔍 Detecting resource gaps in curriculum data...\n');

  const report = detectResourceGaps();

  console.log('📊 Summary:');
  console.log(`   Total Outcomes: ${report.summary.totalOutcomes}`);
  console.log(`   ✅ With Resources: ${report.summary.outcomesWithResources}`);
  console.log(`   ❌ Without Resources: ${report.summary.outcomesWithoutResources}`);
  console.log(`   📈 Coverage: ${Math.round((report.summary.outcomesWithResources / report.summary.totalOutcomes) * 100)}%`);
  console.log(`   📚 Total Units: ${report.summary.totalUnits}`);
  console.log(`   ⚠️  Units with Gaps: ${report.summary.unitsWithGaps}\n`);

  // Save JSON report
  const jsonPath = join(process.cwd(), 'data', 'reports', 'resource-gaps.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`💾 JSON report saved: ${jsonPath}`);

  // Generate and save HTML report
  const html = generateHTMLReport(report);
  const htmlPath = join(process.cwd(), 'data', 'reports', 'resource-gaps.html');
  writeFileSync(htmlPath, html);
  console.log(`🌐 HTML report saved: ${htmlPath}`);

  console.log('\n✨ Done!');
}

main();
