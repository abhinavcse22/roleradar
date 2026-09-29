'use client';

import React, { useState } from 'react';
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
import { PipelineStats, ScoredJobListing } from '@/lib/pipeline/types';
import { WorkMode } from '@/lib/jobs/types';
import { SearchForm } from '@/components/SearchForm';
import { PipelineSummary } from '@/components/PipelineSummary';
import { FiltersBar } from '@/components/FiltersBar';
import { JobCard } from '@/components/JobCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

interface ApiResponse {
  success: boolean;
  jobs?: ScoredJobListing[];
  stats?: PipelineStats;
  executedAt?: string;
  error?: string;
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPreferences, setLastPreferences] = useState<UserPreferences | null>(null);

  // Client-side filter & sort state
  const [selectedWorkMode, setSelectedWorkMode] = useState<'All' | WorkMode>('All');
  const [selectedSort, setSelectedSort] = useState<'match' | 'freshness'>('match');

  const executeSearch = async (preferences: UserPreferences) => {
    setLoading(true);
    setError(null);
    setLastPreferences(preferences);

    const controller = new AbortController();
    const clientTimeout = setTimeout(() => {
      controller.abort();
    }, 45000); // 45s safety timeout

    try {
      const response = await fetch('/api/jobs/search', {
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Search request timed out after 45 seconds. Please try again.');
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
        <div className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live careers discovery across Ashby, Greenhouse, Lever &amp; company portals</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Find jobs that actually match you.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            RoleRadar searches live career pages and job portals, verifies openings, removes duplicates, and explains why each role matches your preferences.
          </p>
        </div>

        {/* Search Preferences Form */}
        <div className="mb-10">
          <SearchForm
            isLoading={loading}
            onSearch={executeSearch}
          />
        </div>

        {/* Honest Loading State */}
        {loading && (
          <div className="py-16 text-center max-w-lg mx-auto space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white mb-1.5">
                Searching live career pages...
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Discovering current openings, reading live job pages with TinyFish Fetch, and exploring dynamic career hubs with TinyFish Agent.
              </p>
            </div>

            {/* 3-Step Conceptual Progression */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-300">
                <Search className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
                <span className="font-semibold block">1. Search</span>
                <span className="text-[10px] text-zinc-500">Live discovery</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-300">
                <FileText className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <span className="font-semibold block">2. Fetch</span>
                <span className="text-[10px] text-zinc-500">Verify postings</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-purple-300">
                <Bot className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                <span className="font-semibold block">3. Agent</span>
                <span className="text-[10px] text-zinc-500">Dynamic hubs</span>
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
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/80 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {data.stats ? `${data.stats.eligibleJobs} jobs matched` : `${filteredJobs.length} jobs matched`}
                </h2>
                {data.stats && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {data.stats.uniqueJobs} unique jobs found ·{' '}
                    {data.stats.uniqueJobs - data.stats.eligibleJobs} filtered by criteria · verified live
                  </p>
                )}
              </div>
            </div>

            {/* Pipeline Statistics Summary */}
            {data.stats && (
              <PipelineSummary
                stats={data.stats}
                executedAt={data.executedAt}
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
