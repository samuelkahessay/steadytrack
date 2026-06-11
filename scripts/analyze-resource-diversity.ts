#!/usr/bin/env npx tsx
/**
 * Resource Diversity Analysis
 * Analyzes resource reuse patterns, provider dependency, and diversity across curriculum
 */

import fs from 'fs';
import path from 'path';

const CURRICULUM_DIR = path.join(process.cwd(), 'data', 'curriculum');
const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

interface Resource {
  type: string;
  title: string;
  url: string;
  difficulty: string;
  alignedOutcomes: string[];
  source: string;
  provider: string;
  embeddable: boolean;
}

interface Outcome {
  code: string;
  description: string;
  type?: string;
}

interface Unit {
  id: string;
  title: string;
  estimatedHours?: number;
  outcomes: Outcome[];
  resources?: Resource[];
}

interface Curriculum {
  subject: string;
  grade: number;
  units: Unit[];
}

interface ResourceUsage {
  url: string;
  title: string;
  type: string;
  provider: string;
  source: string;
  usageCount: number;
  alignedOutcomes: string[];
  subjects: Set<string>;
  units: Set<string>;
}

interface SubjectStats {
  subject: string;
  uniqueResources: number;
  totalEntries: number;
  diversityPercent: number;
  providerDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  mostReusedResource: {
    title: string;
    url: string;
    count: number;
  } | null;
}

interface DiversityAnalysis {
  timestamp: string;
  overall: {
    totalUniqueResources: number;
    totalResourceEntries: number;
    avgReuseRate: number;
    diversityPercent: number;
  };
  bySubject: SubjectStats[];
  mostReusedResources: Array<{
    url: string;
    title: string;
    type: string;
    provider: string;
    usageCount: number;
    subjects: string[];
    alignedOutcomes: string[];
    isOverused: boolean;
  }>;
  providerDependency: Record<string, number>;
  typeDistribution: Record<string, number>;
  lowDiversityUnits: Array<{
    subject: string;
    unit: string;
    uniqueResources: number;
    totalResources: number;
    diversityPercent: number;
  }>;
  singleResourceOutcomes: Array<{
    subject: string;
    outcomeCode: string;
    resourceTitle: string;
    resourceUrl: string;
  }>;
}

function loadCurriculum(filename: string): Curriculum {
  const filepath = path.join(CURRICULUM_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

function analyzeDiversity(): DiversityAnalysis {
  const curriculumFiles = [
    'bio-30.json',
    'bio-20.json',
    'chem-30.json',
    'chem-20.json',
    'phys-30.json',
    'phys-20.json',
    'ela-30-1.json',
    'ela-20-1.json',
    'math-30-1.json',
    'math-20-1.json',
  ];

  const globalResourceMap = new Map<string, ResourceUsage>();
  const subjectStats: SubjectStats[] = [];
  const globalProviderCounts: Record<string, number> = {};
  const globalTypeCounts: Record<string, number> = {};
  const lowDiversityUnits: Array<any> = [];
  const singleResourceOutcomes: Array<any> = [];

  // Analyze each curriculum
  for (const filename of curriculumFiles) {
    try {
      const curriculum = loadCurriculum(filename);
      const { subject } = curriculum;

      const subjectResourceMap = new Map<string, ResourceUsage>();
      const providerCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      let totalEntries = 0;

      // Process each unit
      for (const unit of curriculum.units) {
        if (!unit.resources || unit.resources.length === 0) continue;

        const unitUniqueResources = new Set<string>();

        // Process each resource in the unit
        for (const resource of unit.resources) {
          totalEntries++;
          unitUniqueResources.add(resource.url);

          // Track provider and type
          providerCounts[resource.provider] = (providerCounts[resource.provider] || 0) + 1;
          typeCounts[resource.type] = (typeCounts[resource.type] || 0) + 1;
          globalProviderCounts[resource.provider] = (globalProviderCounts[resource.provider] || 0) + 1;
          globalTypeCounts[resource.type] = (globalTypeCounts[resource.type] || 0) + 1;

          // Track subject-level usage
          if (!subjectResourceMap.has(resource.url)) {
            subjectResourceMap.set(resource.url, {
              url: resource.url,
              title: resource.title,
              type: resource.type,
              provider: resource.provider,
              source: resource.source,
              usageCount: 0,
              alignedOutcomes: [],
              subjects: new Set([subject]),
              units: new Set([`${subject}:${unit.title}`]),
            });
          }

          const subjectUsage = subjectResourceMap.get(resource.url)!;
          subjectUsage.usageCount++;
          subjectUsage.alignedOutcomes.push(...resource.alignedOutcomes);

          // Track global usage
          if (!globalResourceMap.has(resource.url)) {
            globalResourceMap.set(resource.url, {
              url: resource.url,
              title: resource.title,
              type: resource.type,
              provider: resource.provider,
              source: resource.source,
              usageCount: 0,
              alignedOutcomes: [],
              subjects: new Set(),
              units: new Set(),
            });
          }

          const globalUsage = globalResourceMap.get(resource.url)!;
          globalUsage.usageCount++;
          globalUsage.alignedOutcomes.push(...resource.alignedOutcomes);
          globalUsage.subjects.add(subject);
          globalUsage.units.add(`${subject}:${unit.title}`);
        }

        // Check for low diversity units
        const unitDiversity = (unitUniqueResources.size / unit.resources.length) * 100;
        if (unit.resources.length >= 5 && unitDiversity < 60) {
          lowDiversityUnits.push({
            subject,
            unit: unit.title,
            uniqueResources: unitUniqueResources.size,
            totalResources: unit.resources.length,
            diversityPercent: Math.round(unitDiversity),
          });
        }

        // Check for outcomes with only one resource
        const outcomeResourceMap = new Map<string, Resource[]>();
        for (const resource of unit.resources) {
          for (const outcomeCode of resource.alignedOutcomes) {
            if (!outcomeResourceMap.has(outcomeCode)) {
              outcomeResourceMap.set(outcomeCode, []);
            }
            outcomeResourceMap.get(outcomeCode)!.push(resource);
          }
        }

        for (const [outcomeCode, resources] of outcomeResourceMap) {
          // Deduplicate by URL
          const uniqueUrls = new Set(resources.map(r => r.url));
          if (uniqueUrls.size === 1) {
            singleResourceOutcomes.push({
              subject,
              outcomeCode,
              resourceTitle: resources[0].title,
              resourceUrl: resources[0].url,
            });
          }
        }
      }

      // Calculate subject stats
      const uniqueResources = subjectResourceMap.size;
      const diversityPercent = totalEntries > 0 ? (uniqueResources / totalEntries) * 100 : 0;

      // Find most reused resource in this subject
      let mostReused: { title: string; url: string; count: number } | null = null;
      for (const usage of subjectResourceMap.values()) {
        if (!mostReused || usage.usageCount > mostReused.count) {
          mostReused = {
            title: usage.title,
            url: usage.url,
            count: usage.usageCount,
          };
        }
      }

      subjectStats.push({
        subject,
        uniqueResources,
        totalEntries,
        diversityPercent: Math.round(diversityPercent),
        providerDistribution: providerCounts,
        typeDistribution: typeCounts,
        mostReusedResource: mostReused,
      });
    } catch (error) {
      console.warn(`Warning: Could not load ${filename}`);
    }
  }

  // Calculate overall stats
  const totalUniqueResources = globalResourceMap.size;
  const totalResourceEntries = Array.from(globalResourceMap.values()).reduce(
    (sum, usage) => sum + usage.usageCount,
    0
  );
  const avgReuseRate = totalUniqueResources > 0 ? totalResourceEntries / totalUniqueResources : 0;
  const diversityPercent = totalResourceEntries > 0 ? (totalUniqueResources / totalResourceEntries) * 100 : 0;

  // Get most reused resources (top 50)
  const mostReused = Array.from(globalResourceMap.values())
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 50)
    .map(usage => ({
      url: usage.url,
      title: usage.title,
      type: usage.type,
      provider: usage.provider,
      usageCount: usage.usageCount,
      subjects: Array.from(usage.subjects),
      alignedOutcomes: Array.from(new Set(usage.alignedOutcomes)),
      isOverused: usage.usageCount > 8,
    }));

  // Sort low diversity units by diversity percent
  lowDiversityUnits.sort((a, b) => a.diversityPercent - b.diversityPercent);

  return {
    timestamp: new Date().toISOString(),
    overall: {
      totalUniqueResources,
      totalResourceEntries,
      avgReuseRate: Math.round(avgReuseRate * 100) / 100,
      diversityPercent: Math.round(diversityPercent),
    },
    bySubject: subjectStats,
    mostReusedResources: mostReused,
    providerDependency: globalProviderCounts,
    typeDistribution: globalTypeCounts,
    lowDiversityUnits: lowDiversityUnits.slice(0, 20), // Top 20 lowest diversity
    singleResourceOutcomes: singleResourceOutcomes.slice(0, 30), // Top 30
  };
}

function generateHTMLReport(analysis: DiversityAnalysis): string {
  const { overall, bySubject, mostReusedResources, providerDependency, typeDistribution, lowDiversityUnits, singleResourceOutcomes } = analysis;

  // Calculate provider percentages
  const totalProviderCount = Object.values(providerDependency).reduce((a, b) => a + b, 0);
  const providerPercentages = Object.entries(providerDependency)
    .map(([provider, count]) => ({
      provider,
      count,
      percent: Math.round((count / totalProviderCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const typePercentages = Object.entries(typeDistribution)
    .map(([type, count]) => ({
      type,
      count,
      percent: Math.round((count / overall.totalResourceEntries) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resource Diversity Analysis</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 32px; margin-bottom: 10px; color: #1d1d1f; }
    h2 { font-size: 24px; margin: 40px 0 20px; color: #1d1d1f; border-bottom: 2px solid #e5e5e7; padding-bottom: 10px; }
    h3 { font-size: 18px; margin: 20px 0 10px; color: #424245; }
    .timestamp { color: #86868b; font-size: 14px; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px; }
    .stat-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .stat-card.success { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .stat-value { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e5e7; }
    th { background: #f5f5f7; font-weight: 600; color: #1d1d1f; }
    tr:hover { background: #f9f9f9; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge.danger { background: #ffebee; color: #c62828; }
    .badge.warning { background: #fff3e0; color: #e65100; }
    .badge.success { background: #e8f5e9; color: #2e7d32; }
    .badge.info { background: #e3f2fd; color: #1565c0; }
    .provider-bar { height: 24px; background: #e5e5e7; border-radius: 4px; overflow: hidden; margin: 8px 0; }
    .provider-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; padding: 0 12px; color: white; font-size: 12px; font-weight: 600; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .recommendation { background: #e3f2fd; border-left: 4px solid #1565c0; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .recommendation-title { font-weight: 600; margin-bottom: 8px; color: #1565c0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Resource Diversity Analysis</h1>
    <div class="timestamp">Generated: ${new Date(analysis.timestamp).toLocaleString()}</div>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${overall.diversityPercent}%</div>
        <div class="stat-label">Overall Diversity</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${overall.totalUniqueResources}</div>
        <div class="stat-label">Unique Resources</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${overall.avgReuseRate}x</div>
        <div class="stat-label">Avg Reuse Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${overall.totalResourceEntries}</div>
        <div class="stat-label">Total Entries</div>
      </div>
    </div>

    <div class="recommendation">
      <div class="recommendation-title">Key Findings</div>
      <p><strong>Diversity Score:</strong> ${overall.diversityPercent}% diversity means each resource is reused an average of ${overall.avgReuseRate} times. ${overall.diversityPercent >= 60 ? 'This is healthy!' : 'Consider adding more unique resources.'}</p>
      <p><strong>Provider Concentration:</strong> Top provider (${providerPercentages[0].provider}) accounts for ${providerPercentages[0].percent}% of resources. ${providerPercentages[0].percent > 50 ? '<span class="badge danger">High dependency risk</span>' : '<span class="badge success">Good distribution</span>'}</p>
      <p><strong>Single-Resource Outcomes:</strong> ${singleResourceOutcomes.length} outcomes have only one resource. These are single points of failure.</p>
    </div>

    <h2>Subject-Level Diversity</h2>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Unique Resources</th>
          <th>Total Entries</th>
          <th>Diversity %</th>
          <th>Most Reused Resource</th>
          <th>Top Provider</th>
        </tr>
      </thead>
      <tbody>
        ${bySubject
          .map(
            (s) => `
          <tr>
            <td><strong>${s.subject}</strong></td>
            <td>${s.uniqueResources}</td>
            <td>${s.totalEntries}</td>
            <td>
              <span class="badge ${s.diversityPercent >= 60 ? 'success' : s.diversityPercent >= 40 ? 'warning' : 'danger'}">
                ${s.diversityPercent}%
              </span>
            </td>
            <td>${s.mostReusedResource ? `${s.mostReusedResource.title} (${s.mostReusedResource.count}x)` : 'N/A'}</td>
            <td>${Object.entries(s.providerDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <h2>Provider Dependency</h2>
    <p style="margin-bottom: 20px;">Distribution of resources across providers. High concentration on one provider indicates dependency risk.</p>
    ${providerPercentages
      .map(
        (p) => `
      <div>
        <strong>${p.provider}</strong>: ${p.count} resources (${p.percent}%)
        <div class="provider-bar">
          <div class="provider-fill" style="width: ${p.percent}%">${p.percent}%</div>
        </div>
      </div>
    `
      )
      .join('')}

    <h2>Resource Type Distribution</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Count</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${typePercentages
          .map(
            (t) => `
          <tr>
            <td><strong>${t.type}</strong></td>
            <td>${t.count}</td>
            <td>${t.percent}%</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <h2>Most Reused Resources (Top 50)</h2>
    <p style="margin-bottom: 20px;">Resources aligned to multiple outcomes. <span class="badge danger">Overused</span> if >8 outcomes.</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Provider</th>
          <th>Type</th>
          <th>Usage Count</th>
          <th>Subjects</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${mostReusedResources
          .map(
            (r) => `
          <tr>
            <td><a href="${r.url}" target="_blank">${r.title}</a></td>
            <td>${r.provider}</td>
            <td><span class="badge info">${r.type}</span></td>
            <td><strong>${r.usageCount}</strong></td>
            <td>${r.subjects.join(', ')}</td>
            <td>
              ${r.isOverused ? '<span class="badge danger">Overused</span>' : '<span class="badge success">Healthy</span>'}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <h2>Low-Diversity Units (Top 20)</h2>
    <p style="margin-bottom: 20px;">Units where resources are heavily reused. Consider adding more variety here.</p>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Unit</th>
          <th>Unique Resources</th>
          <th>Total Resources</th>
          <th>Diversity %</th>
        </tr>
      </thead>
      <tbody>
        ${lowDiversityUnits.length > 0
          ? lowDiversityUnits
              .map(
                (u) => `
          <tr>
            <td>${u.subject}</td>
            <td>${u.unit}</td>
            <td>${u.uniqueResources}</td>
            <td>${u.totalResources}</td>
            <td><span class="badge ${u.diversityPercent >= 50 ? 'warning' : 'danger'}">${u.diversityPercent}%</span></td>
          </tr>
        `
              )
              .join('')
          : '<tr><td colspan="5" style="text-align: center; color: #86868b;">No low-diversity units found</td></tr>'}
      </tbody>
    </table>

    <h2>Single-Resource Outcomes (Sample)</h2>
    <p style="margin-bottom: 20px;">Outcomes with only one resource are risky. If that resource becomes unavailable, the outcome has no backup.</p>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Outcome Code</th>
          <th>Resource</th>
        </tr>
      </thead>
      <tbody>
        ${singleResourceOutcomes.length > 0
          ? singleResourceOutcomes
              .map(
                (o) => `
          <tr>
            <td>${o.subject}</td>
            <td><code>${o.outcomeCode}</code></td>
            <td><a href="${o.resourceUrl}" target="_blank">${o.resourceTitle}</a></td>
          </tr>
        `
              )
              .join('')
          : '<tr><td colspan="3" style="text-align: center; color: #86868b;">All outcomes have multiple resources!</td></tr>'}
      </tbody>
    </table>

    <h2>Recommendations</h2>
    <div class="recommendation">
      <div class="recommendation-title">1. Provider Diversification</div>
      <p>${providerPercentages[0].percent > 50 ? `You're heavily reliant on <strong>${providerPercentages[0].provider}</strong> (${providerPercentages[0].percent}%). Consider adding resources from other providers like ${providerPercentages.slice(1, 4).map(p => p.provider).join(', ')}.` : 'Good provider diversity! Keep maintaining a mix of sources.'}</p>
    </div>

    <div class="recommendation">
      <div class="recommendation-title">2. Address Single-Resource Outcomes</div>
      <p>${singleResourceOutcomes.length > 0 ? `${singleResourceOutcomes.length} outcomes have only one resource. Add backup resources to these outcomes to reduce dependency risk.` : 'Great! All outcomes have multiple resources.'}</p>
    </div>

    <div class="recommendation">
      <div class="recommendation-title">3. Improve Low-Diversity Units</div>
      <p>${lowDiversityUnits.length > 0 ? `Focus on units like <strong>${lowDiversityUnits[0].unit}</strong> in ${lowDiversityUnits[0].subject} (${lowDiversityUnits[0].diversityPercent}% diversity) where resources are heavily reused.` : 'All units have good diversity!'}</p>
    </div>

    <div class="recommendation">
      <div class="recommendation-title">4. Resource Type Balance</div>
      <p>Current distribution: ${typePercentages.slice(0, 3).map(t => `${t.type} (${t.percent}%)`).join(', ')}. ${typePercentages[0].percent > 60 ? `Consider adding more ${typePercentages.slice(1).map(t => t.type).join(' and ')} resources for variety.` : 'Good balance of resource types!'}</p>
    </div>
  </div>
</body>
</html>`;
}

function main() {
  console.log('📊 Analyzing resource diversity...\n');

  const analysis = analyzeDiversity();

  console.log('Overall Statistics:');
  console.log(`  Unique Resources: ${analysis.overall.totalUniqueResources}`);
  console.log(`  Total Entries: ${analysis.overall.totalResourceEntries}`);
  console.log(`  Diversity: ${analysis.overall.diversityPercent}%`);
  console.log(`  Avg Reuse: ${analysis.overall.avgReuseRate}x\n`);

  // Save JSON report
  const jsonPath = path.join(REPORTS_DIR, 'resource-diversity.json');
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  console.log(`✅ JSON report saved: ${jsonPath}`);

  // Generate and save HTML report
  const html = generateHTMLReport(analysis);
  const htmlPath = path.join(REPORTS_DIR, 'resource-diversity.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML report saved: ${htmlPath}`);

  console.log('\n📊 Open the HTML report to explore diversity insights!');
}

main();
