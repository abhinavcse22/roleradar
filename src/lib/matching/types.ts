import { SeniorityLevel, WorkMode } from '../jobs/types';

export type VisaPreference =
  | 'Any'
  | 'Sponsorship required'
  | 'No sponsorship required';

export interface UserPreferences {
  role: string;
  location: string;
  keywords?: string[];
  seniority?: SeniorityLevel | 'Any' | null;
  workMode?: WorkMode | 'Any' | null;
  visaPreference?: VisaPreference;
}

export interface MatchBreakdown {
  role: number;       // max 30
  location: number;   // max 20
  keywords: number;   // max 20
  seniority: number;  // max 10
  workMode: number;   // max 10
  visa: number;       // max 5
  freshness: number;  // max 5
}

export interface MatchResult {
  score: number;      // 0 - 100
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  breakdown: MatchBreakdown;
}
