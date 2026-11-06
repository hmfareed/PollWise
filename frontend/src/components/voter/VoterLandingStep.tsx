import React from "react";
import { Link } from "react-router-dom";
import { Vote, ShieldCheck, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface VoterLandingStepProps {
  electionTitle: string;
  electionDescription?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  isOpen: boolean;
  electionStatus?: string;
  electionId?: string;
  onStart: () => void;
}

export const VoterLandingStep: React.FC<VoterLandingStepProps> = ({
  electionTitle,
  electionDescription,
  opensAt,
  closesAt,
  isOpen,
  electionStatus = "draft",
  electionId,
  onStart,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Vote className="w-7 h-7" />
          </div>
          <Badge variant={isOpen ? "success" : "secondary"} className="mx-auto mb-2">
            {isOpen ? "Voting Open" : "Voting Unavailable"}
          </Badge>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {electionTitle}
          </CardTitle>
          {electionDescription && (
            <CardDescription className="text-muted-foreground mt-2 text-base">
              {electionDescription}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-xl p-4 border border-border/60 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-foreground block">Voting Window</span>
                <span className="text-muted-foreground">
                  {opensAt ? new Date(opensAt).toLocaleDateString() : "Immediate"} –{" "}
                  {closesAt ? new Date(closesAt).toLocaleDateString() : "Until Closed"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-foreground block">Secret Ballot Guarantee</span>
                <span className="text-muted-foreground">
                  Your candidate selections are cryptographically decoupled from your institutional identity. No administrator or supervisor can view your vote.
                </span>
              </div>
            </div>
          </div>

          {!isOpen && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {electionStatus === "draft"
                    ? "Election In Draft Preparation"
                    : electionStatus === "scheduled"
                    ? "Voting Scheduled But Not Yet Open"
                    : electionStatus === "paused"
                    ? "Voting Temporarily Paused"
                    : electionStatus === "closed"
                    ? "Election Concluded"
                    : "Voting Currently Unavailable"}
                </span>
              </div>
              <p className="text-muted-foreground dark:text-amber-300/80 leading-relaxed">
                {electionStatus === "draft"
                  ? "This election is currently in preparation and has not yet opened for voting. Please check back during the official voting window."
                  : electionStatus === "scheduled"
                  ? `This election is scheduled to open on ${opensAt ? new Date(opensAt).toLocaleString() : "the scheduled date"}.`
                  : electionStatus === "paused"
                  ? "This election is temporarily paused by election administrators under emergency operational protocol. Please check back shortly."
                  : electionStatus === "closed"
                  ? "The voting window for this election has closed. No further ballots may be submitted."
                  : "Voting is not currently active for this election."}
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center">
            You will identify yourself with your authorized institutional credentials, verify an on-screen code, and cast your ballot.
          </div>

          <Button
            size="lg"
            className="w-full text-base font-semibold py-6 rounded-xl shadow-md"
            disabled={!isOpen}
            onClick={onStart}
          >
            Start Voting <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
