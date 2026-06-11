import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RateLimitPresets } from '@/lib/ratelimit';
import { serverLogger } from '@/lib/logger';

export const runtime = 'nodejs'; // Cheerio needs Node runtime

interface ArticleMetadata {
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  wordCount?: number;
  readingTime?: number;
  embeddable: boolean;
  error?: string;
}

/**
 * Validate URL to prevent SSRF attacks
 */
async function validateUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  // Only http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol - only http/https allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block IP literals
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    throw new Error('IP literals not allowed');
  }

  // Block IPv6 literals (enclosed in brackets)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    throw new Error('IPv6 literals not allowed');
  }

  // Block localhost and private networks
  const privatePatterns = [
    'localhost',
    '127.',
    '10.',
    '192.168.',
    // Private Class B (172.16.0.0 - 172.31.255.255)
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
  ];

  for (const pattern of privatePatterns) {
    if (typeof pattern === 'string') {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        throw new Error('Private networks not allowed');
      }
    } else if (pattern.test(hostname)) {
      throw new Error('Private networks not allowed');
    }
  }

  // Block link-local addresses
  if (hostname.startsWith('169.254.')) {
    throw new Error('Link-local addresses not allowed');
  }
}

/**
 * Check if URL can be embedded via iframe by inspecting headers
 */
async function checkEmbeddable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SteadyTrack/1.0 (+https://steadytrack.vercel.app)',
      },
      redirect: 'follow', // Follow redirects
    });

    clearTimeout(timeoutId);

    // Check X-Frame-Options
    const xFrameOptions = response.headers.get('x-frame-options');
    if (xFrameOptions) {
      const value = xFrameOptions.toLowerCase();
      if (value.includes('deny') || value.includes('sameorigin')) {
        return false;
      }
    }

    // Check Content-Security-Policy frame-ancestors
    const csp = response.headers.get('content-security-policy');
    if (csp) {
      const frameAncestors = csp
        .split(';')
        .find((directive) => directive.trim().startsWith('frame-ancestors'));

      if (frameAncestors) {
        const value = frameAncestors.toLowerCase();
        // If frame-ancestors is present but not 'self' or '*', likely blocked
        if (
          !value.includes("'self'") &&
          !value.includes('*') &&
          value.includes("'none'")
        ) {
          return false;
        }
      }
    }

    return true; // Likely embeddable
  } catch (_error) {
    serverLogger.warn('Embeddability check failed', { url });
    return false; // Assume blocked on error
  }
}

/**
 * Estimate reading time from word count
 * Based on average reading speed of 238 WPM
 */
function estimateReadingTime(wordCount: number, imageCount: number = 0): number {
  const WPM = 238;
  const SECONDS_PER_IMAGE = 12;

  const readingMinutes = wordCount / WPM;
  const imageMinutes = (imageCount * SECONDS_PER_IMAGE) / 60;

  return Math.max(1, Math.ceil(readingMinutes + imageMinutes));
}

async function handleArticleMetadata(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    // Validate URL for SSRF protection
    await validateUrl(url);

    // Check embeddability via headers (runs in parallel with fetch below)
    const embeddablePromise = checkEmbeddable(url);

    // Fetch HTML with safety limits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SteadyTrack/1.0 (+https://steadytrack.vercel.app)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      // Next.js cache (1 hour)
      next: { revalidate: 3600 },
    });

    clearTimeout(timeoutId);

    // Verify content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) {
      throw new Error('Content is not HTML');
    }

    // Read response with size limit (512KB)
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const maxSize = 512 * 1024; // 512KB limit

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > maxSize) {
          await reader.cancel();
          break;
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Decode HTML
    const html = new TextDecoder().decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c)))
    );

    // Parse with Cheerio
    const $ = cheerio.load(html);

    // Extract Open Graph metadata
    const ogTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="og:title"]').attr('content');
    const ogDescription =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="og:description"]').attr('content');
    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="og:image"]').attr('content');
    const ogSiteName =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="og:site_name"]').attr('content');

    // Fallback to standard meta tags
    const title = ogTitle || $('title').text().trim() || url;
    const description =
      ogDescription || $('meta[name="description"]').attr('content') || '';
    const image = ogImage;
    const siteName = ogSiteName;

    // Extract article text for word count (simple approach - can be enhanced)
    let wordCount: number | undefined;
    let readingTime: number | undefined;

    // Try to find article content in common selectors
    const articleSelectors = [
      'article',
      '[role="article"]',
      '.article-body',
      '.article-content',
      '.post-content',
      'main',
    ];

    for (const selector of articleSelectors) {
      const articleText = $(selector).text().trim();
      if (articleText && articleText.length > 100) {
        const words = articleText.split(/\s+/).filter((w) => w.length > 0);
        wordCount = words.length;

        // Count images in article
        const imageCount = $(selector).find('img').length;
        readingTime = estimateReadingTime(wordCount, imageCount);
        break;
      }
    }

    // Wait for embeddability check
    const embeddable = await embeddablePromise;

    const metadata: ArticleMetadata = {
      title,
      ...(description && { description }),
      ...(image && { image }),
      ...(siteName && { siteName }),
      ...(wordCount !== undefined && { wordCount }),
      ...(readingTime !== undefined && { readingTime }),
      embeddable,
    };

    return NextResponse.json(metadata);
  } catch (error) {
    serverLogger.error(
      'Metadata fetch error',
      error instanceof Error ? error : undefined,
      { url, path: '/api/article-metadata' }
    );

    // Return partial data instead of error (graceful degradation)
    const metadata: ArticleMetadata = {
      title: url,
      embeddable: false,
      error: error instanceof Error ? error.message : 'Failed to fetch metadata',
    };

    // Still return 200 to allow client to proceed
    return NextResponse.json(metadata, { status: 200 });
  }
}

// Apply moderate rate limiting: 10 requests per hour (makes external HTTP requests)
export const GET = withRateLimit(
  { ...RateLimitPresets.MODERATE, prefix: 'article-metadata' },
  handleArticleMetadata
);
