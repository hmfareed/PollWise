import React from "react";
import { Check, ArrowLeft, ArrowRight, FastForward, User, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { getAssetUrl } from "../../lib/api-client";
import type { BallotPosition } from "../../types/voter-participation";

interface PositionVoteStepProps {
  position: BallotPosition;
  currentIndex: number;
  totalPositions: number;
  selectedCandidateId?: string | null;
  isSkipped: boolean;
  onSelectCandidate: (candidateId: string) => void;
  onSkipPosition: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const PositionVoteStep: React.FC<PositionVoteStepProps> = ({
  position,
  currentIndex,
  totalPositions,
  selectedCandidateId,
  isSkipped,
  onSelectCandidate,
  onSkipPosition,
  onPrevious,
  onNext,
}) => {
  const isLast = currentIndex === totalPositions - 1;
  const hasAnswered = !!selectedCandidateId || isSkipped;
  const canProceed = !position.is_required || !!selectedCandidateId;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header & Progress */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="px-3 py-1 font-semibold text-xs text-muted-foreground">
          Position {currentIndex + 1} of {totalPositions}
        </Badge>
        {position.is_required ? (
          <Badge variant="destructive" className="text-xs">
            Required
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Optional
          </Badge>
        )}
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {position.title}
          </CardTitle>
          {position.description && (
            <CardDescription className="text-muted-foreground text-sm mt-1">
              {position.description}
            </CardDescription>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            {position.max_selections === 1
              ? "Select one candidate, or skip if optional."
              : `Select up to ${position.max_selections} candidates.`}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Candidates List */}
          {position.candidates.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
              No candidates are available for this position.
            </div>
          ) : (
            <div className="space-y-3">
              {position.candidates.map((cand) => {
                const isSelected = selectedCandidateId === cand.id && !isSkipped;
                return (
                  <div
                    key={cand.id}
                    onClick={() => onSelectCandidate(cand.id)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 shadow-sm"
                        : "border-border hover:border-border/80 bg-card hover:bg-muted/20"
                    }`}
                  >
                    {/* Radio / Selection Indicator */}
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    {/* Candidate Photo or Avatar */}
                    {cand.photo_url ? (
                      <img
                        src={getAssetUrl(cand.photo_url)}
                        alt={cand.name}
                        className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                        <User className="w-6 h-6" />
                      </div>
                    )}

                    {/* Candidate Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base text-foreground tracking-tight">
                        {cand.name}
                      </h4>
                      {cand.biography && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {cand.biography}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skip Button (if not required) */}
          {!position.is_required && (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant={isSkipped ? "secondary" : "ghost"}
                className={`w-full py-5 text-sm font-medium border ${
                  isSkipped ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}
                onClick={onSkipPosition}
              >
                <FastForward className="w-4 h-4 mr-2" />
                {isSkipped ? "Position Skipped (Click to undo)" : "Skip this Position"}
              </Button>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-4 flex items-center justify-between gap-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="px-5 py-5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>

            <Button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className="px-6 py-5 font-semibold"
            >
              {isLast ? "Review Selections" : "Next"}{" "}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
