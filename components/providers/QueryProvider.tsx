/**
 * React Query Provider Component
 *
 * This component wraps the application with QueryClientProvider to enable
 * React Query throughout the app. It also includes the DevTools in development.
 *
 * Usage:
 * ```tsx
 * <QueryProvider>
 *   <YourApp />
 * </QueryProvider>
 * ```
 */

'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query/client';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryProvider wraps the app with React Query's QueryClientProvider
 *
 * We use useState to ensure the QueryClient is only created once per component
 * instance, which is important for proper client-side hydration in Next.js.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient instance once per component mount
  // This ensures the client persists across re-renders but resets on remount
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {/* DevTools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
