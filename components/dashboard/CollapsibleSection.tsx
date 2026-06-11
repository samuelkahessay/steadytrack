'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { get, set } from '@/lib/storage/local';

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  storageKey?: string; // Optional key for localStorage persistence
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
}

export default function CollapsibleSection({
  title,
  defaultExpanded = false,
  storageKey,
  children,
  className,
  titleClassName,
  contentClassName,
}: CollapsibleSectionProps) {
  // Initialize state from localStorage if key provided, otherwise use default
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!storageKey) return defaultExpanded;
    const stored = get<string | null>(storageKey, null);
    return stored !== null ? stored === 'true' : defaultExpanded;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(
    isExpanded ? undefined : 0
  );

  // Save to localStorage when expanded state changes
  useEffect(() => {
    if (storageKey) {
      set(storageKey, String(isExpanded));
    }
  }, [isExpanded, storageKey]);

  // Update height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return;

    if (isExpanded) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);
      // After animation, set to undefined to allow dynamic resizing
      const timer = setTimeout(() => setHeight(undefined), 300);
      return () => clearTimeout(timer);
    } else {
      setHeight(contentRef.current.scrollHeight);
      // Force reflow
      requestAnimationFrame(() => {
        setHeight(0);
      });
    }
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={cn('border border-gray-200 rounded-lg bg-white', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between',
          'hover:bg-gray-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
          titleClassName
        )}
        aria-expanded={isExpanded}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <svg
          className={cn(
            'w-5 h-5 text-gray-600 transition-transform duration-300',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content with smooth height transition */}
      <div
        ref={contentRef}
        style={{ height }}
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          contentClassName
        )}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
