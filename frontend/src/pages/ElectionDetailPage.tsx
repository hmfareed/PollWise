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
  AlertCircle,
  Vote,
  Users,
  CheckCircle2,
  UserPlus
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
  const [showAddVoterModal, setShowAddVoterModal] = useState(false);
  const [voterEmailInput, setVoterEmailInput] = useState("");
  const [bulkEmailsInput, setBulkEmailsInput] = useState("");
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

  const { data: participation } = useQuery({
    queryKey: ["participation", id],
    queryFn: () => apiClient.getMyParticipation(id!),
    enabled: !!id && isAuthenticated,
  });

  const { data: eligibilityList } = useQuery({
    queryKey: ["election-eligibility", id],
    queryFn: () => apiClient.getEligibility(id!),
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

  const addVoterMutation = useMutation({
    mutationFn: () => apiClient.addEligibleVoter(id!, { email: voterEmailInput.trim() }),
    onSuccess: () => {
      setVoterEmailInput("");
      setShowAddVoterModal(false);
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to add voter to roll"),
  });

  const bulkImportMutation = useMutation({
    mutationFn: () => {
      const parsedEmails = bulkEmailsInput
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes("@"));
      return apiClient.bulkImportEligibility(id!, parsedEmails);
    },
    onSuccess: () => {
      setBulkEmailsInput("");
      setShowAddVoterModal(false);
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", id] });
      setErrorMessage(null);
    },
    onError: (err: any) => setErrorMessage(err?.message || "Failed to bulk import voters"),
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

      {/* Published / Tallied / Closed Results Banner */}
      {(election.status === "published" || election.status === "tallied" || election.status === "closed") && (
        <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-blue-950">
              {election.status === "published"
                ? "Official Results Published"
                : election.status === "tallied"
                ? "Election Tallied (Awaiting Publication Approval)"
                : "Election Voting Concluded"}
            </h3>
            <p className="text-xs text-blue-800">
              {election.status === "published"
                ? "Certified election outcomes and vote distributions are available for public inspection."
                : election.status === "tallied"
                ? "The election has been tallied and is undergoing managerial audit review."
                : "This election is closed. Tally calculation can now be initiated by election officials."}
            </p>
          </div>
          <Link to={`/elections/${election.id}/results`}>
            <Button className="gap-2 self-start sm:self-auto bg-primary">
              View Election Results
            </Button>
          </Link>
        </div>
      )}
      {election.status === "open" && (
        <div className="p-5 rounded-2xl border border-emerald-300 bg-emerald-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              </span>
              <h3 className="font-bold text-base text-emerald-950">Voting Is Currently Open</h3>
            </div>
            <p className="text-xs text-emerald-800">
              {participation?.has_voted
                ? "You have already cast your secret ballot for this election. Thank you for participating!"
                : participation?.is_eligible
                ? "You are authorized as an eligible voter. You may now proceed to the secure voting booth."
                : "Eligible voters may cast their ballots until the election closes."}
            </p>
          </div>

          <div>
            {participation?.has_voted ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-900 gap-1.5 py-1.5 px-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                Ballot Cast
              </Badge>
            ) : participation?.is_eligible ? (
              <Link to={`/elections/${election.id}/vote`}>
                <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800 shadow">
                  <Vote className="h-4 w-4" />
                  Cast Your Ballot
                </Button>
              </Link>
            ) : (
              <Link to={`/elections/${election.id}/vote`}>
                <Button variant="secondary" className="gap-1.5 text-xs">
                  Enter Voting Booth
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

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

      {/* Voter Eligibility Roster (Auditor / Manager View) */}
      {isAuthenticated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Voter Eligibility Roll</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Verified institutional voters authorized to request single-use voting credentials.
              </CardDescription>
            </div>
            {election.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => setShowAddVoterModal(true)} className="gap-1.5 text-xs">
                <UserPlus className="h-3.5 w-3.5" />
                Add Eligible Voters
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(!eligibilityList || eligibilityList.length === 0) ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                No voters registered on this eligibility roll yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {eligibilityList.slice(0, 10).map((elig) => (
                  <div key={elig.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{elig.user_email || elig.user_id}</p>
                      {elig.user_name && <p className="text-[11px] text-muted-foreground">{elig.user_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {elig.eligibility_status}
                      </Badge>
                      <Badge
                        variant={elig.entitlement_status === "redeemed" ? "success" : "secondary"}
                        className="text-[10px]"
                      >
                        {elig.entitlement_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Add Eligible Voters Modal */}
      {showAddVoterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="max-w-lg w-full shadow-xl">
            <CardHeader>
              <CardTitle>Register Eligible Voters</CardTitle>
              <CardDescription className="text-xs">
                Add verified institutional members to the authorized voter registry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Single Voter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Add Individual by Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="student@university.edu"
                    value={voterEmailInput}
                    onChange={(e) => setVoterEmailInput(e.target.value)}
                    className="flex-1 p-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    onClick={() => addVoterMutation.mutate()}
                    disabled={!voterEmailInput.trim() || addVoterMutation.isPending}
                    className="text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-muted-foreground">OR BULK IMPORT</span></div>
              </div>

              {/* Bulk Import */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Paste Email Roster (One per line)</label>
                <textarea
                  rows={4}
                  placeholder="alice@university.edu&#10;bob@university.edu&#10;carol@university.edu"
                  value={bulkEmailsInput}
                  onChange={(e) => setBulkEmailsInput(e.target.value)}
                  className="w-full p-2 text-xs font-mono rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bulkImportMutation.mutate()}
                  disabled={!bulkEmailsInput.trim() || bulkImportMutation.isPending}
                  className="w-full text-xs"
                >
                  {bulkImportMutation.isPending ? "Importing Roster..." : "Import Email Roll"}
                </Button>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setShowAddVoterModal(false)} className="text-xs">
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
