/**
 * React Query Client Configuration
 *
 * This file sets up the QueryClient with sensible defaults for the application.
 *
 * Key Configuration Decisions:
 * - staleTime: 5 minutes (data considered fresh for 5 minutes)
 * - gcTime: 10 minutes (unused cache kept for 10 minutes)
 * - refetchOnWindowFocus: true (refetch when user returns to tab)
 * - retry: 1 attempt (fail fast, retry once)
 *
 * These settings balance:
 * - Fresh data for active users
 * - Reduced unnecessary network requests
 * - Fast error feedback
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { serverLogger } from '@/lib/logger';

/**
 * Default options for all queries and mutations
 */
const defaultOptions: DefaultOptions = {
  queries: {
    // Consider data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,

    // Keep unused data in cache for 10 minutes
    gcTime: 10 * 60 * 1000,

    // Refetch when user returns to the window/tab
    refetchOnWindowFocus: true,

    // Refetch when network reconnects
    refetchOnReconnect: true,

    // Don't refetch on mount if data is still fresh
    refetchOnMount: false,

    // Retry failed requests once
    retry: 1,

    // Exponential backoff: 1s delay before retry
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
  mutations: {
    // Retry failed mutations once
    retry: 1,

    // 1s delay before retry
    retryDelay: 1000,
  },
};

/**
 * Create a new QueryClient instance with default configuration
 *
 * @returns Configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions,
  });

  // Log errors to our logging system
  client.getQueryCache().config.onError = (error) => {
    serverLogger.error(
      '[React Query] Query error',
      error instanceof Error ? error : undefined,
      { context: 'react-query' }
    );
  };

  client.getMutationCache().config.onError = (error) => {
    serverLogger.error(
      '[React Query] Mutation error',
      error instanceof Error ? error : undefined,
      { context: 'react-query' }
    );
  };

  return client;
}

/**
 * Singleton QueryClient instance for server-side rendering
 *
 * In Next.js App Router, we need to ensure we create a single QueryClient
 * instance that persists across the entire request lifecycle.
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  // Server: always create a new QueryClient
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  // Browser: reuse existing QueryClient
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }

  return browserQueryClient;
}
