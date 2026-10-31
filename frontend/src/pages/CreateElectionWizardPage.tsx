import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Check,
  Plus,
  Trash2,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Lock,
  AlertCircle,
  Users,
  Shield,
  Settings,
  FileText,
  Hash,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type ElectionType = "general" | "by_election" | "referendum" | "primary";
type TieBreakingPolicy = "random" | "manual_review" | "runoff";
type EligibilityScope =
  | "entire_institution"
  | "specific_department"
  | "manual_list"
  | "csv_import";
type CandidateMode = "manager_registers" | "open_application";
type ResultsVisibility =
  | "everyone"
  | "authenticated_members"
  | "administrators_only";

interface LocalPosition {
  title: string;
  description: string;
  max_selections: number;
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------
const inputCls =
  "w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground";
const labelCls = "block text-xs font-semibold text-foreground mb-1";

// ---------------------------------------------------------------------------
// Step meta
// ---------------------------------------------------------------------------
const STEPS = [
  { num: 1, label: "Basic Info", icon: <FileText className="h-3.5 w-3.5" /> },
  { num: 2, label: "Structure", icon: <Settings className="h-3.5 w-3.5" /> },
  { num: 3, label: "Voting Rules", icon: <Shield className="h-3.5 w-3.5" /> },
  { num: 4, label: "Schedule", icon: <Calendar className="h-3.5 w-3.5" /> },
  { num: 5, label: "Eligibility", icon: <Users className="h-3.5 w-3.5" /> },
  { num: 6, label: "Candidates", icon: <UserPlus className="h-3.5 w-3.5" /> },
  { num: 7, label: "Security", icon: <Lock className="h-3.5 w-3.5" /> },
  { num: 8, label: "Review", icon: <Hash className="h-3.5 w-3.5" /> },
] as const;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function defaultOpensAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function defaultClosesAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  d.setHours(17, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

async function computeSha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Toggle helper component
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  id: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onToggle, label, id }) => (
  <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none">
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onToggle(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        checked ? "bg-primary" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
    <span className="text-xs font-medium text-foreground">{label}</span>
  </label>
);

function StepHeader({
  title: stepTitle,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <CardHeader>
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <CardTitle className="text-lg">{stepTitle}</CardTitle>
      </div>
      <CardDescription className="text-xs">{subtitle}</CardDescription>
    </CardHeader>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export const CreateElectionWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [configHash, setConfigHash] = useState<string>("");

  // ---------- Step 1: Basic Info ----------
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [electionType, setElectionType] = useState<ElectionType>("general");
  const [academicYear, setAcademicYear] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  // ---------- Step 2: Election Structure ----------
  const [isMultiPosition, setIsMultiPosition] = useState(false);
  const [positions, setPositions] = useState<LocalPosition[]>([
    { title: "President", description: "Executive leader", max_selections: 1 },
  ]);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPosTitle, setNewPosTitle] = useState("");
  const [newPosDesc, setNewPosDesc] = useState("");
  const [newPosMaxSel, setNewPosMaxSel] = useState(1);

  // ---------- Step 3: Voting Rules ----------
  const [allowAbstention, setAllowAbstention] = useState(false);
  const [tieBreaking, setTieBreaking] = useState<TieBreakingPolicy>("manual_review");
  const [minSelections, setMinSelections] = useState(1);
  const [showResultsBeforeClose, setShowResultsBeforeClose] = useState(false);

  // ---------- Step 4: Schedule ----------
  const [opensAt, setOpensAt] = useState(defaultOpensAt);
  const [closesAt, setClosesAt] = useState(defaultClosesAt);
  const [timezone, setTimezone] = useState("UTC");

  // ---------- Step 5: Eligibility ----------
  const [eligibilityScope, setEligibilityScope] =
    useState<EligibilityScope>("entire_institution");
  const [departmentName, setDepartmentName] = useState("");

  // ---------- Step 6: Candidate Config ----------
  const [candidateMode, setCandidateMode] =
    useState<CandidateMode>("manager_registers");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [candidateRequirements, setCandidateRequirements] = useState("");

  // ---------- Step 7: Security ----------
  const [requireSignOff, setRequireSignOff] = useState(true);
  const [allowRecountRequests, setAllowRecountRequests] = useState(true);
  const [resultsVisibility, setResultsVisibility] =
    useState<ResultsVisibility>("authenticated_members");
  const [requireResultApproval, setRequireResultApproval] = useState(true);

  // ---------- Organizations query ----------
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: apiClient.getOrganizations,
  });

  const effectiveOrgId = selectedOrgId || organizations?.[0]?.id || "";

  // ---------- Compute hash when reaching step 8 ----------
  useEffect(() => {
    if (step === 8) {
      const config = {
        title,
        description,
        electionType,
        academicYear,
        organization_id: effectiveOrgId,
        managerEmail,
        isMultiPosition,
        positions,
        allowAbstention,
        tieBreaking,
        minSelections,
        showResultsBeforeClose,
        opensAt,
        closesAt,
        timezone,
        eligibilityScope,
        departmentName,
        candidateMode,
        applicationDeadline,
        candidateRequirements,
        requireSignOff,
        allowRecountRequests,
        resultsVisibility,
        requireResultApproval,
      };
      computeSha256Hex(JSON.stringify(config)).then(setConfigHash);
    }
  }, [
    step,
    title,
    description,
    electionType,
    academicYear,
    effectiveOrgId,
    managerEmail,
    isMultiPosition,
    positions,
    allowAbstention,
    tieBreaking,
    minSelections,
    showResultsBeforeClose,
    opensAt,
    closesAt,
    timezone,
    eligibilityScope,
    departmentName,
    candidateMode,
    applicationDeadline,
    candidateRequirements,
    requireSignOff,
    allowRecountRequests,
    resultsVisibility,
    requireResultApproval,
  ]);

  // ---------- Validation per step ----------
  function validateAndNext() {
    setErrorMessage(null);
    if (step === 1) {
      if (!title.trim()) {
        setErrorMessage("Election title is required.");
        return;
      }
      if (!effectiveOrgId) {
        setErrorMessage("Please select a valid organization.");
        return;
      }
    }
    if (step === 2) {
      if (positions.length === 0) {
        setErrorMessage("At least one position is required.");
        return;
      }
      for (const p of positions) {
        if (!p.title.trim()) {
          setErrorMessage("All positions must have a title.");
          return;
        }
      }
    }
    if (step === 4) {
      if (!opensAt || !closesAt) {
        setErrorMessage("Both opens-at and closes-at dates are required.");
        return;
      }
      if (new Date(closesAt) <= new Date(opensAt)) {
        setErrorMessage("Closing date must be after the opening date.");
        return;
      }
    }
    setStep((s) => s + 1);
  }

  // ---------- Add / remove position ----------
  function addPosition() {
    if (!newPosTitle.trim()) return;
    setPositions([
      ...positions,
      {
        title: newPosTitle.trim(),
        description: newPosDesc.trim(),
        max_selections: newPosMaxSel,
      },
    ]);
    setNewPosTitle("");
    setNewPosDesc("");
    setNewPosMaxSel(1);
    setShowAddPosition(false);
  }

  function removePosition(idx: number) {
    setPositions(positions.filter((_, i) => i !== idx));
  }

  // ---------- Final submit ----------
  async function handleFinalSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const metadata = {
        election_type: electionType,
        academic_year: academicYear,
        manager_email: managerEmail,
        voting_rules: {
          allow_abstention: allowAbstention,
          tie_breaking_policy: tieBreaking,
          min_selections: minSelections,
          show_results_before_close: showResultsBeforeClose,
        },
        timezone,
        eligibility_scope: eligibilityScope,
        department_name: departmentName,
        candidate_mode: candidateMode,
        application_deadline: applicationDeadline,
        candidate_requirements: candidateRequirements,
        security: {
          require_sign_off: requireSignOff,
          allow_recount_requests: allowRecountRequests,
          results_visibility: resultsVisibility,
          require_result_approval: requireResultApproval,
        },
        configuration_fingerprint: configHash,
      };

      const createdElection = await apiClient.createElection({
        organization_id: effectiveOrgId,
        title: title.trim(),
        description: description.trim() || undefined,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        timezone,
        // @ts-expect-error extra metadata passed; backend may accept or ignore it
        metadata,
      });

      for (let pIdx = 0; pIdx < positions.length; pIdx++) {
        const pos = positions[pIdx];
        await apiClient.addPosition(createdElection.id, {
          title: pos.title,
          description: pos.description || undefined,
          max_selections: pos.max_selections,
          display_order: pIdx,
        });
      }

      navigate("/admin");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create election.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  }

  // ---------- Progress bar ----------
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  // ---------- Nav buttons helper ----------
  function NavButtons({
    onNext,
    nextLabel = "Next",
    showBack = true,
    loading = false,
  }: {
    onNext?: () => void;
    nextLabel?: string;
    showBack?: boolean;
    loading?: boolean;
  }) {
    return (
      <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
        {showBack ? (
          <Button
            variant="secondary"
            onClick={() => {
              setErrorMessage(null);
              setStep((s) => s - 1);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={onNext ?? validateAndNext}
          disabled={loading}
          className="gap-2"
        >
          {loading ? "Submitting…" : nextLabel}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* ── Header & progress ── */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create Institutional Election
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Step {step} of {STEPS.length} — {STEPS[step - 1].label}
        </p>

        {/* Progress bar */}
        <div className="relative mt-4 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
          {STEPS.map((s) => (
            <div key={s.num} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === s.num
                    ? "bg-primary text-primary-foreground shadow"
                    : step > s.num
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {step > s.num ? <Check className="h-3 w-3" /> : s.num}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:inline mr-1 ${
                  step === s.num
                    ? "text-foreground font-semibold"
                    : step > s.num
                    ? "text-emerald-700"
                    : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {s.num < STEPS.length && (
                <div className="w-4 h-px bg-border hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Error banner ── */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1 — Basic Info                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <Card>
          <StepHeader
            icon={<FileText className="h-4 w-4" />}
            title="Basic Information"
            subtitle="Define the election title, type, host organization, and session details."
          />
          <CardContent className="space-y-5">
            {/* Organization */}
            <div>
              <label className={labelCls}>
                <Building2 className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Organization *
              </label>
              {organizations && organizations.length > 0 ? (
                <select
                  value={effectiveOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className={inputCls}
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No organizations found. Please create or join an organization first.
                </div>
              )}
            </div>

            {/* Election Title */}
            <div>
              <label className={labelCls}>Election Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Student Union General Election"
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Provide context, voting guidelines, or institutional references…"
                className={inputCls}
              />
            </div>

            {/* Election Type */}
            <div>
              <label className={labelCls}>Election Type</label>
              <select
                value={electionType}
                onChange={(e) => setElectionType(e.target.value as ElectionType)}
                className={inputCls}
              >
                <option value="general">General</option>
                <option value="by_election">By-Election</option>
                <option value="referendum">Referendum</option>
                <option value="primary">Primary</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className={labelCls}>Academic Year / Session Label</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2026/2027"
                className={inputCls}
              />
            </div>

            {/* Manager Email */}
            <div>
              <label className={labelCls}>Election Manager Email (optional)</label>
              <input
                type="email"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="manager@example.com"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Assigns the election manager role after creation.
              </p>
            </div>

            <NavButtons showBack={false} nextLabel="Next: Structure" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2 — Election Structure                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <Card>
          <StepHeader
            icon={<Settings className="h-4 w-4" />}
            title="Election Structure"
            subtitle="Define the ballot positions. At least one position is required."
          />
          <CardContent className="space-y-5">
            {/* Single vs Multi toggle */}
            <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-slate-50">
              <Toggle
                id="multi-position"
                checked={isMultiPosition}
                onToggle={setIsMultiPosition}
                label={
                  isMultiPosition
                    ? "Multi-position election"
                    : "Single-position election"
                }
              />
            </div>

            {/* Position list */}
            <div className="space-y-3">
              {positions.map((pos, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-4 rounded-xl border border-border bg-slate-50"
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">{pos.title}</p>
                    {pos.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {pos.description}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Max selections: {pos.max_selections}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePosition(idx)}
                    className="text-slate-400 hover:text-red-500 ml-3 flex-shrink-0"
                    aria-label="Remove position"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {positions.length === 0 && (
                <p className="text-xs text-amber-700 italic">
                  No positions added yet. Add at least one position below.
                </p>
              )}
            </div>

            {/* Add position form */}
            {showAddPosition ? (
              <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-3">
                <h4 className="text-xs font-bold text-foreground">New Position</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Position Title *</label>
                    <input
                      type="text"
                      value={newPosTitle}
                      onChange={(e) => setNewPosTitle(e.target.value)}
                      placeholder="e.g. Vice President"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Description (optional)</label>
                    <input
                      type="text"
                      value={newPosDesc}
                      onChange={(e) => setNewPosDesc(e.target.value)}
                      placeholder="Brief role description"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="w-36">
                  <label className={labelCls}>Max Selections</label>
                  <input
                    type="number"
                    min={1}
                    value={newPosMaxSel}
                    onChange={(e) => setNewPosMaxSel(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addPosition} disabled={!newPosTitle.trim()} className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Add Position
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddPosition(false);
                      setNewPosTitle("");
                      setNewPosDesc("");
                      setNewPosMaxSel(1);
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPosition(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Position
              </Button>
            )}

            <NavButtons nextLabel="Next: Voting Rules" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 3 — Voting Rules                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <Card>
          <StepHeader
            icon={<Shield className="h-4 w-4" />}
            title="Voting Rules"
            subtitle="Configure ballot behaviour that applies to the entire election."
          />
          <CardContent className="space-y-6">
            <Toggle
              id="allow-abstention"
              checked={allowAbstention}
              onToggle={setAllowAbstention}
              label="Allow abstention"
            />

            <div>
              <label className={labelCls}>Tie-Breaking Policy</label>
              <select
                value={tieBreaking}
                onChange={(e) => setTieBreaking(e.target.value as TieBreakingPolicy)}
                className={inputCls}
              >
                <option value="manual_review">Manual Review</option>
                <option value="random">Random</option>
                <option value="runoff">Runoff</option>
              </select>
            </div>

            <div className="w-40">
              <label className={labelCls}>Minimum Selections Per Ballot</label>
              <input
                type="number"
                min={0}
                value={minSelections}
                onChange={(e) => setMinSelections(Number(e.target.value))}
                className={inputCls}
              />
            </div>

            <Toggle
              id="show-results-before-close"
              checked={showResultsBeforeClose}
              onToggle={setShowResultsBeforeClose}
              label="Show live results before closing"
            />

            <NavButtons nextLabel="Next: Schedule" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 4 — Schedule                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <Card>
          <StepHeader
            icon={<Calendar className="h-4 w-4" />}
            title="Schedule"
            subtitle="Set the voting window and timezone for this election."
          />
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Opens At *
                </label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Closes At *
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputCls}
              >
                <option value="UTC">UTC</option>
                <option value="Africa/Lagos">Africa/Lagos</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
            </div>

            <NavButtons nextLabel="Next: Eligibility" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 5 — Voter Eligibility                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 5 && (
        <Card>
          <StepHeader
            icon={<Users className="h-4 w-4" />}
            title="Voter Eligibility Scope"
            subtitle="Determine who is eligible to vote in this election."
          />
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {(
                [
                  {
                    value: "entire_institution",
                    label: "Entire Institution",
                    detail: "All members are automatically eligible.",
                  },
                  {
                    value: "specific_department",
                    label: "Specific Department / Unit",
                    detail: "Restrict voting to a named department or unit.",
                  },
                  {
                    value: "manual_list",
                    label: "Manual List",
                    detail:
                      "Add eligible voters individually after creation.",
                  },
                  {
                    value: "csv_import",
                    label: "CSV Import",
                    detail:
                      "Upload a CSV after creation in the Voters tab.",
                  },
                ] as { value: EligibilityScope; label: string; detail: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    eligibilityScope === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="eligibility"
                    value={opt.value}
                    checked={eligibilityScope === opt.value}
                    onChange={() => setEligibilityScope(opt.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.detail}</p>
                  </div>
                </label>
              ))}
            </div>

            {eligibilityScope === "specific_department" && (
              <div>
                <label className={labelCls}>Department / Unit Name</label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="e.g. Faculty of Engineering"
                  className={inputCls}
                />
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
              You can also manage voter eligibility in detail from the{" "}
              <strong>Voters &amp; Eligibility</strong> tab after creation.
            </div>

            <NavButtons nextLabel="Next: Candidates" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 6 — Candidate Configuration                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 6 && (
        <Card>
          <StepHeader
            icon={<UserPlus className="h-4 w-4" />}
            title="Candidate Configuration"
            subtitle="Choose how candidates are registered for this election."
          />
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {(
                [
                  {
                    value: "manager_registers",
                    label: "Manager Registers Candidates",
                    detail: "Admin adds candidates directly from the Candidates tab.",
                  },
                  {
                    value: "open_application",
                    label: "Open Application",
                    detail:
                      "Candidates apply themselves — managed in the Candidates tab.",
                  },
                ] as { value: CandidateMode; label: string; detail: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    candidateMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="candidateMode"
                    value={opt.value}
                    checked={candidateMode === opt.value}
                    onChange={() => setCandidateMode(opt.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.detail}</p>
                  </div>
                </label>
              ))}
            </div>

            {candidateMode === "open_application" && (
              <div>
                <label className={labelCls}>Application Deadline</label>
                <input
                  type="datetime-local"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Candidate Requirements (optional)</label>
              <textarea
                value={candidateRequirements}
                onChange={(e) => setCandidateRequirements(e.target.value)}
                rows={3}
                placeholder="e.g. Must be a registered member, minimum GPA 3.0…"
                className={inputCls}
              />
            </div>

            <NavButtons nextLabel="Next: Security" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 7 — Security & Approval                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 7 && (
        <Card>
          <StepHeader
            icon={<Lock className="h-4 w-4" />}
            title="Security &amp; Approval Settings"
            subtitle="Configure sign-off, recount, and results publication rules."
          />
          <CardContent className="space-y-6">
            <Toggle
              id="require-sign-off"
              checked={requireSignOff}
              onToggle={setRequireSignOff}
              label="Require sign-off before opening"
            />

            <Toggle
              id="allow-recount"
              checked={allowRecountRequests}
              onToggle={setAllowRecountRequests}
              label="Allow recount requests"
            />

            <div>
              <label className={labelCls}>Results Visible To</label>
              <div className="space-y-2 mt-2">
                {(
                  [
                    { value: "everyone", label: "Everyone" },
                    {
                      value: "authenticated_members",
                      label: "Authenticated Members Only",
                    },
                    {
                      value: "administrators_only",
                      label: "Administrators Only",
                    },
                  ] as { value: ResultsVisibility; label: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      resultsVisibility === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resultsVisibility"
                      value={opt.value}
                      checked={resultsVisibility === opt.value}
                      onChange={() => setResultsVisibility(opt.value)}
                      className="accent-primary"
                    />
                    <span className="text-xs font-medium text-foreground">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Toggle
              id="require-result-approval"
              checked={requireResultApproval}
              onToggle={setRequireResultApproval}
              label="Require result approval before publication"
            />

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
              These settings can be adjusted until the election is opened.
            </div>

            <NavButtons nextLabel="Review &amp; Submit" />
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 8 — Review & Freeze                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {step === 8 && (
        <Card>
          <StepHeader
            icon={<Hash className="h-4 w-4" />}
            title="Review &amp; Freeze"
            subtitle="Verify all settings before submitting. A configuration fingerprint will be recorded."
          />
          <CardContent className="space-y-5">
            {/* Summary card */}
            <div className="rounded-xl border border-border bg-slate-50 divide-y divide-border text-xs">
              {/* Step 1 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Basic Info
                </p>
                <SummaryRow label="Title" value={title} />
                <SummaryRow label="Organization" value={effectiveOrgId} />
                <SummaryRow label="Type" value={electionType} />
                {academicYear && (
                  <SummaryRow label="Academic Year" value={academicYear} />
                )}
                {description && (
                  <SummaryRow label="Description" value={description} />
                )}
                {managerEmail && (
                  <SummaryRow label="Manager Email" value={managerEmail} />
                )}
              </div>

              {/* Step 2 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Structure
                </p>
                <SummaryRow
                  label="Mode"
                  value={isMultiPosition ? "Multi-position" : "Single-position"}
                />
                <SummaryRow
                  label="Positions"
                  value={positions.map((p) => p.title).join(", ") || "—"}
                />
              </div>

              {/* Step 3 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Voting Rules
                </p>
                <SummaryRow
                  label="Abstention"
                  value={allowAbstention ? "Allowed" : "Not allowed"}
                />
                <SummaryRow label="Tie-breaking" value={tieBreaking} />
                <SummaryRow
                  label="Min selections"
                  value={String(minSelections)}
                />
                <SummaryRow
                  label="Show live results"
                  value={showResultsBeforeClose ? "Yes" : "No"}
                />
              </div>

              {/* Step 4 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Schedule
                </p>
                <SummaryRow
                  label="Opens"
                  value={new Date(opensAt).toLocaleString()}
                />
                <SummaryRow
                  label="Closes"
                  value={new Date(closesAt).toLocaleString()}
                />
                <SummaryRow label="Timezone" value={timezone} />
              </div>

              {/* Step 5 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Eligibility
                </p>
                <SummaryRow label="Scope" value={eligibilityScope} />
                {eligibilityScope === "specific_department" &&
                  departmentName && (
                    <SummaryRow label="Department" value={departmentName} />
                  )}
              </div>

              {/* Step 6 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Candidate Config
                </p>
                <SummaryRow label="Mode" value={candidateMode} />
                {candidateMode === "open_application" &&
                  applicationDeadline && (
                    <SummaryRow
                      label="Application Deadline"
                      value={new Date(applicationDeadline).toLocaleString()}
                    />
                  )}
                {candidateRequirements && (
                  <SummaryRow
                    label="Requirements"
                    value={candidateRequirements}
                  />
                )}
              </div>

              {/* Step 7 */}
              <div className="px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Security
                </p>
                <SummaryRow
                  label="Require sign-off"
                  value={requireSignOff ? "Yes" : "No"}
                />
                <SummaryRow
                  label="Allow recount"
                  value={allowRecountRequests ? "Yes" : "No"}
                />
                <SummaryRow
                  label="Results visible to"
                  value={resultsVisibility}
                />
                <SummaryRow
                  label="Require result approval"
                  value={requireResultApproval ? "Yes" : "No"}
                />
              </div>
            </div>

            {/* Config fingerprint */}
            <div className="p-4 rounded-xl border border-border bg-slate-50 flex items-start gap-3">
              <Hash className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Configuration Fingerprint
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 break-all font-mono">
                  {configHash || "Computing…"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  This SHA-256 hash is derived from the complete wizard
                  configuration and will be recorded when the election is saved.
                </p>
              </div>
            </div>

            {/* Immutability notice */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-start gap-3 text-xs text-blue-900">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Immutable Configuration Guarantee</p>
                <p className="mt-0.5 text-blue-700">
                  This election will be initialized in{" "}
                  <strong>draft</strong> state. After formal launch approval,
                  transitioning to <strong>scheduled</strong> will compute an
                  irreversible SHA-256 ballot hash, locking all candidates and
                  positions permanently.
                </p>
              </div>
            </div>

            {/* Nav */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => {
                  setErrorMessage(null);
                  setStep(7);
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? "Submitting…" : "Submit Election"}
                {!isSubmitting && <Check className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny helper for summary rows
// ---------------------------------------------------------------------------
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
