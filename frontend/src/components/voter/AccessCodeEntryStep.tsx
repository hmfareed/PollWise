import React, { useState } from "react";
import { Ticket, ArrowRight, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";

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
    <Card className="w-full max-w-md mx-auto shadow-lg border-border">
      <CardHeader className="text-center pb-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
          <Ticket className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold">Enter Voting Access Code</CardTitle>
        <CardDescription className="text-xs max-w-xs mx-auto">
          Please enter the alphanumeric code found on your physical voter slip (e.g., PW-7K9M-2X4L).
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="access-code-input" className="text-xs font-semibold text-foreground">
              Voter Slip Access Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="access-code-input"
                type="text"
                placeholder="PW-XXXX-XXXX"
                value={code}
                onChange={handleInputChange}
                disabled={isLoading}
                className="pl-9 font-mono uppercase tracking-widest text-center text-base sm:text-lg font-bold"
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Check your physical printed slip provided by your election administrator.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 gap-1.5"
              disabled={!code.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  Verify Code
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {onSwitchToIdentifier && (
            <div className="pt-2 text-center border-t border-border/40">
              <button
                type="button"
                onClick={onSwitchToIdentifier}
                className="text-xs text-muted-foreground hover:text-primary transition-colors hover:underline"
              >
                No physical slip? Verify with {identifierLabel} instead
              </button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
