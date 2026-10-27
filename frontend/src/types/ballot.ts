export interface BallotSelectionItem {
  position_id: string;
  candidate_ids: string[];
  is_abstain: boolean;
}

export interface BallotSubmitPayload {
  election_id: string;
  credential: string;
  selections: BallotSelectionItem[];
  idempotency_key?: string;
}

export interface BallotSubmitResponse {
  status: string;
  receipt_reference: string;
}

export interface ParticipationStatus {
  election_id: string;
  is_eligible: boolean;
  eligibility_status?: string | null;
  entitlement_status?: string | null;
  has_voted: boolean;
}

export interface EligibilityRecord {
  id: string;
  election_id: string;
  user_id: string;
  user_email?: string | null;
  user_name?: string | null;
  eligibility_status: string;
  entitlement_status: string;
  created_at: string;
}

export interface VotingCredentialResponse {
  election_id: string;
  credential: string;
  expires_at?: string | null;
}
