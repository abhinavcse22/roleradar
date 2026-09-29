'use client';

import React from 'react';
import { Bot, CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';

export interface ActiveAgentRunState {
  runId: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  jobsExtracted?: number;
  error?: string | null;
}

interface AgentStatusBannerProps {
  runs: ActiveAgentRunState[];
  onCancelRun?: (runId: string) => void;
  onCancelAll?: () => void;
}

export function AgentStatusBanner({ runs, onCancelAll }: AgentStatusBannerProps) {
  if (!runs || runs.length === 0) return null;

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
  const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
  const cancelledRuns = runs.filter((r) => r.status === 'CANCELLED').length;
  const activeRuns = runs.filter((r) => r.status === 'PENDING' || r.status === 'RUNNING');
  const isAllTerminal = activeRuns.length === 0;

  const totalExtracted = runs.reduce((acc, r) => acc + (r.jobsExtracted || 0), 0);

  // Honest status summary text
  let summaryText = '';
  if (isAllTerminal) {
    if (completedRuns === totalRuns) {
      summaryText = `${completedRuns} completed · 0 running · ${totalExtracted} jobs extracted`;
    } else {
      summaryText = `${completedRuns} completed · 0 running · ${failedRuns + cancelledRuns} incomplete · ${totalExtracted} jobs extracted`;
    }
  } else {
    if (completedRuns > 0) {
      summaryText = `${totalRuns} career portals exploring · ${completedRuns} completed · ${activeRuns.length} running`;
    } else {
      summaryText = `${totalRuns} career portal${totalRuns > 1 ? 's' : ''} exploring · ${activeRuns.length} running`;
    }
  }

  const formatDomain = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return `${u.hostname}${u.pathname.length > 1 ? u.pathname.slice(0, 24) : ''}`;
    } catch {
      return urlStr.slice(0, 30);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 mb-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-purple-300">
            {isAllTerminal ? (
              <CheckCircle2 className="w-4 h-4 text-purple-300" />
            ) : (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                TinyFish Agent Background Tasks
              </span>
              {!isAllTerminal && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900/60 border border-purple-700/60 text-purple-300 font-mono animate-pulse">
                  Polling live
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-300 mt-0.5">{summaryText}</p>
          </div>
        </div>

        {!isAllTerminal && onCancelAll && (
          <button
            type="button"
            onClick={onCancelAll}
            className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel Background Tasks
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-purple-900/30">
        {runs.map((run) => {
          const isPending = run.status === 'PENDING';
          const isRunning = run.status === 'RUNNING';
          const isCompleted = run.status === 'COMPLETED';
          const isFailed = run.status === 'FAILED';
          const isCancelled = run.status === 'CANCELLED';

          return (
            <div
              key={run.runId}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate font-mono text-zinc-300" title={run.url}>
                  {formatDomain(run.url)}
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 font-mono text-[11px]">
                {isPending && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    PENDING
                  </span>
                )}
                {isRunning && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    RUNNING
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {run.jobsExtracted !== undefined && run.jobsExtracted > 0
                      ? `+${run.jobsExtracted} jobs`
                      : '0 jobs'}
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/50">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Failed
                  </span>
                )}
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
                    <XCircle className="w-2.5 h-2.5" />
                    CANCELLED
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
