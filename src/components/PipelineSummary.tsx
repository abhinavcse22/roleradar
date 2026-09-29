import React from 'react';
import { Search, FileText, Bot, GitMerge, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PipelineStats } from '@/lib/pipeline/types';

interface PipelineSummaryProps {
  stats: PipelineStats;
  executedAt?: string;
}

export function PipelineSummary({ stats, executedAt }: PipelineSummaryProps) {
  return (
    <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 mb-8 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800/70">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Live TinyFish Discovery Pipeline
          </h2>
        </div>
        {executedAt && (
          <span className="text-xs text-zinc-500 font-mono">
            Verified {new Date(executedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Stage 1: Search */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 mb-1">
            <Search className="w-3.5 h-3.5" />
            <span className="font-semibold">Search</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.searchResults}
          </div>
          <div className="text-[11px] text-zinc-500">sources discovered</div>
        </div>

        {/* Stage 2: Fetch */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span className="font-semibold">Fetch</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.fetchedPages}
          </div>
          <div className="text-[11px] text-zinc-500">pages full-browser read</div>
        </div>

        {/* Stage 3: Agent */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1">
            <Bot className="w-3.5 h-3.5" />
            <span className="font-semibold">Agent</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.agentRunsStarted !== undefined
              ? `${stats.agentRunsCompleted ?? stats.agentRuns}/${stats.agentRunsStarted}`
              : stats.agentRuns}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.agentJobsExtracted !== undefined && stats.agentJobsExtracted > 0
              ? `${stats.agentJobsExtracted} jobs extracted`
              : stats.agentRunsStarted !== undefined && stats.agentRunsStarted > 0 && (stats.agentRunsCompleted ?? 0) < stats.agentRunsStarted
              ? 'hubs exploring...'
              : 'career hubs explored'}
          </div>
        </div>

        {/* Stage 4: Deduplication */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
            <GitMerge className="w-3.5 h-3.5" />
            <span className="font-semibold">Deduplication</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.normalizedJobs} → {stats.uniqueJobs}
          </div>
          <div className="text-[11px] text-zinc-500">raw to unique listings</div>
        </div>

        {/* Stage 5: Matching */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Matching</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.eligibleJobs}
          </div>
          <div className="text-[11px] text-zinc-500">ranked eligible jobs</div>
        </div>
      </div>

      {stats.failedSources > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-500">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>
            {stats.failedSources} source(s) were unavailable or timed out; pipeline continued with active sources without interruption.
          </span>
        </div>
      )}
    </div>
  );
}
