import React from "react";
import { AlertOctagon, PlayCircle, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import type { Election } from "../../types/election";

export interface EmergencyStatusBannerProps {
  election: Election;
  onResume: () => void;
  onClose: () => void;
  isResuming?: boolean;
  isClosing?: boolean;
}

export const EmergencyStatusBanner: React.FC<EmergencyStatusBannerProps> = ({
  election,
  onResume,
  onClose,
  isResuming = false,
  isClosing = false,
}) => {
  if (election.status !== "paused") return null;

  const pausedTime = election.paused_at
    ? new Date(election.paused_at).toLocaleString()
    : "Recently";

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30 p-4 sm:p-5 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">
                Election is Temporarily Paused
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                Emergency Hold
              </span>
            </div>
            {election.pause_reason && (
              <p className="text-sm text-amber-900/90 dark:text-amber-200/90">
                <span className="font-semibold">Reason:</span> {election.pause_reason}
              </p>
            )}
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Halted at {pausedTime}. Voter verification and ballot ingestion are suspended.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
          <Button
            size="sm"
            onClick={onResume}
            disabled={isResuming || isClosing}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <PlayCircle className="h-4 w-4" />
            {isResuming ? "Resuming…" : "Resume Election"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onClose}
            disabled={isResuming || isClosing}
            className="gap-1.5 font-medium shadow-xs"
          >
            <XCircle className="h-4 w-4" />
            {isClosing ? "Closing…" : "Close Election"}
          </Button>
        </div>
      </div>
    </div>
  );
};
