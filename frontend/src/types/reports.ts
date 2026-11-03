export type ReportType = "certified_results" | "turnout" | "summary" | "audit_trail";
export type ReportFormat = "csv" | "json";

export interface ReportExportItem {
  id: string;
  election_id: string;
  report_type: ReportType;
  file_format: ReportFormat;
  file_name: string;
  checksum?: string | null;
  generated_by: string;
  created_at: string;
}

export interface ReportExportListResponse {
  items: ReportExportItem[];
  total_count: number;
}

export interface GenerateReportRequest {
  report_type: ReportType;
  file_format?: ReportFormat;
}

export interface GenerateReportResponse {
  report: ReportExportItem;
  download_url: string;
  content_preview?: string | null;
}
