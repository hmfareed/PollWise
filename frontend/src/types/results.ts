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
  configuration_hash: string;
  ballot_count: number;
  approval_status: string;
  computed_at: string;
  published_at?: string | null;
  positions: PositionResult[];
}
