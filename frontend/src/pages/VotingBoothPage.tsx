import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Vote, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Copy, 
  Check, 
  AlertCircle
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import type { BallotSelectionItem } from "../types/ballot";

export const VotingBoothPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();

  // In-memory credential stored in component state only (Doc 20)
  const [credentialToken, setCredentialToken] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [isRequestingCred, setIsRequestingCred] = useState(false);

  // Voting stage: "select" -> "review" -> "submitted"
  const [stage, setStage] = useState<"select" | "review" | "submitted">("select");

  // Voter selections: { [positionId]: { candidateIds: string[], isAbstain: boolean } }
  const [selections, setSelections] = useState<
    Record<string, { candidateIds: string[]; isAbstain: boolean }>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptReference, setReceiptReference] = useState<string | null>(null);
  const [hasCopiedReceipt, setHasCopiedReceipt] = useState(false);

  const { data: election, isLoading: isElectionLoading } = useQuery({
    queryKey: ["election", id],
    queryFn: () => apiClient.getElection(id!),
    enabled: !!id,
  });

  const { data: participation, isLoading: isParticipationLoading, refetch: refetchParticipation } = useQuery({
    queryKey: ["participation", id],
    queryFn: () => apiClient.getMyParticipation(id!),
    enabled: !!id && isAuthenticated,
  });

  // Request single-use voting credential into memory
  const handleRequestCredential = async () => {
    if (!id) return;
    setIsRequestingCred(true);
    setCredentialError(null);
    try {
      const resp = await apiClient.requestVotingCredential(id);
      setCredentialToken(resp.credential);
    } catch (err: any) {
      setCredentialError(err?.message || "Failed to obtain voting authorization");
    } finally {
      setIsRequestingCred(false);
    }
  };

  const handleSelectCandidate = (positionId: string, candidateId: string, maxSelections: number) => {
    const current = selections[positionId] || { candidateIds: [], isAbstain: false };
    if (current.isAbstain) {
      // Disallow candidate selection if currently abstaining
      return;
    }

    let updatedIds: string[];
    if (maxSelections === 1) {
      updatedIds = [candidateId];
    } else {
      if (current.candidateIds.includes(candidateId)) {
        updatedIds = current.candidateIds.filter((cid) => cid !== candidateId);
      } else {
        if (current.candidateIds.length >= maxSelections) return;
        updatedIds = [...current.candidateIds, candidateId];
      }
    }

    setSelections({
      ...selections,
      [positionId]: { candidateIds: updatedIds, isAbstain: false },
    });
  };

  const handleToggleAbstain = (positionId: string) => {
    const current = selections[positionId] || { candidateIds: [], isAbstain: false };
    const nextAbstain = !current.isAbstain;
    setSelections({
      ...selections,
      [positionId]: { candidateIds: nextAbstain ? [] : [], isAbstain: nextAbstain },
    });
  };

  const validateSelections = (): boolean => {
    if (!election || !election.positions) return false;
    for (const pos of election.positions) {
      const sel = selections[pos.id];
      if (!sel) return false;
      if (!sel.isAbstain && sel.candidateIds.length === 0) return false;
    }
    return true;
  };

  const handleSubmitBallot = async () => {
    if (!id || !credentialToken || !election) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const ballotSelections: BallotSelectionItem[] = election.positions.map((pos) => {
      const sel = selections[pos.id] || { candidateIds: [], isAbstain: false };
      return {
        position_id: pos.id,
        candidate_ids: sel.candidateIds,
        is_abstain: sel.isAbstain,
      };
    });

    try {
      // 1. Submit anonymously to isolated ballot-box with credentials: "omit"
      const result = await apiClient.submitBallot({
        election_id: id,
        credential: credentialToken,
        selections: ballotSelections,
      });

      setReceiptReference(result.receipt_reference);

      // 2. Erase the single-use credential from component memory immediately
      setCredentialToken(null);

      // 3. Confirm redemption back to identity service so voter's entitlement status updates
      try {
        await apiClient.confirmRedemption(id, result.receipt_reference);
        refetchParticipation();
      } catch {
        // Even if the confirmation callback fails, the ballot was safely accepted by the ballot-box
      }

      setStage("submitted");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit ballot to ballot-box");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReceiptToClipboard = () => {
    if (!receiptReference) return;
    navigator.clipboard.writeText(receiptReference);
    setHasCopiedReceipt(true);
    setTimeout(() => setHasCopiedReceipt(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <Lock className="h-10 w-10 text-primary mx-auto" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-xs text-muted-foreground">
          You must sign in with your verified institutional account to verify voter eligibility and cast a ballot.
        </p>
        <Link to="/login">
          <Button className="w-full">Sign In to Vote</Button>
        </Link>
      </div>
    );
  }

  if (isElectionLoading || isParticipationLoading) {
    return <div className="text-center py-16 text-xs text-muted-foreground">Initializing secure voting booth...</div>;
  }

  if (!election) {
    return <div className="text-center py-16 text-xs text-muted-foreground">Election not found.</div>;
  }

  if (election.status !== "open") {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Voting Not Active</h2>
        <p className="text-xs text-muted-foreground">
          This election is in status <strong>{election.status}</strong>. Ballots can only be cast when the election is open.
        </p>
        <Link to={`/elections/${id}`}>
          <Button variant="secondary">View Election Details</Button>
        </Link>
      </div>
    );
  }

  if (participation && !participation.is_eligible) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <AlertTriangle className="h-10 w-10 text-danger mx-auto" />
        <h2 className="text-xl font-bold">Not on Voter Roll</h2>
        <p className="text-xs text-muted-foreground">
          Account <strong>{user?.email}</strong> is not registered as an eligible voter for this election. If you believe this is an error, please contact the election administrator.
        </p>
        <Link to={`/elections/${id}`}>
          <Button variant="secondary">Back to Election</Button>
        </Link>
      </div>
    );
  }

  if (participation && participation.has_voted && stage !== "submitted") {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
        <h2 className="text-xl font-bold">Ballot Already Cast</h2>
        <p className="text-xs text-muted-foreground">
          Your single-use voting entitlement for <strong>{election.title}</strong> has already been redeemed. Each eligible voter is entitled to exactly one ballot.
        </p>
        <Link to={`/elections/${id}`}>
          <Button variant="secondary">Back to Election Overview</Button>
        </Link>
      </div>
    );
  }

  // Submitted Screen
  if (stage === "submitted") {
    return (
      <div className="max-w-xl mx-auto space-y-8 py-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-emerald-950">Ballot Successfully Cast</h1>
            <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
              Your anonymous ballot has been cryptographically validated and accepted by the isolated ballot-box.
            </p>
          </div>

          {/* Receipt Reference Box */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-surface shadow-sm space-y-2 max-w-sm mx-auto">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Cryptographic Receipt Reference
            </span>
            <div className="flex items-center justify-center gap-2">
              <code className="text-base font-mono font-bold text-foreground tracking-wider">
                {receiptReference}
              </code>
              <button
                onClick={copyReceiptToClipboard}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground"
                title="Copy receipt"
              >
                {hasCopiedReceipt ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Save this reference to independently verify that your ballot was included in the final tally.
            </p>
          </div>

          <div className="p-3 bg-emerald-100/60 rounded-lg text-xs text-emerald-900 text-left space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Ballot Secrecy Guarantee
            </p>
            <p className="text-[11px]">
              No voter identifiers, email addresses, or session tokens were transmitted to the ballot-box database. Your selections cannot be linked to your identity.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/elections">
              <Button className="gap-2">
                Return to Elections
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pre-ballot: Require voter to obtain single-use bearer token
  if (!credentialToken) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to={`/elections/${id}`} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Election Details
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Enter Voting Booth</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {election.title} · Official Institutional Ballot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 text-xs text-blue-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" />
                Voter Privacy & Single-Use Authorization
              </p>
              <p className="leading-relaxed">
                To guarantee secret ballots, the system generates a single-use random authorization token. When you cast your ballot, this authorization token is redeemed anonymously without your name, email, or user account attached.
              </p>
            </div>

            {credentialError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{credentialError}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-xs py-2 border-b border-border">
                <span className="text-muted-foreground">Eligible Voter</span>
                <span className="font-medium text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-border">
                <span className="text-muted-foreground">Ballot Positions</span>
                <span className="font-semibold text-foreground">{election.positions?.length || 0}</span>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-muted-foreground">Entitlement Status</span>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                  Ready to Issue
                </Badge>
              </div>
            </div>

            <Button
              onClick={handleRequestCredential}
              disabled={isRequestingCred}
              className="w-full gap-2"
            >
              {isRequestingCred ? "Authorizing..." : "Authorize & Open Ballot"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active Ballot Screen: Selections
  if (stage === "select") {
    const allFilled = validateSelections();

    return (
      <div className="max-w-3xl mx-auto space-y-8 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Official Ballot</span>
            <h1 className="text-2xl font-extrabold text-foreground">{election.title}</h1>
            <p className="text-xs text-muted-foreground">
              Review candidates and record your selections for each position.
            </p>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto gap-1 text-xs border-emerald-200 bg-emerald-50 text-emerald-800">
            <Lock className="h-3 w-3" />
            Authorized Session
          </Badge>
        </div>

        {submitError && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Positions and Candidates */}
        <div className="space-y-6">
          {election.positions?.map((pos, pIdx) => {
            const currentSel = selections[pos.id] || { candidateIds: [], isAbstain: false };

            return (
              <Card key={pos.id} className="border border-border shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-border py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-primary">Position #{pIdx + 1}</span>
                      <CardTitle className="text-lg">{pos.title}</CardTitle>
                      {pos.description && (
                        <CardDescription className="text-xs pt-1">{pos.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant={currentSel.candidateIds.length > 0 || currentSel.isAbstain ? "success" : "outline"} className="text-xs">
                      {currentSel.isAbstain
                        ? "Abstaining"
                        : currentSel.candidateIds.length === 1
                        ? "Selected"
                        : "Select 1"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pos.candidates.map((cand) => {
                      const isSelected = currentSel.candidateIds.includes(cand.id);

                      return (
                        <div
                          key={cand.id}
                          onClick={() => handleSelectCandidate(pos.id, cand.id, pos.max_selections)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3 ${
                            isSelected
                              ? "border-primary bg-blue-50/40 ring-1 ring-primary shadow-sm"
                              : "border-border hover:border-slate-300 bg-surface"
                          }`}
                        >
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center mt-0.5 border ${
                              isSelected
                                ? "border-primary bg-primary text-white"
                                : "border-slate-300 bg-surface"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-sm text-foreground">{cand.name}</p>
                            {cand.biography && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {cand.biography}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explicit Abstention Option */}
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={currentSel.isAbstain}
                        onChange={() => handleToggleAbstain(pos.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span>Abstain from voting for this position</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Link to={`/elections/${id}`}>
            <Button variant="secondary" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cancel & Exit
            </Button>
          </Link>

          <Button
            onClick={() => setStage("review")}
            disabled={!allFilled}
            className="gap-2"
          >
            Review Ballot Selections
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Review Stage Screen
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-foreground">Review Your Ballot</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Carefully verify your choices before final submission. Once cast, secret ballots cannot be modified.
        </p>
      </div>

      {submitError && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {election.positions?.map((pos, pIdx) => {
            const sel = selections[pos.id];
            const selectedCandidates = pos.candidates.filter((c) =>
              sel?.candidateIds.includes(c.id)
            );

            return (
              <div key={pos.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-primary">Position #{pIdx + 1}</span>
                  <h4 className="font-semibold text-sm text-foreground">{pos.title}</h4>
                </div>
                <div className="text-right">
                  {sel?.isAbstain ? (
                    <Badge variant="outline" className="text-slate-600 bg-slate-100">
                      Abstain
                    </Badge>
                  ) : selectedCandidates.length > 0 ? (
                    <div className="space-y-1">
                      {selectedCandidates.map((c) => (
                        <p key={c.id} className="text-xs font-bold text-foreground">
                          {c.name}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-danger italic">No selection</span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs text-amber-900 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Irreversible Submission Notice</p>
          <p className="mt-0.5 text-amber-800">
            By clicking "Cast Secret Ballot", your choices will be deposited directly into the isolated ballot-box. Your single-use authorization token will be consumed immediately.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="secondary" onClick={() => setStage("select")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Modify Choices
        </Button>

        <Button
          onClick={handleSubmitBallot}
          disabled={isSubmitting}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? "Submitting to Ballot-Box..." : "Cast Secret Ballot"}
          <Vote className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
