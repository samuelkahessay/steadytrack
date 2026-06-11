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
      isProduction
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
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
              isProduction
                ? "script-src 'self' 'unsafe-inline' https://www.youtube.com"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
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

export default nextConfig;
