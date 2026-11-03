export type IdentifierType = "institutional_email" | "institutional_id";

export interface VoterAuthConfig {
  id: string;
  election_id: string;
  identifier_type: IdentifierType;
  identifier_label: string;
  identifier_normalization_rules?: Record<string, unknown> | null;
  otp_length: number;
  otp_expiry_seconds: number;
  otp_max_attempts: number;
  otp_regeneration_cooldown_seconds: number;
  session_idle_timeout_seconds: number;
  session_max_duration_seconds: number;
  allow_session_resume: boolean;
  allow_position_skip: boolean;
  configuration_locked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoterAuthConfigUpdate {
  identifier_type?: IdentifierType;
  identifier_label?: string;
  identifier_normalization_rules?: Record<string, unknown> | null;
  otp_expiry_seconds?: number;
  otp_max_attempts?: number;
  allow_session_resume?: boolean;
  allow_position_skip?: boolean;
}

export interface VoterRecord {
  id: string;
  election_id: string;
  identifier_type: IdentifierType;
  normalized_identifier: string;
  voter_reference_id?: string | null;
  eligibility_status: string;
  voter_group?: string | null;
  source: string;
  created_at: string;
}

export interface VoterCSVPreviewReport {
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  sample_records: Array<{
    identifier: string;
    voter_group?: string | null;
    eligibility_status: string;
  }>;
  errors: string[];
}

export interface VoterChallengeResponse {
  challenge_id: string;
  otp_code: string;
  expires_in_seconds: number;
  identifier_label: string;
}

export interface VoterVerifyResponse {
  session_token: string;
  status: string;
  expires_at: string;
  allow_position_skip: boolean;
}

export interface CandidateItem {
  id: string;
  name: string;
  biography?: string | null;
  photo_url?: string | null;
  display_order: number;
}

export interface BallotPosition {
  id: string;
  title: string;
  description?: string | null;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  candidates: CandidateItem[];
}

export interface VoterBallotStructure {
  election_id: string;
  election_title: string;
  allow_position_skip: boolean;
  positions: BallotPosition[];
  draft?: {
    selections: Array<{
      position_id: string;
      candidate_id?: string | null;
      skipped: boolean;
    }>;
  } | null;
}

export interface VoterSelectionInput {
  position_id: string;
  candidate_id?: string | null;
  skipped: boolean;
}

export interface BallotSubmissionReceipt {
  confirmation_reference: string;
  submitted_at: string;
  status: string;
}

export interface VotingCentre {
  id: string;
  institution_id: string;
  name: string;
  location_description?: string | null;
  status: string;
  created_at: string;
}

export interface VotingTerminal {
  id: string;
  voting_centre_id: string;
  institution_id: string;
  terminal_name: string;
  authorized_election_id?: string | null;
  terminal_status: string;
  token?: string | null;
  last_seen_at?: string | null;
}

export interface TerminalHeartbeatResponse {
  command: "none" | "reset" | string;
  server_time: string;
}

export interface AccessCodeItem {
  id: string;
  election_id: string;
  code: string;
  status: "unused" | "used";
  used_by_student_id?: string | null;
  used_at?: string | null;
  created_at: string;
}

export interface AccessCodeListResponse {
  items: AccessCodeItem[];
  total_count: number;
  unused_count: number;
  used_count: number;
}

export interface VerifyAccessCodeResponse {
  valid: boolean;
  code: string;
  election_id: string;
  election_title: string;
}

export interface ClaimAccessCodeResponse {
  session_token: string;
  status: string;
  expires_at: string;
  allow_position_skip: boolean;
}

