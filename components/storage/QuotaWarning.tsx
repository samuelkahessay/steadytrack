'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, HardDrive } from 'lucide-react';
import { getQuotaInfo, isApproachingQuota } from '@/lib/storage/local';

/**
 * QuotaWarning Component
 * Displays a warning when localStorage usage approaches the quota limit (80%)
 *
 * Features:
 * - Shows current usage and percentage
 * - Dismissible but reappears after 24 hours if quota still high
 * - Provides suggestions for freeing up space
 */
export function QuotaWarning() {
  const [isVisible, setIsVisible] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<ReturnType<typeof getQuotaInfo> | null>(null);

  useEffect(() => {
    // Check if we should show the warning
    const checkQuota = () => {
      if (!isApproachingQuota(80)) {
        setIsVisible(false);
        return;
      }

      // Check if user dismissed it recently (within 24 hours)
      const dismissedAt = localStorage.getItem('quota-warning-dismissed');
      if (dismissedAt) {
        const dismissedTime = new Date(dismissedAt).getTime();
        const now = Date.now();
        const hoursSinceDismissal = (now - dismissedTime) / (1000 * 60 * 60);

        if (hoursSinceDismissal < 24) {
          setIsVisible(false);
          return;
        }
      }

      // Show warning and get quota info
      const info = getQuotaInfo();
      setQuotaInfo(info);
      setIsVisible(true);
    };

    checkQuota();
  }, []);

  const handleDismiss = () => {
    // Remember dismissal for 24 hours
    localStorage.setItem('quota-warning-dismissed', new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible || !quotaInfo) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg shadow-sm">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              Storage Space Running Low
            </h3>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-yellow-600 dark:text-yellow-500 hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            You&apos;re using {quotaInfo.formattedUsed} of {quotaInfo.formattedTotal} ({quotaInfo.percentUsed}%) of your browser&apos;s storage.
            Consider exporting or clearing old data to free up space.
          </p>

          {/* Progress bar */}
          <div className="w-full bg-yellow-200 dark:bg-yellow-800/30 rounded-full h-2 mb-3">
            <div
              className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(quotaInfo.percentUsed, 100)}%` }}
            />
          </div>

          {/* Suggestions */}
          <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3 h-3 flex-shrink-0" />
              <span>
                <strong>Suggestions:</strong> Export your data from Settings, clear old study plans, or reduce microcard cache
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
