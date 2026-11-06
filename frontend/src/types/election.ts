export interface Candidate {
  id: string;
  position_id: string;
  name: string;
  biography?: string | null;
  photo_url?: string | null;
  display_order: number;
  status: string;
  created_at: string;
}

export interface Position {
  id: string;
  election_id: string;
  title: string;
  description?: string | null;
  min_selections: number;
  max_selections: number;
  display_order: number;
  candidates: Candidate[];
}

export interface Election {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  status: "draft" | "scheduled" | "open" | "paused" | "closed" | "tallied" | "published" | "canceled";
  opens_at?: string | null;
  closes_at?: string | null;
  timezone: string;
  voting_method: string;
  configuration_version: number;
  configuration_hash?: string | null;
  paused_at?: string | null;
  pause_reason?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ElectionDetail extends Election {
  positions: Position[];
}

export interface AuditEvent {
  id: string;
  organization_id?: string | null;
  election_id?: string | null;
  actor_id?: string | null;
  event_type: string;
  outcome: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateElectionPayload {
  organization_id: string;
  title: string;
  description?: string;
  opens_at?: string;
  closes_at?: string;
  timezone?: string;
}

export interface CreatePositionPayload {
  title: string;
  description?: string;
  min_selections?: number;
  max_selections?: number;
  display_order?: number;
}

export interface CreateCandidatePayload {
  name: string;
  biography?: string;
  photo_url?: string;
  display_order?: number;
}

export interface LaunchApprovalPayload {
  decision: "approved" | "rejected";
  reason?: string;
}

export interface TurnoutVelocityPoint {
  timestamp: string;
  ballots_count: number;
  cumulative_ballots: number;
}

export interface DepartmentTurnoutMetric {
  department: string;
  eligible_count: number;
  voted_count: number;
  turnout_percentage: number;
  is_suppressed: boolean;
}

export interface InfrastructureHealth {
  ballot_box_status: string;
  credential_service_status: string;
  database_status: string;
}

export interface LiveMonitoringData {
  election_id: string;
  status: string;
  total_eligible: number;
  ballots_cast: number;
  turnout_percentage: number;
  paused_at?: string | null;
  pause_reason?: string | null;
  velocity: TurnoutVelocityPoint[];
  departmental_turnout: DepartmentTurnoutMetric[];
  health: InfrastructureHealth;
}

export interface PauseElectionRequest {
  reason: string;
}

export interface ResumeElectionRequest {
  reason?: string | null;
}
