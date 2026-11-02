import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Lock,
  Save,
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  Link2,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { VoterAuthConfig, IdentifierType } from "../../types/voter-participation";

interface VoterAuthConfigCardProps {
  electionId: string;
  onConfigSaved?: (config: VoterAuthConfig) => void;
  isReadOnly?: boolean;
}

export const VoterAuthConfigCard: React.FC<VoterAuthConfigCardProps> = ({
  electionId,
  onConfigSaved,
  isReadOnly = false,
}) => {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["voter-auth-config", electionId],
    queryFn: () => apiClient.getVoterAuthConfig(electionId),
  });

  const [identifierType, setIdentifierType] = useState<IdentifierType>("institutional_email");
  const [identifierLabel, setIdentifierLabel] = useState<string>("Institutional Email");
  const [otpExpiry, setOtpExpiry] = useState<number>(300);
  const [otpMaxAttempts, setOtpMaxAttempts] = useState<number>(3);
  const [allowSkip, setAllowSkip] = useState<boolean>(true);
  const [allowResume, setAllowResume] = useState<boolean>(true);
  const [showLockConfirm, setShowLockConfirm] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const votingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/elections/${electionId}/vote`
      : `/elections/${electionId}/vote`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(votingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const input = document.createElement("input");
      input.value = votingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  useEffect(() => {
    if (config) {
      setIdentifierType(config.identifier_type);
      setIdentifierLabel(config.identifier_label);
      setOtpExpiry(config.otp_expiry_seconds);
      setOtpMaxAttempts(config.otp_max_attempts);
      setAllowSkip(config.allow_position_skip);
      setAllowResume(config.allow_session_resume);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      identifier_type: IdentifierType;
      identifier_label: string;
      otp_expiry_seconds: number;
      otp_max_attempts: number;
      allow_position_skip: boolean;
      allow_session_resume: boolean;
    }) => apiClient.updateVoterAuthConfig(electionId, payload),
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.setQueryData(["voter-auth-config", electionId], updated);
      queryClient.invalidateQueries({ queryKey: ["voter-auth-config", electionId] });
      setActionSuccess("Voter authentication configuration saved successfully.");
      if (onConfigSaved) onConfigSaved(updated);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionSuccess(null);
      const msg = err instanceof Error ? err.message : "Failed to save configuration.";
      setActionError(msg);
    },
  });

  const lockMutation = useMutation({
    mutationFn: () => apiClient.lockVoterAuthConfig(electionId),
    onSuccess: (locked) => {
      setActionError(null);
      queryClient.setQueryData(["voter-auth-config", electionId], locked);
      queryClient.invalidateQueries({ queryKey: ["voter-auth-config", electionId] });
      setShowLockConfirm(false);
      setActionSuccess("Configuration permanently locked.");
      if (onConfigSaved) onConfigSaved(locked);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to lock configuration.";
      setActionError(msg);
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6 text-center text-xs text-muted-foreground">
        Loading voter authentication configuration...
      </Card>
    );
  }

  const isLocked = !!config?.configuration_locked_at || isReadOnly;

  const handleSave = () => {
    setActionError(null);
    setActionSuccess(null);
    updateMutation.mutate({
      identifier_type: identifierType,
      identifier_label: identifierLabel,
      otp_expiry_seconds: Number(otpExpiry),
      otp_max_attempts: Number(otpMaxAttempts),
      allow_position_skip: allowSkip,
      allow_session_resume: allowResume,
    });
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Voter Authentication Method
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure how eligible participants identify and authenticate before casting a ballot.
              </CardDescription>
            </div>
          </div>
          {isLocked ? (
            <Badge variant="destructive" className="gap-1.5 text-xs py-1 px-2.5">
              <Lock className="w-3.5 h-3.5" />
              Configuration Locked
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs py-1 px-2.5">
              Draft Editable
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* Shareable Voter Participation Link */}
        <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-300">
              <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Voter Participation Link</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono truncate max-w-sm sm:max-w-md select-all">
              {votingUrl}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="text-xs h-7 px-3 gap-1.5 border-blue-200 dark:border-blue-850 text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
            <a
              href={votingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold px-2 py-1 rounded hover:bg-blue-100/50"
            >
              <span>Open Booth</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {actionError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg flex items-center justify-between text-xs text-red-800 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-600 hover:text-red-800 dark:hover:text-red-200 text-xs font-semibold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {isLocked && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              This election's voter authentication configuration has been locked. Parameters cannot be modified after voting has commenced.
            </span>
          </div>
        )}

        {/* Identifier Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Authentication Identifier
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                identifierType === "institutional_email"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-border hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="identifier_type"
                value="institutional_email"
                checked={identifierType === "institutional_email"}
                disabled={isLocked}
                onChange={() => {
                  setIdentifierType("institutional_email");
                  if (identifierLabel === "Student ID" || identifierLabel === "Staff ID") {
                    setIdentifierLabel("Institutional Email");
                  }
                }}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Institutional Email</span>
                <span className="text-muted-foreground mt-0.5 block">
                  Voters identify using their verified school/company email address.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                identifierType === "institutional_id"
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-border hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="identifier_type"
                value="institutional_id"
                checked={identifierType === "institutional_id"}
                disabled={isLocked}
                onChange={() => {
                  setIdentifierType("institutional_id");
                  if (identifierLabel === "Institutional Email") {
                    setIdentifierLabel("Student ID");
                  }
                }}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Institutional ID</span>
                <span className="text-muted-foreground mt-0.5 block">
                  Voters identify using a student number, employee badge, or membership ID.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Interface Label */}
        <div className="space-y-1.5">
          <label htmlFor="identifier-label-input" className="text-xs font-semibold text-foreground block">
            Voter Interface Field Label
          </label>
          <input
            id="identifier-label-input"
            type="text"
            value={identifierLabel}
            disabled={isLocked}
            onChange={(e) => setIdentifierLabel(e.target.value)}
            placeholder="e.g. Student ID, Staff Number, University Email"
            className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <p className="text-[11px] text-muted-foreground">
            This custom label is shown to voters in the input placeholder and instructions (e.g., "Enter your {identifierLabel}").
          </p>
        </div>

        {/* Verification & Ballot Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              On-Screen OTP Expiry (Seconds)
            </label>
            <input
              type="number"
              min={60}
              max={3600}
              value={otpExpiry}
              disabled={isLocked}
              onChange={(e) => setOtpExpiry(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">
              Voters must type the on-screen code within this window (default: 300s = 5m).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Max OTP Verification Attempts
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={otpMaxAttempts}
              disabled={isLocked}
              onChange={(e) => setOtpMaxAttempts(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">
              Challenges are invalidated after this many consecutive incorrect entries (default: 3).
            </p>
          </div>
        </div>

        {/* Skip & Resume Toggles */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowSkip}
              disabled={isLocked}
              onChange={(e) => setAllowSkip(e.target.checked)}
              className="rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-foreground">Allow Position Skipping</span>
              <span className="text-muted-foreground block">
                Allow voters to skip optional positions during ballot progression without selecting a candidate.
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowResume}
              disabled={isLocked}
              onChange={(e) => setAllowResume(e.target.checked)}
              className="rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-foreground">Allow Session Resumption</span>
              <span className="text-muted-foreground block">
                Permit voters to resume unsubmitted ballot drafts within the session timeout window.
              </span>
            </div>
          </label>
        </div>

        {/* Action Controls */}
        {!isLocked && (
          <div className="pt-4 flex items-center justify-between gap-3 border-t border-border/60">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setActionError(null);
                setShowLockConfirm(true);
              }}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Configuration
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold min-w-[150px] cursor-pointer"
            >
              {updateMutation.isPending ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        )}

        {/* Lock Confirmation Modal Overlay */}
        {showLockConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">Lock Authentication Configuration?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once locked, authentication identifier rules, labels, and skip policies cannot be modified. This ensures voter integrity before opening the voting window.
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowLockConfirm(false);
                    setActionError(null);
                  }}
                  disabled={lockMutation.isPending}
                  className="text-xs h-8 px-4 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => lockMutation.mutate()}
                  disabled={lockMutation.isPending}
                  className="text-xs h-8 px-4 font-semibold gap-1.5 cursor-pointer"
                >
                  {lockMutation.isPending ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      Locking...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Confirm Lock
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
