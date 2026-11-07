import React, { useState } from "react";
import { Ticket, ArrowRight, AlertCircle, Loader2, KeyRound, HelpCircle, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface AccessCodeEntryStepProps {
  onVerify: (code: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
  onBack?: () => void;
  onSwitchToIdentifier?: () => void;
  identifierLabel?: string;
}

export const AccessCodeEntryStep: React.FC<AccessCodeEntryStepProps> = ({
  onVerify,
  isLoading,
  error,
  onClearError,
  onBack,
  onSwitchToIdentifier,
  identifierLabel = "institutional credentials",
}) => {
  const [code, setCode] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    // Auto-uppercase
    setCode(e.target.value.toUpperCase());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) {
      onVerify(trimmed);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Centered Main Form (Sitting flat on the canvas, brought down to middle) */}
      <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
        {/* Header Block */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-[#0055FF] mx-auto flex items-center justify-center shadow-xs">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
              Enter Voting Access Code
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
              Please enter the alphanumeric code found on your physical voter slip (e.g., PW-7K9M-2X4L).
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="access-code-input"
              className="text-xs sm:text-sm font-bold text-[#0B1528] block"
            >
              Voter Slip Access Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="access-code-input"
                type="text"
                placeholder="PW-XXXX-XXXX"
                value={code}
                onChange={handleInputChange}
                disabled={isLoading}
                className="pl-11 pr-4 py-6 font-mono uppercase tracking-widest text-center text-lg sm:text-xl font-bold rounded-xl border border-slate-200 focus:border-[#0055FF] focus:ring-[#0055FF] bg-white text-[#0B1528] shadow-2xs"
                autoFocus
                required
              />
            </div>
            <p className="text-xs text-slate-500 text-center">
              Check your physical printed slip provided by your election administrator.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-6 rounded-xl font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                onClick={onBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 py-6 rounded-xl font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              disabled={!code.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <span>Verify Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {onSwitchToIdentifier && (
            <div className="pt-4 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={onSwitchToIdentifier}
                className="text-xs text-slate-500 hover:text-[#0055FF] transition-colors hover:underline cursor-pointer font-medium"
              >
                No physical slip? Verify with {identifierLabel} instead
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Footer Support and Privacy Notice - Aligned with Left Footer */}
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
