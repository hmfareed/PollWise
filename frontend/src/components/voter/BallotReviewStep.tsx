import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowLeft, Send, Edit2, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import type { BallotPosition } from "../../types/voter-participation";

interface BallotReviewStepProps {
  electionTitle: string;
  positions: BallotPosition[];
  selections: Record<string, { candidateId?: string | null; skipped: boolean }>;
  isSubmitting: boolean;
  submitError?: string | null;
  onEditPosition: (index: number) => void;
  onSubmit: () => void;
  onBackToBallot: () => void;
}

export const BallotReviewStep: React.FC<BallotReviewStepProps> = ({
  electionTitle,
  positions,
  selections,
  isSubmitting,
  submitError,
  onEditPosition,
  onSubmit,
  onBackToBallot,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <Badge variant="outline" className="mx-auto mb-2 text-xs">
            Final Step
          </Badge>
          <CardTitle className="text-2xl font-bold tracking-tight">Review Your Ballot</CardTitle>
          <CardDescription className="text-sm mt-1">
            Please verify your selections for {electionTitle} before final submission.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary Table of Positions */}
          <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden bg-muted/10">
            {positions.map((pos, idx) => {
              const sel = selections[pos.id];
              let choiceText = "Unanswered";
              let isSkipped = false;

              if (sel?.skipped) {
                choiceText = "Skipped";
                isSkipped = true;
              } else if (sel?.candidateId) {
                const found = pos.candidates.find((c) => c.id === sel.candidateId);
                choiceText = found ? found.name : "Selected Candidate";
              }

              return (
                <div key={pos.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Position {idx + 1}
                      </span>
                      {pos.is_required && (
                        <span className="text-[10px] text-red-500 font-medium">Required</span>
                      )}
                    </div>
                    <div className="font-semibold text-foreground text-base mt-0.5 truncate">
                      {pos.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Choice:</span>
                      <span
                        className={`text-sm font-medium ${
                          isSkipped
                            ? "text-amber-600 dark:text-amber-400 italic"
                            : sel?.candidateId
                            ? "text-blue-600 dark:text-blue-400 font-semibold"
                            : "text-red-500"
                        }`}
                      >
                        {choiceText}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditPosition(idx)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Change
                  </Button>
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2.5 text-red-700 dark:text-red-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="p-3 bg-muted/40 rounded-xl text-center text-xs text-muted-foreground">
            Once submitted, your vote is recorded anonymously. You cannot change your answers after submission.
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="py-5 px-5"
              onClick={onBackToBallot}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <Button
              type="button"
              className="flex-1 py-5 text-base font-semibold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
            >
              Submit Ballot <Send className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">Submit your ballot?</h3>
              <p className="text-sm text-muted-foreground">
                After your ballot is submitted, you cannot change your selections. Are you ready to submit your vote?
              </p>
            </div>

            <div className="pt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 py-5"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Return to Review
              </Button>

              <Button
                type="button"
                className="flex-1 py-5 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setShowConfirmModal(false);
                  onSubmit();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Confirm and Submit"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
