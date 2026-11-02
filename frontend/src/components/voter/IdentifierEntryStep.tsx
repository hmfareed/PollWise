import React, { useState } from "react";
import { UserCheck, AlertCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";

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
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl mx-auto flex items-center justify-center mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Voter Verification</CardTitle>
          <CardDescription>
            Enter your approved {identifierLabel} to access the ballot.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="identifier-input" className="text-sm font-medium text-foreground">
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
                className="py-5 text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Your entry is matched against the election's approved voter roll.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2.5 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-5"
                onClick={onBack}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>

              <Button
                type="submit"
                className="flex-2 py-5 font-semibold"
                disabled={!value.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
