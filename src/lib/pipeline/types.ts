import { JobListing } from '../jobs/types';
import { MatchResult, UserPreferences } from '../matching/types';

export type PipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PipelineStats {
  searchResults: number;          // Total raw search results returned across all queries
  searchQueries?: number;         // Total search query vectors generated & executed
  directJobCandidates: number;    // Search results classified as direct job postings
  careerHubCandidates: number;    // Search results classified as career hubs
  fetchAttempted?: number;        // Direct job pages dispatched to TinyFish Fetch
  fetchedPages: number;           // Direct job pages successfully fetched and verified (fetch completed)
  agentRuns: number;              // Compatibility field (alias for agentRunsCompleted)
  agentRunsStarted?: number;      // Asynchronous Agent runs actually submitted to TinyFish
  agentRunsCompleted?: number;    // Agent runs that completed successfully with valid extraction
  agentFailures: number;          // Agent runs that failed or timed out
  agentJobsExtracted: number;     // Total valid job records extracted by completed Agent runs
  normalizedJobs: number;         // Canonical JobListing records produced before deduplication
  uniqueJobs: number;             // Canonical jobs remaining after cross-source deduplication
  eligibleJobs: number;           // Unique jobs that passed hard preference filters
  filteredJobs?: number;          // Unique jobs rejected by hard preference filters (uniqueJobs - eligibleJobs)
  failedSources: number;          // Total network source failures across search, fetch, and agent
}

export type ScoredJobListing = JobListing & {
  match: MatchResult;
};

export interface AsyncAgentRunDescriptor {
  runId: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | string;
}

export interface SearchPipelineResult {
  jobs: ScoredJobListing[];
  stats: PipelineStats;
  executedAt: string;
  agentRuns?: AsyncAgentRunDescriptor[];
}

export type SearchPipelineInput = UserPreferences;
