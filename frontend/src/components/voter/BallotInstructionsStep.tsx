import React from "react";
import { FileText, Check, FastForward, Shield, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface BallotInstructionsStepProps {
  electionTitle: string;
  totalPositions: number;
  allowSkip: boolean;
  onBegin: () => void;
}

export const BallotInstructionsStep: React.FC<BallotInstructionsStepProps> = ({
  electionTitle,
  totalPositions,
  allowSkip,
  onBegin,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl mx-auto flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <Badge variant="outline" className="mx-auto mb-2 text-xs">
            {totalPositions} {totalPositions === 1 ? "Position" : "Positions"} on Ballot
          </Badge>
          <CardTitle className="text-2xl font-bold tracking-tight">Ballot Instructions</CardTitle>
          <CardDescription className="text-base text-muted-foreground mt-1">
            Please read these guidelines before beginning your ballot for {electionTitle}.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground block">One Position Per Screen</span>
                <span className="text-muted-foreground">
                  You will review each position sequentially. Tap or click on a candidate's card to select your choice.
                </span>
              </div>
            </div>

            {allowSkip && (
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FastForward className="w-4 h-4" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-foreground block">Optional Position Skipping</span>
                  <span className="text-muted-foreground">
                    For optional positions, you can select "Skip this Position" to proceed without casting a vote for that position.
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground block">Review and Final Submission</span>
                <span className="text-muted-foreground">
                  After the final position, you will see a complete review screen. You can edit any selection before submitting. Once submitted, your ballot is final and cannot be modified.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-center text-xs text-muted-foreground">
            Strict Secret Ballot: Your selections are recorded anonymously.
          </div>

          <Button
            size="lg"
            className="w-full py-6 text-base font-semibold rounded-xl shadow-md"
            onClick={onBegin}
          >
            Begin Ballot <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
