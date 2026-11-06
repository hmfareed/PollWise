import React, { useState } from "react";
import { AlertTriangle, PauseCircle, PlayCircle, X, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";

export interface EmergencyControlModalProps {
  isOpen: boolean;
  actionType: "pause" | "resume" | "emergency_close" | "cancel";
  electionTitle: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export const EmergencyControlModal: React.FC<EmergencyControlModalProps> = ({
  isOpen,
  actionType,
  electionTitle,
  isSubmitting = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const isReasonRequired = actionType !== "resume";
  const isReasonValid = !isReasonRequired || reason.trim().length >= 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid || isSubmitting) return;
    onConfirm(reason.trim());
  };

  const getActionConfig = () => {
    switch (actionType) {
      case "pause":
        return {
          title: "Pause Election",
          icon: <PauseCircle className="h-5 w-5 text-amber-500" />,
          warning:
            "Voting will be halted immediately. Voters in the voting booth will be notified that the election is temporarily paused under emergency protocol.",
          confirmText: "Confirm Pause",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
          placeholder: "State specific reason for emergency pause (e.g. network outage, terminal maintenance)...",
        };
      case "resume":
        return {
          title: "Resume Election",
          icon: <PlayCircle className="h-5 w-5 text-emerald-500" />,
          warning:
            "Re-enables voter authentication and ballot submissions. The election status will return to open.",
          confirmText: "Confirm Resume",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
          placeholder: "Optional notes on emergency resolution...",
        };
      case "emergency_close":
        return {
          title: "Emergency Close Election",
          icon: <ShieldAlert className="h-5 w-5 text-rose-500" />,
          warning:
            "Terminates voting immediately and freezes ballot box for tallying. This action is irreversible.",
          confirmText: "Emergency Close",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
          placeholder: "Document mandatory administrative justification for emergency closing...",
        };
      default:
        return {
          title: "Cancel Election",
          icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
          warning:
            "Formally aborts this election cycle under institutional governance rules.",
          confirmText: "Cancel Election",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
          placeholder: "Mandatory justification for cancellation...",
        };
    }
  };

  const config = getActionConfig();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {config.icon}
            <h3 id="emergency-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {config.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Election
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {electionTitle}
            </p>
          </div>

          {/* Warning notice */}
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Operational Emergency Protocol</p>
              <p className="mt-0.5 leading-relaxed">{config.warning}</p>
            </div>
          </div>

          {/* Reason textarea */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="emergency-reason"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Audited Justification {isReasonRequired && <span className="text-rose-500">*</span>}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {reason.trim().length} / 5 chars min
              </span>
            </div>
            <textarea
              id="emergency-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.placeholder}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
            {isReasonRequired && reason.length > 0 && !isReasonValid && (
              <p className="text-xs text-rose-500 mt-1">
                Reason must be at least 5 characters (excluding whitespace).
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isReasonValid || isSubmitting}
              className={`gap-2 ${config.btnColor}`}
            >
              {isSubmitting ? "Executing…" : config.confirmText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
