export interface CandidateResult {
  candidate_id?: string | null;
  name: string;
  votes: number;
  percentage: number;
}

export interface PositionResult {
  position_id: string;
  title: string;
  total_votes: number;
  abstain_count: number;
  candidates: CandidateResult[];
  winner_ids: string[];
}

export interface ElectionResult {
  id: string;
  election_id: string;
  result_version?: number;
  tally_algorithm_version?: string;
  configuration_hash: string;
  ballot_count: number;
  approval_status: string;
  computed_at: string;
  published_at?: string | null;
  positions: PositionResult[];
}

export interface RecountRequest {
  id: string;
  election_id: string;
  requester_user_id: string;
  reason: string;
  status: "pending" | "completed" | "rejected";
  resulting_result_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
}
