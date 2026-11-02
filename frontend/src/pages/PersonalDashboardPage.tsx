import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Vote,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus,
  KeyRound,
  Info,
  X,
  Building,
  Check,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import type { UserElectionSummary, InvitationValidationResponse } from "../types/auth";

type ElectionCategory = "all" | "requires_action" | "active" | "upcoming" | "completed";

export const PersonalDashboardPage: React.FC = () => {
  const { user, memberships } = useAuth();
  const [activeCategory, setActiveCategory] = useState<ElectionCategory>("all");
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  // Invitation code state
  const [invitationCode, setInvitationCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<InvitationValidationResponse | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Query user elections
  const {
    data: elections = [],
    isLoading,
    refetch: refetchElections,
  } = useQuery<UserElectionSummary[]>({
    queryKey: ["my-elections"],
    queryFn: () => apiClient.getMyElections(),
  });

  // Calculate categorized counts
  const requiresActionElections = elections.filter((e) => e.status === "open" && !e.has_voted);
  const activeElections = elections.filter((e) => e.status === "open");
  const upcomingElections = elections.filter((e) => e.status === "scheduled" || e.status === "draft");
  const completedElections = elections.filter(
    (e) => e.status === "closed" || e.status === "tallied" || e.status === "published"
  );

  const filteredElections = elections.filter((e) => {
    switch (activeCategory) {
      case "requires_action":
        return e.status === "open" && !e.has_voted;
      case "active":
        return e.status === "open";
      case "upcoming":
        return e.status === "scheduled" || e.status === "draft";
      case "completed":
        return e.status === "closed" || e.status === "tallied" || e.status === "published";
      case "all":
      default:
        return true;
    }
  });

  const handleValidateCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invitationCode.trim()) {
      setJoinError("Please enter an invitation code.");
      return;
    }

    setJoinError(null);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const res = await apiClient.validateInvitation(invitationCode.trim());
      setValidationResult(res);
    } catch (err: any) {
      setJoinError(err?.message || "Invalid or expired invitation code.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitationCode.trim()) return;

    setJoinError(null);
    setIsJoining(true);

    try {
      const res = await apiClient.acceptInvitation(invitationCode.trim());
      const instName = res.institution_name || validationResult?.institution_name || "the institution";
      setJoinSuccess(`Successfully joined ${instName}!`);
      setValidationResult(null);
      setInvitationCode("");
      await refetchElections();
    } catch (err: any) {
      setJoinError(err?.message || "Failed to accept invitation. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const resetJoinModal = () => {
    setIsJoinModalOpen(false);
    setInvitationCode("");
    setValidationResult(null);
    setJoinError(null);
    setJoinSuccess(null);
  };

  const isProfileComplete = Boolean(
    user?.first_name && user?.last_name && user?.email_verified
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ==================================================================== */}
      {/* 1. WELCOME HEADER                                                    */}
      {/* ==================================================================== */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-900 via-[#0B1528] to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="text-xs uppercase tracking-widest font-bold text-sky-400">
              Personal Voter Dashboard
            </span>
            {isProfileComplete ? (
              <Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] px-2 py-0.5">
                <Check className="h-3 w-3 mr-1" />
                Profile Complete
              </Badge>
            ) : (
              <Badge variant="warning" className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] px-2 py-0.5">
                Profile Incomplete
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.display_name || user?.first_name || "Voter"}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Your personal voting space. Track active elections, cast encrypted ballots, and inspect verified results.
          </p>
        </div>

        {/* Ambient subtle decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ==================================================================== */}
      {/* 2. STATS OVERVIEW                                                    */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Elections</span>
            <Vote className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">{elections.length}</div>
          <p className="text-xs text-slate-400 mt-1">Available in your portfolio</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Action Needed</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600">{requiresActionElections.length}</div>
          <p className="text-xs text-slate-400 mt-1">Open ballots awaiting your vote</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ballots Cast</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
            {elections.filter((e) => e.has_voted).length}
          </div>
          <p className="text-xs text-slate-400 mt-1">Verified voting receipts</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Institutions</span>
            <Building className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {new Set(elections.map((e) => e.institution_name).filter(Boolean)).size || memberships.length}
          </div>
          <p className="text-xs text-slate-400 mt-1">Connected organizations</p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. MAIN DASHBOARD CONTENT GRID                                       */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: My Elections (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">My Elections</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Elections from your connected institutions and memberships
              </p>
            </div>

            {/* Filter Tabs */}
            {elections.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {[
                  { id: "all" as const, label: `All (${elections.length})` },
                  { id: "requires_action" as const, label: `Requires Action (${requiresActionElections.length})` },
                  { id: "active" as const, label: `Active (${activeElections.length})` },
                  { id: "upcoming" as const, label: `Upcoming (${upcomingElections.length})` },
                  { id: "completed" as const, label: `Completed (${completedElections.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      activeCategory === tab.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Empty State vs Elections List */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 font-medium bg-white rounded-2xl border border-slate-200">
              Loading your elections...
            </div>
          ) : elections.length === 0 ? (
            /* Empty State matching Section 9.2 verbatim */
            <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
                <Vote className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No elections available yet</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
                You can join an institution using an invitation link or code. When you become eligible for an election, it will appear here.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => setIsJoinModalOpen(true)} className="rounded-xl font-semibold gap-2">
                  <Plus className="h-4 w-4" />
                  Enter Invitation Code
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="rounded-xl font-semibold gap-2"
                >
                  <Info className="h-4 w-4 text-blue-600" />
                  Learn How Pollwise Works
                </Button>
              </div>
            </div>
          ) : filteredElections.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm">
              No elections found matching this filter category.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredElections.map((elec) => {
                const isVotingOpen = elec.status === "open";
                const isScheduledOrDraft = elec.status === "scheduled" || elec.status === "draft";
                const isPublished = elec.status === "published";
                const isClosed = elec.status === "closed" || elec.status === "tallied";

                return (
                  <Card key={elec.id} className="border-slate-200 hover:border-slate-300 transition-all shadow-xs">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                              {elec.institution_name || "Institution Election"}
                            </span>
                          </div>
                          <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                            {elec.title}
                          </CardTitle>
                          {elec.start_time && (
                            <CardDescription className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {new Date(elec.start_time).toLocaleDateString()} -{" "}
                                {elec.end_time ? new Date(elec.end_time).toLocaleDateString() : "Ongoing"}
                              </span>
                            </CardDescription>
                          )}
                        </div>

                        {/* Status Badges Matching Spec */}
                        <div className="flex items-center gap-2 self-start">
                          {isVotingOpen && !elec.has_voted && (
                            <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-1 font-semibold">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                              Voting Open
                            </Badge>
                          )}

                          {isVotingOpen && elec.has_voted && (
                            <Badge variant="default" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-1 font-semibold">
                              <CheckCircle className="h-3.5 w-3.5 mr-1 text-blue-600" />
                              Vote Submitted
                            </Badge>
                          )}

                          {isPublished && (
                            <Badge variant="default" className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-2.5 py-1 font-semibold">
                              Results Published
                            </Badge>
                          )}

                          {isScheduledOrDraft && (
                            <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-1 font-semibold">
                              Not Open Yet
                            </Badge>
                          )}

                          {isClosed && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 text-xs px-2.5 py-1 font-semibold">
                              Election Closed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                          {elec.has_voted ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                              Receipt Confirmed
                            </span>
                          ) : isVotingOpen ? (
                            <span className="text-amber-700 font-medium">
                              Ballot ready for casting
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {isScheduledOrDraft ? "Ballot will open according to schedule" : "Voting is closed"}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {isVotingOpen && !elec.has_voted && (
                            <Link to={`/elections/${elec.id}/vote`}>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 rounded-lg shadow-xs">
                                <span>Cast Ballot</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}

                          {isPublished && (
                            <Link to={`/elections/${elec.id}/results`}>
                              <Button size="sm" variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-50 font-semibold gap-1.5 rounded-lg">
                                <span>View Results</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}

                          <Link to={`/elections/${elec.id}`}>
                            <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900 text-xs">
                              Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Account Security & Recent Activity */}
        <div className="space-y-6">
          {/* Account Security Status Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Account Security
                </CardTitle>
                <Link
                  to="/settings"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Manage Security
                </Link>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Security status and credentials protection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800">Email Verification</p>
                  <p className="text-[11px] text-slate-500">{user?.email}</p>
                </div>
                {user?.email_verified ? (
                  <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                    <Check className="h-3 w-3 mr-1" />
                    Email Verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-[11px]">
                    Unverified
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800">Two-Factor Authentication</p>
                  <p className="text-[11px] text-slate-500">Authenticator app</p>
                </div>
                {user?.mfa_enabled ? (
                  <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                    <Check className="h-3 w-3 mr-1" />
                    MFA Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px]">
                    MFA Disabled
                  </Badge>
                )}
              </div>

              <div className="pt-2">
                <Link
                  to="/settings"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <span>Security Settings</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Join Institution Quick Card */}
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50/70 to-sky-50/30 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-600" />
                Join Institution
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Connect your personal voter account to an institution using an invite code.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <Button
                onClick={() => setIsJoinModalOpen(true)}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Enter Code
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity Timeline */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Timeline of personal voter security and ballot events
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="relative pl-5 space-y-4 border-l-2 border-slate-100 text-xs">
                {/* Voted Elections */}
                {elections
                  .filter((e) => e.has_voted)
                  .map((e) => (
                    <div key={e.id} className="relative">
                      <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                      <p className="font-semibold text-slate-800">
                        Ballot cast for {e.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {e.institution_name || "Institutional Election"} · Receipt Verified
                      </p>
                    </div>
                  ))}

                {/* Institutions Joined */}
                {memberships.map((m) => (
                  <div key={m.id} className="relative">
                    <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-white" />
                    <p className="font-semibold text-slate-800">
                      Joined {m.organization_name}
                    </p>
                    <p className="text-[11px] text-slate-400">Institutional membership active</p>
                  </div>
                ))}

                {/* Email Verification */}
                {user?.email_verified && (
                  <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-sky-500 border-2 border-white" />
                    <p className="font-semibold text-slate-800">Account verification confirmed</p>
                    <p className="text-[11px] text-slate-400">Primary email address confirmed</p>
                  </div>
                )}

                {/* Account Created */}
                <div className="relative">
                  <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-slate-400 border-2 border-white" />
                  <p className="font-semibold text-slate-800">Personal account created</p>
                  <p className="text-[11px] text-slate-400">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. JOIN INSTITUTION MODAL DIALOG                                     */}
      {/* ==================================================================== */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative space-y-5">
            <button
              type="button"
              onClick={resetJoinModal}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Building className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Enter Invitation Code</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Enter the invitation code provided by your university, union, or association to access your elections.
              </p>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <span>{joinError}</span>
              </div>
            )}

            {joinSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>{joinSuccess}</span>
              </div>
            )}

            {!joinSuccess && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Invitation Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. INV- or code"
                      value={invitationCode}
                      onChange={(e) => {
                        setInvitationCode(e.target.value);
                        setValidationResult(null);
                        setJoinError(null);
                      }}
                      className="text-sm font-mono uppercase"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleValidateCode()}
                      disabled={isValidating || !invitationCode.trim()}
                      className="font-semibold text-xs whitespace-nowrap cursor-pointer"
                    >
                      {isValidating ? "Checking..." : "Validate"}
                    </Button>
                  </div>
                </div>

                {/* Validation Preview Card */}
                {validationResult && (
                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-fade-in">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Institution Found
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {validationResult.institution_name}
                    </p>
                    <p className="text-xs text-slate-600">
                      Invitation Type:{" "}
                      <span className="font-semibold uppercase text-slate-800">
                        {validationResult.invitation_type}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetJoinModal}
                    className="text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!validationResult || isJoining}
                    onClick={handleAcceptInvitation}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 cursor-pointer shadow-xs"
                  >
                    {isJoining ? "Joining..." : "Join Institution"}
                  </Button>
                </div>
              </div>
            )}

            {joinSuccess && (
              <div className="flex justify-end pt-2">
                <Button onClick={resetJoinModal} className="font-semibold text-xs">
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. LEARN HOW POLLWISE WORKS MODAL                                    */}
      {/* ==================================================================== */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative space-y-6">
            <button
              type="button"
              onClick={() => setIsHowItWorksOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Info className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">How Pollwise Works</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                High-integrity institutional voting with end-to-end cryptographic privacy
              </p>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-0.5">Join Your Institution</p>
                  <p className="text-xs text-slate-500">
                    Use an invitation link or code provided by your organization to establish election eligibility without compromising your personal identity.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-0.5">Cast Ballots Anonymously</p>
                  <p className="text-xs text-slate-500">
                    Ballots are cryptographically decoupled from your user account. Once cast into the ballot box, your specific choices cannot be linked back to you.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-0.5">Cryptographic Verification</p>
                  <p className="text-xs text-slate-500">
                    Receive an unforgeable cryptographic ballot receipt. When results are published, audit the cryptographic tally to verify your vote was counted.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsHowItWorksOpen(false)} className="font-semibold text-xs px-6">
                Got It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
