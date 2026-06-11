import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

/**
 * Header component for plan view pages
 * Provides back navigation and title
 */
export function PlanHeader() {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: 'ghost', className: 'hover:bg-gray-100 flex-shrink-0' })}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="flex-1 text-center">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">My Study Plan</h1>
          </div>
          <div className="w-10 sm:w-16 flex-shrink-0" /> {/* Spacer for balance */}
        </div>
      </div>
    </div>
  );
}
