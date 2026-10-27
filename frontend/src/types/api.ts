/**
 * Pollwise standardized API response contracts matching backend models.
 */

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiErrorDetail | null;
}

export interface DatabaseHealthStatus {
  connected: boolean;
  database: string;
  latency_ms: number;
  error?: string | null;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  environment: string;
  version: string;
}

export interface ReadinessStatus {
  ready: boolean;
  databases: Record<string, DatabaseHealthStatus>;
}
