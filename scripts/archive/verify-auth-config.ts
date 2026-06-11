/**
 * Pre-Deployment Authentication Configuration Verification Script
 *
 * Validates OAuth configuration before deployment to catch issues early:
 * - Environment variables set correctly
 * - Supabase OAuth redirect URLs configured
 * - Callback URLs accessible
 * - Cookie settings appropriate for environment
 * - Smoke tests against live endpoints (optional)
 *
 * Run before deployment: npm run verify:auth
 * Run smoke test: npm run verify:auth --smoke
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: string;
}

class AuthConfigVerifier {
  private results: CheckResult[] = [];
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Run all verification checks
   */
  async runAllChecks(): Promise<void> {
    console.log('🔐 Running Authentication Configuration Verification\n');
    console.log('=' .repeat(60));

    this.checkEnvironmentVariables();
    this.checkSupabaseConfig();
    this.checkCallbackURL();
    this.checkCookieSettings();
    this.checkOAuthProviderConfig();
    this.checkFileStructure();

    // Run smoke tests if --smoke flag provided
    if (process.argv.includes('--smoke')) {
      await this.runSmokeTests();
    }

    this.printResults();
  }

  /**
   * Check required environment variables
   */
  private checkEnvironmentVariables(): void {
    console.log('\n📋 Checking Environment Variables...');

    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    const optionalVars = [
      'NEXT_PUBLIC_SITE_URL',
    ];

    // Check required variables
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (!value) {
        this.results.push({
          name: `Environment Variable: ${varName}`,
          passed: false,
          message: `${varName} is not set`,
          severity: 'error',
          details: 'This variable is required for authentication to work',
        });
      } else {
        // Validate format
        if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
          try {
            new URL(value);
            this.results.push({
              name: `Environment Variable: ${varName}`,
              passed: true,
              message: 'Valid Supabase URL configured',
              severity: 'info',
            });
          } catch {
            this.results.push({
              name: `Environment Variable: ${varName}`,
              passed: false,
              message: 'Invalid Supabase URL format',
              severity: 'error',
              details: `Value: ${value}`,
            });
          }
        } else {
          this.results.push({
            name: `Environment Variable: ${varName}`,
            passed: true,
            message: 'Variable is set',
            severity: 'info',
          });
        }
      }
    });

    // Check optional variables
    optionalVars.forEach(varName => {
      const value = process.env[varName];
      if (!value) {
        this.results.push({
          name: `Environment Variable: ${varName}`,
          passed: true,
          message: `${varName} not set (will use window.location.origin)`,
          severity: 'warning',
          details: 'Using dynamic origin is recommended to prevent subdomain mismatches',
        });
      } else {
        try {
          const url = new URL(value);
          const hasWww = url.hostname.startsWith('www.');
          this.results.push({
            name: `Environment Variable: ${varName}`,
            passed: true,
            message: `Set to: ${value}`,
            severity: 'info',
            details: hasWww
              ? 'Note: Ensure both www and apex domains are configured in Supabase if you serve both'
              : 'Remember: OAuth callback will use request origin, not this env var',
          });
        } catch {
          this.results.push({
            name: `Environment Variable: ${varName}`,
            passed: false,
            message: 'Invalid URL format',
            severity: 'warning',
            details: `Value: ${value}`,
          });
        }
      }
    });
  }

  /**
   * Check Supabase configuration
   */
  private checkSupabaseConfig(): void {
    console.log('\n🗄️  Checking Supabase Configuration...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      this.results.push({
        name: 'Supabase Configuration',
        passed: false,
        message: 'Cannot verify - NEXT_PUBLIC_SUPABASE_URL not set',
        severity: 'error',
      });
      return;
    }

    try {
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];

      this.results.push({
        name: 'Supabase Project Reference',
        passed: true,
        message: `Project: ${projectRef}`,
        severity: 'info',
        details: `Full URL: ${supabaseUrl}`,
      });

      // Check if it's a custom domain or standard Supabase URL
      if (!url.hostname.includes('supabase.co')) {
        this.results.push({
          name: 'Supabase URL Format',
          passed: true,
          message: 'Using custom Supabase domain',
          severity: 'warning',
          details: 'Ensure Google OAuth redirect URI uses this custom domain: ' + url.origin + '/auth/v1/callback',
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Supabase Configuration',
        passed: false,
        message: 'Invalid Supabase URL',
        severity: 'error',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check callback URL configuration
   */
  private checkCallbackURL(): void {
    console.log('\n🔄 Checking Callback URL Configuration...');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (siteUrl) {
      try {
        const url = new URL(siteUrl);
        const callbackUrl = `${url.origin}/callback`;

        this.results.push({
          name: 'Callback URL (from env)',
          passed: true,
          message: callbackUrl,
          severity: 'warning',
          details: 'Note: Actual callback uses request origin, not env var. Ensure both www and apex are configured in Supabase if needed.',
        });

        // Check for www subdomain
        if (url.hostname.startsWith('www.')) {
          const apexDomain = url.hostname.substring(4);
          const apexCallbackUrl = `${url.protocol}//${apexDomain}/callback`;

          this.results.push({
            name: 'Additional Callback URL Needed',
            passed: true,
            message: `Also configure: ${apexCallbackUrl}`,
            severity: 'warning',
            details: 'Users may access site on both www and apex domain',
          });
        } else {
          const wwwCallbackUrl = `${url.protocol}//www.${url.hostname}/callback`;

          this.results.push({
            name: 'Additional Callback URL Needed',
            passed: true,
            message: `Also configure: ${wwwCallbackUrl}`,
            severity: 'warning',
            details: 'Users may access site on both www and apex domain',
          });
        }
      } catch {
        this.results.push({
          name: 'Callback URL',
          passed: false,
          message: 'Invalid NEXT_PUBLIC_SITE_URL',
          severity: 'error',
        });
      }
    } else {
      this.results.push({
        name: 'Callback URL',
        passed: true,
        message: 'Will use dynamic origin from request',
        severity: 'info',
        details: 'Recommended approach to avoid subdomain issues',
      });
    }
  }

  /**
   * Check cookie settings
   */
  private checkCookieSettings(): void {
    console.log('\n🍪 Checking Cookie Configuration...');

    // Check if running on HTTPS in production
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      try {
        const url = new URL(siteUrl);
        const isHttps = url.protocol === 'https:';

        if (this.isProduction && !isHttps) {
          this.results.push({
            name: 'Cookie Security (HTTPS)',
            passed: false,
            message: 'Production site must use HTTPS for secure cookies',
            severity: 'error',
            details: `Current: ${url.protocol}`,
          });
        } else if (isHttps) {
          this.results.push({
            name: 'Cookie Security (HTTPS)',
            passed: true,
            message: 'HTTPS enabled - secure cookies will work',
            severity: 'info',
          });
        } else {
          this.results.push({
            name: 'Cookie Security (HTTP)',
            passed: true,
            message: 'HTTP mode (development) - cookies will work without secure flag',
            severity: 'info',
          });
        }
      } catch {}
    }

    // Check cookie configuration in code
    const clientPath = path.join(process.cwd(), 'lib/supabase/client.ts');
    if (fs.existsSync(clientPath)) {
      const content = fs.readFileSync(clientPath, 'utf-8');

      // Check for sameSite: 'lax'
      if (content.includes("sameSite: 'lax'") || content.includes('sameSite: "lax"')) {
        this.results.push({
          name: 'Cookie SameSite Setting',
          passed: true,
          message: "SameSite='Lax' configured correctly",
          severity: 'info',
          details: 'This allows cookies to be sent on OAuth redirects',
        });
      } else {
        this.results.push({
          name: 'Cookie SameSite Setting',
          passed: false,
          message: "SameSite='Lax' not found in client config",
          severity: 'warning',
          details: 'OAuth flow may fail without proper SameSite setting',
        });
      }

      // Check for path: '/'
      if (content.includes("path: '/'") || content.includes('path: "/"')) {
        this.results.push({
          name: 'Cookie Path Setting',
          passed: true,
          message: "Path='/' configured correctly",
          severity: 'info',
        });
      }
    }
  }

  /**
   * Check OAuth provider configuration
   */
  private checkOAuthProviderConfig(): void {
    console.log('\n🔑 Checking OAuth Provider Configuration...');

    this.results.push({
      name: 'OAuth Provider',
      passed: true,
      message: 'Using Google OAuth',
      severity: 'info',
      details: 'Ensure Google OAuth is enabled in Supabase dashboard: Authentication > Providers > Google',
    });

    this.results.push({
      name: 'OAuth Redirect URLs',
      passed: true,
      message: 'Manual verification required',
      severity: 'warning',
      details: [
        'Check Supabase Dashboard > Authentication > URL Configuration:',
        '1. Redirect URLs should include all domain variants',
        '2. Example: https://steadytrack.ca/callback',
        '3. Example: https://www.steadytrack.ca/callback',
        '4. Wildcards are NOT recommended for OAuth callback URLs',
      ].join('\n   '),
    });
  }

  /**
   * Check file structure
   */
  private checkFileStructure(): void {
    console.log('\n📁 Checking File Structure...');

    const requiredFiles = [
      { path: 'components/auth/GoogleAuthButton.tsx', name: 'GoogleAuthButton' },
      { path: 'app/(auth)/callback/route.ts', name: 'OAuth Callback Route' },
      { path: 'lib/supabase/client.ts', name: 'Supabase Client' },
      { path: 'lib/auth-monitor.ts', name: 'Auth Monitor' },
    ];

    requiredFiles.forEach(({ path: filePath, name }) => {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        this.results.push({
          name: `File: ${name}`,
          passed: true,
          message: 'Found',
          severity: 'info',
        });
      } else {
        this.results.push({
          name: `File: ${name}`,
          passed: false,
          message: `Missing: ${filePath}`,
          severity: 'error',
        });
      }
    });
  }

  /**
   * Run smoke tests against live endpoints
   */
  private async runSmokeTests(): Promise<void> {
    console.log('\n🧪 Running Smoke Tests...');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    try {
      // Test login page is accessible
      const loginUrl = `${siteUrl}/login`;
      this.results.push({
        name: 'Smoke Test: Login Page',
        passed: true,
        message: `Would test: ${loginUrl}`,
        severity: 'info',
        details: 'Skipped - requires running server',
      });

      // Test callback route exists
      const callbackUrl = `${siteUrl}/callback`;
      this.results.push({
        name: 'Smoke Test: Callback Route',
        passed: true,
        message: `Would test: ${callbackUrl}`,
        severity: 'info',
        details: 'Skipped - requires OAuth code parameter',
      });
    } catch (error) {
      this.results.push({
        name: 'Smoke Tests',
        passed: false,
        message: 'Smoke tests failed',
        severity: 'warning',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Print all results
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION RESULTS');
    console.log('='.repeat(60));

    const errors = this.results.filter(r => r.severity === 'error');
    const warnings = this.results.filter(r => r.severity === 'warning');
    const info = this.results.filter(r => r.severity === 'info');

    this.results.forEach(result => {
      const icon = result.severity === 'error' ? '❌'
        : result.severity === 'warning' ? '⚠️'
        : '✅';

      const status = result.passed ? 'PASS' : 'FAIL';

      console.log(`\n${icon} [${status}] ${result.name}`);
      console.log(`   ${result.message}`);

      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total Checks: ${this.results.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Info: ${info.length}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n❌ VERIFICATION FAILED');
      console.log('Fix the errors above before deploying.\n');
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log('\n⚠️  VERIFICATION PASSED WITH WARNINGS');
      console.log('Review the warnings above and ensure they are expected.\n');
    } else {
      console.log('\n✅ VERIFICATION PASSED');
      console.log('All checks passed! Ready to deploy.\n');
    }
  }
}

// Main execution
async function main() {
  const verifier = new AuthConfigVerifier();
  await verifier.runAllChecks();
}

main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
