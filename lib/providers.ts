/**
 * Provider Registry for Resource Embedding
 *
 * This file defines how different educational content providers can be embedded
 * in the study mode interface. Each provider has specific requirements for:
 * - URL patterns and embed URL generation
 * - Security policies (sandbox, allow attributes)
 * - Embeddability detection
 *
 * Security-first approach: Only explicitly allowed providers can be embedded.
 */

export interface ProviderConfig {
  id: string;
  name: string;
  canEmbed: (url: string, metadata?: ResourceMetadata) => boolean;
  buildEmbedUrl: (url: string, metadata?: ResourceMetadata) => string | null;
  sandbox?: string[]; // omit to disable sandbox attribute
  allow?: string;
  referrerPolicy?: string;
  requiresInteraction?: boolean; // If true, show "Click to load" overlay
}

export interface ResourceMetadata {
  youtubeId?: string;
  provider?: string;
  embedUrl?: string;
  embeddable?: boolean;
}

// Always use dynamic origin at runtime to ensure YouTube embed URLs work correctly
// across local and deployed domains.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * YouTube Provider
 * Uses youtube-nocookie.com for privacy
 * No sandbox when using JS API (required for ended events)
 */
export const YouTubeProvider: ProviderConfig = {
  id: 'youtube',
  name: 'YouTube',
  canEmbed: (url: string, metadata?: ResourceMetadata) => {
    // Check if we have metadata with YouTube ID
    if (metadata?.youtubeId) return true;

    // Check if URL is a direct YouTube link
    return url.includes('youtube.com') || url.includes('youtu.be');
  },
  buildEmbedUrl: (url: string, metadata?: ResourceMetadata) => {
    let videoId: string | null = null;

    // First, try metadata
    if (metadata?.youtubeId) {
      videoId = metadata.youtubeId;
    } else {
      // Try to extract from URL
      videoId = extractYouTubeId(url);
    }

    if (!videoId) return null;

    // Build YouTube nocookie embed URL with optimal parameters
    const params = new URLSearchParams({
      enablejsapi: '1', // Enable JS API for event listening
      origin: ORIGIN, // Required for JS API
      modestbranding: '1', // Minimize YouTube branding
      rel: '0', // Don't show related videos
      autoplay: '0', // Don't autoplay
      fs: '1', // Allow fullscreen
    });

    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  },
  // No sandbox - YouTube JS API requires it to be disabled
  allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
  referrerPolicy: 'strict-origin-when-cross-origin',
};

/**
 * Khan Academy Provider
 * Many KA videos are hosted on YouTube
 * KA articles/exercises are NOT embeddable
 */
export const KhanAcademyProvider: ProviderConfig = {
  id: 'khan-academy',
  name: 'Khan Academy',
  canEmbed: (url: string, metadata?: ResourceMetadata) => {
    // Only embeddable if we have a YouTube ID in metadata
    if (metadata?.youtubeId) return true;

    // Check for KA embed endpoints (rare, but possible)
    if (url.includes('/embed_video?v=') || url.includes('/computer-programming/') && url.includes('/embed')) {
      return true;
    }

    // Otherwise, not embeddable
    return false;
  },
  buildEmbedUrl: (url: string, metadata?: ResourceMetadata) => {
    // If we have YouTube ID, delegate to YouTube provider
    if (metadata?.youtubeId) {
      return YouTubeProvider.buildEmbedUrl(url, metadata);
    }

    // Check for embed_video query param
    const urlObj = new URL(url);
    const videoParam = urlObj.searchParams.get('v');
    if (videoParam) {
      return YouTubeProvider.buildEmbedUrl(url, { youtubeId: videoParam });
    }

    // No embeddable URL found
    return null;
  },
  // Delegate to YouTube settings when using YouTube
  allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
  referrerPolicy: 'strict-origin-when-cross-origin',
};

/**
 * OpenStax Provider
 * NOT embeddable due to X-Frame-Options
 * Always fallback to new tab
 */
export const OpenStaxProvider: ProviderConfig = {
  id: 'openstax',
  name: 'OpenStax',
  canEmbed: () => false, // OpenStax sets X-Frame-Options: DENY
  buildEmbedUrl: () => null,
};

/**
 * LibreTexts Provider
 * May or may not be embeddable - needs verification
 * Conservative approach: not embeddable by default
 */
export const LibreTextsProvider: ProviderConfig = {
  id: 'libretexts',
  name: 'LibreTexts',
  canEmbed: () => false, // Conservative: not embeddable until verified
  buildEmbedUrl: () => null,
};

/**
 * Provider Registry
 * Order matters: first match wins
 */
export const PROVIDERS: ProviderConfig[] = [
  YouTubeProvider,
  KhanAcademyProvider,
  OpenStaxProvider,
  LibreTextsProvider,
];

/**
 * Get provider for a given URL and metadata
 */
export function getProvider(url: string, metadata?: ResourceMetadata): ProviderConfig | null {
  // First, try to match by metadata provider field
  if (metadata?.provider) {
    const provider = PROVIDERS.find((p) =>
      p.id === metadata.provider ||
      p.id === 'youtube' && metadata.provider === 'khan-academy-video' ||
      p.id === 'khan-academy' && metadata.provider === 'khan-academy-video' ||
      p.id === 'khan-academy' && metadata.provider === 'khan-academy-web'
    );
    if (provider) return provider;
  }

  // Fallback: match by URL pattern
  for (const provider of PROVIDERS) {
    if (provider.canEmbed(url, metadata)) {
      return provider;
    }
  }

  return null;
}

/**
 * Check if a resource can be embedded
 */
export function canEmbedResource(url: string, metadata?: ResourceMetadata): boolean {
  // Check metadata first
  if (metadata?.embeddable !== undefined) {
    return metadata.embeddable;
  }

  const provider = getProvider(url, metadata);
  return provider ? provider.canEmbed(url, metadata) : false;
}

/**
 * Build embed URL for a resource
 */
export function buildEmbedUrl(url: string, metadata?: ResourceMetadata): string | null {
  const provider = getProvider(url, metadata);

  // For YouTube/Khan Academy, ALWAYS generate URL dynamically to ensure correct origin
  // Pre-generated embedUrl in metadata may have the wrong origin for the current host.
  if (provider?.id === 'youtube' || provider?.id === 'khan-academy') {
    return provider.buildEmbedUrl(url, metadata);
  }

  // For other providers, use metadata embedUrl if available
  if (metadata?.embedUrl) {
    return metadata.embedUrl;
  }

  return provider ? provider.buildEmbedUrl(url, metadata) : null;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Pattern 1: youtube.com/watch?v=ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }

    // Pattern 2: youtu.be/ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.substring(1).split('?')[0];
    }

    // Pattern 3: youtube.com/embed/ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
      return urlObj.pathname.split('/embed/')[1].split('?')[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get embed configuration for a resource
 */
export interface EmbedConfig {
  url: string;
  sandbox?: string[];
  allow?: string;
  referrerPolicy?: string;
  provider: ProviderConfig;
}

export function getEmbedConfig(url: string, metadata?: ResourceMetadata): EmbedConfig | null {
  const provider = getProvider(url, metadata);
  if (!provider) return null;

  const embedUrl = provider.buildEmbedUrl(url, metadata);
  if (!embedUrl) return null;

  const base: EmbedConfig = {
    url: embedUrl,
    referrerPolicy: provider.referrerPolicy || 'strict-origin-when-cross-origin',
    provider,
  };

  return {
    ...base,
    ...(provider.sandbox !== undefined ? { sandbox: provider.sandbox } : {}),
    ...(provider.allow !== undefined ? { allow: provider.allow } : {}),
  };
}
