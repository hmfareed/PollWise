import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, Check, RotateCcw, ShieldCheck, HelpCircle, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface SubmissionConfirmedStepProps {
  confirmationReference: string;
  autoResetSeconds?: number;
  onFinish: () => void;
}

export const SubmissionConfirmedStep: React.FC<SubmissionConfirmedStepProps> = ({
  confirmationReference,
  autoResetSeconds = 15,
  onFinish,
}) => {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(autoResetSeconds);

  const handleCopy = () => {
    navigator.clipboard.writeText(confirmationReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-countdown to reset for next voter (critical for kiosk/booth shared hardware)
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onFinish]);

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Centered Main Content (Sitting flat on the canvas, brought down to middle) */}
      <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6 text-center">
        {/* Header Block */}
        <div className="space-y-3">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-xs ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <Badge variant="success" className="mx-auto text-xs px-3 py-1">
            Participation Confirmed
          </Badge>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
              Ballot Successfully Cast
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Your vote has been securely recorded and your participation verified.
            </p>
          </div>
        </div>

        {/* Confirmation Receipt Box */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Official Confirmation Reference
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-extrabold text-[#0B1528] tracking-wider select-all">
              {confirmationReference}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-[#0B1528] border-slate-200 cursor-pointer"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Keep this receipt reference for your records. It proves your ballot was accepted while keeping your votes strictly secret.
          </p>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-blue-50/60 border border-blue-200/60 rounded-xl text-left text-xs text-slate-600">
          <ShieldCheck className="w-5 h-5 text-[#0055FF] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#0B1528] block">One Accepted Ballot Enforced</span>
            Your voter identifier is permanently marked as participated for this election. A second ballot cannot be submitted.
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2 space-y-2">
          <Button
            size="lg"
            className="w-full py-6 text-base font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            onClick={onFinish}
          >
            <RotateCcw className="w-5 h-5" />
            Next Voter in Line ({countdown}s)
          </Button>
          <p className="text-[11px] text-slate-400 text-center">
            This screen will automatically reset to code entry in {countdown}s for the next voter.
          </p>
        </div>
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
