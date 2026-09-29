// --- Search Types ---

export interface TinyFishSearchResultItem {
  position?: number;
  title: string;
  url: string;
  snippet?: string;
  site_name?: string;
  [key: string]: unknown;
}

export interface TinyFishSearchApiResponse {
  query?: string;
  results?: TinyFishSearchResultItem[];
  total_results?: number;
  page?: number;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface NormalizedSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  position: number;
}

export interface SearchOptions {
  location?: string;
  language?: string;
  timeoutMs?: number;
}

// --- Fetch Types ---

export interface TinyFishFetchResultItem {
  url: string;
  final_url?: string;
  title?: string;
  description?: string | null;
  language?: string | null;
  text?: string;
  author?: string | null;
  published_date?: string | null;
  latency_ms?: number;
  format?: string;
  [key: string]: unknown;
}

export interface TinyFishFetchErrorItem {
  url?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface TinyFishFetchApiResponse {
  results?: TinyFishFetchResultItem[];
  errors?: TinyFishFetchErrorItem[];
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface NormalizedFetchResult {
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

export interface FetchOptions {
  format?: 'markdown' | 'json' | 'html';
  timeoutMs?: number;
}

// --- Agent Types ---

export interface AgentJobItem {
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

export interface AgentExtractionResult {
  jobs: AgentJobItem[];
  [key: string]: unknown;
}

export interface TinyFishAgentSSEEvent {
  type: 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE' | string;
  run_id?: string;
  status?: string;
  purpose?: string;
  streaming_url?: string;
  timestamp?: string;
  result?: unknown;
  resultJson?: unknown;
  result_json?: unknown;
  error?: string | { message?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface NormalizedAgentRunResult {
  success: boolean;
  runId?: string;
  status: string;
  jobs: AgentJobItem[];
  rawResult?: unknown;
  error?: string;
  eventsObserved: string[];
  lastPurpose?: string;
  checkedAt: string;
}

export interface AgentRunParams {
  url: string;
  role: string;
  location: string;
  keywords: string[];
  timeoutMs?: number;
  onProgress?: (event: TinyFishAgentSSEEvent) => void;
}

export type TinyFishRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | string;

export interface AsyncAgentRunStartResult {
  runId: string;
  url: string;
  status: TinyFishRunStatus;
  error?: string | null;
}

export interface AsyncAgentRunStatusResult {
  runId: string;
  status: TinyFishRunStatus;
  jobs: AgentJobItem[];
  error?: string | null;
  rawResult?: unknown;
  finishedAt?: string | null;
}

export interface AsyncAgentCancelResult {
  runId: string;
  status: 'CANCELLED' | string;
  cancelledAt?: string | null;
  message?: string | null;
}
