export type DashboardPeriod =
  | "last_30_days"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months";

export interface KPIMetric {
  value: number;
  change_pct: number | null;
}

export interface DashboardMetrics {
  total_elections: KPIMetric;
  eligible_voters: KPIMetric;
  registered_candidates: KPIMetric;
  active_elections: KPIMetric;
}

export interface ChartDataPoint {
  label: string;
  timestamp: string;
  created: number;
  closed: number;
  published: number;
}

export interface ElectionOverviewChartData {
  period: string;
  points: ChartDataPoint[];
}

export interface ElectionStatusDonutData {
  total: number;
  draft: number;
  scheduled: number;
  open: number;
  closed: number;
  published: number;
  canceled: number;
}

export interface UpcomingDeadlineItem {
  election_id: string;
  title: string;
  deadline_type: string;
  deadline_at: string;
  status: string;
}

export interface RecentActivityItem {
  id: string;
  event_type: string;
  description: string;
  timestamp: string;
  outcome: string;
  actor_email?: string | null;
}

export interface DashboardSummaryResponse {
  organization_id: string;
  organization_name: string;
  period: string;
  metrics: DashboardMetrics;
  election_overview: ElectionOverviewChartData;
  election_status: ElectionStatusDonutData;
  upcoming_deadlines: UpcomingDeadlineItem[];
  recent_activity: RecentActivityItem[];
}
