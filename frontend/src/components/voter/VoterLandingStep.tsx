import React from "react";
import {
  Vote,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Info,
  AlertCircle,
  HelpCircle,
  Lock,
} from "lucide-react";
import { getAssetUrl } from "../../lib/api-client";

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
  electionPhotoUrl?: string | null;
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
  electionPhotoUrl,
  onStart,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const durationText = formatVotingDuration(opensAt, closesAt);
  const formattedStart = formatDateOnly(opensAt, "Immediate");
  const formattedEnd = formatDateOnly(closesAt, "Until Closed");

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Top Main Section: Election Header, Flat Metadata, Instructions, and Action Button */}
      <div className="space-y-6">
        {/* Header Block at the very top */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1">
          <div className="flex items-start gap-3.5">
            {/* Circular Profile Picture (PFP) with Fallback */}
            {electionPhotoUrl && !imageError ? (
              <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-50 shrink-0 shadow-xs">
                <img
                  src={getAssetUrl(electionPhotoUrl)}
                  alt={`${electionTitle} logo`}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-[#0055FF] flex items-center justify-center shrink-0 shadow-xs">
                <Vote className="w-6 h-6" />
              </div>
            )}

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
                {electionTitle}
              </h1>
              <p className="text-xs sm:text-sm font-semibold tracking-wider text-slate-500 uppercase mt-1">
                {electionDescription || "Official Institutional Election"}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="sm:self-start shrink-0">
            {isOpen ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Voting Open</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="capitalize">{electionStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flat Metadata Row (Voting Window & Ballot Security) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-3 sm:pt-5 pb-1">
          {/* Voting Window */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#0055FF] mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-xs sm:text-sm">
              <span className="font-bold text-[#0B1528] block">
                Voting Window
              </span>
              <span className="text-slate-600 block font-medium">
                {formattedStart} – {formattedEnd}
              </span>
              <span className="text-slate-400 text-xs block">
                {durationText}
              </span>
            </div>
          </div>

          {/* Ballot Security with subtle divider on sm screens */}
          <div className="flex items-start gap-3 sm:border-l sm:border-slate-200 sm:pl-6">
            <ShieldCheck className="w-5 h-5 text-[#0055FF] mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-xs sm:text-sm">
              <span className="font-bold text-[#0B1528] block">
                Ballot Security
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                Your candidate selections are cryptographically decoupled from your institutional identity.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic System Instructions Card */}
        <div className="bg-blue-50/70 rounded-2xl p-4 sm:p-5 border border-blue-100 space-y-3.5">
          <div className="flex items-center gap-2.5 text-[#0055FF]">
            <Info className="w-4 h-4 shrink-0" />
            <h2 className="text-sm font-bold text-[#0B1528]">
              Before you start
            </h2>
          </div>

          <ol className="space-y-2.5 text-xs sm:text-sm text-slate-700">
            {hasAccessCodes ? (
              <>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Enter the alphanumeric access code found on your physical voter slip.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Provide your Student or Institutional ID to verify eligibility.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Access your confidential ballot and review positions sequentially.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Follow the instructions to complete and cast your vote anonymously.</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Enter your approved {identifierLabel}.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>You will see a 6-digit verification code on this screen.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Enter the code to verify your session and access the ballot.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0055FF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
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
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
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
            <p className="text-slate-600 leading-relaxed">
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
          className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          <span>Start Voting</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Footer Support and Privacy Notice - Pushed to the Bottom and Aligned with Left Footer */}
      <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Need help?</span>
          <a
            href="mailto:support@pollwise.io"
            className="font-semibold text-[#0055FF] hover:underline"
          >
            Contact election support
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Privacy Notice</span>
          <span className="text-slate-300">•</span>
          <a
            href="/privacy"
            className="font-semibold text-[#0055FF] hover:underline"
          >
            Read our privacy policy
          </a>
        </div>
      </div>
    </div>
  );
};
