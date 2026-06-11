'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  animated?: boolean;
  showLabel?: boolean;
}

export default function ProgressBar({
  value,
  className,
  animated = true,
  showLabel = false,
}: ProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (animated) {
      // Animate from 0 to target value
      const timer = setTimeout(() => {
        setDisplayValue(value);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value, animated]);

  // Determine color based on value
  const getColorClass = (val: number) => {
    if (val >= 70) return 'from-green-400 to-green-600';
    if (val >= 50) return 'from-yellow-400 to-yellow-600';
    if (val >= 25) return 'from-orange-400 to-orange-600';
    return 'from-red-400 to-red-600';
  };

  const colorClass = getColorClass(value);

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            'absolute top-0 left-0 h-full bg-gradient-to-r transition-all duration-700 ease-out',
            colorClass
          )}
          style={{ width: `${displayValue}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {showLabel && (
        <p className="text-xs text-gray-600 mt-1 text-right">{Math.round(value)}%</p>
      )}
    </div>
  );
}
