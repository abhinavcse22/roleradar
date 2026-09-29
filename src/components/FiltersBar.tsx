import React from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';
import { WorkMode } from '@/lib/jobs/types';

interface FiltersBarProps {
  totalCount: number;
  filteredCount: number;
  selectedWorkMode: 'All' | WorkMode;
  onWorkModeChange: (mode: 'All' | WorkMode) => void;
  selectedSort: 'match' | 'freshness';
  onSortChange: (sort: 'match' | 'freshness') => void;
}

export function FiltersBar({
  totalCount,
  filteredCount,
  selectedWorkMode,
  onWorkModeChange,
  selectedSort,
  onSortChange,
}: FiltersBarProps) {
  const modes: ('All' | WorkMode)[] = ['All', 'Remote', 'Hybrid', 'On-site'];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 mb-6 border-b border-zinc-800/80">
      {/* Count Indicator */}
      <div className="text-sm text-zinc-300">
        Showing <strong className="text-white font-semibold">{filteredCount}</strong> of{' '}
        <span className="text-zinc-400">{totalCount} matched jobs</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Work Mode Filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <Filter className="w-3.5 h-3.5 text-zinc-500 ml-1.5" />
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => onWorkModeChange(mode)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedWorkMode === mode
                  ? 'bg-zinc-800 text-cyan-300 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 ml-1.5" />
          <button
            onClick={() => onSortChange('match')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              selectedSort === 'match'
                ? 'bg-zinc-800 text-cyan-300 font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Best Match
          </button>
          <button
            onClick={() => onSortChange('freshness')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              selectedSort === 'freshness'
                ? 'bg-zinc-800 text-cyan-300 font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Freshest
          </button>
        </div>
      </div>
    </div>
  );
}
