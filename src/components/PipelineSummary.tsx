'use client';

import React, { useState } from 'react';
import {
  Search,
  FileText,
  Bot,
  GitMerge,
  CheckCircle2,
  ShieldAlert,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PipelineStats } from '@/lib/pipeline/types';

interface PipelineSummaryProps {
  stats: PipelineStats;
  executedAt?: string;
}

export function PipelineSummary({ stats, executedAt }: PipelineSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const runningAgents = Math.max(
    0,
    (stats.agentRunsStarted ?? 0) - (stats.agentRunsCompleted ?? 0) - (stats.agentFailures ?? 0)
  );

  const filteredCount =
    stats.filteredJobs !== undefined
      ? stats.filteredJobs
      : Math.max(0, stats.uniqueJobs - stats.eligibleJobs);

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 mb-6 backdrop-blur-sm overflow-hidden transition-all">
      {/* Collapsed Header / Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-200">
            How RoleRadar searched
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-[11px] text-zinc-400 hidden sm:inline font-mono">
            Search · Fetch · Agent · Deduplication · Matching
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {executedAt && (
            <span className="text-[11px] text-zinc-500 font-mono hidden md:inline">
              Verified {new Date(executedAt).toLocaleTimeString()}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
            <span>{isOpen ? 'Hide telemetry' : 'View telemetry'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </button>

      {/* Expanded Telemetry Grid */}
      {isOpen && (
        <div className="p-4 pt-3 border-t border-zinc-800/70 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Stage 1: Search */}
            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 mb-0.5">
                <Search className="w-3 h-3" />
                <span className="font-semibold text-[11px]">Search</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {stats.searchResults}
              </div>
              <div className="text-[10px] text-zinc-500">
                live results · {stats.searchQueries ?? 5} vectors
              </div>
            </div>

            {/* Stage 2: Fetch */}
            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-0.5">
                <FileText className="w-3 h-3" />
                <span className="font-semibold text-[11px]">Fetch</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {stats.fetchedPages}
              </div>
              <div className="text-[10px] text-zinc-500">
                {stats.fetchAttempted ?? stats.fetchedPages} attempted · {stats.fetchedPages} verified
              </div>
            </div>

            {/* Stage 3: Agent */}
            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-0.5">
                <Bot className="w-3 h-3" />
                <span className="font-semibold text-[11px]">Agent</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {stats.agentRunsStarted !== undefined && stats.agentRunsStarted > 0
                  ? `${stats.agentRunsCompleted ?? 0} / ${stats.agentRunsStarted}`
                  : stats.agentRunsCompleted ?? stats.agentRuns ?? 0}
              </div>
              <div className="text-[10px] text-zinc-500">
                {stats.agentRunsStarted !== undefined && stats.agentRunsStarted > 0 && runningAgents > 0
                  ? `${runningAgents} running · ${stats.agentJobsExtracted ?? 0} jobs`
                  : `${stats.agentJobsExtracted ?? 0} jobs${stats.agentFailures > 0 ? ` · ${stats.agentFailures} fail` : ''}`}
              </div>
            </div>

            {/* Stage 4: Deduplication */}
            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-0.5">
                <GitMerge className="w-3 h-3" />
                <span className="font-semibold text-[11px]">Deduplication</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {stats.normalizedJobs} → {stats.uniqueJobs}
              </div>
              <div className="text-[10px] text-zinc-500">records → unique</div>
            </div>

            {/* Stage 5: Matching */}
            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-semibold text-[11px]">Matching</span>
              </div>
              <div className="text-base font-bold text-white font-mono">
                {stats.uniqueJobs} → {stats.eligibleJobs}
              </div>
              <div className="text-[10px] text-zinc-500">unique → eligible</div>
            </div>
          </div>

          {(filteredCount > 0 || stats.failedSources > 0) && (
            <div className="pt-2 border-t border-zinc-800/60 space-y-1 text-xs text-zinc-500">
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
      )}
    </div>
  );
}
