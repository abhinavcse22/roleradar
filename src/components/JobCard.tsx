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
} from 'lucide-react';
import { ScoredJobListing } from '@/lib/pipeline/types';

interface JobCardProps {
  job: ScoredJobListing;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs)) return 'recently';
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

export function getProvenanceLabel(job: ScoredJobListing): string {
  const sources = Array.from(new Set((job.provenance || []).map((p) => p.source)));

  if (sources.includes('agent')) {
    if (sources.includes('fetch')) {
      return 'Discovered via Agent · verified via Fetch';
    }
    return 'Discovered by TinyFish Agent';
  }

  if (sources.includes('fetch')) {
    if (sources.includes('search')) {
      return 'Discovered via Search · verified via Fetch';
    }
    return 'Verified via TinyFish Fetch';
  }

  return 'Discovered via TinyFish Search';
}

export function cleanJobDescription(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#+\s+/gm, '') // Remove markdown headers (#, ##, ###)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove markdown bold/italics
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
    .trim();
}

/**
 * Checks if a dimension was neutral for this job match.
 * In our scoring model, neutral dimensions earn 0 points and generate neither reasons nor warnings.
 */
export function isDimensionNeutral(
  job: ScoredJobListing,
  dimension: 'keywords' | 'seniority' | 'workMode' | 'visa'
): boolean {
  const { breakdown, reasons = [], warnings = [] } = job.match;
  const combinedFeedback = [...reasons, ...warnings].join(' ').toLowerCase();

  switch (dimension) {
    case 'keywords':
      return breakdown.keywords === 0 && !combinedFeedback.includes('keyword');
    case 'seniority':
      return breakdown.seniority === 0 && !combinedFeedback.includes('seniority') && !combinedFeedback.includes('experience');
    case 'workMode':
      return breakdown.workMode === 0 && !combinedFeedback.includes('work mode') && !combinedFeedback.includes('remote') && !combinedFeedback.includes('hybrid') && !combinedFeedback.includes('on-site');
    case 'visa':
      return breakdown.visa === 0 && !combinedFeedback.includes('visa') && !combinedFeedback.includes('sponsorship');
    default:
      return false;
  }
}

export function JobCard({ job }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [showAllReqs, setShowAllReqs] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { score, reasons = [], warnings = [], breakdown } = job.match;

  // Determine restrained score badge color
  const scoreBadgeColor =
    score >= 85
      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80'
      : score >= 70
      ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80'
      : score >= 50
      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
      : 'bg-zinc-900 text-zinc-400 border-zinc-800';

  const provenanceLabel = getProvenanceLabel(job);
  const cleanedDescription = cleanJobDescription(job.description || '');

  // Meaningful metadata tags (exclude empty, null, or placeholder values)
  const metaBadges: string[] = [];
  if (job.workMode) {
    metaBadges.push(job.workMode);
  }
  if (
    job.employmentType &&
    !['unknown', 'not disclosed', 'null', 'undisclosed'].includes(job.employmentType.toLowerCase())
  ) {
    metaBadges.push(job.employmentType);
  }
  if (job.seniority) {
    metaBadges.push(job.seniority);
  }

  const displayReasons = showAllReasons ? reasons : reasons.slice(0, 3);
  const hasMoreReasons = reasons.length > 3;

  const validReqs = (job.requirements || []).filter((r) => r && r.trim().length > 0);
  const displayReqs = showAllReqs ? validReqs : validReqs.slice(0, 4);
  const hasMoreReqs = validReqs.length > 4;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-md shadow-black/30">
      {/* Top Header: Title, Company, Location & Score */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug break-words">
            {job.title}
          </h3>

          {/* Company · Location */}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-zinc-300">
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-200">
              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{job.company || 'Company not specified'}</span>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="inline-flex items-center gap-1 text-zinc-400 text-xs">
              <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>{job.location || 'Location not specified'}</span>
            </span>
          </div>
        </div>

        {/* Match Score Badge */}
        <div className="shrink-0 self-start sm:self-auto">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold font-mono border ${scoreBadgeColor}`}
          >
            <span>{score}% Match</span>
          </div>
        </div>
      </div>

      {/* Metadata Row: Badges (Work Mode, Employment Type, Seniority) */}
      {metaBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {metaBadges.map((badge, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 text-[11px] font-mono border border-zinc-700/60"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Why this matches & Warnings (Top scannable evidence) */}
      <div className="my-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 space-y-1.5 text-xs">
        {/* Reasons */}
        {displayReasons.length > 0 ? (
          displayReasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2 text-zinc-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{reason}</span>
            </div>
          ))
        ) : (
          <div className="text-zinc-500 text-xs">Meets basic candidate criteria</div>
        )}

        {/* Expand more reasons button */}
        {hasMoreReasons && (
          <button
            type="button"
            onClick={() => setShowAllReasons(!showAllReasons)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium pl-5.5 cursor-pointer pt-0.5 transition-colors"
          >
            {showAllReasons ? 'Show less' : `+${reasons.length - 3} more match reasons`}
          </button>
        )}

        {/* Meaningful Warnings */}
        {warnings.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/60 space-y-1">
            {warnings.map((warn, idx) => (
              <div key={idx} className="flex items-start gap-2 text-amber-300/90">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{warn}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Inline Details Section */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-4 text-xs">
          {/* About the role / Description */}
          {cleanedDescription && (
            <div>
              <span className="font-semibold text-zinc-200 block mb-1 text-xs uppercase tracking-wider">
                About the role
              </span>
              <p className="text-zinc-300/90 whitespace-pre-line leading-relaxed text-xs">
                {cleanedDescription}
              </p>
            </div>
          )}

          {/* Requirements */}
          {validReqs.length > 0 && (
            <div>
              <span className="font-semibold text-zinc-200 block mb-1.5 text-xs uppercase tracking-wider">
                Requirements
              </span>
              <ul className="space-y-1.5 text-zinc-300">
                {displayReqs.map((req, rIdx) => (
                  <li key={rIdx} className="flex items-start gap-2">
                    <span className="text-cyan-400 leading-none mt-1">•</span>
                    <span className="leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
              {hasMoreReqs && (
                <button
                  type="button"
                  onClick={() => setShowAllReqs(!showAllReqs)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium pl-3 cursor-pointer pt-1 transition-colors"
                >
                  {showAllReqs ? 'Show fewer requirements' : `+${validReqs.length - 4} more requirements`}
                </button>
              )}
            </div>
          )}

          {/* Keywords */}
          {job.keywords && job.keywords.length > 0 && (
            <div>
              <span className="font-semibold text-zinc-200 block mb-1.5 text-xs uppercase tracking-wider">
                Extracted Skills &amp; Domain Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {job.keywords.map((kw, kIdx) => (
                  <span
                    key={kIdx}
                    className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-zinc-700/60"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Match Breakdown Section */}
          <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBreakdown(!showBreakdown)}
              aria-expanded={showBreakdown}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors cursor-pointer"
            >
              <span className="text-xs font-semibold text-zinc-300">
                Match breakdown (Score: {score}%)
              </span>
              <span className="text-[11px] text-cyan-400 inline-flex items-center gap-1 font-medium">
                <span>{showBreakdown ? 'Hide points' : 'View points'}</span>
                {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>

            {showBreakdown && (
              <div className="p-3 pt-0 border-t border-zinc-800/60 font-mono text-[11px]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5">
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Role</span>
                    <span className="text-white font-bold">{breakdown.role} / 30</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Location</span>
                    <span className="text-white font-bold">{breakdown.location} / 20</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Keywords</span>
                    <span className="text-white font-bold">
                      {isDimensionNeutral(job, 'keywords') ? '—' : `${breakdown.keywords} / 20`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Seniority</span>
                    <span className="text-white font-bold">
                      {isDimensionNeutral(job, 'seniority') ? '—' : `${breakdown.seniority} / 10`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Work Mode</span>
                    <span className="text-white font-bold">
                      {isDimensionNeutral(job, 'workMode') ? '—' : `${breakdown.workMode} / 10`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Visa</span>
                    <span className="text-white font-bold">
                      {isDimensionNeutral(job, 'visa') ? '—' : `${breakdown.visa} / 5`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800/60">
                    <span className="text-zinc-500 block">Freshness</span>
                    <span className="text-white font-bold">{breakdown.freshness} / 5</span>
                  </div>
                  <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800/40">
                    <span className="text-cyan-400 block">Final Match</span>
                    <span className="text-cyan-200 font-bold">{score}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Footer: Verification Metadata, View Details Toggle & Apply CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/60 mt-3">
        {/* Verification & Source Provenance */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Verified live · {formatTimeAgo(job.checkedAt)}</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono truncate max-w-xs">
            {provenanceLabel}
          </div>
        </div>

        {/* Action Buttons: View details & Apply */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{expanded ? 'Hide details' : 'View details'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {job.applyUrl && job.applyUrl.trim().length > 0 ? (
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
            <span className="text-xs text-zinc-500 italic px-2 py-1">
              Application link unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
