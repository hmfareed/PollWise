import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Trophy, 
  ArrowLeft, 
  Calculator, 
  Lock, 
  Globe, 
  ShieldCheck, 
  AlertCircle 
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export const ElectionResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [approveReason, setApproveReason] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: election, isLoading: isElectionLoading } = useQuery({
    queryKey: ["election", id],
    queryFn: () => apiClient.getElection(id!),
    enabled: !!id,
  });

  const { data: results, isLoading: isResultsLoading, error: resultsError } = useQuery({
    queryKey: ["election-results", id],
    queryFn: () => apiClient.getResults(id!),
    enabled: !!id,
    retry: false,
  });

  const tallyMutation = useMutation({
    mutationFn: () => apiClient.computeTally(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to calculate tally"),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.approveTally(id!, results!.id, {
        decision: "approved",
        reason: approveReason || "Tally audited and approved by election authority",
      }),
    onSuccess: () => {
      setShowApproveModal(false);
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to record tally approval"),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishResults(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to publish results"),
  });

  if (isElectionLoading) {
    return <div className="text-center py-16 text-xs text-muted-foreground">Loading election...</div>;
  }

  if (!election) {
    return <div className="text-center py-16 text-xs text-muted-foreground">Election not found.</div>;
  }

  const isPublished = election.status === "published";

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to={`/elections/${id}`} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Election Overview
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">Official Results</span>
      </div>

      {/* Results Header Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isPublished ? (
                <Badge variant="success" className="gap-1.5 py-1 px-2.5">
                  <Globe className="h-3.5 w-3.5" />
                  Published & Publicly Auditable
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 py-1 px-2.5 border-amber-300 bg-amber-50 text-amber-800">
                  <Lock className="h-3.5 w-3.5" />
                  Confidential Interim Tally
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {election.title}
            </h1>
          </div>

          {/* Manager Action Controls */}
          {isAuthenticated && (
            <div className="flex flex-wrap items-center gap-2">
              {election.status === "closed" && !results && (
                <Button
                  onClick={() => tallyMutation.mutate()}
                  disabled={tallyMutation.isPending}
                  className="gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  {tallyMutation.isPending ? "Tallying..." : "Run Official Tally"}
                </Button>
              )}

              {election.status === "tallied" && results?.approval_status === "pending" && (
                <Button
                  variant="outline"
                  onClick={() => setShowApproveModal(true)}
                  className="gap-2 border-primary text-primary"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Approve Tally
                </Button>
              )}

              {election.status === "tallied" && results?.approval_status === "approved" && (
                <Button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Globe className="h-4 w-4" />
                  {publishMutation.isPending ? "Publishing..." : "Publish Results"}
                </Button>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* High-Level Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Total Ballots Cast</span>
            <p className="text-lg font-bold text-foreground">
              {results ? results.ballot_count.toLocaleString() : "Pending Tally"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Tally Computed At</span>
            <p>{results ? new Date(results.computed_at).toLocaleString() : "Not Computed"}</p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Tally Audit Status</span>
            <p className="font-medium capitalize text-foreground">
              {results ? results.approval_status : "Awaiting Tally"}
            </p>
          </div>
        </div>
      </div>

      {/* Results Content */}
      {isResultsLoading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Loading audited results...</p>
      ) : resultsError || !results ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Lock className="h-8 w-8 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base text-foreground">Results Not Available Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {!isPublished
                ? "This election results are confidential and will be displayed here once officially audited, approved, and published."
                : "Tally calculation has not been initiated for this election yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {results.positions.map((pos, pIdx) => (
            <Card key={pos.position_id} className="border border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-primary">Position #{pIdx + 1}</span>
                    <CardTitle className="text-lg">{pos.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {pos.total_votes.toLocaleString()} votes cast
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-4">
                  {pos.candidates.map((cand) => {
                    const isWinner = pos.winner_ids.includes(cand.candidate_id || "");

                    return (
                      <div
                        key={cand.candidate_id || cand.name}
                        className={`rounded-xl border p-4 transition-colors space-y-2 ${
                          isWinner
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-border bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isWinner && <Trophy className="h-4 w-4 text-emerald-600" />}
                            <span className="font-bold text-sm text-foreground">{cand.name}</span>
                            {isWinner && (
                              <Badge variant="success" className="text-[10px] py-0 px-1.5">
                                Elected
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-foreground">
                              {cand.votes.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1.5">
                              ({cand.percentage}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isWinner ? "bg-emerald-600" : "bg-primary"
                            }`}
                            style={{ width: `${cand.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Abstain Count */}
                {pos.abstain_count > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Abstentions</span>
                    <span>{pos.abstain_count.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full shadow-xl">
            <CardHeader>
              <CardTitle>Approve Tally for Publication</CardTitle>
              <CardDescription className="text-xs">
                Record official sign-off confirming that the computed tally matches audited expectations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Audit Reference / Remarks</label>
                <textarea
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  placeholder="e.g. Scrutinized and confirmed by Election Scrutineer Committee"
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Approving..." : "Confirm Tally Approval"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
