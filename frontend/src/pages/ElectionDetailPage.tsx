import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Shield,
  ShieldCheck,
  Users,
  UserPlus,
  BarChart3,
  Calendar,
  FileText,
  Activity,
  Trophy,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  Lock,
} from "lucide-react";
import { apiClient, fetchApi } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { StatusBadge } from "../components/ui/status-badge";
import { Badge } from "../components/ui/badge";
import type { ElectionDetail, AuditEvent } from "../types/election";
import type { EligibilityRecord } from "../types/ballot";
import type { ElectionResult } from "../types/results";

// ─── Inline primitive components (no shadcn tabs/progress/input) ───────────

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}
const TabsCtx = React.createContext<TabsContextValue>({
  active: "",
  setActive: () => undefined,
});

const Tabs: React.FC<{ defaultValue: string; children: React.ReactNode }> = ({
  defaultValue,
  children,
}) => {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div>{children}</div>
    </TabsCtx.Provider>
  );
};

const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`flex flex-wrap gap-1 rounded-xl bg-muted p-1 ${className}`}
    role="tablist"
  >
    {children}
  </div>
);

const TabsTrigger: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className = "" }) => {
  const { active, setActive } = React.useContext(TabsCtx);
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
        ${isActive
          ? "bg-white shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-white/50"
        } ${className}`}
    >
      {children}
    </button>
  );
};

const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className = "" }) => {
  const { active } = React.useContext(TabsCtx);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
};

// Simple progress bar
const ProgressBar: React.FC<{ value: number; className?: string; colorClass?: string }> = ({
  value,
  className = "",
  colorClass = "bg-primary",
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`h-2 w-full rounded-full bg-muted overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

// Simple inline input
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = "",
  ...props
}) => (
  <input
    className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 ${className}`}
    {...props}
  />
);

// Simple inline textarea
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = "",
  ...props
}) => (
  <textarea
    className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 ${className}`}
    {...props}
  />
);

// ─── Types ─────────────────────────────────────────────────────────────────

interface AddPositionFormState {
  title: string;
  description: string;
  max_selections: number;
}

interface AddCandidateFormState {
  position_id: string;
  name: string;
  biography: string;
}

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  draft: {
    label: "Draft",
    colorClass: "text-gray-600",
    bgClass: "bg-gray-100",
    borderClass: "border-gray-300",
  },
  scheduled: {
    label: "Scheduled",
    colorClass: "text-blue-700",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-300",
  },
  open: {
    label: "Open",
    colorClass: "text-green-700",
    bgClass: "bg-green-50",
    borderClass: "border-green-300",
  },
  closed: {
    label: "Closed",
    colorClass: "text-amber-700",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-300",
  },
  tallied: {
    label: "Tallied",
    colorClass: "text-purple-700",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-300",
  },
  published: {
    label: "Published",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    colorClass: "text-red-700",
    bgClass: "bg-red-50",
    borderClass: "border-red-300",
  },
};

// ─── Main Page Component ────────────────────────────────────────────────────

export const ElectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // ── State ──
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 2 – Positions
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [positionForm, setPositionForm] = useState<AddPositionFormState>({
    title: "",
    description: "",
    max_selections: 1,
  });

  // Tab 3 – Candidates
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [candidateForm, setCandidateForm] = useState<AddCandidateFormState>({
    position_id: "",
    name: "",
    biography: "",
  });

  // Tab 4 – Voters
  const [voterEmail, setVoterEmail] = useState("");

  // Tab 5 – Participation
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Tab 6 – Schedule
  const [scheduleForm, setScheduleForm] = useState({ opens_at: "", closes_at: "" });

  // Tab 7 – Security
  const [configHash, setConfigHash] = useState<string | null>(null);

  // ── Queries ──
  const {
    data: election,
    isLoading,
    error,
  } = useQuery<ElectionDetail>({
    queryKey: ["election", id],
    queryFn: () => apiClient.getElection(id!),
    enabled: !!id,
  });

  const { data: eligibilityList } = useQuery<EligibilityRecord[]>({
    queryKey: ["election-eligibility", id],
    queryFn: () => apiClient.getEligibility(id!),
    enabled: !!id && isAuthenticated,
  });

  const { data: auditTrail } = useQuery<AuditEvent[]>({
    queryKey: ["election-audit", id],
    queryFn: () => apiClient.getElectionAudit(id!),
    enabled: !!id && isAuthenticated,
  });

  const { data: results, refetch: refetchResults } = useQuery<ElectionResult>({
    queryKey: ["election-results", id],
    queryFn: () => apiClient.getResults(id!),
    enabled: !!id && (election?.status === "tallied" || election?.status === "published"),
    retry: false,
  });

  // ── Participation polling (Tab 5) ──
  const { data: eligibilityData, refetch: refetchEligibility } = useQuery<EligibilityRecord[]>({
    queryKey: ["election-eligibility-poll", id],
    queryFn: () => apiClient.getEligibility(id!),
    enabled: !!id && isAuthenticated,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = useCallback(() => {
    refetchEligibility();
    setLastRefreshed(new Date());
    setSecondsAgo(0);
  }, [refetchEligibility]);

  // ── Compute SHA-256 config fingerprint ──
  useEffect(() => {
    if (!election) return;
    const fingerprint = JSON.stringify({
      id: election.id,
      title: election.title,
      status: election.status,
      voting_method: election.voting_method,
      configuration_version: election.configuration_version,
      opens_at: election.opens_at,
      closes_at: election.closes_at,
      timezone: election.timezone,
    });
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(fingerprint))
      .then((buf) => {
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setConfigHash(hex);
      })
      .catch(() => setConfigHash(null));
  }, [election]);

  // ── Pre-fill schedule form ──
  useEffect(() => {
    if (election) {
      setScheduleForm({
        opens_at: election.opens_at
          ? new Date(election.opens_at).toISOString().slice(0, 16)
          : "",
        closes_at: election.closes_at
          ? new Date(election.closes_at).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [election]);

  // ── Mutations ──
  const notify = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
    setErrorMessage(null);
  };
  const handleError = (err: unknown, fallback: string) => {
    const e = err as { message?: string };
    setErrorMessage(e?.message || fallback);
  };

  const invalidateElection = () =>
    queryClient.invalidateQueries({ queryKey: ["election", id] });

  const scheduleMutation = useMutation({
    mutationFn: () => apiClient.scheduleElection(id!),
    onSuccess: () => {
      invalidateElection();
      notify("Election scheduled successfully.");
    },
    onError: (err) => handleError(err, "Failed to schedule election"),
  });

  const openMutation = useMutation({
    mutationFn: () => apiClient.openElection(id!),
    onSuccess: () => {
      invalidateElection();
      notify("Election is now open for voting.");
    },
    onError: (err) => handleError(err, "Failed to open election"),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiClient.closeElection(id!),
    onSuccess: () => {
      invalidateElection();
      notify("Election closed successfully.");
    },
    onError: (err) => handleError(err, "Failed to close election"),
  });

  const tallyMutation = useMutation({
    mutationFn: () => apiClient.computeTally(id!),
    onSuccess: () => {
      invalidateElection();
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      notify("Tally computed successfully.");
    },
    onError: (err) => handleError(err, "Failed to compute tally"),
  });

  const approveResultsMutation = useMutation({
    mutationFn: ({ approved }: { approved: boolean }) =>
      fetchApi<{ approval_id: string; decision: string; status: string }>(
        `/results/elections/${id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ approved }),
        }
      ),
    onSuccess: (_, vars) => {
      invalidateElection();
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      notify(vars.approved ? "Results approved." : "Results rejected.");
    },
    onError: (err) => handleError(err, "Failed to process results approval"),
  });

  const addPositionMutation = useMutation({
    mutationFn: () =>
      apiClient.addPosition(id!, {
        title: positionForm.title,
        description: positionForm.description || undefined,
        max_selections: positionForm.max_selections,
      }),
    onSuccess: () => {
      invalidateElection();
      setPositionForm({ title: "", description: "", max_selections: 1 });
      setShowAddPosition(false);
      notify("Position added.");
    },
    onError: (err) => handleError(err, "Failed to add position"),
  });

  const removePositionMutation = useMutation({
    mutationFn: (posId: string) => apiClient.deletePosition(posId),
    onSuccess: () => {
      invalidateElection();
      notify("Position removed.");
    },
    onError: (err) => handleError(err, "Failed to remove position"),
  });

  const addCandidateMutation = useMutation({
    mutationFn: () =>
      apiClient.addCandidate(candidateForm.position_id, {
        name: candidateForm.name,
        biography: candidateForm.biography || undefined,
      }),
    onSuccess: () => {
      invalidateElection();
      setCandidateForm({ position_id: "", name: "", biography: "" });
      setShowAddCandidate(false);
      notify("Candidate added.");
    },
    onError: (err) => handleError(err, "Failed to add candidate"),
  });

  const removeCandidateMutation = useMutation({
    mutationFn: (candidateId: string) => apiClient.deleteCandidate(candidateId),
    onSuccess: () => {
      invalidateElection();
      notify("Candidate removed.");
    },
    onError: (err) => handleError(err, "Failed to remove candidate"),
  });

  const addVoterMutation = useMutation({
    mutationFn: () =>
      apiClient.addEligibleVoter(id!, { email: voterEmail.trim() }),
    onSuccess: () => {
      setVoterEmail("");
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", id] });
      queryClient.invalidateQueries({ queryKey: ["election-eligibility-poll", id] });
      notify("Voter added to eligibility roll.");
    },
    onError: (err) => handleError(err, "Failed to add voter"),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: () =>
      apiClient.updateElection(id!, {
        opens_at: scheduleForm.opens_at ? new Date(scheduleForm.opens_at).toISOString() : undefined,
        closes_at: scheduleForm.closes_at ? new Date(scheduleForm.closes_at).toISOString() : undefined,
      }),
    onSuccess: () => {
      invalidateElection();
      notify("Schedule updated.");
    },
    onError: (err) => handleError(err, "Failed to update schedule"),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishResults(id!),
    onSuccess: () => {
      invalidateElection();
      refetchResults();
      notify("Results published successfully.");
    },
    onError: (err) => handleError(err, "Failed to publish results"),
  });

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm">Loading election details…</p>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-danger mx-auto" />
        <h2 className="text-lg font-bold">Election Not Found</h2>
        <p className="text-xs text-muted-foreground">
          This election does not exist or access is restricted.
        </p>
        <Link to="/elections">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Elections
          </Button>
        </Link>
      </div>
    );
  }

  // Derived stats
  const totalPositions = election.positions?.length ?? 0;
  const totalCandidates =
    election.positions?.reduce((acc, p) => acc + (p.candidates?.length ?? 0), 0) ?? 0;
  const totalEligible = eligibilityData?.length ?? eligibilityList?.length ?? 0;
  const totalVoted =
    eligibilityData?.filter((r) => r.entitlement_status === "redeemed").length ??
    eligibilityList?.filter((r) => r.entitlement_status === "redeemed").length ??
    0;
  const participationRate = totalEligible > 0 ? (totalVoted / totalEligible) * 100 : 0;

  const canEditSchedule =
    election.status === "draft" || election.status === "scheduled";

  const statusCfg = STATUS_CONFIG[election.status] ?? STATUS_CONFIG["draft"];

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/elections"
          className="hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Elections
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-xs">
          {election.title}
        </span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={election.status} />
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusCfg.bgClass} ${statusCfg.colorClass} ${statusCfg.borderClass}`}
              >
                {election.status === "draft" ? "Editable Draft" : "Configuration Frozen"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {election.title}
            </h1>
            {election.description && (
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {election.description}
              </p>
            )}
          </div>
        </div>

        {/* Notification banners */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-danger">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errorMessage}
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-auto text-xs underline hover:no-underline"
            >
              dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="overview">
            <FileText className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="positions">
            <BarChart3 className="h-3.5 w-3.5" /> Positions
          </TabsTrigger>
          <TabsTrigger value="candidates">
            <Users className="h-3.5 w-3.5" /> Candidates
          </TabsTrigger>
          <TabsTrigger value="voters">
            <UserPlus className="h-3.5 w-3.5" /> Voters
          </TabsTrigger>
          <TabsTrigger value="participation">
            <Activity className="h-3.5 w-3.5" /> Participation
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="h-3.5 w-3.5" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Clock className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
          <TabsTrigger value="results">
            <Trophy className="h-3.5 w-3.5" /> Results
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════
            TAB 1 – Overview
        ═══════════════════════════════════════════ */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Positions", value: totalPositions, icon: <BarChart3 className="h-5 w-5 text-primary" /> },
              { label: "Candidates", value: totalCandidates, icon: <Users className="h-5 w-5 text-blue-500" /> },
              { label: "Eligible Voters", value: totalEligible, icon: <UserPlus className="h-5 w-5 text-emerald-500" /> },
              { label: "Ballots Cast", value: totalVoted, icon: <CheckCircle2 className="h-5 w-5 text-purple-500" /> },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5 flex flex-col gap-2">
                  {stat.icon}
                  <span className="text-3xl font-extrabold text-foreground">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Participation rate */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Participation Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {totalVoted} of {totalEligible} voters
                </span>
                <span className="text-primary">{participationRate.toFixed(1)}%</span>
              </div>
              <ProgressBar
                value={participationRate}
                colorClass={
                  participationRate >= 75
                    ? "bg-emerald-500"
                    : participationRate >= 40
                    ? "bg-blue-500"
                    : "bg-amber-500"
                }
              />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Election Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">Opens</p>
                  <p className="text-sm font-semibold">
                    {election.opens_at
                      ? new Date(election.opens_at).toLocaleString()
                      : "TBD"}
                  </p>
                </div>
                <div className="flex-1 flex items-center gap-1">
                  <div className="h-px flex-1 bg-border" />
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="text-center min-w-[120px]">
                  <p className="text-xs text-muted-foreground mb-1">Closes</p>
                  <p className="text-sm font-semibold">
                    {election.closes_at
                      ? new Date(election.closes_at).toLocaleString()
                      : "TBD"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Timezone: {election.timezone}
              </p>
            </CardContent>
          </Card>

          {/* Lifecycle actions */}
          {isAuthenticated && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lifecycle Actions</CardTitle>
                <CardDescription>
                  Advance or manage this election's status.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {election.status === "draft" && (
                  <Button
                    onClick={() => scheduleMutation.mutate()}
                    disabled={scheduleMutation.isPending}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    {scheduleMutation.isPending ? "Scheduling…" : "Schedule Election"}
                  </Button>
                )}

                {election.status === "scheduled" && (
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => openMutation.mutate()}
                    disabled={openMutation.isPending}
                  >
                    {openMutation.isPending ? "Opening…" : "Open Election"}
                  </Button>
                )}

                {election.status === "open" && (
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Close this election? Voters will no longer be able to cast ballots."
                        )
                      ) {
                        closeMutation.mutate();
                      }
                    }}
                    disabled={closeMutation.isPending}
                  >
                    {closeMutation.isPending ? "Closing…" : "Close Election"}
                  </Button>
                )}

                {election.status === "closed" && (
                  <Button
                    className="gap-2"
                    onClick={() => tallyMutation.mutate()}
                    disabled={tallyMutation.isPending}
                  >
                    <BarChart3 className="h-4 w-4" />
                    {tallyMutation.isPending ? "Computing…" : "Compute Tally"}
                  </Button>
                )}

                {election.status === "tallied" && (
                  <div className="flex gap-2">
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => approveResultsMutation.mutate({ approved: true })}
                      disabled={approveResultsMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Results
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        if (window.confirm("Reject these results? This will require re-tallying.")) {
                          approveResultsMutation.mutate({ approved: false });
                        }
                      }}
                      disabled={approveResultsMutation.isPending}
                    >
                      Reject Results
                    </Button>
                  </div>
                )}

                {election.status === "published" && (
                  <Link to={`/elections/${election.id}/results`}>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Trophy className="h-4 w-4" />
                      View Public Results
                    </Button>
                  </Link>
                )}

                {["draft", "scheduled", "open", "closed", "tallied", "published"].indexOf(election.status) === -1 && (
                  <p className="text-sm text-muted-foreground">
                    No actions available for status: <strong>{election.status}</strong>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Positions & Candidates Preview */}
          {election.positions && election.positions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ballot Positions ({totalPositions})</CardTitle>
                <CardDescription>
                  Positions contested in this election. Switch to the Positions tab to configure or add candidates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {election.positions.map((pos) => (
                  <div key={pos.id} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-foreground">{pos.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {pos.candidates?.length ?? 0} candidate{(pos.candidates?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {pos.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{pos.description}</p>
                    )}
                    {pos.candidates && pos.candidates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {pos.candidates.map((cand) => (
                          <span
                            key={cand.id}
                            className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-card border border-border text-foreground font-medium shadow-xs"
                          >
                            {cand.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 2 – Positions
        ═══════════════════════════════════════════ */}
        <TabsContent value="positions" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Ballot Positions ({totalPositions})
            </h2>
            {isAuthenticated && election.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddPosition((v) => !v)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Position
              </Button>
            )}
          </div>

          {/* Add Position inline form */}
          {showAddPosition && (
            <Card className="border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Title *</label>
                  <Input
                    placeholder="e.g. Student Body President"
                    value={positionForm.title}
                    onChange={(e) =>
                      setPositionForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    placeholder="Optional description of this position…"
                    rows={2}
                    value={positionForm.description}
                    onChange={(e) =>
                      setPositionForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Max Selections</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={positionForm.max_selections}
                    onChange={(e) =>
                      setPositionForm((f) => ({
                        ...f,
                        max_selections: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="w-24"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => addPositionMutation.mutate()}
                    disabled={!positionForm.title.trim() || addPositionMutation.isPending}
                  >
                    {addPositionMutation.isPending ? "Adding…" : "Add Position"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddPosition(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {election.positions?.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No positions added yet. Use "Add Position" to create ballot positions.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {election.positions?.map((pos, idx) => (
              <Card key={pos.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-primary">
                      Position #{idx + 1}
                    </span>
                    <CardTitle className="text-base">{pos.title}</CardTitle>
                    {pos.description && (
                      <CardDescription className="text-xs">
                        {pos.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      Max {pos.max_selections} selection
                      {pos.max_selections !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {pos.candidates?.length ?? 0} candidates
                    </Badge>
                    {isAuthenticated && election.status === "draft" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:text-danger hover:bg-red-50 h-7 w-7 p-0"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove position "${pos.title}"? This will also remove all its candidates.`
                            )
                          ) {
                            removePositionMutation.mutate(pos.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 3 – Candidates
        ═══════════════════════════════════════════ */}
        <TabsContent value="candidates" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Candidates ({totalCandidates})
            </h2>
            {isAuthenticated && election.status === "draft" && totalPositions > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddCandidate((v) => !v)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Candidate
              </Button>
            )}
          </div>

          {/* Add Candidate form */}
          {showAddCandidate && (
            <Card className="border-primary/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Candidate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Position *</label>
                  <select
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={candidateForm.position_id}
                    onChange={(e) =>
                      setCandidateForm((f) => ({ ...f, position_id: e.target.value }))
                    }
                  >
                    <option value="">— Select position —</option>
                    {election.positions?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Name *</label>
                  <Input
                    placeholder="Candidate full name"
                    value={candidateForm.name}
                    onChange={(e) =>
                      setCandidateForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Biography</label>
                  <Textarea
                    rows={3}
                    placeholder="Brief biography or platform statement…"
                    value={candidateForm.biography}
                    onChange={(e) =>
                      setCandidateForm((f) => ({ ...f, biography: e.target.value }))
                    }
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => addCandidateMutation.mutate()}
                    disabled={
                      !candidateForm.position_id ||
                      !candidateForm.name.trim() ||
                      addCandidateMutation.isPending
                    }
                  >
                    {addCandidateMutation.isPending ? "Adding…" : "Add Candidate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddCandidate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {totalCandidates === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No candidates yet. Add positions first, then add candidates to each position.
              </CardContent>
            </Card>
          )}

          {election.positions?.map((pos) =>
            (pos.candidates?.length ?? 0) > 0 ? (
              <div key={pos.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {pos.title}
                </h3>
                <div className="grid gap-3">
                  {pos.candidates?.map((cand) => (
                    <Card key={cand.id} className="flex flex-row items-center gap-4 p-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                        {cand.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{cand.name}</p>
                        {cand.biography && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {cand.biography}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={cand.status === "active" ? "success" : "secondary"}
                          className="text-xs"
                        >
                          {cand.status}
                        </Badge>
                        {isAuthenticated && election.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:text-danger hover:bg-red-50 h-7 w-7 p-0"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove candidate "${cand.name}" from this election?`
                                )
                              ) {
                                removeCandidateMutation.mutate(cand.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 4 – Voters
        ═══════════════════════════════════════════ */}
        <TabsContent value="voters" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Eligible Voters ({totalEligible})
            </h2>
          </div>

          {/* Add voter */}
          {isAuthenticated && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Eligible Voter</CardTitle>
                <CardDescription className="text-xs">
                  Register a voter by their institutional email address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="voter@institution.edu"
                    value={voterEmail}
                    onChange={(e) => setVoterEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => addVoterMutation.mutate()}
                    disabled={!voterEmail.trim() || addVoterMutation.isPending}
                  >
                    {addVoterMutation.isPending ? "Adding…" : "Add Voter"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Bulk Import:</strong> Use CSV import in the main Voters tab for bulk operations.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Voter list */}
          <Card>
            <CardContent className="p-0">
              {(!eligibilityList || eligibilityList.length === 0) ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No voters registered on this eligibility roll yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {eligibilityList.map((elig) => {
                    const voted = elig.entitlement_status === "redeemed";
                    return (
                      <div
                        key={elig.id}
                        className="flex items-center gap-3 px-5 py-3 text-sm"
                      >
                        {voted ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {elig.user_email ?? elig.user_id}
                          </p>
                          {elig.user_name && (
                            <p className="text-xs text-muted-foreground">{elig.user_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant={voted ? "success" : "secondary"}
                            className="text-xs"
                          >
                            {voted ? "Voted" : "Not voted"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 5 – Participation (Monitoring)
        ═══════════════════════════════════════════ */}
        <TabsContent value="participation" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Participation Monitor</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Privacy notice */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
            <span>
              <strong>Secret Ballot Protection:</strong> Individual voter selections are secret and not accessible
              to administrators. Only aggregate participation counts are shown here.
            </span>
          </div>

          {/* Live stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Live Statistics</CardTitle>
                <span className="text-xs text-muted-foreground">
                  Updated {secondsAgo}s ago ({lastRefreshed.toLocaleTimeString()})
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>
                  {totalVoted} ballots cast
                </span>
                <span>
                  {totalEligible} eligible voters
                </span>
              </div>
              <ProgressBar
                value={participationRate}
                className="h-4"
                colorClass={
                  participationRate >= 75
                    ? "bg-emerald-500"
                    : participationRate >= 40
                    ? "bg-blue-500"
                    : "bg-amber-500"
                }
              />
              <p className="text-center text-2xl font-extrabold text-primary">
                {participationRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          {/* Breakdown table */}
          {totalEligible > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Metric</th>
                      <th className="pb-2 font-medium text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2">Eligible Voters</td>
                      <td className="py-2 text-right font-semibold">{totalEligible}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Ballots Cast</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">{totalVoted}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Yet to Vote</td>
                      <td className="py-2 text-right font-semibold text-amber-700">
                        {totalEligible - totalVoted}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Participation Rate</td>
                      <td className="py-2 text-right font-semibold text-primary">
                        {participationRate.toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 6 – Schedule
        ═══════════════════════════════════════════ */}
        <TabsContent value="schedule" className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">Election Schedule</h2>

          {/* Current schedule display */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                label: "Opens At",
                value: election.opens_at
                  ? new Date(election.opens_at).toLocaleString()
                  : "Not set",
                icon: <Clock className="h-5 w-5 text-blue-500" />,
              },
              {
                label: "Closes At",
                value: election.closes_at
                  ? new Date(election.closes_at).toLocaleString()
                  : "Not set",
                icon: <Clock className="h-5 w-5 text-amber-500" />,
              },
              {
                label: "Timezone",
                value: election.timezone,
                icon: <Calendar className="h-5 w-5 text-emerald-500" />,
              },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-5 flex items-start gap-3">
                  {item.icon}
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Visual timeline bar */}
          {election.opens_at && election.closes_at && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground shrink-0">Opens</span>
                  <div className="flex-1 flex items-center">
                    <div className="h-1 w-4 bg-blue-300 rounded-l-full" />
                    <div className="flex-1 h-2 bg-gradient-to-r from-blue-400 to-amber-400 rounded" />
                    <div className="h-1 w-4 bg-amber-300 rounded-r-full" />
                  </div>
                  <span className="text-muted-foreground shrink-0">Closes</span>
                </div>
                <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
                  <span>{new Date(election.opens_at).toLocaleDateString()}</span>
                  <span>{new Date(election.closes_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Edit form */}
          {isAuthenticated && canEditSchedule ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Edit Schedule</CardTitle>
                <CardDescription className="text-xs">
                  Adjust the opening and closing times for this election.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Opens At</label>
                    <Input
                      type="datetime-local"
                      value={scheduleForm.opens_at}
                      onChange={(e) =>
                        setScheduleForm((f) => ({ ...f, opens_at: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Closes At</label>
                    <Input
                      type="datetime-local"
                      value={scheduleForm.closes_at}
                      onChange={(e) =>
                        setScheduleForm((f) => ({ ...f, closes_at: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <Button
                  onClick={() => updateScheduleMutation.mutate()}
                  disabled={updateScheduleMutation.isPending}
                  className="gap-2"
                >
                  {updateScheduleMutation.isPending ? "Saving…" : "Save Schedule"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            !canEditSchedule && (
              <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Schedule is locked once the election is open or beyond.
              </div>
            )
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 7 – Security
        ═══════════════════════════════════════════ */}
        <TabsContent value="security" className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">Security & Integrity</h2>

          {/* Config fingerprint */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Configuration Fingerprint</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-mono bg-muted rounded p-2 break-all">
                {configHash ?? "Computing…"}
              </p>
              <p className="text-xs text-muted-foreground">
                SHA-256 of election metadata. Configuration locked since:{" "}
                <strong>{new Date(election.created_at).toLocaleString()}</strong>
              </p>
              {election.configuration_hash && (
                <p className="text-xs text-muted-foreground">
                  Server-side hash:{" "}
                  <span className="font-mono">{election.configuration_hash}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Security checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Security Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Secret ballot",
                  detail: "Credentials omitted from ballot endpoint; voter identity never linked to selections.",
                },
                {
                  label: "Audit trail enabled",
                  detail: "Every lifecycle action and configuration change is cryptographically logged.",
                },
                {
                  label: "Voter eligibility verification",
                  detail: "Only pre-registered eligible voters may obtain voting credentials.",
                },
                {
                  label: "Single vote per eligible voter",
                  detail: "One-time credentials prevent duplicate ballot submission.",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Separation notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
            <span>
              <strong>Database Separation:</strong> PollWise uses separation of databases to prevent linking
              ballots to voter identities. The ballot database never receives authentication cookies.
            </span>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 8 – Activity (Audit Log)
        ═══════════════════════════════════════════ */}
        <TabsContent value="activity" className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">Audit Log</h2>

          {!isAuthenticated ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Sign in to view the audit log for this election.
              </CardContent>
            </Card>
          ) : !auditTrail || auditTrail.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">No audit entries yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Audit entries for this election will appear here as actions are taken.
                  The global audit log in the admin panel contains all records.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {auditTrail.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-5 py-3.5 flex items-start justify-between gap-4 text-sm"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono font-semibold text-foreground text-xs">
                          {ev.event_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Outcome:{" "}
                          <span className="text-emerald-700 font-medium">
                            {ev.outcome}
                          </span>
                          {ev.actor_id && (
                            <> · by <span className="font-medium">{ev.actor_id}</span></>
                          )}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0 tabular-nums">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 9 – Results
        ═══════════════════════════════════════════ */}
        <TabsContent value="results" className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">Election Results</h2>

          {election.status !== "tallied" && election.status !== "published" ? (
            <Card>
              <CardContent className="p-12 text-center space-y-3">
                <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-base font-semibold">Results not yet available</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Results will appear here once the election is closed and tallied by election
                  officials.
                </p>
              </CardContent>
            </Card>
          ) : !results ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Loading results…
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Results summary */}
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground">Total Ballots</p>
                    <p className="text-3xl font-extrabold mt-1">{results.ballot_count}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-semibold mt-1 capitalize">
                      {results.approval_status}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground">Computed At</p>
                    <p className="text-sm font-semibold mt-1">
                      {new Date(results.computed_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Per-position results */}
              {results.positions.map((posResult) => (
                <Card key={posResult.position_id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{posResult.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {posResult.total_votes} total votes
                      {posResult.abstain_count > 0 && ` · ${posResult.abstain_count} abstentions`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {posResult.candidates
                      .slice()
                      .sort((a, b) => b.votes - a.votes)
                      .map((cand) => {
                        const isWinner =
                          cand.candidate_id !== null &&
                          cand.candidate_id !== undefined &&
                          posResult.winner_ids.includes(cand.candidate_id);
                        return (
                          <div key={cand.name} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium flex items-center gap-1.5">
                                {isWinner && (
                                  <Trophy className="h-4 w-4 text-amber-500" />
                                )}
                                {cand.name}
                                {isWinner && (
                                  <Badge variant="success" className="text-xs ml-1">
                                    Winner
                                  </Badge>
                                )}
                              </span>
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {cand.votes} votes ({cand.percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <ProgressBar
                              value={cand.percentage}
                              colorClass={isWinner ? "bg-amber-400" : "bg-muted-foreground/30"}
                            />
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              ))}

              {/* Actions for tallied status */}
              {election.status === "tallied" && isAuthenticated && (
                <Card>
                  <CardContent className="p-5 flex flex-wrap gap-3 items-center">
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        approveResultsMutation.mutate({ approved: true });
                        setTimeout(() => publishMutation.mutate(), 800);
                      }}
                      disabled={approveResultsMutation.isPending || publishMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approveResultsMutation.isPending || publishMutation.isPending
                        ? "Publishing…"
                        : "Approve & Publish Results"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Publishing makes results publicly accessible.
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* View public results link */}
              {election.status === "published" && (
                <div className="flex">
                  <Link to={`/elections/${election.id}/results`}>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Trophy className="h-4 w-4" />
                      View Public Results Page
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
