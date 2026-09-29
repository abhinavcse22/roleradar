import React from 'react';
import { Search, FileText, Bot, GitMerge, CheckCircle2, ShieldAlert, Filter } from 'lucide-react';
import { PipelineStats } from '@/lib/pipeline/types';

interface PipelineSummaryProps {
  stats: PipelineStats;
  executedAt?: string;
}

export function PipelineSummary({ stats, executedAt }: PipelineSummaryProps) {
  const runningAgents = Math.max(
    0,
    (stats.agentRunsStarted ?? 0) - (stats.agentRunsCompleted ?? 0) - (stats.agentFailures ?? 0)
  );

  const filteredCount =
    stats.filteredJobs !== undefined
      ? stats.filteredJobs
      : Math.max(0, stats.uniqueJobs - stats.eligibleJobs);

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
          <div className="text-[11px] text-zinc-500">
            live results · {stats.searchQueries ?? 5} query vectors
          </div>
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
          <div className="text-[11px] text-zinc-500">
            {stats.fetchAttempted ?? stats.fetchedPages} attempted · {stats.fetchedPages} verified
          </div>
        </div>

        {/* Stage 3: Agent */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1">
            <Bot className="w-3.5 h-3.5" />
            <span className="font-semibold">Agent</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.agentRunsStarted !== undefined && stats.agentRunsStarted > 0
              ? `${stats.agentRunsCompleted ?? 0} / ${stats.agentRunsStarted}`
              : stats.agentRunsCompleted ?? stats.agentRuns ?? 0}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.agentRunsStarted !== undefined && stats.agentRunsStarted > 0 && runningAgents > 0
              ? `${runningAgents} running · ${stats.agentJobsExtracted ?? 0} jobs added`
              : `${stats.agentJobsExtracted ?? 0} jobs added${stats.agentFailures > 0 ? ` · ${stats.agentFailures} failed` : ''}`}
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
          <div className="text-[11px] text-zinc-500">records → unique jobs</div>
        </div>

        {/* Stage 5: Matching */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Matching</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {stats.uniqueJobs} → {stats.eligibleJobs}
          </div>
          <div className="text-[11px] text-zinc-500">unique → eligible</div>
        </div>
      </div>

      {(filteredCount > 0 || stats.failedSources > 0) && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-1 text-xs text-zinc-500">
          {filteredCount > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
              <span>
                {filteredCount} unique job{filteredCount !== 1 ? 's' : ''} filtered out by hard criteria (role, location, eligibility).
              </span>
            </div>
          )}
          {stats.failedSources > 0 && (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {stats.failedSources} source(s) were unavailable or timed out; pipeline continued with active sources without interruption.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
