'use client';

import React, { useState } from 'react';
import { Search, MapPin, Tag, Briefcase, Globe, Shield, Loader2 } from 'lucide-react';
import { SeniorityLevel, WorkMode } from '@/lib/jobs/types';
import { UserPreferences, VisaPreference } from '@/lib/matching/types';

interface SearchFormProps {
  isLoading: boolean;
  onSearch: (preferences: UserPreferences) => void;
}

export function SearchForm({ isLoading, onSearch }: SearchFormProps) {
  const [role, setRole] = useState('Product Manager');
  const [location, setLocation] = useState('India');
  const [keywords, setKeywords] = useState('AI');
  const [seniority, setSeniority] = useState<SeniorityLevel | 'Any'>('Any');
  const [workMode, setWorkMode] = useState<WorkMode | 'Any'>('Any');
  const [visaPreference, setVisaPreference] = useState<VisaPreference>('Any');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim() || !location.trim() || isLoading) return;

    const kwArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    onSearch({
      role: role.trim(),
      location: location.trim(),
      keywords: kwArray,
      seniority,
      workMode,
      visaPreference,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl shadow-black/40 backdrop-blur-md"
    >
      {/* Primary Row: Role & Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            Desired Role <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Product Manager, Frontend Engineer..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            Target Location <span className="text-cyan-400">*</span>
          </label>
          <input
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. India, Bengaluru, London, Remote..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all"
          />
        </div>
      </div>

      {/* Secondary Row: Keywords, Seniority, Work Mode, Visa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-zinc-500" />
            Keywords (optional)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="AI, SaaS, React..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
            Seniority
          </label>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value as SeniorityLevel | 'Any')}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all cursor-pointer"
          >
            <option value="Any">Any Seniority</option>
            <option value="Intern">Intern</option>
            <option value="Junior">Junior / Entry</option>
            <option value="Mid">Mid Level</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead / Staff</option>
            <option value="Director">Director</option>
            <option value="Executive">Executive</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-zinc-500" />
            Work Mode
          </label>
          <select
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value as WorkMode | 'Any')}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all cursor-pointer"
          >
            <option value="Any">Any Mode</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            Visa Preference
          </label>
          <select
            value={visaPreference}
            onChange={(e) => setVisaPreference(e.target.value as VisaPreference)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all cursor-pointer"
          >
            <option value="Any">Any / Not Specified</option>
            <option value="Sponsorship required">Sponsorship Required</option>
            <option value="No sponsorship required">No Sponsorship Required</option>
          </select>
        </div>
      </div>

      {/* CTA Button & Attribution */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800/60">
        <span className="text-xs text-zinc-500">
          Searches live career pages across Ashby, Greenhouse, Lever &amp; company portals.
        </span>

        <button
          type="submit"
          disabled={isLoading || !role.trim() || !location.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white font-semibold text-sm transition-all cursor-pointer shadow-md shadow-cyan-950/60"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Searching live portals...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-white" />
              <span>Find live openings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
