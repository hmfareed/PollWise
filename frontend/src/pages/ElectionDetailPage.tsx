import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
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
  Vote,
  Copy,
  Check,
  Printer,
  Download,
  AlertTriangle,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  AlertOctagon,
  Server,
  Zap,
} from "lucide-react";
import { apiClient, getAssetUrl } from "../lib/api-client";
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
import { AccessCodeManager } from "../components/admin/AccessCodeManager";
import { CertifiedCertificateModal } from "../components/reports/CertifiedCertificateModal";
import { ElectionReportsModal } from "../components/reports/ElectionReportsModal";
import { RecountRequestModal } from "../components/reports/RecountRequestModal";
import { EmergencyControlModal } from "../components/elections/EmergencyControlModal";
import { EmergencyStatusBanner } from "../components/elections/EmergencyStatusBanner";
import { TurnoutVelocityChart } from "../components/elections/TurnoutVelocityChart";
import { CandidatePhotoUpload } from "../components/admin/CandidatePhotoUpload";
import type { ElectionDetail, AuditEvent, LiveMonitoringData } from "../types/election";
import type { EligibilityRecord } from "../types/ballot";
import type { ElectionResult, RecountRequest } from "../types/results";

// ─── Inline primitive components (no shadcn tabs/progress/input) ───────────

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}
const TabsCtx = React.createContext<TabsContextValue>({
  active: "",
  setActive: () => undefined,
});

const Tabs: React.FC<{
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ defaultValue = "overview", value, onValueChange, children, className = "" }) => {
  const [internalActive, setInternalActive] = useState(defaultValue);
  const active = value !== undefined ? value : internalActive;
  const setActive = (val: string) => {
    if (value === undefined) setInternalActive(val);
    onValueChange?.(val);
  };
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
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
  photo_url?: string;
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
  paused: {
    label: "Paused",
    colorClass: "text-amber-700 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/40",
    borderClass: "border-amber-300 dark:border-amber-800",
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
  const [activeTab, setActiveTab] = useState("overview");
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
    photo_url: "",
  });

  // Tab 5 – Participation
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Tab 6 – Schedule
  const [scheduleForm, setScheduleForm] = useState({ opens_at: "", closes_at: "" });

  // Tab 7 – Security
  const [configHash, setConfigHash] = useState<string | null>(null);

  // Voting link copy state
  const [copiedVotingLink, setCopiedVotingLink] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showRecountModal, setShowRecountModal] = useState(false);
  const [emergencyModal, setEmergencyModal] = useState<{
    isOpen: boolean;
    actionType: "pause" | "resume" | "emergency_close" | "cancel";
  }>({ isOpen: false, actionType: "pause" });
  const votingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/elections/${id}/vote`
      : `/elections/${id}/vote`;

  const handleCopyVotingLink = async () => {
    try {
      await navigator.clipboard.writeText(votingUrl);
    } catch {
      const input = document.createElement("input");
      input.value = votingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopiedVotingLink(true);
    notify("Voting booth link copied to clipboard!");
    setTimeout(() => setCopiedVotingLink(false), 2500);
  };

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

  // ── Participation polling (Tab 5 & Overview metrics) ──
  const { data: eligibilityData, refetch: refetchEligibility } = useQuery<EligibilityRecord[]>({
    queryKey: ["election-eligibility-poll", id],
    queryFn: () => apiClient.getEligibility(id!),
    enabled: !!id && isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: accessCodesData, refetch: refetchAccessCodes } = useQuery({
    queryKey: ["access-codes", id],
    queryFn: () => apiClient.getAccessCodes(id!),
    enabled: !!id && isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: partSummary, refetch: refetchPartSummary } = useQuery({
    queryKey: ["election-participation-summary", id],
    queryFn: () => apiClient.getParticipationSummary(id!),
    enabled: !!id && isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: recounts, refetch: refetchRecounts } = useQuery<RecountRequest[]>({
    queryKey: ["election-recounts", id],
    queryFn: () => apiClient.getRecounts(id!),
    enabled: !!id && (election?.status === "tallied" || election?.status === "published"),
  });

  const {
    data: monitoringData,
    isLoading: isMonitoringLoading,
    refetch: refetchMonitoring,
  } = useQuery<LiveMonitoringData>({
    queryKey: ["election-monitoring", id],
    queryFn: () => apiClient.getElectionMonitoring(id!),
    enabled: !!id,
    refetchInterval: activeTab === "participation" ? 15000 : false,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = useCallback(() => {
    refetchEligibility();
    refetchAccessCodes();
    refetchPartSummary();
    if (election?.status === "tallied" || election?.status === "published") {
      refetchResults();
      refetchRecounts();
    }
    setLastRefreshed(new Date());
    setSecondsAgo(0);
  }, [refetchEligibility, refetchAccessCodes, refetchPartSummary, refetchResults, refetchRecounts, election?.status]);

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

  // ── Launch Readiness Prerequisite Computations ──
  const emptyPositions = (election?.positions || []).filter(
    (p) => !p.candidates || !p.candidates.some((c) => c.status === "active")
  );
  const hasNoPositions = !election?.positions || election.positions.length === 0;
  const hasNoSchedule = !election?.opens_at || !election?.closes_at;
  const isScheduleInvalid = !!(
    election?.opens_at &&
    election?.closes_at &&
    new Date(election.closes_at) <= new Date(election.opens_at)
  );
  const isClosingPassed = !!(
    election?.closes_at && new Date(election.closes_at) <= new Date()
  );
  const isDraftNotReady =
    hasNoPositions ||
    emptyPositions.length > 0 ||
    hasNoSchedule ||
    isScheduleInvalid ||
    isClosingPassed;

  // ── Mutations ──
  const notify = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
    setErrorMessage(null);
  };
  const handleError = (err: unknown, fallback: string) => {
    const e = err as { message?: string };
    const msg = e?.message || fallback;
    setErrorMessage(msg);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const invalidateElection = () =>
    queryClient.invalidateQueries({ queryKey: ["election", id] });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (hasNoPositions) {
        throw new Error("Election must contain at least one ballot position before scheduling.");
      }
      if (emptyPositions.length > 0) {
        const names = emptyPositions.map((p) => `"${p.title}"`).join(", ");
        throw new Error(
          `Cannot schedule election: Position ${names} ${
            emptyPositions.length > 1 ? "have" : "has"
          } no active candidates. Please add candidates or remove empty positions first.`
        );
      }
      if (hasNoSchedule) {
        throw new Error(
          "Opening and closing timestamps must be specified prior to scheduling. Please configure them in the Schedule tab."
        );
      }
      if (isScheduleInvalid) {
        throw new Error("Closing time must be strictly after opening time.");
      }
      try {
        await apiClient.approveLaunch(id!, {
          decision: "approved",
          reason: "Administrator scheduled election launch",
        });
      } catch {
        // Continue if already approved
      }
      return apiClient.scheduleElection(id!);
    },
    onSuccess: () => {
      invalidateElection();
      notify("Election scheduled successfully.");
    },
    onError: (err) => handleError(err, "Failed to schedule election"),
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      if (election?.status === "draft") {
        if (hasNoPositions) {
          throw new Error("Election must contain at least one ballot position before opening.");
        }
        if (emptyPositions.length > 0) {
          const names = emptyPositions.map((p) => `"${p.title}"`).join(", ");
          throw new Error(
            `Cannot open election: Position ${names} ${
              emptyPositions.length > 1 ? "have" : "has"
            } no active candidates. Please add candidates or remove empty positions first.`
          );
        }
        if (hasNoSchedule) {
          throw new Error(
            "Opening and closing timestamps must be configured in the Schedule tab before opening."
          );
        }
        if (isScheduleInvalid) {
          throw new Error("Closing time must be strictly after opening time.");
        }
        if (isClosingPassed) {
          throw new Error("Closing time has already passed. Please update the schedule before opening.");
        }
        try {
          await apiClient.approveLaunch(id!, {
            decision: "approved",
            reason: "Administrator direct open",
          });
        } catch {}
        await apiClient.scheduleElection(id!);
      }
      return apiClient.openElection(id!);
    },
    onSuccess: () => {
      invalidateElection();
      notify("Election is now open for voting.");
    },
    onError: (err) => handleError(err, "Failed to open election"),
  });

  // ── Prune Empty Positions & Open Modal Action ──
  const [showEmptyPositionsModal, setShowEmptyPositionsModal] = useState(false);
  const [isPruningAndOpening, setIsPruningAndOpening] = useState(false);
  const [modalActionError, setModalActionError] = useState<string | null>(null);

  const handleRemoveEmptyAndOpen = async () => {
    try {
      setIsPruningAndOpening(true);
      setModalActionError(null);
      for (const pos of emptyPositions) {
        await apiClient.deletePosition(pos.id);
      }
      try {
        await apiClient.approveLaunch(id!, {
          decision: "approved",
          reason: "Administrator direct open",
        });
      } catch {}
      await apiClient.scheduleElection(id!);
      await apiClient.openElection(id!);

      setShowEmptyPositionsModal(false);
      invalidateElection();
      notify("Election is now open for voting.");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setModalActionError(e?.message || "Failed to remove empty positions and open election.");
    } finally {
      setIsPruningAndOpening(false);
    }
  };

  const handleOpenClick = () => {
    if (election?.status === "draft") {
      if (hasNoPositions) {
        handleError(
          new Error("Election must contain at least one ballot position before opening."),
          "Cannot open election"
        );
        return;
      }
      if (emptyPositions.length > 0) {
        setModalActionError(null);
        setShowEmptyPositionsModal(true);
        return;
      }
      if (hasNoSchedule) {
        handleError(
          new Error("Opening and closing timestamps must be configured in the Schedule tab before opening."),
          "Cannot open election"
        );
        return;
      }
      if (isScheduleInvalid) {
        handleError(
          new Error("Closing time must be strictly after opening time."),
          "Cannot open election"
        );
        return;
      }
      if (isClosingPassed) {
        handleError(
          new Error("Closing time has already passed. Please update the schedule before opening."),
          "Cannot open election"
        );
        return;
      }
    }
    openMutation.mutate();
  };

  const closeMutation = useMutation({
    mutationFn: () => apiClient.closeElection(id!),
    onSuccess: () => {
      invalidateElection();
      notify("Election closed successfully.");
    },
    onError: (err) => handleError(err, "Failed to close election"),
  });

  const pauseMutation = useMutation({
    mutationFn: (reason: string) => apiClient.pauseElection(id!, reason),
    onSuccess: (updated) => {
      invalidateElection();
      queryClient.invalidateQueries({ queryKey: ["election-monitoring", id] });
      notify("Election paused successfully under emergency operational protocol.");
      setEmergencyModal({ isOpen: false, actionType: "pause" });
    },
    onError: (err) => handleError(err, "Failed to pause election"),
  });

  const resumeMutation = useMutation({
    mutationFn: (reason?: string) => apiClient.resumeElection(id!, reason),
    onSuccess: (updated) => {
      invalidateElection();
      queryClient.invalidateQueries({ queryKey: ["election-monitoring", id] });
      notify("Election resumed successfully. Voting is now open.");
      setEmergencyModal({ isOpen: false, actionType: "resume" });
    },
    onError: (err) => handleError(err, "Failed to resume election"),
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
    mutationFn: ({ approved, reason }: { approved: boolean; reason?: string }) =>
      apiClient.approveTally(id!, results?.id, {
        decision: approved ? "approved" : "rejected",
        approved,
        reason:
          reason ||
          (approved
            ? "Tally verified and approved by election authority"
            : "Tally rejected by election authority"),
      }),
    onSuccess: (_, vars) => {
      invalidateElection();
      queryClient.invalidateQueries({ queryKey: ["election-results", id] });
      queryClient.invalidateQueries({ queryKey: ["election-participation-summary", id] });
      refetchResults();
      refetchPartSummary();
      notify(
        vars.approved
          ? "Results approved successfully. You can now publish them."
          : "Results rejected."
      );
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
        photo_url: candidateForm.photo_url?.trim() || undefined,
      }),
    onSuccess: () => {
      invalidateElection();
      setCandidateForm({ position_id: "", name: "", biography: "", photo_url: "" });
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

  const summaryEligible = partSummary?.total_eligible ?? 0;
  const codesEligible = accessCodesData?.total_count ?? 0;
  const listEligible = eligibilityData?.length ?? eligibilityList?.length ?? 0;
  const rawEligible = Math.max(summaryEligible, codesEligible, listEligible);

  const summaryVoted = partSummary?.ballots_cast ?? 0;
  const resultsVoted = results?.ballot_count ?? 0;
  const codesVoted = accessCodesData?.used_count ?? 0;
  const listVoted =
    eligibilityData?.filter((r) => r.entitlement_status === "redeemed").length ??
    eligibilityList?.filter((r) => r.entitlement_status === "redeemed").length ??
    0;
  const totalVoted = Math.max(summaryVoted, resultsVoted, codesVoted, listVoted);
  const totalEligible = Math.max(rawEligible, totalVoted);

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

      {/* Emergency Status Banner when Paused */}
      {election.status === "paused" && (
        <div className="mb-6">
          <EmergencyStatusBanner
            election={election}
            onResume={() => setEmergencyModal({ isOpen: true, actionType: "resume" })}
            onClose={() => {
              if (
                window.confirm(
                  "Close this paused election? Voting will be permanently concluded and ballot collections frozen for tallying."
                )
              ) {
                closeMutation.mutate();
              }
            }}
            isResuming={resumeMutation.isPending}
            isClosing={closeMutation.isPending}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <CardContent className="space-y-4">
                {/* Inline error for immediate visibility */}
                {errorMessage && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-danger">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                      <span>{errorMessage}</span>
                    </div>
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline ml-2 shrink-0 cursor-pointer"
                    >
                      dismiss
                    </button>
                  </div>
                )}

                {/* Pre-flight readiness guidance for draft elections */}
                {election.status === "draft" && isDraftNotReady && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Action Required Before Opening</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-amber-800">
                      {hasNoPositions && (
                        <li>At least one ballot position is required before launching.</li>
                      )}
                      {emptyPositions.length > 0 && (
                        <li>
                          {emptyPositions.length} position{emptyPositions.length > 1 ? "s have" : " has"} no candidates:{" "}
                          <span className="font-semibold">{emptyPositions.map((p) => p.title).join(", ")}</span>.
                          {" "}Every position must have at least one active candidate.
                        </li>
                      )}
                      {hasNoSchedule && (
                        <li>Voting schedule (opens at & closes at) must be configured in the Schedule tab.</li>
                      )}
                      {isScheduleInvalid && (
                        <li>Voting closing time must be strictly after opening time.</li>
                      )}
                      {isClosingPassed && (
                        <li>Voting closing time has already passed. Please update the schedule.</li>
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {emptyPositions.length > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100/70 text-amber-900 cursor-pointer"
                            onClick={() => setActiveTab("candidates")}
                          >
                            Add Candidates →
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100/70 text-amber-900 cursor-pointer"
                            onClick={() => setActiveTab("positions")}
                          >
                            Manage Positions →
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer"
                            onClick={() => {
                              setModalActionError(null);
                              setShowEmptyPositionsModal(true);
                            }}
                          >
                            Resolve & Open Options →
                          </Button>
                        </>
                      )}
                      {(hasNoSchedule || isScheduleInvalid || isClosingPassed) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100/70 text-amber-900 cursor-pointer"
                          onClick={() => setActiveTab("schedule")}
                        >
                          Configure Schedule →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyVotingLink}
                    className="gap-1.5 text-xs h-9 cursor-pointer border-border hover:bg-muted"
                  >
                    {copiedVotingLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Voter Link</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReportsModal(true)}
                    className="gap-1.5 text-xs h-9 cursor-pointer border-border hover:bg-muted"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Reports & Exports</span>
                  </Button>

                  {election.status === "draft" && (
                    <>
                      <Button
                        onClick={handleOpenClick}
                        disabled={openMutation.isPending || scheduleMutation.isPending || isPruningAndOpening}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                      >
                        <Vote className="h-4 w-4" />
                        {openMutation.isPending || isPruningAndOpening ? "Opening…" : "Open Election Now"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => scheduleMutation.mutate()}
                        disabled={scheduleMutation.isPending || openMutation.isPending || isPruningAndOpening}
                        className="gap-2 cursor-pointer"
                      >
                        <Lock className="h-4 w-4" />
                        {scheduleMutation.isPending ? "Scheduling…" : "Schedule Election"}
                      </Button>
                    </>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/elections/${id}/vote`}>
                      <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        <Vote className="h-4 w-4" />
                        Cast Ballot
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold"
                      onClick={() => setEmergencyModal({ isOpen: true, actionType: "pause" })}
                      disabled={pauseMutation.isPending || closeMutation.isPending}
                    >
                      <PauseCircle className="h-4 w-4" />
                      Pause Election
                    </Button>
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
                      disabled={closeMutation.isPending || pauseMutation.isPending}
                    >
                      {closeMutation.isPending ? "Closing…" : "Close Election"}
                    </Button>
                  </div>
                )}

                {election.status === "paused" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      onClick={() => setEmergencyModal({ isOpen: true, actionType: "resume" })}
                      disabled={resumeMutation.isPending || closeMutation.isPending}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {resumeMutation.isPending ? "Resuming…" : "Resume Election"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Close this paused election? Voting will be permanently concluded and ballot collections frozen for tallying."
                          )
                        ) {
                          closeMutation.mutate();
                        }
                      }}
                      disabled={closeMutation.isPending || resumeMutation.isPending}
                    >
                      {closeMutation.isPending ? "Closing…" : "Close Election"}
                    </Button>
                  </div>
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
                  <div className="flex flex-wrap gap-2 items-center">
                    {results?.approval_status === "approved" ? (
                      <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Publish these approved results? They will become publicly visible to all voters."
                            )
                          ) {
                            publishMutation.mutate();
                          }
                        }}
                        disabled={publishMutation.isPending}
                      >
                        <Trophy className="h-4 w-4" />
                        {publishMutation.isPending ? "Publishing…" : "Publish Results"}
                      </Button>
                    ) : (
                      <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Approve and certify these results? Once approved, they can be published to voters."
                            )
                          ) {
                            approveResultsMutation.mutate({ approved: true });
                          }
                        }}
                        disabled={approveResultsMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {approveResultsMutation.isPending ? "Approving…" : "Approve Results"}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        if (window.confirm("Reject these results? This will require re-tallying.")) {
                          approveResultsMutation.mutate({ approved: false });
                        }
                      }}
                      disabled={approveResultsMutation.isPending || publishMutation.isPending}
                    >
                      Reject Results
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setShowRecountModal(true)}
                      disabled={approveResultsMutation.isPending || publishMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Request Recount
                    </Button>
                  </div>
                )}

                {election.status === "published" && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Link to={`/elections/${election.id}/results`}>
                      <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Trophy className="h-4 w-4" />
                        View Public Results
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setShowRecountModal(true)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Request Recount
                    </Button>
                  </div>
                )}

                {["draft", "scheduled", "open", "paused", "closed", "tallied", "published"].indexOf(election.status) === -1 && (
                  <p className="text-sm text-muted-foreground">
                    No actions available for status: <strong>{election.status}</strong>
                  </p>
                )}
                </div>
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
                      {pos.candidates && pos.candidates.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {pos.candidates.length} candidate{pos.candidates.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveTab("candidates")}
                          className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          0 candidates — add candidate →
                        </button>
                      )}
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
                    {pos.candidates && pos.candidates.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {pos.candidates.length} candidate{pos.candidates.length !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                        0 candidates (Action required)
                      </Badge>
                    )}
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
                <CandidatePhotoUpload
                  value={candidateForm.photo_url}
                  onChange={(url) =>
                    setCandidateForm((f) => ({ ...f, photo_url: url }))
                  }
                />
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
                    onClick={() => {
                      setCandidateForm({ position_id: "", name: "", biography: "", photo_url: "" });
                      setShowAddCandidate(false);
                    }}
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
                      {cand.photo_url ? (
                        <img
                          src={getAssetUrl(cand.photo_url)}
                          alt={cand.name}
                          className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                          {cand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
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
            TAB 4 – Voters (Physical Access Codes)
        ═══════════════════════════════════════════ */}
        <TabsContent value="voters" className="mt-6 space-y-4">
          <AccessCodeManager
            electionId={id!}
            electionTitle={election?.title}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 5 – Participation (Monitoring)
        ═══════════════════════════════════════════ */}
        <TabsContent value="participation" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Participation Monitor</h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(apiClient.getReportExportUrl(id!, "turnout", "csv"), "_blank")}
                className="gap-1.5 text-xs"
              >
                <Download className="h-4 w-4" />
                Export Turnout CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualRefresh}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
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
                <CardTitle className="text-base font-bold">Live Turnout Statistics</CardTitle>
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

          {/* Infrastructure Health Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 border border-border/80 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Ballot Ingestion Service</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-bold text-sm text-foreground">
                <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="capitalize">{monitoringData?.health?.ballot_box_status || "Healthy"}</span>
              </div>
            </Card>

            <Card className="p-4 border border-border/80 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Single-Use Credential Service</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-bold text-sm text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="capitalize">{monitoringData?.health?.credential_service_status || "Active"}</span>
              </div>
            </Card>

            <Card className="p-4 border border-border/80 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Database Storage</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-bold text-sm text-foreground">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="capitalize">{monitoringData?.health?.database_status || "Connected"}</span>
              </div>
            </Card>
          </div>

          {/* Turnout Velocity Chart */}
          <TurnoutVelocityChart
            velocity={monitoringData?.velocity || []}
            isLoading={isMonitoringLoading}
          />

          {/* Departmental Participation Breakdown (Doc 01 §11.2 Privacy Threshold) */}
          {monitoringData?.departmental_turnout && monitoringData.departmental_turnout.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Departmental Turnout Breakdown</CardTitle>
                    <CardDescription className="text-xs">
                      Registered groups and participation rate per institutional unit
                    </CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    Doc 01 §11.2 Privacy Protected
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-medium">Department / Faculty</th>
                        <th className="py-2.5 px-3 text-right font-medium">Eligible Voters</th>
                        <th className="py-2.5 px-3 text-right font-medium">Ballots Cast</th>
                        <th className="py-2.5 px-3 text-right font-medium">Turnout %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {monitoringData.departmental_turnout.map((dept, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                            <span>{dept.department}</span>
                            {dept.is_suppressed && (
                              <Badge variant="outline" className="text-2xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                                Privacy Suppressed (&lt; 10 voters)
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">{dept.eligible_count}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {dept.voted_count}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-primary">
                            {dept.turnout_percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>
                    Subgroups with fewer than 10 registered voters are aggregated to prevent deduction of individual voting participation (Doc 01 §11.2).
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Audit Log</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(apiClient.getReportExportUrl(id!, "audit_trail", "csv"), "_blank")}
              className="gap-1.5 text-xs"
            >
              <Download className="h-4 w-4" />
              Export Audit Trail (CSV)
            </Button>
          </div>

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
              <div className="grid sm:grid-cols-4 gap-4">
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
                    <p className="text-xs text-muted-foreground">Tally Version</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold">
                        v{results.result_version || 1}
                      </span>
                      {results.result_version && results.result_version > 1 ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Recount
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted/40">
                          Original
                        </Badge>
                      )}
                    </div>
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

              {/* Recount Audit History */}
              {recounts && recounts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-amber-500" />
                      Official Recount & Dispute Audit History
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Chronological ledger of formal recount requests and deterministic recalculations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recounts.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-xl border border-border bg-surface-alt/40 p-4 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 capitalize"
                            >
                              {rec.status}
                            </Badge>
                            <span className="font-semibold text-foreground">
                              Formal Recount Request
                            </span>
                          </div>
                          <span className="text-muted-foreground text-[11px]">
                            {new Date(rec.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-foreground leading-relaxed">
                          <span className="text-muted-foreground font-medium">Justification: </span>
                          {rec.reason}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Actions for tallied status */}
              {election.status === "tallied" && isAuthenticated && (
                <Card>
                  <CardContent className="p-5 flex flex-wrap gap-3 items-center">
                    {results?.approval_status === "approved" ? (
                      <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Publish these approved results? They will become publicly visible to all voters."
                            )
                          ) {
                            publishMutation.mutate();
                          }
                        }}
                        disabled={publishMutation.isPending}
                      >
                        <Trophy className="h-4 w-4" />
                        {publishMutation.isPending ? "Publishing…" : "Publish Results"}
                      </Button>
                    ) : (
                      <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={async () => {
                          if (
                            window.confirm(
                              "Approve and publish these results? Once published, they will become publicly accessible to all voters."
                            )
                          ) {
                            try {
                              await approveResultsMutation.mutateAsync({ approved: true });
                              publishMutation.mutate();
                            } catch {
                              // Error handled by approveResultsMutation
                            }
                          }
                        }}
                        disabled={approveResultsMutation.isPending || publishMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {approveResultsMutation.isPending || publishMutation.isPending
                          ? "Publishing…"
                          : "Approve & Publish Results"}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Publishing makes results publicly accessible.
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* View public results link and export controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(apiClient.getResultsExportUrl(id!, "csv"), "_blank")}
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-4 w-4" />
                  Export Results CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCertificateModal(true)}
                  className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Printer className="h-4 w-4" />
                  Official Certificate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRecountModal(true)}
                  className="gap-1.5 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Request Recount
                </Button>
                {election.status === "published" && (
                  <Link to={`/elections/${election.id}/results`}>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Trophy className="h-4 w-4" />
                      View Public Results Page
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Reports and Certificate Modals */}
      <CertifiedCertificateModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        election={election}
        results={results ?? null}
      />
      <ElectionReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        electionId={id!}
        electionTitle={election.title}
        isPublished={election.status === "published"}
        onOpenCertificate={() => setShowCertificateModal(true)}
      />
      <RecountRequestModal
        isOpen={showRecountModal}
        onClose={() => setShowRecountModal(false)}
        electionId={id!}
        electionTitle={election.title}
        currentVersion={results?.result_version || 1}
        onSuccess={() => {
          invalidateElection();
          queryClient.invalidateQueries({ queryKey: ["election-results", id] });
          queryClient.invalidateQueries({ queryKey: ["election-recounts", id] });
          refetchResults();
          refetchRecounts();
          notify("Recount requested successfully. New tally version created.");
        }}
      />

      {/* Emergency Control Modal */}
      <EmergencyControlModal
        isOpen={emergencyModal.isOpen}
        actionType={emergencyModal.actionType}
        electionTitle={election.title}
        isSubmitting={pauseMutation.isPending || resumeMutation.isPending || closeMutation.isPending}
        onClose={() => setEmergencyModal({ isOpen: false, actionType: "pause" })}
        onConfirm={(reason) => {
          if (emergencyModal.actionType === "pause") {
            pauseMutation.mutate(reason);
          } else if (emergencyModal.actionType === "resume") {
            resumeMutation.mutate(reason);
          } else if (emergencyModal.actionType === "emergency_close") {
            closeMutation.mutate();
          }
        }}
      />

      {/* Empty Positions Action Modal */}
      {showEmptyPositionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">Action Required Before Opening</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every ballot position must have at least one active candidate before an election can open. The following {emptyPositions.length} position{emptyPositions.length > 1 ? "s do" : " does"} not have any candidates:
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 max-h-48 overflow-y-auto">
              {emptyPositions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-card border border-border/60">
                  <span className="font-semibold text-foreground">{pos.title}</span>
                  <Badge variant="outline" className="text-2xs text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 font-medium">
                    0 candidates
                  </Badge>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              You can remove these unfilled positions and open the election immediately, or add candidates in the Candidates tab.
            </p>

            {modalActionError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg text-xs text-danger flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalActionError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEmptyPositionsModal(false)}
                disabled={isPruningAndOpening}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowEmptyPositionsModal(false);
                  setActiveTab("candidates");
                }}
                disabled={isPruningAndOpening}
                className="cursor-pointer"
              >
                Add Candidates →
              </Button>
              <Button
                size="sm"
                onClick={handleRemoveEmptyAndOpen}
                disabled={isPruningAndOpening}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                <Vote className="h-4 w-4" />
                {isPruningAndOpening ? "Opening Election…" : "Remove Empty Positions & Open Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
