import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Users, 
  Vote, 
  Plus, 
  Trash2, 
  AlertCircle,
  UserCheck
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { StructureUnit } from "../types/organization";

const STEPS = [
  { id: 1, label: "Institution Profile" },
  { id: 2, label: "Institution Details" },
  { id: 3, label: "Admin Profile" },
  { id: 4, label: "Structure" },
  { id: 5, label: "Security Setup" },
  { id: 6, label: "Review & Activate" },
];

export const InstitutionOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, memberships } = useAuth();

  // Find active or draft institution membership
  const targetMembership = memberships.find((m) => m.role === "organization_admin") || memberships[0];
  const orgId = targetMembership?.organization_id;

  const { data: organization, isLoading: isOrgLoading } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => apiClient.getOrganization(orgId!),
    enabled: !!orgId,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompletedSuccess, setIsCompletedSuccess] = useState(false);

  // Step 1: Institution Profile
  const [institutionName, setInstitutionName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [institutionType, setInstitutionType] = useState("University");
  const [country, setCountry] = useState("United States");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Step 2: Institution Details
  const [description, setDescription] = useState("");
  const [approximateMembers, setApproximateMembers] = useState<number>(2500);
  const [registrationIdentifier, setRegistrationIdentifier] = useState("");

  // Step 3: Administrator Profile
  const [adminTitle, setAdminTitle] = useState("Director of Electoral Board");
  const [adminDepartment, setAdminDepartment] = useState("Office of the Registrar");
  const [adminPhone, setAdminPhone] = useState("");

  // Step 4: Structure Units
  const [structureUnits, setStructureUnits] = useState<StructureUnit[]>([
    { name: "Faculty of Engineering & Technology", unit_type: "faculty" },
    { name: "Faculty of Arts & Sciences", unit_type: "faculty" },
    { name: "Student Representative Council", unit_type: "student_union" },
  ]);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitType, setNewUnitType] = useState("department");

  // Step 5: Security Setup
  const [mfaPolicy, setMfaPolicy] = useState("recommended");
  const [approvedDomainsInput, setApprovedDomainsInput] = useState("");
  const [invitationPermission, setInvitationPermission] = useState("admin_only");
  const [requireDualApproval, setRequireDualApproval] = useState(false);

  const hasInitializedRef = React.useRef(false);

  // Prepopulate when organization loads
  useEffect(() => {
    if (organization && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setInstitutionName(organization.name || "");
      if (organization.metadata) {
        const m = organization.metadata;
        if (m.abbreviation) setAbbreviation(m.abbreviation);
        if (m.institution_type) setInstitutionType(m.institution_type);
        if (m.country) setCountry(m.country);
        if (m.city) setCity(m.city);
        if (m.website) setWebsite(m.website);
        if (m.contact_email) setContactEmail(m.contact_email);
        if (m.description) setDescription(m.description);
        if (m.approximate_members) setApproximateMembers(m.approximate_members);
        if (m.structure_units && Array.isArray(m.structure_units)) {
          setStructureUnits(m.structure_units);
        }
      }
    }
  }, [organization]);

  const onboardingMutation = useMutation({
    mutationFn: (isCompleted: boolean) => {
      if (!orgId) throw new Error("No organization assigned to your account.");

      const approvedDomains = approvedDomainsInput
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      return apiClient.completeOnboarding(orgId, {
        institution_name: institutionName.trim(),
        abbreviation: abbreviation.trim() || undefined,
        institution_type: institutionType,
        country,
        region: region.trim() || undefined,
        city: city.trim() || undefined,
        website: website.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        description: description.trim() || undefined,
        approximate_members: Number(approximateMembers) || 0,
        department_count: structureUnits.length,
        registration_identifier: registrationIdentifier.trim() || undefined,
        admin_title: adminTitle.trim() || undefined,
        admin_department: adminDepartment.trim() || undefined,
        admin_phone: adminPhone.trim() || undefined,
        structure_units: structureUnits,
        mfa_policy: mfaPolicy,
        approved_domains: approvedDomains,
        invitation_permission: invitationPermission,
        require_dual_approval_for_launch: requireDualApproval,
        is_completed: isCompleted,
      });
    },
    onSuccess: (_data, isCompleted) => {
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      setErrorMessage(null);

      if (isCompleted) {
        setIsCompletedSuccess(true);
      } else {
        alert("Institution onboarding progress saved as draft.");
      }
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || "Failed to save onboarding data. Please check your inputs.");
    },
  });

  const handleAddUnit = () => {
    if (!newUnitName.trim()) return;
    setStructureUnits([...structureUnits, { name: newUnitName.trim(), unit_type: newUnitType }]);
    setNewUnitName("");
  };

  const handleRemoveUnit = (index: number) => {
    setStructureUnits(structureUnits.filter((_, idx) => idx !== index));
  };

  if (isOrgLoading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-xs text-muted-foreground">
        Loading institutional workspace setup...
      </div>
    );
  }

  // ========================================================================
  // VIEW: ONBOARDING COMPLETION WELCOME SCREEN (Doc 27 Section 6)
  // ========================================================================
  if (isCompletedSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <Card className="border-emerald-200 bg-white shadow-sm overflow-hidden text-center">
          <div className="bg-emerald-600 p-8 text-white space-y-2">
            <div className="h-16 w-16 rounded-full bg-white text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Your Institution is Ready for Pollwise!</h1>
            <p className="text-xs text-emerald-100 max-w-md mx-auto">
              {institutionName} has been verified and activated in the institutional directory.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1 text-left">
              <h2 className="text-sm font-bold text-foreground">Suggested Next Actions:</h2>
              <p className="text-xs text-muted-foreground">
                Get your institutional election operations underway with these core steps:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <Link to="/admin/elections/new" className="block">
                <div className="p-4 rounded-xl border border-border bg-slate-50 hover:border-primary transition group h-full">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center mb-2">
                    <Vote className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary">1. Create Election</h3>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Configure positions, candidates, and schedule.
                  </p>
                </div>
              </Link>

              <Link to="/admin" className="block">
                <div className="p-4 rounded-xl border border-border bg-slate-50 hover:border-primary transition group h-full">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary">2. Invite Team</h3>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Assign election managers and electoral auditors.
                  </p>
                </div>
              </Link>

              <Link to="/elections" className="block">
                <div className="p-4 rounded-xl border border-border bg-slate-50 hover:border-primary transition group h-full">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
                    <Users className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary">3. Import Voters</h3>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Upload eligibility rosters and verify members.
                  </p>
                </div>
              </Link>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => navigate("/admin")}
                className="w-full gap-2 text-xs font-semibold py-2.5"
              >
                Go to Institutional Admin Console
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========================================================================
  // VIEW: MULTI-STEP ONBOARDING WIZARD (Doc 27 Section 5)
  // ========================================================================
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Wizard Header */}
      <div className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Institution Onboarding Setup</h1>
        <p className="text-xs text-muted-foreground">
          Configure your institutional identity, academic structures, and governance rules before hosting elections.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-6 gap-2">
        {STEPS.map((s) => {
          const isDone = s.id < currentStep;
          const isCurrent = s.id === currentStep;
          return (
            <div key={s.id} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  isDone
                    ? "bg-emerald-600"
                    : isCurrent
                    ? "bg-primary"
                    : "bg-slate-200"
                }`}
              />
              <span
                className={`text-[10px] hidden sm:block truncate ${
                  isCurrent ? "font-bold text-primary" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Step {currentStep} of 6
            </span>
            <Badge variant="outline" className="text-[10px]">
              {STEPS[currentStep - 1].label}
            </Badge>
          </div>
          <CardTitle className="text-lg">{STEPS[currentStep - 1].label}</CardTitle>
          <CardDescription className="text-xs">
            {currentStep === 1 && "Provide basic institutional identity and location details."}
            {currentStep === 2 && "Detail your institution's scale and operational profile."}
            {currentStep === 3 && "Confirm the lead electoral administrator's position and contact info."}
            {currentStep === 4 && "Define faculties, departments, and academic units eligible for elections."}
            {currentStep === 5 && "Establish administrative MFA, approved email domains, and audit thresholds."}
            {currentStep === 6 && "Review all institutional settings before activating the workspace."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: INSTITUTION PROFILE */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground">Institution Name</label>
                  <input
                    type="text"
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="e.g. Northwestern Polytechnic University"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Abbreviation</label>
                  <input
                    type="text"
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value)}
                    placeholder="e.g. NPU"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Institution Type</label>
                  <select
                    value={institutionType}
                    onChange={(e) => setInstitutionType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="University">University</option>
                    <option value="College">College</option>
                    <option value="Secondary school">Secondary school</option>
                    <option value="Professional association">Professional association</option>
                    <option value="Student union">Student union</option>
                    <option value="Corporate organization">Corporate organization</option>
                    <option value="Nonprofit organization">Nonprofit organization</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Chicago"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Region / State</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="e.g. Illinois"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Official Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://polytechnic.edu"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Official Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="elections@polytechnic.edu"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INSTITUTION DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Institution Mission & Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your institution and governance objectives..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Approximate Number of Members</label>
                  <input
                    type="number"
                    value={approximateMembers}
                    onChange={(e) => setApproximateMembers(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Registration / Accreditation ID (Optional)</label>
                  <input
                    type="text"
                    value={registrationIdentifier}
                    onChange={(e) => setRegistrationIdentifier(e.target.value)}
                    placeholder="e.g. EDU-ACCRED-2026-X"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ADMINISTRATOR PROFILE */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Authenticated Administrator</span>
                  <p className="font-semibold text-slate-900">{user?.display_name}</p>
                </div>
                <Badge variant="outline">{user?.email}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Position / Title</label>
                  <input
                    type="text"
                    value={adminTitle}
                    onChange={(e) => setAdminTitle(e.target.value)}
                    placeholder="e.g. Dean of Academic Affairs"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Department / Office</label>
                  <input
                    type="text"
                    value={adminDepartment}
                    onChange={(e) => setAdminDepartment(e.target.value)}
                    placeholder="e.g. Office of the Registrar"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground">Contact Phone Number</label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: STRUCTURE & DEPARTMENTS */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Define faculties, departments, schools, and student unions that will host or participate in elections.
                </p>
              </div>

              {/* Add New Unit Row */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. Faculty of Computer Science"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={newUnitType}
                  onChange={(e) => setNewUnitType(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="faculty">Faculty</option>
                  <option value="department">Department</option>
                  <option value="school">School</option>
                  <option value="student_union">Student Union</option>
                  <option value="committee">Committee</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddUnit}
                  className="gap-1.5 text-xs flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Unit
                </Button>
              </div>

              {/* Units List */}
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-slate-50/50">
                {structureUnits.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">
                    No departments or faculties added yet. Add your first unit above.
                  </p>
                ) : (
                  structureUnits.map((u, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{u.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {u.unit_type.replace("_", " ")}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnit(idx)}
                        className="text-slate-400 hover:text-danger p-1 transition"
                        title="Remove unit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 5: SECURITY SETUP */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Administrator MFA Policy</label>
                <select
                  value={mfaPolicy}
                  onChange={(e) => setMfaPolicy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="optional">Optional for All Roles</option>
                  <option value="recommended">Recommended for Managers and Auditors</option>
                  <option value="required">Strictly Enforced for All Administrators</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Approved Email Domains (Comma-separated)</label>
                <input
                  type="text"
                  value={approvedDomainsInput}
                  onChange={(e) => setApprovedDomainsInput(e.target.value)}
                  placeholder="polytechnic.edu, alumni.polytechnic.edu"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Restricts voter account registration to verified institutional email addresses.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Member & Manager Invitation Control</label>
                <select
                  value={invitationPermission}
                  onChange={(e) => setInvitationPermission(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="admin_only">Institution Administrators Only</option>
                  <option value="managers_and_admins">Election Managers and Administrators</option>
                </select>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-border">
                <input
                  type="checkbox"
                  id="dual-approval"
                  checked={requireDualApproval}
                  onChange={(e) => setRequireDualApproval(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="dual-approval" className="text-xs text-foreground font-medium">
                  Enforce Separation of Duties: Require two distinct managerial sign-offs before an election can open.
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW & ACTIVATE */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800 text-sm">{institutionName}</span>
                  <Badge variant="default" className="text-[10px]">{institutionType}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-600 text-[11px]">
                  <div>
                    <span className="text-slate-400">Location:</span> {city ? `${city}, ` : ""}{country}
                  </div>
                  <div>
                    <span className="text-slate-400">Approx. Members:</span> {approximateMembers.toLocaleString()}
                  </div>
                  <div>
                    <span className="text-slate-400">Admin Lead:</span> {user?.display_name} ({adminTitle})
                  </div>
                  <div>
                    <span className="text-slate-400">MFA Policy:</span> <span className="capitalize">{mfaPolicy}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 text-[11px]">Academic & Administrative Units:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {structureUnits.map((u, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium text-slate-800">
                        {u.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Action Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous Step
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {currentStep === 6 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    disabled={onboardingMutation.isPending}
                    onClick={() => onboardingMutation.mutate(false)}
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={onboardingMutation.isPending}
                    onClick={() => onboardingMutation.mutate(true)}
                  >
                    {onboardingMutation.isPending ? "Activating..." : "Complete Setup & Launch"}
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setCurrentStep(currentStep + 1)}
                >
                  Next Step
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
