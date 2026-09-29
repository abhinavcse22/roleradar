'use client';

import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { ScoredJobListing } from '@/lib/pipeline/types';

interface JobCardProps {
  job: ScoredJobListing;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'recently';
  }
}

function getProvenanceLabel(job: ScoredJobListing): string {
  const sources = Array.from(new Set((job.provenance || []).map((p) => p.source)));

  if (sources.includes('agent')) {
    if (sources.includes('fetch')) {
      return 'Discovered via Agent · verified via Fetch';
    }
    return 'Discovered & extracted via TinyFish Agent';
  }

  if (sources.includes('fetch')) {
    if (sources.includes('search')) {
      return 'Discovered via Search · verified via TinyFish Fetch';
    }
    return 'Verified via TinyFish Fetch';
  }

  return 'Discovered via TinyFish Search';
}

export function JobCard({ job }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { score, reasons, warnings, breakdown } = job.match;

  // Determine score color badge
  const scoreBadgeColor =
    score >= 80
      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
      : score >= 65
      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  const provenanceLabel = getProvenanceLabel(job);

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all shadow-md">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {job.workMode && (
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700/60">
              {job.workMode}
            </span>
          )}
          {job.employmentType && (
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700/60">
              {job.employmentType}
            </span>
          )}
          {job.seniority && (
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700/60">
              {job.seniority}
            </span>
          )}
        </div>

        {/* Match Score Badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono border ${scoreBadgeColor}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{score}% Match</span>
        </div>
      </div>

      {/* Title & Company */}
      <div className="mb-3">
        <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
          {job.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-zinc-300">
          <span className="flex items-center gap-1 font-medium text-zinc-200">
            <Building2 className="w-4 h-4 text-zinc-400" />
            {job.company}
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1 text-zinc-400 text-xs">
            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
            {job.location}
          </span>
        </div>
      </div>

      {/* Match Reasons & Warnings */}
      <div className="my-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
          Why this matches
        </span>

        {/* Reasons */}
        {reasons && reasons.length > 0 ? (
          reasons.slice(0, 4).map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2 text-zinc-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{reason}</span>
            </div>
          ))
        ) : (
          <div className="text-zinc-500 text-xs">Meets basic candidate criteria</div>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
            {warnings.map((warn, idx) => (
              <div key={idx} className="flex items-start gap-2 text-amber-300/90">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsed Description Snippet */}
      {job.description && !expanded && (
        <p className="text-xs text-zinc-400 leading-relaxed mb-4 line-clamp-2">
          {job.description}
        </p>
      )}

      {/* Expanded Details Section */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4 text-xs">
          {/* Full description */}
          <div>
            <span className="font-semibold text-zinc-300 block mb-1">About the Role</span>
            <p className="text-zinc-400 whitespace-pre-line leading-relaxed">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <span className="font-semibold text-zinc-300 block mb-1">
                Extracted Requirements
              </span>
              <ul className="space-y-1 text-zinc-300 list-disc list-inside">
                {job.requirements.map((req, rIdx) => (
                  <li key={rIdx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detected Keywords */}
          {job.keywords && job.keywords.length > 0 && (
            <div>
              <span className="font-semibold text-zinc-300 block mb-1">
                Detected Technology & Domain Tags
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {job.keywords.map((kw, kIdx) => (
                  <span
                    key={kIdx}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] font-mono"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown chips */}
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            <span className="font-bold text-zinc-300 block mb-1">Score Breakdown (out of 100)</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Role: {breakdown.role}/30</span>
              <span>Location: {breakdown.location}/20</span>
              <span>Keywords: {breakdown.keywords}/20</span>
              <span>Seniority: {breakdown.seniority}/10</span>
              <span>Work Mode: {breakdown.workMode}/10</span>
              <span>Visa: {breakdown.visa}/5</span>
              <span>Freshness: {breakdown.freshness}/5</span>
            </div>
          </div>
        </div>
      )}

      {/* Card Footer: Verification, Expand, Apply CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/60 mt-3">
        {/* Source & Freshness Metadata */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>Verified live · {formatTimeAgo(job.checkedAt)}</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono truncate max-w-xs">
            {provenanceLabel}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>{expanded ? 'Hide details' : 'View details'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {job.applyUrl ? (
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <span>Apply</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-xs text-zinc-500 italic">
              Application link unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
