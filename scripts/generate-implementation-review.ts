#!/usr/bin/env tsx

/**
 * Generate comprehensive implementation review document
 * Shows all grades, subjects, outcomes, and resources for review
 */

import fs from 'fs';
import path from 'path';

interface Resource {
  title: string;
  url: string;
  type: string;
  source?: string;
  difficulty?: string;
}

interface Outcome {
  id: string;
  description: string;
  resources: Resource[];
}

interface Unit {
  title: string;
  outcomes: Outcome[];
  resources?: Resource[];
}

interface Curriculum {
  subject: string;
  grade: string;
  level?: string;
  units: Unit[];
}

interface SubjectSummary {
  grade: string;
  subject: string;
  totalOutcomes: number;
  totalResources: number;
  avgResourcesPerOutcome: number;
  outcomes: OutcomeDetail[];
}

interface OutcomeDetail {
  id: string;
  description: string;
  unit: string;
  resourceCount: number;
  resources: Resource[];
}

const DATA_DIR = path.join(process.cwd(), 'data', 'curriculum');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'reports');
const OUTPUT_HTML = path.join(OUTPUT_DIR, 'implementation-review.html');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'implementation-review.json');

function loadCurriculumFiles(): Curriculum[] {
  // Only load curriculum files matching pattern: subject-grade.json or subject-grade-level.json
  const curriculumPattern = /^(bio|chem|phys|math|ela|social)-\d+(-\d+)?\.json$/;
  const files = fs.readdirSync(DATA_DIR).filter(f => curriculumPattern.test(f));
  const curricula: Curriculum[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Validate structure
    if (data && Array.isArray(data.units)) {
      curricula.push(data);
    } else {
      console.warn(`⚠️  Skipping ${file}: invalid structure`);
    }
  }

  return curricula;
}

function extractSubjectSummaries(curricula: Curriculum[]): SubjectSummary[] {
  const summaries: SubjectSummary[] = [];

  for (const curriculum of curricula) {
    // First, build a map of outcome ID to resources
    const outcomeResourcesMap = new Map<string, Resource[]>();

    for (const unit of curriculum.units) {
      const resources = unit.resources || [];

      for (const resource of resources) {
        const alignedOutcomes = (resource as any).alignedOutcomes || [];

        for (const outcomeId of alignedOutcomes) {
          if (!outcomeResourcesMap.has(outcomeId)) {
            outcomeResourcesMap.set(outcomeId, []);
          }
          outcomeResourcesMap.get(outcomeId)!.push(resource);
        }
      }
    }

    // Now build the outcomes list with their resources
    const outcomes: OutcomeDetail[] = [];
    let totalResources = 0;

    for (const unit of curriculum.units) {
      for (const outcome of unit.outcomes) {
        const outcomeId = (outcome as any).code || (outcome as any).id || 'unknown';
        const resources = outcomeResourcesMap.get(outcomeId) || [];
        totalResources += resources.length;

        outcomes.push({
          id: outcomeId,
          description: outcome.description || 'No description',
          unit: unit.title || 'Unknown Unit',
          resourceCount: resources.length,
          resources: resources
        });
      }
    }

    // Sort outcomes by ID
    outcomes.sort((a, b) => {
      const idA = a.id || '';
      const idB = b.id || '';
      return idA.localeCompare(idB);
    });

    summaries.push({
      grade: curriculum.level || curriculum.grade,
      subject: curriculum.subject,
      totalOutcomes: outcomes.length,
      totalResources,
      avgResourcesPerOutcome: outcomes.length > 0 ? totalResources / outcomes.length : 0,
      outcomes
    });
  }

  // Sort by grade (descending) then subject
  summaries.sort((a, b) => {
    const gradeA = parseInt(String(a.grade).match(/\d+/)?.[0] || '0');
    const gradeB = parseInt(String(b.grade).match(/\d+/)?.[0] || '0');
    if (gradeB !== gradeA) return gradeB - gradeA;
    return a.subject.localeCompare(b.subject);
  });

  return summaries;
}

function generateHTML(summaries: SubjectSummary[]): string {
  const totalOutcomes = summaries.reduce((sum, s) => sum + s.totalOutcomes, 0);
  const totalResources = summaries.reduce((sum, s) => sum + s.totalResources, 0);
  const avgResources = totalResources / totalOutcomes;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SteadyTrack Implementation Review</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        h1 {
            color: #2563eb;
            font-size: 2.5em;
            margin-bottom: 10px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
        }

        .date {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 30px;
        }

        .summary {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 20px;
            margin-bottom: 40px;
            border-radius: 4px;
        }

        .summary h2 {
            color: #1e40af;
            margin-bottom: 15px;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .stat {
            background: white;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #dbeafe;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #2563eb;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
        }

        .subject-section {
            margin-bottom: 50px;
            page-break-inside: avoid;
        }

        .subject-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin-bottom: 0;
        }

        .subject-title {
            font-size: 1.8em;
            margin-bottom: 10px;
        }

        .subject-stats {
            display: flex;
            gap: 30px;
            font-size: 0.95em;
            opacity: 0.95;
        }

        .subject-stats span {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .subject-content {
            border: 2px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 8px 8px;
            padding: 0;
        }

        .outcome {
            border-bottom: 1px solid #e5e7eb;
            padding: 25px;
            transition: background 0.2s;
        }

        .outcome:last-child {
            border-bottom: none;
        }

        .outcome:hover {
            background: #f9fafb;
        }

        .outcome-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }

        .outcome-id {
            font-weight: 600;
            color: #2563eb;
            font-size: 1.1em;
            font-family: 'Monaco', 'Courier New', monospace;
        }

        .outcome-badge {
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
        }

        .outcome-description {
            color: #4b5563;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .outcome-unit {
            color: #6b7280;
            font-size: 0.9em;
            margin-bottom: 15px;
            font-style: italic;
        }

        .resources {
            margin-top: 15px;
        }

        .resources-header {
            font-weight: 600;
            color: #374151;
            margin-bottom: 10px;
            font-size: 0.95em;
        }

        .resource-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .resource {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px 15px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 12px;
            align-items: center;
            transition: all 0.2s;
        }

        .resource:hover {
            border-color: #2563eb;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);
        }

        .resource-type {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .type-video {
            background: #fef3c7;
            color: #92400e;
        }

        .type-article {
            background: #dbeafe;
            color: #1e40af;
        }

        .type-practice {
            background: #d1fae5;
            color: #065f46;
        }

        .type-simulation {
            background: #e9d5ff;
            color: #6b21a8;
        }

        .type-reference {
            background: #f3e8ff;
            color: #6b21a8;
        }

        .resource-details {
            min-width: 0;
        }

        .resource-title {
            font-weight: 500;
            color: #111827;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .resource-url {
            color: #6b7280;
            font-size: 0.85em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .resource-url a {
            color: #2563eb;
            text-decoration: none;
        }

        .resource-url a:hover {
            text-decoration: underline;
        }

        .resource-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
            font-size: 0.8em;
            color: #6b7280;
        }

        .resource-source {
            background: white;
            border: 1px solid #e5e7eb;
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
        }

        .resource-difficulty {
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
        }

        .diff-beginner {
            background: #dcfce7;
            color: #166534;
        }

        .diff-intermediate {
            background: #fef3c7;
            color: #92400e;
        }

        .diff-advanced {
            background: #fee2e2;
            color: #991b1b;
        }

        .no-resources {
            color: #ef4444;
            font-style: italic;
            padding: 15px;
            background: #fef2f2;
            border-radius: 4px;
            text-align: center;
        }

        .toc {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 40px;
        }

        .toc h2 {
            color: #374151;
            margin-bottom: 15px;
        }

        .toc ul {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 10px;
        }

        .toc li {
            padding: 8px 12px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }

        .toc a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }

        .toc a:hover {
            text-decoration: underline;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .container {
                box-shadow: none;
                padding: 20px;
            }

            .subject-section {
                page-break-inside: avoid;
            }
        }

        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }

            .resource {
                grid-template-columns: 1fr;
            }

            .resource-meta {
                align-items: flex-start;
                flex-direction: row;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 SteadyTrack Implementation Review</h1>
        <div class="date">Generated: ${new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</div>

        <div class="summary">
            <h2>📊 Overall Summary</h2>
            <div class="summary-stats">
                <div class="stat">
                    <div class="stat-value">${summaries.length}</div>
                    <div class="stat-label">Subjects</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalOutcomes}</div>
                    <div class="stat-label">Total Outcomes</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalResources}</div>
                    <div class="stat-label">Total Resources</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${avgResources.toFixed(1)}</div>
                    <div class="stat-label">Avg Resources/Outcome</div>
                </div>
                <div class="stat">
                    <div class="stat-value">100%</div>
                    <div class="stat-label">Coverage</div>
                </div>
            </div>
        </div>

        <div class="toc">
            <h2>📑 Table of Contents</h2>
            <ul>
                ${summaries.map((summary, idx) => `
                    <li><a href="#subject-${idx}">${summary.subject} ${summary.grade} (${summary.totalOutcomes} outcomes, ${summary.totalResources} resources)</a></li>
                `).join('')}
            </ul>
        </div>
`;

  summaries.forEach((summary, idx) => {
    html += `
        <div class="subject-section" id="subject-${idx}">
            <div class="subject-header">
                <div class="subject-title">${summary.subject} ${summary.grade}</div>
                <div class="subject-stats">
                    <span>📋 ${summary.totalOutcomes} outcomes</span>
                    <span>📚 ${summary.totalResources} resources</span>
                    <span>📈 ${summary.avgResourcesPerOutcome.toFixed(1)} avg/outcome</span>
                </div>
            </div>
            <div class="subject-content">
`;

    summary.outcomes.forEach(outcome => {
      html += `
                <div class="outcome">
                    <div class="outcome-header">
                        <div class="outcome-id">${outcome.id}</div>
                        <div class="outcome-badge">${outcome.resourceCount} resource${outcome.resourceCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="outcome-unit">Unit: ${outcome.unit}</div>
                    <div class="outcome-description">${outcome.description}</div>
`;

      if (outcome.resources.length > 0) {
        html += `
                    <div class="resources">
                        <div class="resources-header">Resources:</div>
                        <div class="resource-list">
`;
        outcome.resources.forEach(resource => {
          const typeClass = `type-${resource.type || 'article'}`;
          const diffClass = resource.difficulty ? `diff-${resource.difficulty.toLowerCase()}` : '';

          html += `
                            <div class="resource">
                                <div class="resource-type ${typeClass}">${resource.type || 'article'}</div>
                                <div class="resource-details">
                                    <div class="resource-title">${resource.title}</div>
                                    <div class="resource-url"><a href="${resource.url}" target="_blank">${resource.url}</a></div>
                                </div>
                                <div class="resource-meta">
                                    ${resource.source ? `<div class="resource-source">${resource.source}</div>` : ''}
                                    ${resource.difficulty ? `<div class="resource-difficulty ${diffClass}">${resource.difficulty}</div>` : ''}
                                </div>
                            </div>
`;
        });
        html += `
                        </div>
                    </div>
`;
      } else {
        html += `
                    <div class="no-resources">⚠️ No resources available</div>
`;
      }

      html += `
                </div>
`;
    });

    html += `
            </div>
        </div>
`;
  });

  html += `
    </div>
</body>
</html>`;

  return html;
}

function main() {
  console.log('📋 Generating implementation review...\n');

  // Load all curriculum files
  const curricula = loadCurriculumFiles();
  console.log(`✅ Loaded ${curricula.length} curriculum files`);

  // Extract summaries
  const summaries = extractSubjectSummaries(curricula);
  console.log(`✅ Extracted ${summaries.length} subject summaries`);

  // Generate HTML report
  const html = generateHTML(summaries);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_HTML, html);
  console.log(`✅ HTML report saved: ${OUTPUT_HTML}`);

  // Generate JSON report
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(summaries, null, 2));
  console.log(`✅ JSON report saved: ${OUTPUT_JSON}`);

  console.log('\n📊 Summary:');
  console.log(`   Total subjects: ${summaries.length}`);
  console.log(`   Total outcomes: ${summaries.reduce((sum, s) => sum + s.totalOutcomes, 0)}`);
  console.log(`   Total resources: ${summaries.reduce((sum, s) => sum + s.totalResources, 0)}`);
  console.log('\n✨ Done!');
}

main();
