/**
 * Test Configuration
 * Centralized settings for Puppeteer UI tests
 */

export const TEST_CONFIG = {
  // Base URL for the application
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

  // Timeouts (in milliseconds)
  timeouts: {
    navigation: 30000,
    element: 10000,
    default: 5000,
  },

  // Viewport configurations for responsive testing
  viewports: {
    mobile: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
    tablet: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: false },
    desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
  },

  // Screenshot settings
  screenshots: {
    enabled: true,
    fullPage: true,
    path: './test-results/screenshots',
  },

  // Error capture settings
  errors: {
    captureConsole: true,
    captureNetwork: true,
    captureJSErrors: true,
    path: './test-results/errors',
  },

  // Browser settings
  browser: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || '0'),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },

  // Routes to test (local-first - all routes are public)
  routes: {
    public: [
      { path: '/', name: 'landing' },
      { path: '/privacy', name: 'privacy' },
      { path: '/terms', name: 'terms' },
      { path: '/test', name: 'test' },
      { path: '/dashboard', name: 'dashboard' },
      { path: '/settings', name: 'settings' },
      { path: '/plan/new', name: 'plan-new' },
      { path: '/learn/infinite', name: 'quick-learn' },
    ],
  },
};

export type ViewportName = keyof typeof TEST_CONFIG.viewports;
export type RouteConfig = { path: string; name: string };
