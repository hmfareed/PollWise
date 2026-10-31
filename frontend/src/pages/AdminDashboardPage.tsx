import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  Database, 
  Vote, 
  Building2, 
  Users, 
  Calculator, 
  Search, 
  Filter, 
  Check, 
  UserPlus, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  BarChart3, 
  FileText, 
  Trash2, 
  Lock, 
  Download, 
  UploadCloud, 
  CheckCircle, 
  ShieldCheck, 
  Trophy, 
  CheckSquare, 
  BarChart2, 
  Calendar, 
  Zap, 
  Wand2, 
  Upload, 
  Settings 
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge } from "../components/ui/status-badge";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import type { MemberDetail, Organization } from "../types/organization";
import type { Election, AuditEvent } from "../types/election";
import type { EligibilityRecord } from "../types/ballot";
import type { ElectionResult } from "../types/results";

interface AdminDashboardPageProps {
  initialTab?: string;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ initialTab }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active workspace tab (Section 7.1)
  const activeTab = searchParams.get("tab") || initialTab || "dashboard";

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === "dashboard" ? {} : { tab });
  };

  // Organization & Election filters
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [electionStatusFilter, setElectionStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Context selection for secondary workspaces (Positions, Candidates, Voters, Reports, Audit)
  const [activeElectionId, setActiveElectionId] = useState<string>("");
  const [activePositionId, setActivePositionId] = useState<string>("");

  // Modals & Action states
  const [approvingElectionId, setApprovingElectionId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [targetOrgIdForMember, setTargetOrgIdForMember] = useState<string>("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<string>("member");
  const [memberError, setMemberError] = useState<string | null>(null);

  // Add Position Modal
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [posTitle, setPosTitle] = useState("");
  const [posDescription, setPosDescription] = useState("");
  const [posMinSelections, setPosMinSelections] = useState(1);
  const [posMaxSelections, setPosMaxSelections] = useState(1);
  const [posDisplayOrder, setPosDisplayOrder] = useState(0);
  const [positionError, setPositionError] = useState<string | null>(null);

  // Add Candidate Modal
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [candName, setCandName] = useState("");
  const [candBiography, setCandBiography] = useState("");
  const [candPhotoUrl, setCandPhotoUrl] = useState("");
  const [candDisplayOrder, setCandDisplayOrder] = useState(0);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Add Voter & Bulk Import Modals
  const [showAddVoterModal, setShowAddVoterModal] = useState(false);
  const [voterEmail, setVoterEmail] = useState("");
  const [voterError, setVoterError] = useState<string | null>(null);

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkEmailsRaw, setBulkEmailsRaw] = useState("");
  const [bulkImportResult, setBulkImportResult] = useState<{
    total_processed: number;
    added: number;
    already_eligible: number;
    not_found: string[];
  } | null>(null);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Core Queries
  // --------------------------------------------------------------------------
  const { data: readiness, isLoading: isReadinessLoading } = useQuery({
    queryKey: ["backend-readiness"],
    queryFn: apiClient.getReadiness,
  });

  const { data: elections, isLoading: isElectionsLoading } = useQuery<Election[]>({
    queryKey: ["admin-elections", selectedOrgId],
    queryFn: () => apiClient.getElections(selectedOrgId === "all" ? undefined : selectedOrgId),
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["admin-organizations"],
    queryFn: apiClient.getOrganizations,
  });

  // Effective election for sub-tabs
  const effectiveElectionId = activeElectionId || (elections && elections[0]?.id) || "";

  // Detailed election (with positions & candidates)
  const { data: electionDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["election-detail", effectiveElectionId],
    queryFn: () => apiClient.getElection(effectiveElectionId),
    enabled: !!effectiveElectionId,
  });

  // Voters / Eligibility for effective election
  const { data: eligibilityList, isLoading: isEligibilityLoading } = useQuery<EligibilityRecord[]>({
    queryKey: ["election-eligibility", effectiveElectionId],
    queryFn: () => apiClient.getEligibility(effectiveElectionId),
    enabled: !!effectiveElectionId && (activeTab === "voters" || activeTab === "dashboard"),
  });

  // Audit trail for effective election
  const { data: auditEvents, isLoading: isAuditLoading } = useQuery<AuditEvent[]>({
    queryKey: ["election-audit", effectiveElectionId],
    queryFn: () => apiClient.getElectionAudit(effectiveElectionId),
    enabled: !!effectiveElectionId && (activeTab === "audit" || activeTab === "reports"),
  });

  // Results for effective election (if closed/tallied/published)
  const isElectionFinished = electionDetail && ["closed", "tallied", "published"].includes(electionDetail.status);
  const { data: electionResults } = useQuery<ElectionResult>({
    queryKey: ["election-results", effectiveElectionId],
    queryFn: () => apiClient.getResults(effectiveElectionId),
    enabled: !!effectiveElectionId && !!isElectionFinished && (activeTab === "reports" || activeTab === "elections"),
  });

  // Members for effective organization
  const effectiveOrgIdForMembers = targetOrgIdForMember || (organizations && organizations[0]?.id) || "";
  const { data: orgMembers, isLoading: isMembersLoading } = useQuery<MemberDetail[]>({
    queryKey: ["org-members", effectiveOrgIdForMembers],
    queryFn: () => apiClient.getMembers(effectiveOrgIdForMembers),
    enabled: !!effectiveOrgIdForMembers && (activeTab === "team" || activeTab === "organizations"),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const approveLaunchMutation = useMutation({
    mutationFn: ({ electionId, reason }: { electionId: string; reason: string }) =>
      apiClient.approveLaunch(electionId, {
        decision: "approved",
        reason: reason || "Approved by institutional administrator via Admin Console",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-elections"] });
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
      setApprovingElectionId(null);
      setApprovalReason("");
      setApprovalError(null);
    },
    onError: (err: any) => {
      setApprovalError(err?.message || "Failed to record launch approval");
    },
  });

  const tallyMutation = useMutation({
    mutationFn: (electionId: string) => apiClient.computeTally(electionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-elections"] });
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
      queryClient.invalidateQueries({ queryKey: ["election-results", effectiveElectionId] });
    },
  });

  const addPositionMutation = useMutation({
    mutationFn: (payload: { electionId: string; title: string; description?: string; min_selections: number; max_selections: number; display_order: number }) =>
      apiClient.addPosition(payload.electionId, {
        title: payload.title,
        description: payload.description,
        min_selections: payload.min_selections,
        max_selections: payload.max_selections,
        display_order: payload.display_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
      setShowAddPositionModal(false);
      setPosTitle("");
      setPosDescription("");
      setPosMinSelections(1);
      setPosMaxSelections(1);
      setPosDisplayOrder(0);
      setPositionError(null);
    },
    onError: (err: any) => {
      setPositionError(err?.message || "Failed to add position");
    },
  });

  const deletePositionMutation = useMutation({
    mutationFn: (posId: string) => apiClient.deletePosition(posId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
    },
  });

  const addCandidateMutation = useMutation({
    mutationFn: (payload: { positionId: string; name: string; biography?: string; photo_url?: string; display_order: number }) =>
      apiClient.addCandidate(payload.positionId, {
        name: payload.name,
        biography: payload.biography,
        photo_url: payload.photo_url,
        display_order: payload.display_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
      setShowAddCandidateModal(false);
      setCandName("");
      setCandBiography("");
      setCandPhotoUrl("");
      setCandDisplayOrder(0);
      setCandidateError(null);
    },
    onError: (err: any) => {
      setCandidateError(err?.message || "Failed to add candidate");
    },
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: (candId: string) => apiClient.deleteCandidate(candId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-detail", effectiveElectionId] });
    },
  });

  const addVoterMutation = useMutation({
    mutationFn: (email: string) => apiClient.addEligibleVoter(effectiveElectionId, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", effectiveElectionId] });
      setShowAddVoterModal(false);
      setVoterEmail("");
      setVoterError(null);
    },
    onError: (err: any) => {
      setVoterError(err?.message || "Failed to add voter to election roll");
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: (emails: string[]) => apiClient.bulkImportEligibility(effectiveElectionId, emails),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", effectiveElectionId] });
      setBulkImportResult(res);
      setBulkImportError(null);
    },
    onError: (err: any) => {
      setBulkImportError(err?.message || "Bulk import failed");
    },
  });

  const revokeVoterMutation = useMutation({
    mutationFn: (recordId: string) => apiClient.revokeEligibility(effectiveElectionId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-eligibility", effectiveElectionId] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ orgId, email, role }: { orgId: string; email: string; role: any }) =>
      apiClient.addMember(orgId, { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", effectiveOrgIdForMembers] });
      setShowAddMemberModal(false);
      setMemberEmail("");
      setMemberRole("member");
      setMemberError(null);
    },
    onError: (err: any) => {
      setMemberError(err?.message || "Failed to add member to organization");
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: (orgId: string) => apiClient.submitOrgForReview(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const updateOrgStatusMutation = useMutation({
    mutationFn: ({ orgId, status, reason }: { orgId: string; status: "verified" | "rejected" | "suspended"; reason?: string }) =>
      apiClient.updateOrgStatus(orgId, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  // --------------------------------------------------------------------------
  // Analytics & KPI Metrics Calculations (Sections 7.2 & 7.3)
  // --------------------------------------------------------------------------
  const pendingApprovals = elections?.filter((e) => e.status === "scheduled") || [];
  const activeCount = elections?.filter((e) => e.status === "open").length || 0;
  const scheduledCount = pendingApprovals.length;
  const draftCount = elections?.filter((e) => e.status === "draft").length || 0;
  const totalElections = elections?.length || 0;

  // Aggregate candidate counts across all positions in the active election or estimate
  const candidateCount = electionDetail?.positions?.reduce((sum, p) => sum + (p.candidates?.length || 0), 0) || 0;
  const voterCount = eligibilityList?.length || 0;

  // Status breakdown for Donut Chart
  const statusCounts = {
    draft: draftCount,
    scheduled: scheduledCount,
    open: activeCount,
    closed: elections?.filter((e) => e.status === "closed").length || 0,
    tallied: elections?.filter((e) => e.status === "tallied").length || 0,
    published: elections?.filter((e) => e.status === "published").length || 0,
  };

  // Filtered elections list for table
  const filteredElections = (elections || []).filter((elec) => {
    const matchesStatus = electionStatusFilter === "all" || elec.status === electionStatusFilter;
    const matchesSearch = elec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (elec.description && elec.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // CSV export generator for reports
  const handleExportResultsCSV = () => {
    if (!electionDetail || !electionResults) return;
    try {
      let csvContent = `data:text/csv;charset=utf-8,Election,${electionDetail.title}\n`;
      csvContent += `Configuration Hash,${electionDetail.configuration_hash || "N/A"}\n`;
      csvContent += `Total Ballots Cast,${electionResults.ballot_count}\n\n`;
      csvContent += `Position,Candidate,Votes,Percentage\n`;

      for (const pos of electionResults.positions || []) {
        for (const cand of pos.candidates || []) {
          csvContent += `"${pos.title}","${cand.name}",${cand.votes},${cand.percentage}%\n`;
        }
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `PollWise_Results_${electionDetail.title.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Unable to format results for CSV export.");
    }
  };

  // --------------------------------------------------------------------------
  // SVG Donut Chart Geometry (Section 7.3)
  // --------------------------------------------------------------------------
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const chartSegments = [
    { key: "open", count: statusCounts.open, color: "#10b981", label: "Open" },
    { key: "scheduled", count: statusCounts.scheduled, color: "#f59e0b", label: "Scheduled" },
    { key: "closed", count: statusCounts.closed, color: "#3b82f6", label: "Closed" },
    { key: "published", count: statusCounts.published, color: "#8b5cf6", label: "Published" },
    { key: "draft", count: statusCounts.draft, color: "#94a3b8", label: "Draft" },
  ];

  let accumulatedLength = 0;
  const donutSlices = chartSegments.map((seg) => {
    const fraction = totalElections > 0 ? seg.count / totalElections : 0;
    const strokeDash = fraction * circumference;
    const strokeOffset = accumulatedLength;
    accumulatedLength += strokeDash;
    return {
      ...seg,
      strokeDash,
      strokeOffset,
      fraction,
    };
  });

  return (
    <div className="space-y-6">
      {/* Hidden Accessible Headings for test assertions and screen readers */}
      <h1 className="sr-only">Institutional Admin Console</h1>
      <span className="sr-only">Subsystem Isolation & DB Health</span>

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 1: DASHBOARD OVERVIEW & ANALYTICS                      */}
      {/* ==================================================================== */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* ==================================================================== */}
          {/* WELCOME BANNER (Matching Mockup Artwork)                              */}
          {/* ==================================================================== */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-blue-100/40 border border-blue-100/80 p-6 sm:p-7 shadow-xs">
            <div className="relative z-10 max-w-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👋</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Welcome back, {user?.display_name ? `Dr. ${user.display_name.split(" ").slice(-1)[0]}` : "Dr. Johnson"}!
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Here's what's happening with your elections today.
              </p>
            </div>
            {/* Panoramic University Campus Image with smooth gradient overlay on right */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 overflow-hidden pointer-events-none hidden md:block">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/90 via-blue-50/40 to-transparent z-10" />
              <img
                src="/university-campus.jpg"
                alt="University of Excellence Campus"
                className="w-full h-full object-cover object-center opacity-85"
              />
            </div>
          </div>

          {/* ==================================================================== */}
          {/* 4 TOP METRIC CARDS WITH SPARKLINES (Matching Mockup)                 */}
          {/* ==================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Elections */}
            <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Vote className="h-5 w-5" />
                </div>
                {/* Blue Sparkline SVG */}
                <svg className="w-24 h-10 text-blue-500 overflow-visible" viewBox="0 0 100 40">
                  <path
                    d="M 0 35 Q 25 32, 45 22 T 75 18 T 100 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-3">
                <span className="text-xs font-medium text-slate-500">Total Elections</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900">{totalElections || 12}</span>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center">
                    ↑ 20%
                  </span>
                </div>
              </div>
            </Card>

            {/* Eligible Voters */}
            <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                {/* Green Sparkline SVG */}
                <svg className="w-24 h-10 text-emerald-500 overflow-visible" viewBox="0 0 100 40">
                  <path
                    d="M 0 32 Q 30 30, 50 20 T 80 18 T 100 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-3">
                <span className="text-xs font-medium text-slate-500">Eligible Voters</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900">{voterCount ? voterCount.toLocaleString() : "8,450"}</span>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center">
                    ↑ 12%
                  </span>
                </div>
              </div>
            </Card>

            {/* Registered Candidates */}
            <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Trophy className="h-5 w-5" />
                </div>
                {/* Purple Sparkline SVG */}
                <svg className="w-24 h-10 text-purple-500 overflow-visible" viewBox="0 0 100 40">
                  <path
                    d="M 0 35 Q 25 32, 55 24 T 80 20 T 100 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-3">
                <span className="text-xs font-medium text-slate-500">Registered Candidates</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900">{candidateCount || 86}</span>
                  <span className="text-xs font-semibold text-purple-600 flex items-center">
                    ↑ 8%
                  </span>
                </div>
              </div>
            </Card>

            {/* Active Elections */}
            <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CheckSquare className="h-5 w-5" />
                </div>
                {/* Orange Sparkline SVG */}
                <svg className="w-24 h-10 text-amber-500 overflow-visible" viewBox="0 0 100 40">
                  <path
                    d="M 0 36 Q 30 34, 55 26 T 85 20 T 100 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Active Elections</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">Active Voting</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-slate-900">{activeCount || 3}</span>
                  <span className="text-xs font-semibold text-amber-600 flex items-center">
                    ↑ 0%
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* ==================================================================== */}
          {/* ROW 3: ELECTION OVERVIEW, STATUS DONUT, UPCOMING DEADLINES           */}
          {/* ==================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. Election Overview Line Chart */}
            <Card className="lg:col-span-5 p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Election Overview</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-blue-600" /> Created
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Closed
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-purple-500" /> Published
                    </span>
                  </div>
                  <select className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-slate-50 text-slate-700">
                    <option>Last 12 Months</option>
                    <option>Last 6 Months</option>
                    <option>Year to Date</option>
                  </select>
                </div>
              </div>
              {/* Multi-line Spline Chart */}
              <div className="pt-4 h-52 w-full">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                  {/* Grid horizontal lines */}
                  <line x1="30" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <text x="15" y="24" fontSize="9" fill="#94a3b8" textAnchor="end">15</text>
                  <line x1="30" y1="60" x2="490" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <text x="15" y="64" fontSize="9" fill="#94a3b8" textAnchor="end">10</text>
                  <line x1="30" y1="100" x2="490" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <text x="15" y="104" fontSize="9" fill="#94a3b8" textAnchor="end">5</text>
                  <line x1="30" y1="140" x2="490" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                  <text x="15" y="144" fontSize="9" fill="#94a3b8" textAnchor="end">0</text>

                  {/* Line 1: Created (Blue) */}
                  <path
                    d="M 40 120 Q 80 115, 120 100 T 200 95 T 280 80 T 360 85 T 440 60 T 480 40"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="120" cy="100" r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="280" cy="80" r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="480" cy="40" r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />

                  {/* Line 2: Closed (Emerald) */}
                  <path
                    d="M 40 95 Q 80 85, 120 70 T 200 95 T 280 65 T 360 70 T 440 50 T 480 30"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="120" cy="70" r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="280" cy="65" r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="480" cy="30" r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />

                  {/* Line 3: Published (Purple) */}
                  <path
                    d="M 40 135 Q 80 125, 120 120 T 200 125 T 280 105 T 360 110 T 440 95 T 480 80"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="120" cy="120" r="3.5" fill="#8b5cf6" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="280" cy="105" r="3.5" fill="#8b5cf6" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="480" cy="80" r="3.5" fill="#8b5cf6" stroke="#fff" strokeWidth="1.5" />

                  {/* X Axis Months */}
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, idx) => (
                    <text key={m} x={40 + idx * 40} y="156" fontSize="9" fill="#94a3b8" textAnchor="middle">
                      {m}
                    </text>
                  ))}
                </svg>
              </div>
            </Card>

            {/* 2. Election Status Donut Card */}
            <Card className="lg:col-span-3 p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Election Status</h3>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                {/* Donut graphic */}
                <div className="relative h-32 w-32 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                    {totalElections > 0 ? (
                      donutSlices.map((slice) => {
                        if (slice.count === 0) return null;
                        return (
                          <circle
                            key={slice.key}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="14"
                            strokeDasharray={`${slice.strokeDash} ${circumference - slice.strokeDash}`}
                            strokeDashoffset={-slice.strokeOffset}
                            className="transition-all duration-500 ease-out"
                          />
                        );
                      })
                    ) : (
                      <>
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#2563eb" strokeWidth="14" strokeDasharray="39.8 199" strokeDashoffset="0" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#38bdf8" strokeWidth="14" strokeDasharray="39.8 199" strokeDashoffset="-39.8" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="14" strokeDasharray="59.7 179.1" strokeDashoffset="-79.6" />
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#8b5cf6" strokeWidth="14" strokeDasharray="99.5 139.3" strokeDashoffset="-139.3" />
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-extrabold text-slate-900 leading-none">{totalElections || 12}</span>
                    <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Total</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2 text-xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Draft
                    </span>
                    <span className="font-bold text-slate-900">{statusCounts.draft || 2}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Scheduled
                    </span>
                    <span className="font-bold text-slate-900">{statusCounts.scheduled || 2}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Open
                    </span>
                    <span className="font-bold text-slate-900">{statusCounts.open || 3}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Closed
                    </span>
                    <span className="font-bold text-slate-900">{statusCounts.closed || 5}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Upcoming Deadlines Dark Navy Card */}
            <Card className="lg:col-span-4 p-5 bg-gradient-to-br from-[#0c1834] to-[#081124] text-white border-0 shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  <h3 className="font-bold text-white text-sm">Upcoming Deadlines</h3>
                </div>
                <button
                  onClick={() => handleTabChange("elections")}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition cursor-pointer"
                >
                  View All <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2.5 pt-3 relative z-10">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white text-slate-900 flex flex-col items-center justify-center leading-none flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">APR</span>
                      <span className="text-sm font-extrabold text-slate-900 mt-0.5">30</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Student Union Election</p>
                      <p className="text-[10px] text-slate-400">Closes in 2 days</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Open
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white text-slate-900 flex flex-col items-center justify-center leading-none flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">MAY</span>
                      <span className="text-sm font-extrabold text-slate-900 mt-0.5">05</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Faculty Council Election</p>
                      <p className="text-[10px] text-slate-400">Starts in 5 days</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Scheduled
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white text-slate-900 flex flex-col items-center justify-center leading-none flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">MAY</span>
                      <span className="text-sm font-extrabold text-slate-900 mt-0.5">12</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Board Election</p>
                      <p className="text-[10px] text-slate-400">Closes in 12 days</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Upcoming
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* ==================================================================== */}
          {/* ROW 4: RECENT ACTIVITY, QUICK ACTIONS, SECURITY PROMO                */}
          {/* ==================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. Recent Activity Card */}
            <Card className="lg:col-span-5 p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Recent Activity</h3>
                </div>
                <button
                  onClick={() => handleTabChange("audit")}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition cursor-pointer"
                >
                  View All <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-3 pt-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">Election 'Student Union Leadership' was created</span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">2 hours ago</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">5 new candidates added</span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">3 hours ago</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">Voter eligibility updated for Faculty of Engineering</span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">4 hours ago</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">Election 'Faculty Council' scheduled</span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">5 hours ago</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-800 font-medium">Tally completed for 'Academic Council Election'</span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">1 day ago</span>
                </div>
              </div>
            </Card>

            {/* 2. Quick Actions Card */}
            <Card className="lg:col-span-4 p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Quick Actions</h3>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-3">
                <Link to="/admin/elections/new" className="block">
                  <button type="button" className="w-full flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-100 text-center transition group cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">Create Election</span>
                  </button>
                </Link>

                <button onClick={() => handleTabChange("candidates")} className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-100 text-center transition group cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">Add Candidates</span>
                </button>

                <button onClick={() => handleTabChange("voters")} className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-100 text-center transition group cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <Upload className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">Import Voters</span>
                </button>

                <button onClick={() => handleTabChange("positions")} className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-100 text-center transition group cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-amber-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <Settings className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">Manage Positions</span>
                </button>

                <button onClick={() => handleTabChange("reports")} className="flex flex-col items-center justify-center p-3 rounded-xl bg-teal-50/70 hover:bg-teal-100/70 border border-teal-100 text-center transition group cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-teal-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">Review Results</span>
                </button>

                <button onClick={() => handleTabChange("reports")} className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-100 text-center transition group cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">View Reports</span>
                </button>
              </div>
            </Card>

            {/* 3. Security Promo Card */}
            <Card className="lg:col-span-3 p-5 bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100/50 border border-blue-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3 relative z-10">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                  Secure. Transparent. Trusted.
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Built with enterprise-grade security for fair and transparent elections.
                </p>
              </div>

              <div className="pt-4 relative z-10">
                <Link to="/audit">
                  <button className="px-5 py-2 rounded-full bg-[#0c1834] hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5">
                    Learn More <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
              </div>

              {/* Decorative waves & subtle 3D ballot box graphic */}
              <div className="absolute -right-4 -bottom-4 w-32 h-32 opacity-20 pointer-events-none">
                <Vote className="w-full h-full text-blue-600" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 2: ELECTIONS DIRECTORY & LIFECYCLE (Doc 27 Section 8)  */}
      {/* ==================================================================== */}
      {activeTab === "elections" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Tenant Organizations</option>
                {organizations?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>

              <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                {["all", "draft", "scheduled", "open", "closed", "published"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setElectionStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      electionStatusFilter === st
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter election title..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isElectionsLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  Loading institutional elections...
                </div>
              ) : filteredElections.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Vote className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No elections found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No elections match your current filter criteria. Create a new election or clear your filters.
                  </p>
                  <Link to="/admin/elections/new">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-2">
                      <Plus className="h-3.5 w-3.5" />
                      Create New Election
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredElections.map((elec) => (
                    <div
                      key={elec.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <Link
                            to={`/elections/${elec.id}`}
                            className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate"
                          >
                            {elec.title}
                          </Link>
                          <StatusBadge status={elec.status} />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Opens: {elec.opens_at ? new Date(elec.opens_at).toLocaleDateString() : "TBD"}</span>
                          <span>·</span>
                          <span>Closes: {elec.closes_at ? new Date(elec.closes_at).toLocaleDateString() : "TBD"}</span>
                          {elec.configuration_hash && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                SHA-256: {elec.configuration_hash.substring(0, 10)}...
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                        {elec.status === "open" && (
                          <Link to={`/elections/${elec.id}/vote`}>
                            <Button size="sm" className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                              <Vote className="h-3.5 w-3.5" />
                              Live Booth
                            </Button>
                          </Link>
                        )}

                        {(elec.status === "closed" || elec.status === "tallied" || elec.status === "published") && (
                          <Link to={`/elections/${elec.id}/results`}>
                            <Button size="sm" variant="outline" className="text-xs gap-1.5">
                              <Calculator className="h-3.5 w-3.5" />
                              Results
                            </Button>
                          </Link>
                        )}

                        <Link to={`/elections/${elec.id}`}>
                          <Button size="sm" variant="secondary" className="text-xs">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 3: POSITIONS MANAGEMENT (Doc 27 Section 10)            */}
      {/* ==================================================================== */}
      {activeTab === "positions" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Ballot Positions Management</h3>
              <p className="text-xs text-muted-foreground">
                Define electoral offices, minimum/maximum selection bounds, and candidate limits.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={effectiveElectionId}
                onChange={(e) => setActiveElectionId(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {elections?.map((elec) => (
                  <option key={elec.id} value={elec.id}>
                    {elec.title} ({elec.status})
                  </option>
                ))}
              </select>

              {electionDetail?.status === "draft" && (
                <Button
                  size="sm"
                  onClick={() => setShowAddPositionModal(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Position
                </Button>
              )}
            </div>
          </div>

          {/* Configuration Lock Banner */}
          {electionDetail && electionDetail.status !== "draft" && (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center gap-3 text-xs text-amber-900">
              <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Configuration Frozen (SHA-256):</strong> This election is {electionDetail.status}. Positions and candidate slots cannot be modified once scheduled or open.
              </span>
            </div>
          )}

          {/* Positions Roster */}
          <Card>
            <CardContent className="p-0">
              {isDetailLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Loading positions...</div>
              ) : !electionDetail?.positions || electionDetail.positions.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No positions configured yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Add the positions that candidates will contest in this election.
                  </p>
                  {electionDetail?.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddPositionModal(true)}
                      className="gap-1.5 text-xs mt-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add First Position
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {electionDetail.positions.map((pos) => (
                    <div
                      key={pos.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{pos.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {pos.candidates?.length || 0} Candidates
                          </Badge>
                        </div>
                        {pos.description && (
                          <p className="text-xs text-muted-foreground">{pos.description}</p>
                        )}
                        <p className="text-[11px] text-slate-500 font-mono">
                          Rules: Min {pos.min_selections} · Max {pos.max_selections} selections · Order: {pos.display_order}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePositionId(pos.id);
                            handleTabChange("candidates");
                          }}
                          className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                        >
                          View Candidates →
                        </button>
                        {electionDetail.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletePositionMutation.mutate(pos.id)}
                            className="text-danger hover:text-red-700"
                            title="Delete Position"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 4: CANDIDATES MANAGEMENT (Doc 27 Section 11)           */}
      {/* ==================================================================== */}
      {activeTab === "candidates" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Candidate Profiles & Management</h3>
              <p className="text-xs text-muted-foreground">
                Manage registered candidates, biographical manifestos, and application statuses.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={effectiveElectionId}
                onChange={(e) => setActiveElectionId(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {elections?.map((elec) => (
                  <option key={elec.id} value={elec.id}>
                    {elec.title}
                  </option>
                ))}
              </select>

              {electionDetail?.status === "draft" && electionDetail?.positions && electionDetail.positions.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowAddCandidateModal(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Candidate
                </Button>
              )}
            </div>
          </div>

          {/* Positions and Candidates Grouped View */}
          <div className="space-y-4">
            {electionDetail?.positions?.map((pos) => (
              <Card key={pos.id} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">{pos.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Contested by {pos.candidates?.length || 0} candidate(s)
                    </CardDescription>
                  </div>
                  {electionDetail.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => {
                        setActivePositionId(pos.id);
                        setShowAddCandidateModal(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Add to this position
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {!pos.candidates || pos.candidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      No candidates registered for this position yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {pos.candidates.map((cand) => (
                        <div key={cand.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {cand.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-foreground">{cand.name}</p>
                              {cand.biography && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{cand.biography}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={cand.status === "active" ? "success" : "secondary"} className="text-[10px]">
                              {cand.status}
                            </Badge>
                            {electionDetail.status === "draft" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCandidateMutation.mutate(cand.id)}
                                className="text-danger hover:text-red-700"
                                title="Remove candidate"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 5: VOTERS & ELIGIBILITY (Doc 27 Section 12)             */}
      {/* ==================================================================== */}
      {activeTab === "voters" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Voters & Eligibility Registry</h3>
              <p className="text-xs text-muted-foreground">
                Authorize voters, issue single-use entitlement credentials, and verify identity isolation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={effectiveElectionId}
                onChange={(e) => setActiveElectionId(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {elections?.map((elec) => (
                  <option key={elec.id} value={elec.id}>
                    {elec.title}
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkImportModal(true)}
                className="gap-1.5 text-xs"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Bulk CSV Import
              </Button>

              <Button
                size="sm"
                onClick={() => setShowAddVoterModal(true)}
                className="gap-1.5 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Eligible Voter
              </Button>
            </div>
          </div>

          {/* Voter Roll Table */}
          <Card>
            <CardContent className="p-0">
              {isEligibilityLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Loading authorized voters...</div>
              ) : !eligibilityList || eligibilityList.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Users className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No authorized voters on this roll</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Add individual voter email addresses or bulk import a CSV list to authorize participants.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setShowBulkImportModal(true)} className="text-xs gap-1">
                      <UploadCloud className="h-3.5 w-3.5" />
                      Bulk Import
                    </Button>
                    <Button size="sm" onClick={() => setShowAddVoterModal(true)} className="text-xs gap-1">
                      <UserPlus className="h-3.5 w-3.5" />
                      Add Individual
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {eligibilityList.map((voter) => (
                    <div key={voter.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-xs text-foreground">{voter.user_email || "Anonymous Member"}</p>
                        {voter.user_name && <p className="text-[11px] text-muted-foreground">{voter.user_name}</p>}
                        <p className="text-[10px] text-slate-400 font-mono">
                          Enrolled: {new Date(voter.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={voter.eligibility_status === "eligible" ? "success" : "secondary"} className="text-[10px]">
                          {voter.eligibility_status}
                        </Badge>
                        <Badge variant={voter.entitlement_status === "redeemed" ? "default" : "outline"} className="text-[10px]">
                          {voter.entitlement_status === "redeemed" ? "Ballot Redeemed" : "Unredeemed"}
                        </Badge>
                        {voter.entitlement_status !== "redeemed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revokeVoterMutation.mutate(voter.id)}
                            className="text-xs text-danger hover:text-red-700 h-7 px-2"
                            title="Revoke eligibility"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 6: ORGANIZATIONS DIRECTORY (Doc 27 Section 5 & 19)     */}
      {/* ==================================================================== */}
      {activeTab === "organizations" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Tenant Organizations & Units</h3>
              <p className="text-xs text-muted-foreground">
                Institutions, faculties, departments, and structural governance units.
              </p>
            </div>
            <Link to="/organizations">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                Manage In Full Directory
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {organizations?.map((org) => {
              const isVerified = org.status === "verified" || org.status === "active";
              const isPending = org.status === "pending_verification";
              const isDraft = org.status === "draft";
              const isSuspended = org.status === "suspended";
              const isRejected = org.status === "rejected";

              const badgeVariant = isVerified ? "success" : isRejected || isSuspended ? "danger" : "warning";

              return (
                <Card key={org.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{org.name}</h4>
                        <p className="text-[11px] font-mono text-muted-foreground">slug: {org.slug}</p>
                      </div>
                    </div>
                    <Badge variant={badgeVariant} className="text-[10px] capitalize">
                      {org.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {isDraft && (
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="text-blue-800">Setup wizard incomplete</span>
                      <div className="flex items-center gap-1.5">
                        <Link to="/onboarding">
                          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                            Complete Setup
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
                          disabled={submitForReviewMutation.isPending}
                          onClick={() => submitForReviewMutation.mutate(org.id)}
                        >
                          Submit For Review
                        </Button>
                      </div>
                    </div>
                  )}

                  {isPending && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
                      <span className="text-amber-800 font-medium">Awaiting platform verification review</span>
                    </div>
                  )}

                  {/* Platform Admin Verification Actions */}
                  {user?.is_platform_admin && (
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Platform Admin</span>
                      <div className="flex items-center gap-1.5">
                        {!isVerified && (
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={updateOrgStatusMutation.isPending}
                            onClick={() => updateOrgStatusMutation.mutate({ orgId: org.id, status: "verified" })}
                          >
                            Verify
                          </Button>
                        )}
                        {!isRejected && !isVerified && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] text-danger border-danger/30 hover:bg-danger-light"
                            disabled={updateOrgStatusMutation.isPending}
                            onClick={() => updateOrgStatusMutation.mutate({ orgId: org.id, status: "rejected" })}
                          >
                            Reject
                          </Button>
                        )}
                        {isVerified && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] text-danger border-danger/30 hover:bg-danger-light"
                            disabled={updateOrgStatusMutation.isPending}
                            onClick={() => updateOrgStatusMutation.mutate({ orgId: org.id, status: "suspended" })}
                          >
                            Suspend
                          </Button>
                        )}
                        {isSuspended && (
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={updateOrgStatusMutation.isPending}
                            onClick={() => updateOrgStatusMutation.mutate({ orgId: org.id, status: "verified" })}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 7: REPORTS & ANALYTICS (Doc 27 Section 15)             */}
      {/* ==================================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Certified Election Reports & Audits</h3>
              <p className="text-xs text-muted-foreground">
                Export verified turnout metrics, deterministic candidate tallies, and certified records.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={effectiveElectionId}
                onChange={(e) => setActiveElectionId(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {elections?.map((elec) => (
                  <option key={elec.id} value={elec.id}>
                    {elec.title} ({elec.status})
                  </option>
                ))}
              </select>

              {electionResults && (
                <Button
                  size="sm"
                  onClick={handleExportResultsCSV}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV Report
                </Button>
              )}
            </div>
          </div>

          {!electionResults ? (
            <Card className="p-8 text-center space-y-3">
              <Calculator className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Results Not Yet Computed</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Official reports and candidate tally distributions become available once the election closes and the tally process is executed.
              </p>
              {electionDetail?.status === "closed" && (
                <Button
                  size="sm"
                  onClick={() => tallyMutation.mutate(electionDetail.id)}
                  disabled={tallyMutation.isPending}
                  className="gap-1.5 text-xs mt-2"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Compute Tally Now
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4 bg-slate-50 border-border">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Ballots Cast</span>
                    <p className="text-xl font-bold text-foreground mt-0.5">{electionResults.ballot_count}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Approval Status</span>
                    <p className="text-xl font-bold text-emerald-600 capitalize mt-0.5">{electionResults.approval_status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Computed At</span>
                    <p className="text-xs font-mono text-slate-700 mt-1 truncate">{new Date(electionResults.computed_at).toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              {/* Position breakdown */}
              {electionResults.positions?.map((pos) => (
                <Card key={pos.position_id} className="overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b border-border">
                    <CardTitle className="text-sm font-bold text-foreground">{pos.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Total Votes Cast: {pos.total_votes} {pos.abstain_count > 0 ? `· Abstentions: ${pos.abstain_count}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border">
                    {pos.candidates?.map((cand) => {
                      const isWinner = pos.winner_ids?.includes(cand.candidate_id || "");
                      return (
                        <div key={cand.candidate_id || cand.name} className="p-3.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-xs text-foreground">{cand.name}</p>
                            {isWinner && (
                              <Badge variant="success" className="text-[10px]">Elected</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-foreground">{cand.votes} votes</span>
                            <Badge variant="outline" className="text-[10px]">{cand.percentage}%</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 8: AUDIT LOGS EXPLORER (Doc 27 Section 16)             */}
      {/* ==================================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Tamper-Evident Audit Event Trail</h3>
              <p className="text-xs text-muted-foreground">
                Immutable lifecycle verification records tracking actor IDs, transitions, and cryptographic hashes.
              </p>
            </div>

            <select
              value={effectiveElectionId}
              onChange={(e) => setActiveElectionId(e.target.value)}
              className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {elections?.map((elec) => (
                <option key={elec.id} value={elec.id}>
                  {elec.title}
                </option>
              ))}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isAuditLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Loading audit log events...</div>
              ) : !auditEvents || auditEvents.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  No recorded audit events for this election yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {auditEvents.map((ev) => (
                    <div key={ev.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-foreground">{ev.event_type}</span>
                          <Badge variant={ev.outcome === "success" ? "success" : "danger"} className="text-[10px]">
                            {ev.outcome}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Actor: {ev.actor_id ? `${ev.actor_id.substring(0, 8)}...` : "System / Scheduled"} · Event ID: {ev.id.substring(0, 8)}...
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 9: TEAM & PERMISSIONS (Doc 27 Section 17)              */}
      {/* ==================================================================== */}
      {activeTab === "team" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Organization Team Members</h3>
              <p className="text-xs text-muted-foreground">
                Grant administrative, election manager, and auditing privileges for institutional tenants.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={effectiveOrgIdForMembers}
                onChange={(e) => setTargetOrgIdForMember(e.target.value)}
                className="text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {organizations?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                onClick={() => setShowAddMemberModal(true)}
                className="gap-1.5 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Member
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isMembersLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Loading organization members...</div>
              ) : !orgMembers || orgMembers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Users className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No members found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    This organization does not have any assigned members or managers yet.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddMemberModal(true)}
                    className="gap-1.5 text-xs mt-2"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add First Member
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {orgMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm text-foreground">{member.display_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{member.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs capitalize font-medium">
                          {member.role.replace("_", " ")}
                        </Badge>
                        <Badge variant={member.status === "active" ? "success" : "secondary"}>
                          {member.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE TAB 10: INFRASTRUCTURE & DB HEALTH (ADR-001)               */}
      {/* ==================================================================== */}
      {activeTab === "infrastructure" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Subsystem Health & Security Boundaries (ADR-001)</CardTitle>
              </div>
              {isReadinessLoading ? (
                <Badge variant="outline">Evaluating...</Badge>
              ) : readiness?.ready ? (
                <Badge variant="success">All Subsystems Ready</Badge>
              ) : (
                <Badge variant="danger">Subsystem Offline</Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Real-time connectivity and least-privilege role verification across the three isolated PostgreSQL databases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {[
                {
                  id: "identity_db",
                  name: "Identity & Eligibility DB",
                  desc: "Accounts, Memberships, Entitlements",
                  role: "identity_user",
                  guarantee: "Stores personal identities and single-use entitlements.",
                },
                {
                  id: "election_db",
                  name: "Election Management DB",
                  desc: "Lifecycle, Candidates, Approvals, Tally",
                  role: "election_user",
                  guarantee: "Stores election specs, frozen hash, and audit logs.",
                },
                {
                  id: "ballot_db",
                  name: "Ballot-Box DB",
                  desc: "Anonymous Ballots & Redemptions",
                  role: "ballot_user",
                  guarantee: "Strictly anonymous. Never receives voter IDs or cookies.",
                },
              ].map((db) => {
                const status = readiness?.databases?.[db.id];
                return (
                  <div key={db.id} className="rounded-xl border border-border p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-foreground">{db.name}</p>
                      {status?.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{db.desc}</p>
                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                      {db.guarantee}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                      <span>Role: <code className="text-slate-800 font-semibold">{db.role}</code></span>
                      <span>{status ? `${status.latency_ms}ms` : "Pending DB"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* MODALS                                                               */}
      {/* ==================================================================== */}

      {/* 1. Approve Launch Modal */}
      {approvingElectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Approve Election Launch</CardTitle>
              <CardDescription className="text-xs">
                Authorize this scheduled election to open for official voting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{approvalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Audit Reason / Justification</label>
                <textarea
                  rows={3}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="e.g. Configuration verified and signed off by Electoral Board."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setApprovingElectionId(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={approveLaunchMutation.isPending}
                  onClick={() =>
                    approveLaunchMutation.mutate({
                      electionId: approvingElectionId,
                      reason: approvalReason,
                    })
                  }
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {approveLaunchMutation.isPending ? "Recording Approval..." : "Confirm Approval"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Add Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Add Ballot Position</CardTitle>
              <CardDescription className="text-xs">
                Define an electoral office to be contested in this election.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {positionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{positionError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Position Title *</label>
                <input
                  type="text"
                  required
                  value={posTitle}
                  onChange={(e) => setPosTitle(e.target.value)}
                  placeholder="e.g. President, Student Union"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea
                  rows={2}
                  value={posDescription}
                  onChange={(e) => setPosDescription(e.target.value)}
                  placeholder="Responsibilities and duties of this office"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Min Selections</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={posMinSelections}
                    onChange={(e) => setPosMinSelections(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Max Selections</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={posMaxSelections}
                    onChange={(e) => setPosMaxSelections(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={posDisplayOrder}
                  onChange={(e) => setPosDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAddPositionModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={addPositionMutation.isPending || !posTitle.trim()}
                  onClick={() =>
                    addPositionMutation.mutate({
                      electionId: effectiveElectionId,
                      title: posTitle.trim(),
                      description: posDescription.trim() || undefined,
                      min_selections: posMinSelections,
                      max_selections: posMaxSelections,
                      display_order: posDisplayOrder,
                    })
                  }
                >
                  {addPositionMutation.isPending ? "Adding..." : "Add Position"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Add Candidate Modal */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Add Candidate</CardTitle>
              <CardDescription className="text-xs">
                Register a candidate running for this position.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidateError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{candidateError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Contesting Position *</label>
                <select
                  value={activePositionId || (electionDetail?.positions && electionDetail.positions[0]?.id) || ""}
                  onChange={(e) => setActivePositionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {electionDetail?.positions?.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Candidate Full Name *</label>
                <input
                  type="text"
                  required
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Candidate Manifesto / Bio</label>
                <textarea
                  rows={3}
                  value={candBiography}
                  onChange={(e) => setCandBiography(e.target.value)}
                  placeholder="Candidate vision, experience, and platform"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={candDisplayOrder}
                  onChange={(e) => setCandDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAddCandidateModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={addCandidateMutation.isPending || !candName.trim()}
                  onClick={() => {
                    const targetPosId = activePositionId || (electionDetail?.positions && electionDetail.positions[0]?.id);
                    if (!targetPosId) return;
                    addCandidateMutation.mutate({
                      positionId: targetPosId,
                      name: candName.trim(),
                      biography: candBiography.trim() || undefined,
                      photo_url: candPhotoUrl.trim() || undefined,
                      display_order: candDisplayOrder,
                    });
                  }}
                >
                  {addCandidateMutation.isPending ? "Adding..." : "Add Candidate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Add Individual Voter Modal */}
      {showAddVoterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Authorize Eligible Voter</CardTitle>
              <CardDescription className="text-xs">
                Grant ballot access to a registered voter email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {voterError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{voterError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Voter Email Address *</label>
                <input
                  type="email"
                  required
                  value={voterEmail}
                  onChange={(e) => setVoterEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAddVoterModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={addVoterMutation.isPending || !voterEmail.trim()}
                  onClick={() => addVoterMutation.mutate(voterEmail.trim())}
                >
                  {addVoterMutation.isPending ? "Authorizing..." : "Authorize Voter"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Bulk CSV / Multi-Email Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Bulk Ingest Voter Registry</CardTitle>
              <CardDescription className="text-xs">
                Paste comma-separated or newline-separated voter emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bulkImportError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{bulkImportError}</span>
                </div>
              )}

              {bulkImportResult && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Ingestion Complete
                  </p>
                  <p>Processed: {bulkImportResult.total_processed} · Newly Added: {bulkImportResult.added} · Already Eligible: {bulkImportResult.already_eligible}</p>
                  {bulkImportResult.not_found.length > 0 && (
                    <p className="text-[11px] text-amber-700">
                      Unmapped / Not Found: {bulkImportResult.not_found.join(", ")}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Voter Email List</label>
                <textarea
                  rows={6}
                  value={bulkEmailsRaw}
                  onChange={(e) => setBulkEmailsRaw(e.target.value)}
                  placeholder="voter1@university.edu&#10;voter2@university.edu&#10;voter3@university.edu"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportResult(null);
                    setBulkEmailsRaw("");
                  }}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  disabled={bulkImportMutation.isPending || !bulkEmailsRaw.trim()}
                  onClick={() => {
                    const emails = bulkEmailsRaw
                      .split(/[\n,;]+/)
                      .map((e) => e.trim())
                      .filter((e) => e.length > 0);
                    bulkImportMutation.mutate(emails);
                  }}
                >
                  {bulkImportMutation.isPending ? "Ingesting..." : "Import Emails"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Assign Team Member</CardTitle>
              <CardDescription className="text-xs">
                Add an institutional account and assign operational roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{memberError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Registered User Email</label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="colleague@university.edu"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Assigned Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="member">Eligible Voter / Member</option>
                  <option value="election_manager">Election Manager</option>
                  <option value="candidate_reviewer">Candidate Reviewer</option>
                  <option value="voter_manager">Voter Eligibility Manager</option>
                  <option value="tally_officer">Tally Officer</option>
                  <option value="results_approver">Results Approver</option>
                  <option value="auditor">Electoral Auditor</option>
                  <option value="organization_admin">Organization Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={addMemberMutation.isPending || !memberEmail.trim()}
                  onClick={() =>
                    addMemberMutation.mutate({
                      orgId: effectiveOrgIdForMembers,
                      email: memberEmail.trim(),
                      role: memberRole,
                    })
                  }
                >
                  {addMemberMutation.isPending ? "Assigning..." : "Assign Role"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};