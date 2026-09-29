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

export interface SearchPipelineResult {
  jobs: ScoredJobListing[];
  stats: PipelineStats;
  executedAt: string;
}

export type SearchPipelineInput = UserPreferences;
