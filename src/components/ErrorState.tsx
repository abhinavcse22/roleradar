import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="p-8 rounded-3xl bg-red-950/30 border border-red-800/60 my-6 text-center max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-red-900/40 border border-red-700/50 flex items-center justify-center text-red-300 mx-auto mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-red-200 mb-2">
        Search could not be completed
      </h3>
      <p className="text-sm text-red-300/80 mb-6 leading-relaxed">
        {message || 'Something went wrong while discovering live career pages. Please check your query and try again.'}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-800/70 border border-red-700/80 text-white text-xs font-semibold transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Try again</span>
      </button>
    </div>
  );
}
