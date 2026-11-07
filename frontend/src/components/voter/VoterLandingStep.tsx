import React from "react";
import { Link } from "react-router-dom";
import {
  Vote,
  ShieldCheck,
  Calendar,
  ArrowRight,
  ChevronLeft,
  Info,
  AlertCircle,
  HelpCircle,
  Lock,
} from "lucide-react";

interface VoterLandingStepProps {
  electionTitle: string;
  electionDescription?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  isOpen: boolean;
  electionStatus?: string;
  electionId?: string;
  hasAccessCodes?: boolean;
  identifierLabel?: string;
  onStart: () => void;
}

const formatVotingDuration = (opensAt?: string | null, closesAt?: string | null): string => {
  if (!opensAt || !closesAt) return "(24 hours)";
  const start = new Date(opensAt).getTime();
  const end = new Date(closesAt).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return "(Until Closed)";
  const diffHours = Math.round((end - start) / (1000 * 60 * 60));
  if (diffHours < 24) return `(${diffHours} ${diffHours === 1 ? "hour" : "hours"})`;
  const diffDays = Math.round(diffHours / 24);
  if (diffHours % 24 === 0) return `(${diffDays} ${diffDays === 1 ? "day" : "days"})`;
  return `(${diffHours} hours)`;
};

const formatDateOnly = (isoStr?: string | null, fallback = "Immediate"): string => {
  if (!isoStr) return fallback;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

export const VoterLandingStep: React.FC<VoterLandingStepProps> = ({
  electionTitle,
  electionDescription,
  opensAt,
  closesAt,
  isOpen,
  electionStatus = "draft",
  hasAccessCodes = false,
  identifierLabel = "institutional email or ID",
  onStart,
}) => {
  const durationText = formatVotingDuration(opensAt, closesAt);
  const formattedStart = formatDateOnly(opensAt, "Immediate");
  const formattedEnd = formatDateOnly(closesAt, "Until Closed");

  return (
    <div className="w-full transition-all">
      {/* Top Breadcrumb Navigation */}
      <div className="mb-6">
        <Link
          to="/elections"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Elections</span>
        </Link>
      </div>

      {/* Main Container Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-8 space-y-7">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-1">
          <div className="flex items-start gap-4">
            {/* Elevated Icon Container */}
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 text-[#0055FF] dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <Vote className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] dark:text-white tracking-tight leading-snug">
                {electionTitle}
              </h1>
              <p className="text-xs sm:text-sm font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase mt-1">
                {electionDescription || "Official Institutional Election"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="sm:self-start shrink-0">
            {isOpen ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Voting Open</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="capitalize">{electionStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Metadata Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voting Window Card */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="space-y-0.5 text-xs sm:text-sm">
              <span className="font-bold text-[#0B1528] dark:text-white block">
                Voting Window
              </span>
              <span className="text-slate-600 dark:text-slate-300 block font-medium">
                {formattedStart} – {formattedEnd}
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs block">
                {durationText}
              </span>
            </div>
          </div>

          {/* Ballot Security Card */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-0.5 text-xs sm:text-sm">
              <span className="font-bold text-[#0B1528] dark:text-white block">
                Ballot Security
              </span>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Your candidate selections are cryptographically decoupled from your institutional identity.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic System Instructions Card */}
        <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl p-5 sm:p-6 border border-blue-100 dark:border-blue-900/50 space-y-4">
          <div className="flex items-center gap-2.5 text-[#0055FF] dark:text-blue-400">
            <Info className="w-5 h-5 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-[#0B1528] dark:text-white">
              Before you start
            </h2>
          </div>

          <ol className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
            {hasAccessCodes ? (
              <>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Enter the alphanumeric access code found on your physical voter slip.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Provide your Student or Institutional ID to verify eligibility.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Access your confidential ballot and review positions sequentially.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Follow the instructions to complete and cast your vote anonymously.</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Enter your approved {identifierLabel}.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>You will see a 6-digit verification code on this screen.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Enter the code to verify your session and access the ballot.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0055FF] dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Follow the instructions to complete and cast your vote anonymously.</span>
                </li>
              </>
            )}
          </ol>
        </div>

        {/* Unavailable Banner if not open */}
        {!isOpen && (
          <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {electionStatus === "draft"
                  ? "Election In Draft Preparation"
                  : electionStatus === "scheduled"
                  ? "Voting Scheduled But Not Yet Open"
                  : electionStatus === "paused"
                  ? "Voting Temporarily Paused"
                  : electionStatus === "closed"
                  ? "Election Concluded"
                  : "Voting Currently Unavailable"}
              </span>
            </div>
            <p className="text-slate-600 dark:text-amber-300/80 leading-relaxed">
              {electionStatus === "draft"
                ? "This election is currently in preparation and has not yet opened for voting. Please check back during the official voting window."
                : electionStatus === "scheduled"
                ? `This election is scheduled to open on ${opensAt ? new Date(opensAt).toLocaleString() : "the scheduled date"}.`
                : electionStatus === "paused"
                ? "This election is temporarily paused by election administrators under emergency operational protocol. Please check back shortly."
                : electionStatus === "closed"
                ? "The voting window for this election has closed. No further ballots may be submitted."
                : "Voting is not currently active for this election."}
            </p>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={!isOpen}
          onClick={onStart}
          className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          <span>Start Voting</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Footer Support and Privacy Notice */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Need help?</span>
            <a
              href="mailto:support@pollwise.io"
              className="font-semibold text-[#0055FF] dark:text-blue-400 hover:underline"
            >
              Contact election support
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Privacy Notice</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <Link
              to="/privacy"
              className="font-semibold text-[#0055FF] dark:text-blue-400 hover:underline"
            >
              Read our privacy policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
