import React, { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Loader2, HelpCircle, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface OTPVerificationStepProps {
  identifier: string;
  otpCode: string; // The on-screen challenge code
  expiresInSeconds?: number;
  isLoading: boolean;
  error?: string | null;
  onVerify: (otp: string) => void;
  onRegenerate: () => void;
  onChangeIdentifier: () => void;
}

export const OTPVerificationStep: React.FC<OTPVerificationStepProps> = ({
  otpCode,
  expiresInSeconds = 300,
  isLoading,
  error,
  onVerify,
  onRegenerate,
  onChangeIdentifier,
}) => {
  const [enteredOtp, setEnteredOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(expiresInSeconds);

  // Countdown timer
  useEffect(() => {
    setTimeLeft(expiresInSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresInSeconds, otpCode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formattedTime = formatTime(timeLeft);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp.length !== 6) return;
    onVerify(enteredOtp);
  };

  // Formats display of the code: "4  8  2  9  1  6"
  const formattedDisplay = otpCode.split("").join("  ");

  return (
    <div className="w-full flex-1 flex flex-col justify-between transition-all bg-white text-slate-900">
      {/* Centered Main Form (Sitting flat on the canvas, brought down to middle) */}
      <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
        {/* Header Block */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-[#0055FF] rounded-xl mx-auto flex items-center justify-center shadow-xs">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight leading-snug">
              Verify Your Access
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
              Enter the on-screen verification code shown below to confirm your session.
            </p>
          </div>
        </div>

        {/* Prominent On-Screen OTP Display */}
        <div className="bg-gradient-to-b from-blue-50/80 to-blue-100/40 border border-blue-200 rounded-2xl p-6 text-center space-y-2 shadow-inner">
          <span className="text-xs font-semibold tracking-wider text-[#0055FF] uppercase block">
            Your Pollwise verification code:
          </span>
          <div className="text-4xl font-mono font-black tracking-widest text-blue-900 select-all py-1">
            {formattedDisplay}
          </div>
          <p className="text-xs text-slate-500">
            Enter the code shown above to access your official ballot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="otp-input" className="text-xs sm:text-sm font-bold text-[#0B1528] block text-center">
              Enter the 6-digit code shown above
            </label>
            <div className="max-w-xs mx-auto">
              <Input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isLoading}
                required
                className="text-center font-mono text-2xl tracking-widest py-6 border border-slate-200 focus:border-[#0055FF] focus:ring-[#0055FF] rounded-xl bg-white text-[#0B1528] shadow-2xs font-bold"
                autoFocus
              />
            </div>
            <div className="text-center text-xs text-slate-500 mt-1">
              Code expires in <span className="font-semibold text-[#0B1528]">{formattedTime}</span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-6 text-base font-bold text-white bg-[#0055FF] hover:bg-[#0047E0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            disabled={enteredOtp.length !== 6 || isLoading || timeLeft === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-1.5" /> Verify Code
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
          <button
            type="button"
            onClick={onChangeIdentifier}
            className="text-slate-500 hover:text-[#0B1528] flex items-center gap-1 underline underline-offset-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Change Identifier
          </button>

          <button
            type="button"
            onClick={onRegenerate}
            className="text-[#0055FF] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate Code
          </button>
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
