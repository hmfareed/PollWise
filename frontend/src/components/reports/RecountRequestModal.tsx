import React, { useState } from "react";
import { RotateCcw, AlertTriangle, X, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { apiClient } from "../../lib/api-client";

interface RecountRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  electionId: string;
  electionTitle: string;
  currentVersion?: number;
  onSuccess: () => void;
}

export const RecountRequestModal: React.FC<RecountRequestModalProps> = ({
  isOpen,
  onClose,
  electionId,
  electionTitle,
  currentVersion = 1,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const nextVersion = (currentVersion || 1) + 1;
  const isReasonValid = reason.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient.requestRecount(electionId, reason.trim());
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate election recount";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Request Official Recount & Audit</h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm">
                {electionTitle}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Warning & Governance Info Card */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>Formal Dispute & Tally Recalculation Protocol (Spec §12.4)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground dark:text-amber-200/80 pl-1 leading-relaxed">
            <li>Re-runs deterministic tally calculation directly from preserved immutable ballots in <code className="font-mono text-xs">ballot_db</code>.</li>
            <li>Produces a new immutable tally snapshot (<span className="font-semibold text-foreground">Version {nextVersion}</span>) without altering original records.</li>
            <li>Resets election status to <span className="font-medium text-foreground">tallied</span> with pending approval; publication will require formal administrative certification.</li>
          </ul>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="recount-reason" className="font-medium text-foreground">
                Formal Justification / Dispute Reason <span className="text-destructive">*</span>
              </label>
              <span className={`text-[11px] ${reason.trim().length >= 5 ? "text-muted-foreground" : "text-amber-500"}`}>
                Min 5 chars ({reason.trim().length}/2000)
              </span>
            </div>
            <textarea
              id="recount-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide detailed justification for the recount request (e.g., tie margin dispute, auditor recalculation)..."
              disabled={isSubmitting}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isReasonValid || isSubmitting}
              className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
              {isSubmitting ? "Initiating Recount..." : "Initiate Recount"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
