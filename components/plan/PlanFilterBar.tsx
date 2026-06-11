import { Calendar, ListTodo, Grid3x3, EyeOff } from 'lucide-react';

interface PlanFilterBarProps {
  filterMode: 'all' | 'today' | 'incomplete';
  setFilterMode: (mode: 'all' | 'today' | 'incomplete') => void;
  hideCompleted: boolean;
  setHideCompleted: (hide: boolean) => void;
  totalIncompleteDays: number;
}

/**
 * Filter bar component for plan view
 * Provides filter chips and hide completed toggle
 */
export function PlanFilterBar({
  filterMode,
  setFilterMode,
  hideCompleted,
  setHideCompleted,
  totalIncompleteDays,
}: PlanFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterMode('today')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
            filterMode === 'today'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Today
        </button>
        <button
          onClick={() => setFilterMode('incomplete')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
            filterMode === 'incomplete'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          Incomplete ({totalIncompleteDays})
        </button>
        <button
          onClick={() => setFilterMode('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
            filterMode === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
          All Days
        </button>
      </div>

      {/* Hide Completed Toggle */}
      <button
        onClick={() => setHideCompleted(!hideCompleted)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
          hideCompleted
            ? 'bg-gray-700 text-white shadow-md'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <EyeOff className="w-4 h-4" />
        <span className="hidden sm:inline">Hide Completed</span>
        <span className="sm:hidden">Hide Done</span>
      </button>
    </div>
  );
}
