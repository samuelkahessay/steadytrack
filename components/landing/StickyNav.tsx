'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Menu, X } from 'lucide-react';
import { getPlan } from '@/lib/storage/plan';

export default function StickyNav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const plan = getPlan();
    setHasPlan(plan !== null && plan.status === 'active');
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => router.push(hasPlan ? '/dashboard' : '/')}
            className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 hover:text-blue-600 transition-colors"
          >
            <Compass className="w-6 h-6 text-blue-600" />
            <span className="hidden sm:inline">SteadyTrack</span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/curriculum"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Curriculum
            </Link>
            <a
              href="#how-it-works"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              How It Works
            </a>
            <a
              href="#faq"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              FAQ
            </a>
            <Link
              href="/contribute"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Contribute
            </Link>
            <button
              onClick={() => router.push(hasPlan ? '/dashboard' : '/plan/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              {hasPlan ? 'Dashboard' : 'Get Started'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:text-blue-600 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-3">
            <Link
              href="/curriculum"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
            >
              Curriculum
            </Link>
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
            >
              FAQ
            </a>
            <Link
              href="/contribute"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
            >
              Contribute
            </Link>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                router.push(hasPlan ? '/dashboard' : '/plan/new');
              }}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-6 py-3 rounded-lg transition-colors shadow-md"
            >
              {hasPlan ? 'Dashboard' : 'Get Started'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
