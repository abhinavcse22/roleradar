'use client';

import { useState } from 'react';
import {
  Search,
  ExternalLink,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  ArrowRight,
  Copy,
  Check,
  Bot,
  Sparkles,
  MapPin,
  Building,
} from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  position: number;
}

interface SearchApiResponse {
  success: boolean;
  query?: string;
  endpoint?: string;
  totalResults?: number;
  results?: SearchResult[];
  checkedAt?: string;
  error?: string;
}

interface FetchResult {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  language: string;
  content: string;
  contentLength: number;
  latencyMs?: number;
  domain: string;
  checkedAt: string;
}

interface FetchApiResponse {
  success: boolean;
  endpoint?: string;
  result?: FetchResult;
  error?: string;
}

interface AgentJob {
  title: string;
  company: string;
  location: string;
  employment_type: string | null;
  work_mode: string | null;
  description: string;
  requirements: string[];
  apply_url: string;
  source_url: string;
}

interface AgentProgressState {
  connecting: boolean;
  running: boolean;
  currentPurpose?: string;
  streamingUrl?: string;
  events: string[];
}

export default function DevTinyFishPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'fetch' | 'agent'>('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('Product Manager AI India jobs');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchData, setSearchData] = useState<SearchApiResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch state
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchData, setFetchData] = useState<FetchApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Agent state
  const [agentUrl, setAgentUrl] = useState('https://www.sarvam.ai/careers');
  const [agentRole, setAgentRole] = useState('Product Manager');
  const [agentLocation, setAgentLocation] = useState('India');
  const [agentKeywords, setAgentKeywords] = useState('AI, SaaS');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgressState>({
    connecting: false,
    running: false,
    events: [],
  });
  const [agentJobs, setAgentJobs] = useState<AgentJob[]>([]);
  const [agentResultMeta, setAgentResultMeta] = useState<{
    status: string;
    runId?: string;
    checkedAt?: string;
  } | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(null);
    setSearchData(null);

    try {
      const res = await fetch(`/api/tinyfish/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const json: SearchApiResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP error ${res.status}`);
      }
      setSearchData(json);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Failed to execute TinyFish search');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFetch = async (e?: React.FormEvent, targetUrlOverride?: string) => {
    if (e) e.preventDefault();
    const urlToFetch = targetUrlOverride || fetchUrl;
    if (!urlToFetch.trim()) return;

    setFetchLoading(true);
    setFetchError(null);
    setFetchData(null);

    try {
      const res = await fetch(`/api/tinyfish/fetch?url=${encodeURIComponent(urlToFetch.trim())}`);
      const json: FetchApiResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP error ${res.status}`);
      }
      setFetchData(json);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch page with TinyFish');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleAgent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!agentUrl.trim()) return;

    setAgentLoading(true);
    setAgentError(null);
    setAgentJobs([]);
    setAgentResultMeta(null);
    setAgentProgress({
      connecting: true,
      running: false,
      events: ['Connecting to TinyFish Agent...'],
    });

    try {
      const queryParams = new URLSearchParams({
        url: agentUrl.trim(),
        role: agentRole.trim(),
        location: agentLocation.trim(),
        keywords: agentKeywords.trim(),
        stream: 'true',
      });

      const response = await fetch(`/api/tinyfish/agent?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No readable response body received from server.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            if (event.type === 'CONNECTING') {
              setAgentProgress((prev) => ({
                ...prev,
                connecting: true,
                running: false,
                events: [...prev.events, event.message || 'Connecting...'],
              }));
            } else if (event.type === 'STARTED') {
              setAgentProgress((prev) => ({
                ...prev,
                connecting: false,
                running: true,
                events: [...prev.events, `Started agent run (ID: ${event.run_id || 'active'})`],
              }));
            } else if (event.type === 'STREAMING_URL') {
              setAgentProgress((prev) => ({
                ...prev,
                streamingUrl: event.streaming_url,
                events: [...prev.events, 'Live browser streaming session initialized'],
              }));
            } else if (event.type === 'PROGRESS') {
              setAgentProgress((prev) => ({
                ...prev,
                currentPurpose: event.purpose,
                events: event.purpose ? [...prev.events, event.purpose] : prev.events,
              }));
            } else if (event.type === 'DONE') {
              setAgentJobs(event.jobs || []);
              setAgentResultMeta({
                status: event.status || 'COMPLETED',
                runId: event.runId,
                checkedAt: event.checkedAt,
              });
              if (event.error) {
                setAgentError(event.error);
              }
            } else if (event.type === 'ERROR') {
              setAgentError(event.error || 'Agent encountered an error');
            }
          } catch {
            // Ignore parse errors on individual stream lines
          }
        }
      }
    } catch (err: unknown) {
      setAgentError(err instanceof Error ? err.message : 'Failed to execute Agent run');
    } finally {
      setAgentLoading(false);
      setAgentProgress((prev) => ({
        ...prev,
        connecting: false,
        running: false,
      }));
    }
  };

  const loadUrlIntoFetch = (url: string) => {
    setFetchUrl(url);
    setActiveTab('fetch');
    handleFetch(undefined, url);
  };

  const loadUrlIntoAgent = (url: string) => {
    setAgentUrl(url);
    setActiveTab('agent');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
              RR
            </Link>
            <div>
              <span className="font-semibold text-zinc-100 tracking-tight">RoleRadar</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                Developer • TinyFish Integration Sandbox
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-100 mr-2 transition-colors"
            >
              ← Back to App
            </Link>
            <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'search'
                    ? 'bg-cyan-950 text-cyan-300 font-medium border border-cyan-800'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                1. Search
              </button>
              <button
                onClick={() => setActiveTab('fetch')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'fetch'
                    ? 'bg-cyan-950 text-cyan-300 font-medium border border-cyan-800'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                2. Fetch
              </button>
              <button
                onClick={() => setActiveTab('agent')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'agent'
                    ? 'bg-cyan-950 text-cyan-300 font-medium border border-cyan-800'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                3. Agent
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        {/* AGENT TAB */}
        {activeTab === 'agent' && (
          <div>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Agent is used here for browser interaction / dynamic extraction.
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                TinyFish Agent Test
              </h1>
              <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
                Connects to the official TinyFish Agent SSE endpoint (
                <code className="text-cyan-400 font-mono text-xs">
                  POST https://agent.tinyfish.ai/v1/automation/run-sse
                </code>
                ) to autonomously navigate dynamic career pages and extract structured job listings.
              </p>
            </div>

            {/* Agent Input Form */}
            <form onSubmit={handleAgent} className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 mb-8 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Careers page URL
                </label>
                <input
                  type="url"
                  value={agentUrl}
                  onChange={(e) => setAgentUrl(e.target.value)}
                  placeholder="https://example.com/careers"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Role
                  </label>
                  <input
                    type="text"
                    value={agentRole}
                    onChange={(e) => setAgentRole(e.target.value)}
                    placeholder="Product Manager"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={agentLocation}
                    onChange={(e) => setAgentLocation(e.target.value)}
                    placeholder="India"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Keywords
                  </label>
                  <input
                    type="text"
                    value={agentKeywords}
                    onChange={(e) => setAgentKeywords(e.target.value)}
                    placeholder="AI, SaaS"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Targeted extraction with structured JSON schema
                </span>
                <button
                  type="submit"
                  disabled={agentLoading || !agentUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-cyan-950"
                >
                  {agentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Agent Running...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>Run Agent</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Notification */}
            {agentError && (
              <div className="mb-8 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-200">Agent Error</div>
                  <div className="mt-1 font-mono text-xs text-red-300/90">{agentError}</div>
                </div>
              </div>
            )}

            {/* Live Progress Box */}
            {agentLoading && (
              <div className="mb-8 p-5 rounded-2xl bg-zinc-900/80 border border-cyan-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {agentProgress.connecting
                        ? 'Connecting to TinyFish Agent...'
                        : 'Agent executing browser workflow...'}
                    </span>
                  </div>
                  {agentProgress.streamingUrl && (
                    <a
                      href={agentProgress.streamingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-300 hover:underline flex items-center gap-1 font-mono"
                    >
                      View Live Browser Stream <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {agentProgress.currentPurpose && (
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 font-mono">
                    <strong className="text-cyan-400">Current Action:</strong>{' '}
                    {agentProgress.currentPurpose}
                  </div>
                )}

                {/* Event log */}
                <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono text-zinc-400 border-t border-zinc-800 pt-2">
                  {agentProgress.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-zinc-600">[{i + 1}]</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Results Status */}
            {agentResultMeta && (
              <div className="mb-6 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Status:{' '}
                    <strong className="text-emerald-400 uppercase font-mono">
                      {agentResultMeta.status}
                    </strong>{' '}
                    • Extracted <strong className="text-zinc-100">{agentJobs.length}</strong>{' '}
                    structured jobs
                  </span>
                </div>
                {agentResultMeta.checkedAt && (
                  <span className="text-zinc-500 font-mono">
                    Verified: {new Date(agentResultMeta.checkedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {/* Extracted Jobs List */}
            {agentJobs.length > 0 ? (
              <div className="space-y-4">
                {agentJobs.map((job, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium mb-1">
                          <Building className="w-3.5 h-3.5" />
                          <span>{job.company || 'Company'}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="flex items-center gap-1 text-zinc-400">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight">
                          {job.title}
                        </h2>
                      </div>
                      <a
                        href={job.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors"
                      >
                        Apply Link <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-2 my-3">
                      {job.employment_type && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono">
                          {job.employment_type}
                        </span>
                      )}
                      {job.work_mode && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono">
                          {job.work_mode}
                        </span>
                      )}
                    </div>

                    {job.description && (
                      <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-3">
                        {job.description}
                      </p>
                    )}

                    {job.requirements && job.requirements.length > 0 && (
                      <div className="pt-3 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1.5">
                          Requirements
                        </span>
                        <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                          {job.requirements.slice(0, 4).map((req, rIdx) => (
                            <li key={rIdx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !agentLoading &&
              agentResultMeta && (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  No matching open jobs found on this careers page for the requested filters.
                </div>
              )
            )}
          </div>
        )}

        {/* FETCH TAB */}
        {activeTab === 'fetch' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                TinyFish Fetch Test
              </h1>
              <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
                Reads any live web page and extracts clean, token-efficient markdown using the
                official TinyFish Fetch REST endpoint (
                <code className="text-cyan-400 font-mono text-xs">POST https://api.fetch.tinyfish.ai</code>
                ).
              </p>
            </div>

            {/* Fetch Input Form */}
            <form onSubmit={handleFetch} className="mb-8 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                URL
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="paste a live job URL here (e.g. from Search tab)"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all font-mono"
                />
                <button
                  type="submit"
                  disabled={fetchLoading || !fetchUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-cyan-950 shrink-0"
                >
                  {fetchLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching page...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Fetch live page</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Notification */}
            {fetchError && (
              <div className="mb-8 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-200">Fetch Error</div>
                  <div className="mt-1 font-mono text-xs text-red-300/90">{fetchError}</div>
                </div>
              </div>
            )}

            {/* Fetch Results Card */}
            {fetchData && fetchData.result && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold font-mono">
                        Page Title
                      </span>
                      <h2 className="text-xl font-bold text-white mt-1">
                        {fetchData.result.title}
                      </h2>
                    </div>
                    <a
                      href={fetchData.result.finalUrl || fetchData.result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                    >
                      Visit Fetched Page <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Domain</span>
                      <span className="text-zinc-200 font-mono mt-0.5 block truncate">
                        {fetchData.result.domain || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Content Length</span>
                      <span className="text-zinc-200 font-semibold mt-0.5 block">
                        {fetchData.result.contentLength.toLocaleString()} characters
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Latency</span>
                      <span className="text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fetchData.result.latencyMs !== undefined
                          ? `${fetchData.result.latencyMs}ms`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Language</span>
                      <span className="text-zinc-200 mt-0.5 block uppercase font-mono">
                        {fetchData.result.language || 'en'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 font-mono pt-2 border-t border-zinc-800/60 truncate">
                    Final URL: {fetchData.result.finalUrl}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-zinc-300">
                      Extracted Markdown Content Preview
                    </span>
                    <span>{fetchData.result.contentLength} characters</span>
                  </div>
                  <div className="p-6 max-h-[500px] overflow-y-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {fetchData.result.content || '(No text content extracted)'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                TinyFish Search Connectivity
              </h1>
              <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
                Testing live web discovery via the official TinyFish Search REST endpoint (
                <code className="text-cyan-400 font-mono text-xs">GET https://api.search.tinyfish.ai</code>
                ). Click <strong>&quot;Test Fetch&quot;</strong> to read with Fetch or <strong>&quot;Send to Agent&quot;</strong> to extract with Agent.
              </p>
            </div>

            {/* Search Input Box */}
            <form onSubmit={handleSearch} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter query (e.g. Product Manager AI India jobs)..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-cyan-950"
                >
                  {searchLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Test Search</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Notification */}
            {searchError && (
              <div className="mb-8 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-200">Search Error</div>
                  <div className="mt-1 font-mono text-xs text-red-300/90">{searchError}</div>
                </div>
              </div>
            )}

            {/* Success Status Banner */}
            {searchData && (
              <div className="mb-6 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Found <strong className="text-zinc-200">{searchData.totalResults ?? 0}</strong> live
                    results from{' '}
                    <code className="text-cyan-400 font-mono">{searchData.endpoint}</code>
                  </span>
                </div>
                {searchData.checkedAt && (
                  <span className="text-zinc-500">
                    Verified at: {new Date(searchData.checkedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {/* Results List */}
            {searchData && searchData.results && searchData.results.length > 0 && (
              <div className="space-y-3">
                {searchData.results.map((item, index) => (
                  <div
                    key={item.url || index}
                    className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          #{item.position}
                        </span>
                        {item.domain && (
                          <span className="flex items-center gap-1 text-xs text-cyan-400/90 font-mono">
                            <Globe className="w-3 h-3" />
                            {item.domain}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(item.url)}
                          className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/60 flex items-center gap-1 transition-colors"
                          title="Copy URL"
                        >
                          {copiedUrl === item.url ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => loadUrlIntoFetch(item.url)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-800 flex items-center gap-1 transition-colors font-medium"
                        >
                          Test Fetch <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => loadUrlIntoAgent(item.url)}
                          className="text-xs text-purple-400 hover:text-purple-300 px-2.5 py-1 rounded bg-purple-950/60 border border-purple-800 flex items-center gap-1 transition-colors font-medium"
                        >
                          Send to Agent <Bot className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-semibold text-zinc-100 hover:text-cyan-300 transition-colors">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    </h3>

                    {item.snippet && (
                      <p className="mt-2 text-sm text-zinc-400 leading-relaxed line-clamp-3">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
