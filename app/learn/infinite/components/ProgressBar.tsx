'use client';

interface ProgressBarProps {
  current: number;
  total: number;
  showNumbers?: boolean;
  hasMore?: boolean;
}

export function ProgressBar({ current, total, showNumbers = false, hasMore = false }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      {/* Progress bar */}
      <div className="flex-1 h-1.5 md:h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Optional numeric display */}
      {showNumbers && (
        <div className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {current} / {total}{hasMore ? '+' : ''}
        </div>
      )}
    </div>
  );
}
