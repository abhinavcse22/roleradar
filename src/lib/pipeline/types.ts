import { JobListing } from '../jobs/types';
import { MatchResult, UserPreferences } from '../matching/types';

export type PipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PipelineStats {
  searchResults: number;
  directJobCandidates: number;
  careerHubCandidates: number;
  fetchedPages: number;
  agentRuns: number;
  agentRunsStarted?: number;
  agentRunsCompleted?: number;
  agentFailures: number;
  agentJobsExtracted: number;
  normalizedJobs: number;
  uniqueJobs: number;
  eligibleJobs: number;
  failedSources: number;
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
