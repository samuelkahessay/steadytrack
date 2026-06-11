'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    logger.error('Dashboard error boundary caught error', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-gray-600 mb-6">
          We encountered an error loading your dashboard. This might be temporary.
        </p>

        {error.digest && (
          <p className="text-xs text-gray-500 mb-4 font-mono bg-gray-50 p-2 rounded">
            Error ID: {error.digest}
          </p>
        )}

        <div className="space-y-3">
          <Button
            onClick={reset}
            className="w-full"
            size="lg"
          >
            Try Again
          </Button>

          <Button
            onClick={() => window.location.href = '/plan/new'}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Create New Plan
          </Button>

          <Button
            onClick={() => window.location.href = '/'}
            variant="ghost"
            className="w-full"
            size="lg"
          >
            Go to Homepage
          </Button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          If this persists, try logging out and back in.
        </p>
      </div>
    </div>
  );
}
