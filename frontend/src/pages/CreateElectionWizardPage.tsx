import React, { useState } from "react";
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
  AlertCircle 
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";

interface LocalCandidate {
  name: string;
  biography?: string;
}

interface LocalPosition {
  title: string;
  description?: string;
  max_selections: number;
  candidates: LocalCandidate[];
}

export const CreateElectionWizardPage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Step: 1 = Details, 2 = Positions & Candidates, 3 = Review & Submit
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Initialize dates synchronously
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opensAt, setOpensAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [closesAt, setClosesAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [timezone] = useState("UTC");

  // Step 2 Positions & Candidates State
  const [positions, setPositions] = useState<LocalPosition[]>([
    {
      title: "President",
      description: "Executive leader of the student union / association",
      max_selections: 1,
      candidates: [
        { name: "Candidate One", biography: "Platform focused on academic representation" },
        { name: "Candidate Two", biography: "Platform focused on campus infrastructure" },
      ],
    },
  ]);

  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [newPositionDesc, setNewPositionDesc] = useState("");
  const [currentCandName, setCurrentCandName] = useState<Record<number, string>>({});
  const [currentCandBio, setCurrentCandBio] = useState<Record<number, string>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user organizations for selection
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: apiClient.getOrganizations,
  });

  const effectiveOrgId = selectedOrgId || organizations?.[0]?.id || "";

  const addPosition = () => {
    if (!newPositionTitle.trim()) return;
    setPositions([
      ...positions,
      {
        title: newPositionTitle.trim(),
        description: newPositionDesc.trim() || undefined,
        max_selections: 1,
        candidates: [],
      },
    ]);
    setNewPositionTitle("");
    setNewPositionDesc("");
  };

  const removePosition = (index: number) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  const addCandidateToPosition = (posIndex: number) => {
    const name = currentCandName[posIndex];
    if (!name || !name.trim()) return;
    const bio = currentCandBio[posIndex] || "";

    const updated = [...positions];
    updated[posIndex].candidates.push({
      name: name.trim(),
      biography: bio.trim() || undefined,
    });
    setPositions(updated);

    setCurrentCandName({ ...currentCandName, [posIndex]: "" });
    setCurrentCandBio({ ...currentCandBio, [posIndex]: "" });
  };

  const removeCandidate = (posIndex: number, candIndex: number) => {
    const updated = [...positions];
    updated[posIndex].candidates = updated[posIndex].candidates.filter((_, i) => i !== candIndex);
    setPositions(updated);
  };

  // Submit the entire election tree atomically
  const handleFinalSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      // 1. Create Election
      const createdElection = await apiClient.createElection({
        organization_id: effectiveOrgId,
        title: title.trim(),
        description: description.trim() || undefined,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        timezone,
      });

      // 2. Add Positions and Candidates
      for (let pIdx = 0; pIdx < positions.length; pIdx++) {
        const pos = positions[pIdx];
        const createdPos = await apiClient.addPosition(createdElection.id, {
          title: pos.title,
          description: pos.description,
          max_selections: pos.max_selections,
          display_order: pIdx,
        });

        for (let cIdx = 0; cIdx < pos.candidates.length; cIdx++) {
          const cand = pos.candidates[cIdx];
          await apiClient.addCandidate(createdPos.id, {
            name: cand.name,
            biography: cand.biography,
            display_order: cIdx,
          });
        }
      }

      // Redirect to the newly created election detail page
      navigate(`/elections/${createdElection.id}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create election structure");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Indicator */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create Institutional Election
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure election parameters, define ballot positions, and attach candidates.
        </p>

        <div className="flex items-center gap-4 mt-6">
          {[
            { num: 1, label: "Election Details" },
            { num: 2, label: "Positions & Candidates" },
            { num: 3, label: "Review & Initialize" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.num
                    ? "bg-primary text-primary-foreground shadow"
                    : step > s.num
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  step === s.num ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {s.num < 3 && <div className="w-8 h-px bg-border hidden sm:block ml-2" />}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 1: General Election Information</CardTitle>
            <CardDescription className="text-xs">
              Define the host organization, election title, and operating timeframe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Target Organization
              </label>
              {organizations && organizations.length > 0 ? (
                <select
                  value={effectiveOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Election Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Student Union General Election"
                className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description & Voter Instructions</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Provide context, voting guidelines, or institutional references..."
                className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Opens At (UTC) *
                </label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Closes At (UTC) *
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  if (!title.trim()) {
                    setErrorMessage("Election title is required");
                    return;
                  }
                  if (!effectiveOrgId) {
                    setErrorMessage("Please select a valid organization");
                    return;
                  }
                  setErrorMessage(null);
                  setStep(2);
                }}
                className="gap-2"
              >
                Next: Positions & Candidates
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Positions & Candidates */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step 2: Ballot Structure</CardTitle>
              <CardDescription className="text-xs">
                Each election requires at least one position, and each position requires at least one candidate before it can be scheduled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Positions List */}
              <div className="space-y-4">
                {positions.map((pos, pIdx) => (
                  <div key={pIdx} className="rounded-xl border border-border p-5 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                          Position #{pIdx + 1}
                        </span>
                        <h4 className="font-bold text-base text-foreground">{pos.title}</h4>
                        {pos.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{pos.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePosition(pIdx)}
                        className="text-danger hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Candidates in this position */}
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-foreground">
                        Registered Candidates ({pos.candidates.length})
                      </span>

                      {pos.candidates.length === 0 ? (
                        <p className="text-xs text-amber-700 italic">
                          No candidates added yet. Add at least one candidate below.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pos.candidates.map((c, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-start justify-between p-3 rounded-lg bg-surface border border-border text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-semibold text-foreground">{c.name}</p>
                                {c.biography && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                                    {c.biography}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeCandidate(pIdx, cIdx)}
                                className="text-slate-400 hover:text-danger ml-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Candidate Form */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Candidate full name"
                          value={currentCandName[pIdx] || ""}
                          onChange={(e) =>
                            setCurrentCandName({ ...currentCandName, [pIdx]: e.target.value })
                          }
                          className="flex-1 p-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="text"
                          placeholder="Brief biography or platform (optional)"
                          value={currentCandBio[pIdx] || ""}
                          onChange={(e) =>
                            setCurrentCandBio({ ...currentCandBio, [pIdx]: e.target.value })
                          }
                          className="flex-1 p-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => addCandidateToPosition(pIdx)}
                          className="gap-1 text-xs"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add Candidate
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Position Box */}
              <div className="p-4 rounded-xl border border-dashed border-border bg-surface space-y-3">
                <h4 className="text-xs font-bold text-foreground">Add Another Position</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Position title (e.g. Vice President)"
                    value={newPositionTitle}
                    onChange={(e) => setNewPositionTitle(e.target.value)}
                    className="p-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Position description (optional)"
                    value={newPositionDesc}
                    onChange={(e) => setNewPositionDesc(e.target.value)}
                    className="p-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addPosition}
                  disabled={!newPositionTitle.trim()}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Position to Ballot
                </Button>
              </div>

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (positions.length === 0) {
                      setErrorMessage("You must define at least one position.");
                      return;
                    }
                    const hasEmptyPos = positions.some((p) => p.candidates.length === 0);
                    if (hasEmptyPos) {
                      setErrorMessage(
                        "Every position must have at least one candidate before scheduling."
                      );
                      return;
                    }
                    setErrorMessage(null);
                    setStep(3);
                  }}
                  className="gap-2"
                >
                  Next: Review & Initialize
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 3: Review & Create Draft Election</CardTitle>
            <CardDescription className="text-xs">
              Verify election parameters before saving as a draft. Once saved, you can add launch approvals and freeze the configuration for scheduling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-border p-4 bg-slate-50 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Title</span>
                <span className="font-semibold text-foreground">{title}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Voting Window</span>
                <span className="font-medium text-foreground">
                  {new Date(opensAt).toLocaleString()} – {new Date(closesAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Positions</span>
                <span className="font-semibold text-foreground">{positions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Candidates</span>
                <span className="font-semibold text-foreground">
                  {positions.reduce((acc, p) => acc + p.candidates.length, 0)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-start gap-3 text-xs text-blue-900">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Immutable Configuration Guarantee</p>
                <p className="mt-0.5 text-blue-700">
                  This election will be initialized in <strong>draft</strong> state. After formal launch approval is recorded, transitioning to <strong>scheduled</strong> will compute an irreversible SHA-256 ballot hash, locking all candidates and positions permanently.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Positions
              </Button>
              <Button onClick={handleFinalSubmit} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? "Creating Election..." : "Create Election"}
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
