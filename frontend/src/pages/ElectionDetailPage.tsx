import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Play, 
  Square, 
  History, 
  ArrowLeft, 
  User, 
  AlertCircle
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { StatusBadge } from "../components/ui/status-badge";
import { Badge } from "../components/ui/badge";

export const ElectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [approvalReason, setApprovalReason] = useState("");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: election, isLoading, error } = useQuery({
    queryKey: ["election", id],
    queryFn: () => apiClient.getElection(id!),
    enabled: !!id,
  });

  const { data: auditTrail } = useQuery({
    queryKey: ["election-audit", id],
    queryFn: () => apiClient.getElectionAudit(id!),
    enabled: !!id && isAuthenticated,
  });

  const scheduleMutation = useMutation({
    mutationFn: () => apiClient.scheduleElection(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      queryClient.invalidateQueries({ queryKey: ["election-audit", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to schedule election"),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.approveLaunch(id!, {
        decision: "approved",
        reason: approvalReason || "Approved by institutional manager",
      }),
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      queryClient.invalidateQueries({ queryKey: ["election-audit", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to record approval"),
  });

  const openMutation = useMutation({
    mutationFn: () => apiClient.openElection(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      queryClient.invalidateQueries({ queryKey: ["election-audit", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to open election"),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiClient.closeElection(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      queryClient.invalidateQueries({ queryKey: ["election-audit", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to close election"),
  });

  if (isLoading) {
    return <div className="text-center py-16 text-xs text-muted-foreground">Loading election details...</div>;
  }

  if (error || !election) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-danger mx-auto" />
        <h2 className="text-lg font-bold">Election Not Found</h2>
        <p className="text-xs text-muted-foreground">This election does not exist or access is restricted.</p>
        <Link to="/elections">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Elections
          </Button>
        </Link>
      </div>
    );
  }

  const isLocked = election.status !== "draft";

  return (
    <div className="space-y-8">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/elections" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          All Elections
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{election.title}</span>
      </div>

      {/* Election Header Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={election.status} />
              {isLocked ? (
                <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-primary">
                  <Lock className="h-3 w-3" />
                  Configuration Frozen
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
                  <Unlock className="h-3 w-3" />
                  Editable Draft
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {election.title}
            </h1>
          </div>

          {/* Lifecycle Action Bar (If authenticated) */}
          {isAuthenticated && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {election.status === "draft" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowApprovalModal(true)}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Approve Launch
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => scheduleMutation.mutate()}
                    disabled={scheduleMutation.isPending}
                    className="gap-1.5"
                  >
                    <Lock className="h-4 w-4" />
                    {scheduleMutation.isPending ? "Freezing..." : "Freeze & Schedule"}
                  </Button>
                </>
              )}

              {election.status === "scheduled" && (
                <Button
                  size="sm"
                  onClick={() => openMutation.mutate()}
                  disabled={openMutation.isPending}
                  className="gap-1.5 bg-success hover:bg-emerald-700"
                >
                  <Play className="h-4 w-4" />
                  {openMutation.isPending ? "Opening..." : "Open Election"}
                </Button>
              )}

              {election.status === "open" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  className="gap-1.5"
                >
                  <Square className="h-4 w-4" />
                  {closeMutation.isPending ? "Closing..." : "Close Election"}
                </Button>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {election.description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {election.description}
          </p>
        )}

        {/* Technical Integrity Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Configuration Hash</span>
            <p className="font-mono text-[11px] truncate" title={election.configuration_hash || "Pending schedule"}>
              {election.configuration_hash || "Unfrozen (Calculated at schedule)"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Timeline</span>
            <p>
              {election.opens_at ? new Date(election.opens_at).toLocaleString() : "TBD"} –{" "}
              {election.closes_at ? new Date(election.closes_at).toLocaleString() : "TBD"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-foreground">Voting Rules</span>
            <p>Single Choice per Position · Secret Ballot</p>
          </div>
        </div>
      </div>

      {/* Ballot Positions & Candidates */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Ballot Positions ({election.positions?.length || 0})
          </h2>
        </div>

        {(!election.positions || election.positions.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center text-xs text-muted-foreground">
              No ballot positions have been added to this election.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6">
          {election.positions?.map((pos, idx) => (
            <Card key={pos.id} className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/70 border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-primary">Position #{idx + 1}</span>
                    <CardTitle className="text-lg">{pos.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Select exactly {pos.max_selections} candidate
                  </Badge>
                </div>
                {pos.description && (
                  <CardDescription className="pt-1 text-xs">{pos.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Candidates ({pos.candidates?.length || 0})
                </h4>
                {(!pos.candidates || pos.candidates.length === 0) ? (
                  <p className="text-xs text-amber-600 italic">No candidates registered for this position.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {pos.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="rounded-xl border border-border p-4 space-y-2 bg-surface hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{cand.name}</p>
                            <Badge
                              variant={cand.status === "active" ? "success" : "secondary"}
                              className="text-[10px] mt-0.5"
                            >
                              {cand.status}
                            </Badge>
                          </div>
                        </div>
                        {cand.biography && (
                          <p className="text-xs text-muted-foreground line-clamp-3 pt-1">
                            {cand.biography}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Audit Event Trail Section */}
      {isAuthenticated && auditTrail && auditTrail.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Immutable Lifecycle Audit Trail</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Every configuration change, approval, and state transition is cryptographically logged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-2">
              {auditTrail.map((ev) => (
                <div key={ev.id} className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-border text-xs">
                  <div className="space-y-1">
                    <span className="font-mono font-semibold text-foreground">{ev.event_type}</span>
                    <p className="text-slate-500 text-[11px]">
                      Outcome: <span className="font-semibold text-success">{ev.outcome}</span>
                    </p>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Launch Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full shadow-xl">
            <CardHeader>
              <CardTitle>Record Launch Approval</CardTitle>
              <CardDescription>
                Provide formal administrative sign-off before this election can be scheduled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Approval Reason / Minutes Reference</label>
                <textarea
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="e.g. Approved in Committee meeting #42"
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Recording..." : "Confirm Approval"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
