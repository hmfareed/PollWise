import React, { useState, useEffect } from "react";
import { KeyRound, AlertCircle, RefreshCw, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";

interface OTPVerificationStepProps {
  otpCode: string;
  expiresInSeconds: number;
  isLoading: boolean;
  error?: string | null;
  onVerify: (enteredCode: string) => void;
  onRegenerate: () => void;
  onChangeIdentifier: () => void;
}

export const OTPVerificationStep: React.FC<OTPVerificationStepProps> = ({
  otpCode,
  expiresInSeconds,
  isLoading,
  error,
  onVerify,
  onRegenerate,
  onChangeIdentifier,
}) => {
  const [enteredOtp, setEnteredOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(expiresInSeconds);

  useEffect(() => {
    setTimeLeft(expiresInSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresInSeconds, otpCode]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp.length !== 6) return;
    onVerify(enteredOtp);
  };

  // Formats display of the code: "4  8  2  9  1  6"
  const formattedDisplay = otpCode.split("").join("  ");

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl mx-auto flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Verify Your Access</CardTitle>
          <CardDescription>
            Enter the on-screen verification code shown below to confirm your session.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Prominent On-Screen OTP Display */}
          <div className="bg-gradient-to-b from-blue-50/80 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 text-center space-y-2 shadow-inner">
            <span className="text-xs font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase block">
              Your Pollwise verification code:
            </span>
            <div className="text-4xl font-mono font-black tracking-widest text-blue-900 dark:text-blue-100 select-all py-1">
              {formattedDisplay}
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the code shown above to access your official ballot.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="otp-input" className="text-sm font-medium text-foreground block text-center">
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
                  className="text-center font-mono text-2xl tracking-widest py-6 border-2 focus:border-blue-600 rounded-xl"
                  autoFocus
                />
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1">
                Code expires in <span className="font-semibold text-foreground">{formattedTime}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2.5 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-6 text-base font-semibold rounded-xl shadow-sm"
              disabled={enteredOtp.length !== 6 || isLoading || timeLeft === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Verify Code
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60">
            <button
              type="button"
              onClick={onChangeIdentifier}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change Identifier
            </button>

            <button
              type="button"
              onClick={onRegenerate}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate Code
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
