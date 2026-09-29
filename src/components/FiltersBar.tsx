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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 mb-5 border-b border-zinc-800/80">
      {/* Clear Count Indicator: Server Telemetry vs Client View */}
      <div className="text-xs text-zinc-400">
        <span className="text-zinc-500 font-mono mr-2">Pipeline:</span>
        <strong className="text-white font-semibold font-mono">{totalCount}</strong> eligible jobs
        {filteredCount !== totalCount && (
          <span className="ml-2 pl-2 border-l border-zinc-800 text-cyan-300">
            Current view: <strong className="font-semibold font-mono">{filteredCount}</strong> shown
          </span>
        )}
      </div>

      {/* Visually secondary controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Work Mode Filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
          <Filter className="w-3 h-3 text-zinc-500 ml-1.5" />
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => onWorkModeChange(mode)}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer text-xs ${
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
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
          <ArrowUpDown className="w-3 h-3 text-zinc-500 ml-1.5" />
          <button
            onClick={() => onSortChange('match')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer text-xs ${
              selectedSort === 'match'
                ? 'bg-zinc-800 text-cyan-300 font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Best Match
          </button>
          <button
            onClick={() => onSortChange('freshness')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer text-xs ${
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
