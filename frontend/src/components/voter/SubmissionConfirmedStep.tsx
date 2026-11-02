import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, Check, ShieldCheck, RotateCcw, Home } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface SubmissionConfirmedStepProps {
  confirmationReference: string;
  isKiosk?: boolean;
  onFinish: () => void;
}

export const SubmissionConfirmedStep: React.FC<SubmissionConfirmedStepProps> = ({
  confirmationReference,
  isKiosk = false,
  onFinish,
}) => {
  const [copied, setCopied] = useState(false);
  const [kioskCountdown, setKioskCountdown] = useState(15);

  const handleCopy = () => {
    navigator.clipboard.writeText(confirmationReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!isKiosk) return;
    const interval = setInterval(() => {
      setKioskCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isKiosk, onFinish]);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="border-border shadow-sm text-center">
        <CardHeader className="pb-3">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center mb-3 ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <Badge variant="success" className="mx-auto mb-2 text-xs">
            Participation Confirmed
          </Badge>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Ballot Successfully Cast
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            Your vote has been securely recorded and your participation verified.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Confirmation Receipt Box */}
          <div className="bg-muted/40 border border-border/80 rounded-2xl p-5 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Official Confirmation Reference
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-2xl font-extrabold text-foreground tracking-wider select-all">
                {confirmationReference}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Keep this receipt reference for your records. It proves your ballot was accepted while keeping your votes strictly secret.
            </p>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 rounded-xl text-left text-xs text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">One Accepted Ballot Enforced</span>
              Your voter identifier is permanently marked as participated for this election. A second ballot cannot be submitted.
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <Button
              size="lg"
              className="w-full py-6 text-base font-semibold rounded-xl shadow-md"
              onClick={onFinish}
            >
              {isKiosk ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" /> Finish & Reset Terminal ({kioskCountdown}s)
                </>
              ) : (
                <>
                  <Home className="w-4 h-4 mr-2" /> Done
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
