'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  Loader2,
  Sparkles,
  Search,
  FileText,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { UserPreferences } from '@/lib/matching/types';
import {
  AsyncAgentRunDescriptor,
  PipelineStats,
  ScoredJobListing,
} from '@/lib/pipeline/types';
import { WorkMode } from '@/lib/jobs/types';
import { AgentJobItem } from '@/lib/tinyfish/types';
import { mergeAgentResults } from '@/lib/pipeline/mergeAgentResults';
import { SearchForm } from '@/components/SearchForm';
import { PipelineSummary } from '@/components/PipelineSummary';
import { AgentStatusBanner, ActiveAgentRunState } from '@/components/AgentStatusBanner';
import { FiltersBar } from '@/components/FiltersBar';
import { JobCard } from '@/components/JobCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface ApiResponse {
  success: boolean;
  jobs?: ScoredJobListing[];
  stats?: PipelineStats;
  executedAt?: string;
  agentRuns?: AsyncAgentRunDescriptor[];
  error?: string;
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPreferences, setLastPreferences] = useState<UserPreferences | null>(null);
  const [activeRuns, setActiveRuns] = useState<ActiveAgentRunState[]>([]);

  // Client-side filter & sort state
  const [selectedWorkMode, setSelectedWorkMode] = useState<'All' | WorkMode>('All');
  const [selectedSort, setSelectedSort] = useState<'match' | 'freshness'>('match');

  const executeSearch = async (preferences: UserPreferences) => {
    // 1. Cancel any prior in-flight background agent runs
    activeRuns
      .filter((r) => r.status === 'PENDING' || r.status === 'RUNNING')
      .forEach((r) => {
        fetch('/api/jobs/agent-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: r.runId }),
        }).catch(() => {});
      });

    setLoading(true);
    setError(null);
    setLastPreferences(preferences);
    setActiveRuns([]);

    const controller = new AbortController();
    const clientTimeout = setTimeout(() => {
      controller.abort();
    }, 25000); // 25s timeout for initial Search + Fetch response

    try {
      const response = await fetch('/api/jobs/search/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
        signal: controller.signal,
      });

      let json: ApiResponse;
      try {
        json = (await response.json()) as ApiResponse;
      } catch {
        throw new Error(
          `Server returned an invalid response (Status ${response.status}). Please try again.`
        );
      }

      if (!response.ok || !json.success) {
        throw new Error(json.error || `Search failed with status ${response.status}`);
      }

      setData(json);
      const initialRuns: ActiveAgentRunState[] = (json.agentRuns || []).map((r) => ({
        runId: r.runId,
        url: r.url,
        status: r.status,
      }));
      setActiveRuns(initialRuns);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Initial search request timed out. Please try again.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while searching live sources.'
        );
      }
    } finally {
      clearTimeout(clientTimeout);
      setLoading(false);
    }
  };

  // Poll active agent runs every 5 seconds until terminal
  useEffect(() => {
    const pendingRuns = activeRuns.filter(
      (r) => r.status === 'PENDING' || r.status === 'RUNNING'
    );
    if (pendingRuns.length === 0) return;

    const intervalId = setInterval(async () => {
      for (const run of pendingRuns) {
        try {
          const res = await fetch(
            `/api/jobs/agent-status?runId=${encodeURIComponent(run.runId)}&url=${encodeURIComponent(run.url)}`
          );
          if (!res.ok) continue;
          const statusData = (await res.json()) as {
            success: boolean;
            status: string;
            jobs?: AgentJobItem[];
            error?: string | null;
          };

          if (!statusData.success) continue;

          const newStatus = (statusData.status || '').toUpperCase();
          if (newStatus !== run.status) {
            if (newStatus === 'COMPLETED') {
              const rawJobs = statusData.jobs || [];
              if (lastPreferences) {
                setData((prev) => {
                  if (!prev || !prev.jobs) return prev;
                  const merged = mergeAgentResults(prev.jobs, rawJobs, lastPreferences);
                  const prevStats = prev.stats || {
                    searchResults: 0,
                    searchQueries: 5,
                    directJobCandidates: 0,
                    careerHubCandidates: 0,
                    fetchAttempted: 0,
                    fetchedPages: 0,
                    agentRuns: 0,
                    agentRunsStarted: activeRuns.length,
                    agentRunsCompleted: 0,
                    agentFailures: 0,
                    agentJobsExtracted: 0,
                    normalizedJobs: 0,
                    uniqueJobs: 0,
                    eligibleJobs: 0,
                    filteredJobs: 0,
                    failedSources: 0,
                  };
                  return {
                    ...prev,
                    jobs: merged.jobs,
                    stats: {
                      ...prevStats,
                      agentRuns: (prevStats.agentRunsCompleted ?? 0) + 1,
                      agentRunsCompleted: (prevStats.agentRunsCompleted ?? 0) + 1,
                      agentJobsExtracted:
                        (prevStats.agentJobsExtracted ?? 0) + rawJobs.length,
                      normalizedJobs:
                        (prevStats.normalizedJobs ?? 0) + merged.addedNormalizedCount,
                      uniqueJobs: merged.totalUniqueJobs,
                      eligibleJobs: merged.totalEligibleJobs,
                      filteredJobs: merged.totalFilteredJobs,
                    },
                  };
                });
              }
              setActiveRuns((prevRuns) =>
                prevRuns.map((r) =>
                  r.runId === run.runId
                    ? { ...r, status: 'COMPLETED', jobsExtracted: rawJobs.length }
                    : r
                )
              );
            } else if (newStatus === 'FAILED') {
              setData((prev) => {
                if (!prev || !prev.stats) return prev;
                return {
                  ...prev,
                  stats: {
                    ...prev.stats,
                    agentFailures: (prev.stats.agentFailures ?? 0) + 1,
                  },
                };
              });
              setActiveRuns((prevRuns) =>
                prevRuns.map((r) =>
                  r.runId === run.runId
                    ? { ...r, status: 'FAILED', error: statusData.error }
                    : r
                )
              );
            } else if (newStatus === 'CANCELLED') {
              setActiveRuns((prevRuns) =>
                prevRuns.map((r) =>
                  r.runId === run.runId ? { ...r, status: 'CANCELLED' } : r
                )
              );
            } else {
              setActiveRuns((prevRuns) =>
                prevRuns.map((r) =>
                  r.runId === run.runId ? { ...r, status: newStatus } : r
                )
              );
            }
          }
        } catch {
          // Ignore transient polling fetch network error
        }
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeRuns, lastPreferences]);

  const handleCancelAll = () => {
    activeRuns
      .filter((r) => r.status === 'PENDING' || r.status === 'RUNNING')
      .forEach((r) => {
        fetch('/api/jobs/agent-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: r.runId }),
        }).catch(() => {});
      });

    setActiveRuns((prev) =>
      prev.map((r) =>
        r.status === 'PENDING' || r.status === 'RUNNING'
          ? { ...r, status: 'CANCELLED' }
          : r
      )
    );
  };

  // Filter and sort the loaded job set
  const jobs = data?.jobs || [];

  const filteredJobs = jobs.filter((job) => {
    if (selectedWorkMode === 'All') return true;
    return job.workMode === selectedWorkMode;
  });

  filteredJobs.sort((a, b) => {
    if (selectedSort === 'match') {
      return b.match.score - a.match.score;
    }
    const timeA = new Date(a.checkedAt).getTime();
    const timeB = new Date(b.checkedAt).getTime();
    return timeB - timeA;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
              RR
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">RoleRadar</span>
              <span className="ml-2.5 text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-medium">
                TinyFish Drop 001
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/dev/tinyfish"
              className="text-zinc-400 hover:text-cyan-400 transition-colors flex items-center gap-1 font-mono"
            >
              <span>Developer Sandbox</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        {/* Compact Hero Section */}
        <div className="mb-5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-medium mb-2">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Live careers discovery across Ashby, Greenhouse, Lever &amp; company portals</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5">
            Find jobs that actually match you.
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            RoleRadar searches live career portals, verifies real openings, removes duplicates, and explains why each job matches your background.
          </p>
        </div>

        {/* Search Preferences Form */}
        <div className="mb-6">
          <SearchForm
            isLoading={loading}
            onSearch={executeSearch}
          />
        </div>

        {/* Honest Initial Loading State */}
        {loading && (
          <div className="py-14 text-center max-w-lg mx-auto space-y-5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white mb-1">
                Searching live career pages...
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Discovering openings with TinyFish Search, reading postings with TinyFish Fetch, and launching background Agent exploration for dynamic career hubs.
              </p>
            </div>

            {/* 3-Step Conceptual Progression */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-300">
                <Search className="w-3.5 h-3.5 mx-auto mb-1 text-cyan-400" />
                <span className="font-semibold block text-[11px]">1. Search</span>
                <span className="text-[10px] text-zinc-500">Live discovery</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-300">
                <FileText className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-400" />
                <span className="font-semibold block text-[11px]">2. Fetch</span>
                <span className="text-[10px] text-zinc-500">Verify postings</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-purple-300">
                <Bot className="w-3.5 h-3.5 mx-auto mb-1 text-purple-400" />
                <span className="font-semibold block text-[11px]">3. Agent</span>
                <span className="text-[10px] text-zinc-500">Async hub explore</span>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <ErrorState
            message={error}
            onRetry={() => {
              if (lastPreferences) {
                executeSearch(lastPreferences);
              }
            }}
          />
        )}

        {/* Initial First-Visit State */}
        {!data && !loading && !error && (
          <EmptyState mode="initial" />
        )}

        {/* Results Section */}
        {data && !loading && !error && (
          <div>
            {/* Results Header */}
            {(() => {
              const pendingAgentCount = activeRuns.filter(
                (r) => r.status === 'PENDING' || r.status === 'RUNNING'
              ).length;

              return (
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {selectedWorkMode !== 'All' && filteredJobs.length < (data.stats?.eligibleJobs ?? jobs.length)
                        ? `Showing ${filteredJobs.length} of ${data.stats?.eligibleJobs ?? jobs.length} matched jobs`
                        : `${data.stats?.eligibleJobs ?? jobs.length} jobs matched`}
                    </h2>
                    {data.stats && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {data.stats.uniqueJobs} unique jobs · {data.stats.filteredJobs ?? (data.stats.uniqueJobs - data.stats.eligibleJobs)} filtered · verified live
                      </p>
                    )}
                  </div>

                  {pendingAgentCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/60 text-purple-300 text-xs font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      <span>{pendingAgentCount} career portal{pendingAgentCount > 1 ? 's' : ''} still being explored</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Pipeline Statistics Summary */}
            {data.stats && (
              <PipelineSummary
                stats={data.stats}
                executedAt={data.executedAt}
              />
            )}

            {/* Live Async Agent Status Banner */}
            {activeRuns.length > 0 && (
              <AgentStatusBanner
                runs={activeRuns}
                onCancelAll={handleCancelAll}
              />
            )}

            {/* In-Memory Filter & Sort Bar */}
            {jobs.length > 0 && (
              <FiltersBar
                totalCount={jobs.length}
                filteredCount={filteredJobs.length}
                selectedWorkMode={selectedWorkMode}
                onWorkModeChange={setSelectedWorkMode}
                selectedSort={selectedSort}
                onSortChange={setSelectedSort}
              />
            )}

            {/* Job Listings List */}
            {filteredJobs.length > 0 ? (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <EmptyState mode="no-results" />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>RoleRadar — Live Job Discovery powered by TinyFish Web Infrastructure</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dev/tinyfish" className="hover:text-cyan-400 transition-colors">
              Developer Sandbox
            </Link>
            <span>•</span>
            <a
              href="https://agent.tinyfish.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              TinyFish Platform ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
