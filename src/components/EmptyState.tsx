import React from 'react';
import { Compass, SearchX } from 'lucide-react';

interface EmptyStateProps {
  mode: 'initial' | 'no-results';
}

export function EmptyState({ mode }: EmptyStateProps) {
  if (mode === 'initial') {
    return (
      <div className="text-center py-20 px-4 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 my-6">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-4">
          <Compass className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">
          Find jobs that actually match you
        </h3>
        <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          Tell us your desired role, target location, and skills above. RoleRadar searches live career portals, reads actual postings with TinyFish, removes duplicates, and provides an explainable match score for every opening.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-20 px-4 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 my-6">
      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-4">
        <SearchX className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">
        No matching openings found
      </h3>
      <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
        Try broadening your location criteria, specifying a more general role title, or removing restrictive keywords to discover more live opportunities.
      </p>
    </div>
  );
}
