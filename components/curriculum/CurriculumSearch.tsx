'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, BookOpen, FileText, Target, ExternalLink } from 'lucide-react';
import Fuse from 'fuse.js';
import { createSearchIndex, SearchableItem } from '@/lib/utils/curriculum';
import Link from 'next/link';

interface CurriculumSearchProps {
  onResultClick?: (item: SearchableItem) => void;
}

export default function CurriculumSearch({ onResultClick }: CurriculumSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchableItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [fuse, setFuse] = useState<Fuse<SearchableItem> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js
  useEffect(() => {
    const searchIndex = createSearchIndex();
    const fuseInstance = new Fuse(searchIndex, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'code', weight: 3 },
        { name: 'subjectName', weight: 1.5 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });
    setFuse(fuseInstance);
  }, []);

  // Handle search
  useEffect(() => {
    if (!fuse || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchResults = fuse.search(query, { limit: 20 });
    setResults(searchResults.map((r) => r.item));
    setIsOpen(true);
  }, [query, fuse]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'subject':
        return <BookOpen className="w-4 h-4" />;
      case 'unit':
        return <FileText className="w-4 h-4" />;
      case 'outcome':
        return <Target className="w-4 h-4" />;
      case 'resource':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subject':
        return 'bg-blue-100 text-blue-700';
      case 'unit':
        return 'bg-purple-100 text-purple-700';
      case 'outcome':
        return 'bg-green-100 text-green-700';
      case 'resource':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(results.length > 0)}
          placeholder="Search subjects, units, outcomes, or resources..."
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[500px] overflow-y-auto">
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 py-1">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {results.map((item, idx) => {
              const href =
                item.type === 'subject'
                  ? `/curriculum/${item.subjectSlug}`
                  : item.type === 'resource' && item.url
                  ? item.url
                  : `/curriculum/${item.subjectSlug}#${item.unitId || ''}`;

              const isExternal = item.type === 'resource';

              return (
                <Link
                  key={idx}
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    setIsOpen(false);
                    onResultClick?.(item);
                  }}
                  className="block px-3 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg ${getTypeColor(
                        item.type
                      )} flex items-center justify-center`}
                    >
                      {getTypeIcon(item.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm line-clamp-1">
                          {item.code ? `${item.code}: ` : ''}
                          {item.title}
                        </span>
                        <span
                          className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${getTypeColor(
                            item.type
                          )}`}
                        >
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {item.subjectName}
                        {item.description && ` • ${item.description}`}
                      </p>
                    </div>

                    {/* Grade badge */}
                    <div className="flex-shrink-0 text-xs text-gray-500">
                      Grade {item.grade}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 text-center">
            No results found for &quot;{query}&quot;
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            Try searching for subject names, outcome codes, or topics
          </p>
        </div>
      )}
    </div>
  );
}
