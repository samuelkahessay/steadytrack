import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Silence multi-lockfile workspace root inference by explicitly setting the tracing root
  // to this project directory.
  outputFileTracingRoot: path.join(__dirname),
  // Remove console logs in production for cleaner bundles
  compiler: {
    removeConsole: isProduction ? {
      exclude: ['error', 'warn'], // Keep console.error and console.warn
    } : false,
  },

  async headers() {
    // Base security headers for all routes
    const baseHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN', // Prevent clickjacking
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff', // Prevent MIME sniffing
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    // Add HSTS only in production (requires HTTPS)
    if (isProduction) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        // Start conservative: 6 months, includeSubDomains, preload
        // Increase to 1 year after confidence in HTTPS deployment
        value: 'max-age=15552000; includeSubDomains; preload',
      });
    }

    // Conservative baseline CSP for most pages
    const baselineCSP = [
      "default-src 'self'",
      // Allow inline scripts and eval in dev for Next.js hot reload
      // Include Vercel Analytics in development
      isProduction
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      // Supabase connection (Sentry /monitoring is covered by 'self')
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`,
      "frame-ancestors 'self'",
      "worker-src 'self' blob:",
    ].join('; ');

    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          ...baseHeaders,
          {
            key: 'Content-Security-Policy',
            value: baselineCSP,
          },
        ],
      },
      {
        // More permissive CSP for study mode pages (YouTube embeds, external resources)
        // Keep current rules while we iterate on tightening
        source: '/plan/:id/study',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Study mode needs unsafe-eval/unsafe-inline for embedded content
              // Include Vercel Analytics in development
              isProduction
                ? "script-src 'self' 'unsafe-inline' https://www.youtube.com"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              // Include YouTube and Supabase (Sentry /monitoring is covered by 'self')
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''} https://www.youtube.com https://www.youtube-nocookie.com`,
              // YouTube and Khan Academy iframes
              "frame-src https://www.youtube-nocookie.com https://*.youtube-nocookie.com https://www.youtube.com https://www.khanacademy.org",
              "frame-ancestors 'self'",
              "media-src https://www.youtube-nocookie.com https://*.youtube-nocookie.com",
              "worker-src 'self' blob:",
              "child-src https://www.youtube-nocookie.com https://*.youtube-nocookie.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry configuration only when an auth token is available.
// This prevents CI runs (e.g., Dependabot PRs) without secrets from failing
// while preserving full Sentry behavior in environments with the token.
const shouldEnableSentryPlugin = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_AUTH_TOKEN.trim());

const configWithOptionalSentry = shouldEnableSentryPlugin
  ? withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG ?? "",

  project: process.env.SENTRY_PROJECT ?? "",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // App Router only: turn off Pages Router auto-instrumentation
  // Prevents Sentry from wrapping legacy `pages/` routes and middleware
  // in a project that only uses the App Router.
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
  })
  : nextConfig;

export default configWithOptionalSentry;
