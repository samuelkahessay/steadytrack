'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';

export interface FilterState {
  grades: number[];
  categories: string[];
  diplomaOnly: boolean;
  viewMode: 'grid' | 'list';
}

interface CurriculumFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  showViewToggle?: boolean;
}

export default function CurriculumFilters({
  filters,
  onFilterChange,
  showViewToggle = true,
}: CurriculumFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleGrade = (grade: number) => {
    const newGrades = filters.grades.includes(grade)
      ? filters.grades.filter((g) => g !== grade)
      : [...filters.grades, grade];
    onFilterChange({ ...filters, grades: newGrades });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFilterChange({ ...filters, categories: newCategories });
  };

  const clearFilters = () => {
    onFilterChange({
      ...filters,
      grades: [],
      categories: [],
      diplomaOnly: false,
    });
  };

  const hasActiveFilters =
    filters.grades.length > 0 ||
    filters.categories.length > 0 ||
    filters.diplomaOnly;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Mobile: Collapsible filters */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <X
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-0' : 'rotate-45'
            }`}
          />
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            <FilterContent
              filters={filters}
              toggleGrade={toggleGrade}
              toggleCategory={toggleCategory}
              onFilterChange={onFilterChange}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop: Always visible filters */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        <FilterContent
          filters={filters}
          toggleGrade={toggleGrade}
          toggleCategory={toggleCategory}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* View mode toggle */}
      {showViewToggle && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onFilterChange({ ...filters, viewMode: 'grid' })}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filters.viewMode === 'grid'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => onFilterChange({ ...filters, viewMode: 'list' })}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filters.viewMode === 'list'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterContent({
  filters,
  toggleGrade,
  toggleCategory,
  onFilterChange,
}: {
  filters: FilterState;
  toggleGrade: (grade: number) => void;
  toggleCategory: (category: string) => void;
  onFilterChange: (filters: FilterState) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Grade filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Grade Level
        </label>
        <div className="flex gap-2">
          {[11, 12].map((grade) => (
            <button
              key={grade}
              onClick={() => toggleGrade(grade)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filters.grades.includes(grade)
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Grade {grade}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Subject Type
        </label>
        <div className="space-y-2">
          {[
            { value: 'science', label: 'Sciences', icon: '🔬' },
            { value: 'math', label: 'Mathematics', icon: '📐' },
            { value: 'humanities', label: 'Humanities', icon: '📚' },
          ].map((category) => (
            <button
              key={category.value}
              onClick={() => toggleCategory(category.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                filters.categories.includes(category.value)
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Diploma filter */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.diplomaOnly}
            onChange={(e) =>
              onFilterChange({ ...filters, diplomaOnly: e.target.checked })
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Diploma exam subjects only
          </span>
        </label>
      </div>
    </div>
  );
}
