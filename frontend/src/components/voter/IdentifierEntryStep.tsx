import React, { useState } from "react";
import { UserCheck, AlertCircle, ArrowLeft, ArrowRight, Loader2, HelpCircle, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface IdentifierEntryStepProps {
  identifierLabel: string;
  identifierType: string;
  isLoading: boolean;
  error?: string | null;
  onSubmit: (identifier: string) => void;
  onBack: () => void;
}

export const IdentifierEntryStep: React.FC<IdentifierEntryStepProps> = ({
  identifierLabel,
  identifierType,
  isLoading,
  error,
  onSubmit,
  onBack,
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  const placeholder =
    identifierType === "institutional_email"
      ? "Enter your institutional email (e.g. voter@university.edu)"
      : `Enter your ${identifierLabel}`;

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Centered Main Form (Sitting flat on the canvas, brought down to middle) */}
      <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
        {/* Header Block */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-[#0055FF] rounded-xl mx-auto flex items-center justify-center shadow-xs">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
              Voter Verification
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
              Enter your approved {identifierLabel} to access the ballot.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="identifier-input" className="text-xs sm:text-sm font-bold text-[#0B1528] block">
              Enter your {identifierLabel}
            </label>
            <Input
              id="identifier-input"
              type={identifierType === "institutional_email" ? "email" : "text"}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isLoading}
              required
              className="py-6 text-base rounded-xl border border-slate-200 focus:border-[#0055FF] focus:ring-[#0055FF] bg-white text-[#0B1528] shadow-2xs"
              autoFocus
            />
            <p className="text-xs text-slate-500 text-center">
              Your entry is matched against the election's approved voter roll.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 py-6 rounded-xl font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
              onClick={onBack}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>

            <Button
              type="submit"
              className="flex-1 py-6 rounded-xl font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              disabled={!value.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
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
