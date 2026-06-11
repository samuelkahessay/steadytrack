/**
 * Comprehensive UI Test Suite using Puppeteer
 * Tests all routes, captures screenshots, logs errors, and generates reports
 */

import puppeteer, { Browser, Page, ConsoleMessage, HTTPResponse } from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { TEST_CONFIG, ViewportName, RouteConfig } from './config';

// Test result types
interface TestResult {
  route: string;
  viewport: string;
  success: boolean;
  errors: ErrorCapture[];
  warnings: string[];
  performance: PerformanceMetrics;
  screenshot: string | null;
  timestamp: string;
  status: number | null;
}

interface ErrorCapture {
  type: 'console' | 'network' | 'exception';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  timestamp: string;
}

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  resourceCount: number;
}

interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
  };
  results: TestResult[];
  generatedAt: string;
}

class UITestRunner {
  private browser: Browser | null = null;
  private results: TestResult[] = [];
  private startTime: number = 0;

  async initialize() {
    console.log('🚀 Initializing browser...');
    this.browser = await puppeteer.launch(TEST_CONFIG.browser);
    this.startTime = Date.now();

    // Ensure directories exist
    if (!existsSync(TEST_CONFIG.screenshots.path)) {
      mkdirSync(TEST_CONFIG.screenshots.path, { recursive: true });
    }
    if (!existsSync(TEST_CONFIG.errors.path)) {
      mkdirSync(TEST_CONFIG.errors.path, { recursive: true });
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    const page = await this.browser.newPage();

    // Set default timeout
    page.setDefaultTimeout(TEST_CONFIG.timeouts.default);
    page.setDefaultNavigationTimeout(TEST_CONFIG.timeouts.navigation);

    return page;
  }

  private setupErrorCapture(page: Page, errors: ErrorCapture[]) {
    // Capture console errors
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      if (type === 'error' || type === 'warn') {
        errors.push({
          type: 'console',
          severity: type === 'error' ? 'error' : 'warning',
          message: msg.text(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Capture page errors
    page.on('pageerror', (error: unknown) => {
      // Puppeteer v24.26+ changed pageerror type from Error to unknown
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({
        type: 'exception',
        severity: 'error',
        message: err.message,
        details: err.stack,
        timestamp: new Date().toISOString(),
      });
    });

    // Capture failed network requests
    page.on('response', (response: HTTPResponse) => {
      if (response.status() >= 400) {
        errors.push({
          type: 'network',
          severity: response.status() >= 500 ? 'error' : 'warning',
          message: `${response.status()} ${response.statusText()} - ${response.url()}`,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private async capturePerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    const performanceData = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as any;
      const resources = performance.getEntriesByType('resource');

      return {
        loadTime: perfData?.loadEventEnd - perfData?.fetchStart || 0,
        domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.fetchStart || 0,
        resourceCount: resources.length,
      };
    });

    return performanceData;
  }

  private async testRoute(
    route: RouteConfig,
    viewport: ViewportName
  ): Promise<TestResult> {
    const page = await this.createPage();
    const errors: ErrorCapture[] = [];
    const warnings: string[] = [];
    let status: number | null = null;
    let screenshot: string | null = null;

    try {
      console.log(`  📄 Testing ${route.name} (${viewport})`);

      // Set viewport
      await page.setViewport(TEST_CONFIG.viewports[viewport]);

      // Setup error capture
      this.setupErrorCapture(page, errors);

      // Navigate to route
      const response = await page.goto(
        `${TEST_CONFIG.baseURL}${route.path}`,
        { waitUntil: 'networkidle2' }
      );

      status = response?.status() || null;

      // Wait a bit for client-side rendering
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for common issues
      await this.runAccessibilityChecks(page, warnings);
      await this.checkForBrokenImages(page, warnings);
      await this.checkForMissingText(page, warnings);

      // Capture screenshot
      if (TEST_CONFIG.screenshots.enabled) {
        const filename = `${route.name}-${viewport}.png` as `${string}.png`;
        screenshot = join(TEST_CONFIG.screenshots.path, filename);
        await page.screenshot({
          path: screenshot as `${string}.png`,
          fullPage: TEST_CONFIG.screenshots.fullPage,
        });
      }

      // Get performance metrics
      const performance = await this.capturePerformanceMetrics(page);

      return {
        route: route.path,
        viewport,
        success: status === 200 && errors.filter(e => e.severity === 'error').length === 0,
        errors,
        warnings,
        performance,
        screenshot,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        route: route.path,
        viewport,
        success: false,
        errors: [
          ...errors,
          {
            type: 'exception',
            severity: 'error',
            message: error.message,
            details: error.stack,
            timestamp: new Date().toISOString(),
          },
        ],
        warnings,
        performance: { loadTime: 0, domContentLoaded: 0, resourceCount: 0 },
        screenshot,
        status,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await page.close();
    }
  }

  private async runAccessibilityChecks(page: Page, warnings: string[]) {
    // Check for missing alt text on images
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.alt).length;
    });

    if (imagesWithoutAlt > 0) {
      warnings.push(`${imagesWithoutAlt} images missing alt text`);
    }

    // Check for heading hierarchy
    const headingIssues = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const levels = headings.map(h => parseInt(h.tagName.charAt(1)));

      // Check if there's more than one h1
      const h1Count = levels.filter(l => l === 1).length;
      if (h1Count > 1) return `Multiple h1 tags found (${h1Count})`;
      if (h1Count === 0) return 'No h1 tag found';

      return null;
    });

    if (headingIssues) {
      warnings.push(headingIssues);
    }

    // Check for form inputs without labels
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return inputs.filter(input => {
        const id = input.id;
        if (!id) return true;
        const label = document.querySelector(`label[for="${id}"]`);
        const ariaLabel = input.getAttribute('aria-label');
        return !label && !ariaLabel;
      }).length;
    });

    if (inputsWithoutLabels > 0) {
      warnings.push(`${inputsWithoutLabels} form inputs without labels or aria-label`);
    }
  }

  private async checkForBrokenImages(page: Page, warnings: string[]) {
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.complete || img.naturalHeight === 0).length;
    });

    if (brokenImages > 0) {
      warnings.push(`${brokenImages} potentially broken images`);
    }
  }

  private async checkForMissingText(page: Page, warnings: string[]) {
    const hasVisibleText = await page.evaluate(() => {
      const body = document.body;
      return body && body.innerText.trim().length > 0;
    });

    if (!hasVisibleText) {
      warnings.push('Page appears to have no visible text content');
    }
  }

  async runTests() {
    console.log('🧪 Starting UI test suite...\n');

    // Test public routes on all viewports (all routes are public in local-first)
    console.log('📱 Testing routes...');
    for (const route of TEST_CONFIG.routes.public) {
      for (const viewport of Object.keys(TEST_CONFIG.viewports) as ViewportName[]) {
        const result = await this.testRoute(route, viewport);
        this.results.push(result);
      }
    }
  }

  generateReport(): TestReport {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const warnings = this.results.reduce((sum, r) => sum + r.warnings.length, 0);

    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        warnings,
        duration,
      },
      results: this.results,
      generatedAt: new Date().toISOString(),
    };
  }

  saveReport(report: TestReport) {
    // Save JSON report
    const jsonPath = join('./test-results', 'test-results.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 JSON report saved to: ${jsonPath}`);

    // Save error log
    const allErrors = report.results.flatMap(r => r.errors);
    const errorLogPath = join(TEST_CONFIG.errors.path, 'errors.json');
    writeFileSync(errorLogPath, JSON.stringify(allErrors, null, 2));
    console.log(`📋 Error log saved to: ${errorLogPath}`);

    // Generate HTML report
    this.generateHTMLReport(report);
  }

  private generateHTMLReport(report: TestReport) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SteadyTrack UI Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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
    .stat-card.passed { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .stat-card.failed { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .stat-card.warnings { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .results { margin-top: 30px; }
    .result-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .result-header {
      background: #f9fafb;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .result-header:hover { background: #f3f4f6; }
    .result-title { font-weight: 600; font-size: 16px; }
    .result-meta { display: flex; gap: 15px; font-size: 14px; color: #666; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.warning { background: #fef3c7; color: #92400e; }
    .result-body {
      padding: 20px;
      display: none;
      background: white;
    }
    .result-item.expanded .result-body { display: block; }
    .screenshot { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; margin-top: 15px; }
    .error-list, .warning-list { margin-top: 15px; }
    .error-item, .warning-item {
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
    .error-item { background: #fee2e2; border-left: 4px solid #dc2626; }
    .warning-item { background: #fef3c7; border-left: 4px solid #d97706; }
    .perf-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .perf-item {
      background: #f9fafb;
      padding: 12px;
      border-radius: 4px;
    }
    .perf-label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .perf-value { font-size: 18px; font-weight: 600; color: #111; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 SteadyTrack UI Test Report</h1>
    <div class="timestamp">Generated: ${new Date(report.generatedAt).toLocaleString()}</div>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${report.summary.total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card warnings">
        <div class="stat-value">${report.summary.warnings}</div>
        <div class="stat-label">Warnings</div>
      </div>
    </div>

    <div class="results">
      <h2 style="margin-bottom: 20px;">Test Results</h2>
      ${report.results.map((result, idx) => `
        <div class="result-item" id="result-${idx}">
          <div class="result-header" onclick="document.getElementById('result-${idx}').classList.toggle('expanded')">
            <div class="result-title">
              ${result.route} <span style="color: #666; font-weight: normal;">(${result.viewport})</span>
            </div>
            <div class="result-meta">
              <span class="badge ${result.success ? 'success' : 'error'}">
                ${result.success ? '✓ PASS' : '✗ FAIL'}
              </span>
              ${result.errors.filter(e => e.severity === 'error').length > 0 ? `
                <span class="badge error">${result.errors.filter(e => e.severity === 'error').length} errors</span>
              ` : ''}
              ${result.warnings.length > 0 ? `
                <span class="badge warning">${result.warnings.length} warnings</span>
              ` : ''}
              <span>HTTP ${result.status || 'N/A'}</span>
            </div>
          </div>
          <div class="result-body">
            <div class="perf-metrics">
              <div class="perf-item">
                <div class="perf-label">Load Time</div>
                <div class="perf-value">${(result.performance.loadTime / 1000).toFixed(2)}s</div>
              </div>
              <div class="perf-item">
                <div class="perf-label">DOM Content Loaded</div>
                <div class="perf-value">${(result.performance.domContentLoaded / 1000).toFixed(2)}s</div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Resources</div>
                <div class="perf-value">${result.performance.resourceCount}</div>
              </div>
            </div>

            ${result.errors.length > 0 ? `
              <div class="error-list">
                <h4 style="margin-bottom: 10px;">Errors:</h4>
                ${result.errors.map(err => `
                  <div class="error-item">
                    <div><strong>${err.type.toUpperCase()}</strong>: ${err.message}</div>
                    ${err.details ? `<div style="margin-top: 5px; opacity: 0.8;">${err.details}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${result.warnings.length > 0 ? `
              <div class="warning-list">
                <h4 style="margin-bottom: 10px;">Warnings:</h4>
                ${result.warnings.map(warn => `
                  <div class="warning-item">${warn}</div>
                `).join('')}
              </div>
            ` : ''}

            ${result.screenshot ? `
              <div>
                <h4 style="margin-top: 20px; margin-bottom: 10px;">Screenshot:</h4>
                <img src="../${result.screenshot}" alt="Screenshot" class="screenshot" loading="lazy" />
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

    const htmlPath = join('./test-results', 'report.html');
    writeFileSync(htmlPath, html);
    console.log(`🌐 HTML report saved to: ${htmlPath}`);
  }

  printSummary(report: TestReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`✓ Passed: ${report.summary.passed}`);
    console.log(`✗ Failed: ${report.summary.failed}`);
    console.log(`⚠ Warnings: ${report.summary.warnings}`);
    console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  const runner = new UITestRunner();

  try {
    await runner.initialize();
    await runner.runTests();
    const report = runner.generateReport();
    runner.saveReport(report);
    runner.printSummary(report);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { UITestRunner };
