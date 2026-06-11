'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Settings } from 'lucide-react';

export default function DashboardHeader() {
  const pathname = usePathname();
  const isSettings = pathname === '/settings';
  const isCurriculum = pathname === '/curriculum';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 mb-8">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
          SteadyTrack
        </Link>

        <nav className="flex items-center gap-4 md:gap-6">
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Dashboard"
          >
            <Home className="w-5 h-5" />
            <span className="hidden md:inline">Dashboard</span>
          </Link>
          <Link
            href="/curriculum"
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              isCurriculum
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Curriculum"
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden md:inline">Curriculum</span>
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              isSettings
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden md:inline">Settings</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
