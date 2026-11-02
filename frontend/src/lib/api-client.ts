import type { ApiResponse, HealthStatus, ReadinessStatus } from "../types/api";
import type {
  AcceptInvitationResponse,
  ChangePasswordPayload,
  InvitationValidationResponse,
  LoginPayload,
  MeResponse,
  MfaSetupResponse,
  MfaVerifyResponse,
  PersonalOnboarding,
  PersonalRegisterPayload,
  RegisterPayload,
  UpdatePersonalOnboardingPayload,
  UpdateUserProfilePayload,
  User,
  UserElectionSummary,
} from "../types/auth";
import type {
  AuditEvent,
  CreateCandidatePayload,
  CreateElectionPayload,
  CreatePositionPayload,
  Election,
  ElectionDetail,
  LaunchApprovalPayload,
  Position,
  Candidate,
} from "../types/election";
import type {
  AddMemberPayload,
  CreateOrganizationPayload,
  MemberDetail,
  Organization,
  OrganizationOnboardingPayload,
} from "../types/organization";
import type {
  BallotSubmitPayload,
  BallotSubmitResponse,
  EligibilityRecord,
  ParticipationStatus,
  VotingCredentialResponse,
} from "../types/ballot";
import type { ElectionResult } from "../types/results";
import type { DashboardPeriod, DashboardSummaryResponse } from "../types/dashboard";
import type {
  BallotPosition,
  BallotSubmissionReceipt,
  TerminalHeartbeatResponse,
  VoterAuthConfig,
  VoterAuthConfigUpdate,
  VoterBallotStructure,
  VoterCSVPreviewReport,
  VoterChallengeResponse,
  VoterRecord,
  VoterSelectionInput,
  VoterVerifyResponse,
  VotingCentre,
  VotingTerminal,
} from "../types/voter-participation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
const BALLOT_BOX_URL = import.meta.env.VITE_BALLOT_BOX_URL || "http://localhost:8000/ballot-box/v1";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Standard fetch helper for authenticated/session-based API requests.
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Transmits session cookies safely
    });
  } catch (err: any) {
    throw new ApiError(
      "NETWORK_ERROR",
      "Unable to connect to the Pollwise server. Please ensure the backend is running at http://localhost:8000 and try again.",
      0,
      err
    );
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "MALFORMED_RESPONSE",
      "Server returned an invalid JSON response",
      response.status
    );
  }

  if (!response.ok || payload.error) {
    throw new ApiError(
      payload.error?.code || "HTTP_ERROR",
      payload.error?.message || `Request failed with status ${response.status}`,
      response.status,
      payload.error?.details
    );
  }

  return payload.data as T;
}

/**
 * Isolated fetch helper for ballot-box operations (Doc 07 & 20).
 * MUST omit credentials and never send identity cookies.
 */
export async function fetchBallotBox<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${BALLOT_BOX_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "omit", // CRITICAL: Never send cookies/identity to ballot-box
  });

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "MALFORMED_RESPONSE",
      "Ballot-box returned an invalid JSON response",
      response.status
    );
  }

  if (!response.ok || payload.error) {
    throw new ApiError(
      payload.error?.code || "BALLOT_BOX_ERROR",
      payload.error?.message || `Ballot submission failed with status ${response.status}`,
      response.status,
      payload.error?.details
    );
  }

  return payload.data as T;
}

export const apiClient = {
  // System Health
  getHealth: () => fetchApi<HealthStatus>("/health"),
  getReadiness: () => fetchApi<ReadinessStatus>("/ready"),

  // Auth & Identity
  register: (payload: RegisterPayload) =>
    fetchApi<User>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  registerPersonal: (payload: PersonalRegisterPayload) =>
    fetchApi<User>("/auth/register/personal", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: LoginPayload) =>
    fetchApi<MeResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => fetchApi<{ message: string }>("/auth/logout", { method: "POST" }),
  getMe: () => fetchApi<MeResponse>("/auth/me"),
  verifyEmail: (token: string) =>
    fetchApi<User>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: (email: string) =>
    fetchApi<{
      message: string;
      verification_token?: string | null;
      verification_url?: string | null;
    }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    fetchApi<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (payload: { token: string; new_password: string }) =>
    fetchApi<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  changePassword: (payload: ChangePasswordPayload) =>
    fetchApi<{ message: string }>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),

  // User Profile, Security & Personal Onboarding
  getPersonalOnboarding: () =>
    fetchApi<PersonalOnboarding>("/users/me/onboarding"),
  updatePersonalOnboarding: (
    stepOrPayload?: number | UpdatePersonalOnboardingPayload,
    status?: string
  ) => {
    let body: UpdatePersonalOnboardingPayload = {};
    if (typeof stepOrPayload === "number") {
      body.current_step = stepOrPayload;
      if (status !== undefined) {
        body.onboarding_status = status;
      }
    } else if (typeof stepOrPayload === "object" && stepOrPayload !== null) {
      body = stepOrPayload;
    }
    return fetchApi<PersonalOnboarding>("/users/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  updateProfile: (payload: UpdateUserProfilePayload) =>
    fetchApi<User>("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  setupMfa: () =>
    fetchApi<MfaSetupResponse>("/users/me/mfa/setup", {
      method: "POST",
    }),
  verifyMfa: (code: string) =>
    fetchApi<MfaVerifyResponse>("/users/me/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  validateInvitation: (code: string) =>
    fetchApi<InvitationValidationResponse>("/institutions/invitations/validate", {
      method: "POST",
      body: JSON.stringify({ invitation_code: code }),
    }),
  acceptInvitation: (code: string) =>
    fetchApi<AcceptInvitationResponse>("/institutions/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ invitation_code: code }),
    }),
  getMyElections: () =>
    fetchApi<UserElectionSummary[]>("/users/me/elections"),

  // Organizations
  getOrganizations: () => fetchApi<Organization[]>("/organizations"),
  createOrganization: (payload: CreateOrganizationPayload) =>
    fetchApi<Organization>("/organizations", { method: "POST", body: JSON.stringify(payload) }),
  getOrganization: (id: string) => fetchApi<Organization>(`/organizations/${id}`),
  updateOrganization: (id: string, payload: { name?: string; status?: string }) =>
    fetchApi<Organization>(`/organizations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getMembers: (orgId: string) => fetchApi<MemberDetail[]>(`/organizations/${orgId}/members`),
  addMember: (orgId: string, payload: AddMemberPayload) =>
    fetchApi<MemberDetail>(`/organizations/${orgId}/members`, { method: "POST", body: JSON.stringify(payload) }),
  updateMember: (orgId: string, memberId: string, payload: { role?: string; status?: string }) =>
    fetchApi<MemberDetail>(`/organizations/${orgId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  completeOnboarding: (orgId: string, payload: OrganizationOnboardingPayload) =>
    fetchApi<Organization>(`/organizations/${orgId}/onboarding`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitOrgForReview: (orgId: string) =>
    fetchApi<{ message: string; organization_id: string; status: string }>(`/organizations/${orgId}/submit-for-review`, {
      method: "POST",
    }),
  updateOrgStatus: (orgId: string, payload: { status: "verified" | "rejected" | "suspended"; reason?: string }) =>
    fetchApi<Organization>(`/organizations/${orgId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getDashboardSummary: (organizationId: string, period?: DashboardPeriod | string) =>
    fetchApi<DashboardSummaryResponse>(
      `/organizations/${organizationId}/dashboard/summary?period=${period || "last_12_months"}`
    ),

  // Elections & Lifecycle
  getElections: (orgId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append("organization_id", orgId);
    if (status) params.append("status", status);
    const qs = params.toString();
    return fetchApi<Election[]>(`/elections${qs ? `?${qs}` : ""}`);
  },
  createElection: (payload: CreateElectionPayload) =>
    fetchApi<Election>("/elections", { method: "POST", body: JSON.stringify(payload) }),
  getElection: (id: string) => fetchApi<ElectionDetail>(`/elections/${id}`),
  updateElection: (id: string, payload: Partial<CreateElectionPayload>) =>
    fetchApi<Election>(`/elections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  
  // Positions & Candidates
  addPosition: (electionId: string, payload: CreatePositionPayload) =>
    fetchApi<Position>(`/elections/${electionId}/positions`, { method: "POST", body: JSON.stringify(payload) }),
  updatePosition: (positionId: string, payload: Partial<CreatePositionPayload>) =>
    fetchApi<Position>(`/positions/${positionId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePosition: (positionId: string) =>
    fetchApi<{ message: string }>(`/positions/${positionId}`, { method: "DELETE" }),
  addCandidate: (positionId: string, payload: CreateCandidatePayload) =>
    fetchApi<Candidate>(`/positions/${positionId}/candidates`, { method: "POST", body: JSON.stringify(payload) }),
  updateCandidate: (candidateId: string, payload: Partial<CreateCandidatePayload>) =>
    fetchApi<Candidate>(`/candidates/${candidateId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCandidate: (candidateId: string) =>
    fetchApi<{ message: string }>(`/candidates/${candidateId}`, { method: "DELETE" }),
  
  // Lifecycle Transitions
  approveLaunch: (electionId: string, payload: LaunchApprovalPayload) =>
    fetchApi<{ approval_id: string; decision: string }>(`/elections/${electionId}/approve-launch`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  scheduleElection: (electionId: string) =>
    fetchApi<ElectionDetail>(`/elections/${electionId}/schedule`, { method: "POST" }),
  openElection: (electionId: string) =>
    fetchApi<ElectionDetail>(`/elections/${electionId}/open`, { method: "POST" }),
  closeElection: (electionId: string) =>
    fetchApi<ElectionDetail>(`/elections/${electionId}/close`, { method: "POST" }),
  cancelElection: (electionId: string, reason: string) =>
    fetchApi<ElectionDetail>(`/elections/${electionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getElectionAudit: (electionId: string) =>
    fetchApi<AuditEvent[]>(`/elections/${electionId}/audit`),

  // Voter Eligibility & Entitlements
  getEligibility: (electionId: string) =>
    fetchApi<EligibilityRecord[]>(`/elections/${electionId}/eligibility`),
  addEligibleVoter: (electionId: string, payload: { email?: string; user_id?: string }) =>
    fetchApi<EligibilityRecord>(`/elections/${electionId}/eligibility`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  bulkImportEligibility: (electionId: string, emails: string[]) =>
    fetchApi<{ total_processed: number; added: number; already_eligible: number; not_found: string[] }>(
      `/elections/${electionId}/eligibility/import`,
      {
        method: "POST",
        body: JSON.stringify({ emails }),
      }
    ),
  revokeEligibility: (electionId: string, recordId: string) =>
    fetchApi<void>(`/elections/${electionId}/eligibility/${recordId}`, {
      method: "DELETE",
    }),
  getMyParticipation: (electionId: string) =>
    fetchApi<ParticipationStatus>(`/elections/${electionId}/participation/me`),
  requestVotingCredential: (electionId: string) =>
    fetchApi<VotingCredentialResponse>(`/elections/${electionId}/voting-credential`, {
      method: "POST",
    }),
  confirmRedemption: (electionId: string, receipt_reference: string) =>
    fetchApi<{ status: string }>(`/elections/${electionId}/confirm-redemption`, {
      method: "POST",
      body: JSON.stringify({ receipt_reference }),
    }),

  // Isolated Ballot-Box Operations (credentials: "omit")
  submitBallot: (payload: BallotSubmitPayload) =>
    fetchBallotBox<BallotSubmitResponse>("/ballots", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Tally & Results
  computeTally: (electionId: string) =>
    fetchApi<ElectionResult>(`/elections/${electionId}/tally`, { method: "POST" }),
  getResults: (electionId: string) =>
    fetchApi<ElectionResult>(`/elections/${electionId}/results`),
  approveTally: (
    electionId: string,
    resultId: string,
    payload: { decision: "approved" | "rejected"; reason?: string }
  ) =>
    fetchApi<{ approval_id: string; decision: string; status: string }>(
      `/elections/${electionId}/results/${resultId}/approve`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  publishResults: (electionId: string) =>
    fetchApi<{ election_id: string; status: string; published: boolean }>(
      `/elections/${electionId}/publish`,
      { method: "POST" }
    ),

  // Independent Voter Authentication & Participation
  getVoterAuthConfig: (electionId: string) =>
    fetchApi<VoterAuthConfig>(`/elections/${electionId}/voter-auth-config`),
  updateVoterAuthConfig: (electionId: string, payload: VoterAuthConfigUpdate) =>
    fetchApi<VoterAuthConfig>(`/elections/${electionId}/voter-auth-config`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  lockVoterAuthConfig: (electionId: string) =>
    fetchApi<VoterAuthConfig>(`/elections/${electionId}/voter-auth-config/lock`, {
      method: "POST",
    }),
  previewVoterRollCSV: async (electionId: string, file: File): Promise<VoterCSVPreviewReport> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/elections/${electionId}/voters/preview`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.code || "CSV_PREVIEW_FAILED", err?.error?.message || "Failed to preview CSV", res.status);
    }
    const json = await res.json();
    return json.data;
  },
  importVoterRollCSV: async (electionId: string, file: File): Promise<{ imported_count: number }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/elections/${electionId}/voters/import`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.code || "CSV_IMPORT_FAILED", err?.error?.message || "Failed to import CSV", res.status);
    }
    const json = await res.json();
    return json.data;
  },
  listVoterRoll: (
    electionId: string,
    page: number = 1,
    pageSize: number = 50,
    query?: string,
    statusFilter?: string
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (query) params.append("query", query);
    if (statusFilter) params.append("eligibility_status", statusFilter);
    return fetchApi<VoterRecord[]>(`/elections/${electionId}/voters?${params.toString()}`);
  },
  addSingleVoter: (
    electionId: string,
    payload: { identifier: string; voter_group?: string; eligibility_status?: string }
  ) =>
    fetchApi<VoterRecord>(`/elections/${electionId}/voters`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteVoter: (electionId: string, voterId: string) =>
    fetchApi<{ deleted: boolean }>(`/elections/${electionId}/voters/${voterId}`, {
      method: "DELETE",
    }),

  // Voter Auth (On-screen Challenge)
  requestVoterChallenge: (
    electionId: string,
    identifier: string,
    terminalToken?: string
  ) =>
    fetchApi<VoterChallengeResponse>(`/elections/${electionId}/voter-auth/request-challenge`, {
      method: "POST",
      headers: terminalToken ? { "X-Terminal-Token": terminalToken } : undefined,
      body: JSON.stringify({ identifier, terminal_token: terminalToken }),
    }),
  verifyVoterChallenge: (
    electionId: string,
    challengeId: string,
    enteredOtp: string,
    terminalToken?: string
  ) =>
    fetchApi<VoterVerifyResponse>(`/elections/${electionId}/voter-auth/verify-challenge`, {
      method: "POST",
      headers: terminalToken ? { "X-Terminal-Token": terminalToken } : undefined,
      body: JSON.stringify({ challenge_id: challengeId, entered_otp: enteredOtp }),
    }),
  endVoterSession: (electionId: string, sessionToken: string) =>
    fetchApi<{ ended: boolean }>(`/elections/${electionId}/voter-auth/end-session`, {
      method: "POST",
      headers: { "X-Voting-Session": sessionToken },
    }),

  // Voter Ballot & Submission
  getVoterBallot: (electionId: string, sessionToken: string) =>
    fetchApi<VoterBallotStructure>(`/elections/${electionId}/ballot`, {
      headers: { "X-Voting-Session": sessionToken },
    }),
  saveVoterBallotDraft: (electionId: string, sessionToken: string, draftPayload: unknown) =>
    fetchApi<{ saved: boolean }>(`/elections/${electionId}/ballot/draft`, {
      method: "PUT",
      headers: { "X-Voting-Session": sessionToken },
      body: JSON.stringify(draftPayload),
    }),
  submitVoterBallot: (
    electionId: string,
    sessionToken: string,
    selections: VoterSelectionInput[],
    idempotencyKey: string
  ) =>
    fetchApi<BallotSubmissionReceipt>(`/elections/${electionId}/ballot/submit`, {
      method: "POST",
      headers: { "X-Voting-Session": sessionToken },
      body: JSON.stringify({ selections, idempotency_key: idempotencyKey }),
    }),

  // Voting Centres & Terminal Management
  createVotingCentre: (payload: { institution_id: string; name: string; location_description?: string }) =>
    fetchApi<VotingCentre>("/voting-centres", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listVotingCentres: (institutionId: string) =>
    fetchApi<VotingCentre[]>(`/voting-centres?institution_id=${institutionId}`),
  registerVotingTerminal: (centreId: string, terminalName: string, authorizedElectionId?: string) =>
    fetchApi<VotingTerminal>(`/voting-centres/${centreId}/terminals`, {
      method: "POST",
      body: JSON.stringify({
        terminal_name: terminalName,
        authorized_election_id: authorizedElectionId,
      }),
    }),
  listVotingTerminals: (centreId: string) =>
    fetchApi<VotingTerminal[]>(`/voting-centres/${centreId}/terminals`),
  terminalHeartbeat: (terminalId: string, terminalToken: string, currentStatus: string) =>
    fetchApi<TerminalHeartbeatResponse>(`/voting-terminals/${terminalId}/heartbeat`, {
      method: "POST",
      headers: { "X-Terminal-Token": terminalToken },
      body: JSON.stringify({ current_status: currentStatus }),
    }),
  supervisorResetTerminal: (terminalId: string) =>
    fetchApi<{ reset_triggered: boolean }>(`/voting-terminals/${terminalId}/reset`, {
      method: "POST",
    }),
};
