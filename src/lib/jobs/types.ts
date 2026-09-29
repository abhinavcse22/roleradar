export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type SeniorityLevel =
  | 'Intern'
  | 'Junior'
  | 'Mid'
  | 'Senior'
  | 'Lead'
  | 'Director'
  | 'Executive';
export type WorkMode = 'Remote' | 'Hybrid' | 'On-site';
export type JobSourceType = 'search' | 'fetch' | 'agent' | 'merged';

export interface JobProvenance {
  source: 'search' | 'fetch' | 'agent';
  url: string;
  timestamp: string;
  details?: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string | null;
  employmentType: EmploymentType | null;
  seniority: SeniorityLevel | null;
  workMode: WorkMode | null;
  description: string;
  requirements: string[];
  keywords: string[];
  source: JobSourceType;
  sourceUrl: string;
  applyUrl: string;
  checkedAt: string;
  provenance: JobProvenance[];
}
