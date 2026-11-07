import React, { useState } from "react";
import { UserCheck, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
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
    <Card className="w-full max-w-md mx-auto shadow-xl shadow-slate-200/50 border border-slate-200/80 rounded-3xl bg-white text-slate-900">
      <CardHeader className="text-center pb-3">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center mb-2">
          <UserCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold">Enter Your Student ID</CardTitle>
        <CardDescription className="text-xs max-w-xs mx-auto">
          Please provide your official Student ID. This will be checked to verify you have not already voted.
        </CardDescription>

        {/* Verified Slip Badge */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 font-mono text-xs bg-muted/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Verified Slip: <strong>{verifiedCode}</strong>
          </Badge>
          <button
            type="button"
            onClick={onChangeCode}
            disabled={isLoading}
            className="text-[11px] text-primary hover:underline"
          >
            Change
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="student-id-input" className="text-xs font-semibold text-foreground">
              Student ID
            </label>
            <Input
              id="student-id-input"
              type="text"
              placeholder="e.g. STU-12345"
              value={studentId}
              onChange={handleInputChange}
              disabled={isLoading}
              className="text-center font-mono font-bold uppercase text-base"
              autoFocus
              required
            />
            <p className="text-[11px] text-muted-foreground text-center">
              Enter your Student ID only.
            </p>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1">
              🔒 Secret Ballot Guarantee
            </p>
            <p>
              Your candidate choices remain anonymous and decoupled from your identity.
              Once your ballot is submitted, both this Student ID and access code <strong>expire permanently</strong>.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full gap-1.5"
              disabled={!studentId.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking ID & Loading Ballot…
                </>
              ) : (
                <>
                  Proceed to Ballot
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
