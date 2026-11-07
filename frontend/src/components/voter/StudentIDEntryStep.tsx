import React, { useState } from "react";
import { UserCheck, ArrowRight, AlertCircle, Loader2, CheckCircle2, HelpCircle, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

interface StudentIDEntryStepProps {
  verifiedCode: string;
  onClaim: (studentId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
  onChangeCode: () => void;
}

export const StudentIDEntryStep: React.FC<StudentIDEntryStepProps> = ({
  verifiedCode,
  onClaim,
  isLoading,
  error,
  onClearError,
  onChangeCode,
}) => {
  const [studentId, setStudentId] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    setStudentId(e.target.value.toUpperCase());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentId.trim();
    if (trimmed) {
      onClaim(trimmed);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Centered Main Form (Sitting flat on the canvas, brought down to middle) */}
      <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
        {/* Header Block */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
              Enter Your Student ID
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
              Please provide your official Student ID. This will be checked to verify you have not already voted.
            </p>
          </div>

          {/* Verified Slip Badge */}
          <div className="pt-1 flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 px-3.5 py-1 font-mono text-xs bg-slate-50 border-slate-200 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Verified Slip: <strong>{verifiedCode}</strong></span>
            </Badge>
            <button
              type="button"
              onClick={onChangeCode}
              disabled={isLoading}
              className="text-xs text-[#0055FF] hover:underline cursor-pointer font-medium"
            >
              Change
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="student-id-input" className="text-xs sm:text-sm font-bold text-[#0B1528] block">
              Student ID
            </label>
            <Input
              id="student-id-input"
              type="text"
              placeholder="e.g. STU-12345"
              value={studentId}
              onChange={handleInputChange}
              disabled={isLoading}
              className="py-6 font-mono font-bold uppercase text-center text-lg sm:text-xl rounded-xl border border-slate-200 focus:border-[#0055FF] focus:ring-[#0055FF] bg-white text-[#0B1528] shadow-2xs"
              autoFocus
              required
            />
            <p className="text-xs text-slate-500 text-center">
              Enter your Student ID only.
            </p>
          </div>

          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-[#0B1528] flex items-center gap-1.5">
              <span>🔒 Secret Ballot Guarantee</span>
            </p>
            <p className="leading-relaxed">
              Your candidate choices remain anonymous and decoupled from your identity.
              Once your ballot is submitted, both this Student ID and access code <strong>expire permanently</strong>.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full py-6 rounded-xl font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              disabled={!studentId.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking ID & Loading Ballot…
                </>
              ) : (
                <>
                  <span>Proceed to Ballot</span>
                  <ArrowRight className="h-4 w-4" />
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
