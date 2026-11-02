import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../lib/api-client";
import type { DashboardSummaryResponse } from "../types/dashboard";

describe("Dashboard Summary API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSummary: DashboardSummaryResponse = {
    organization_id: "org-123",
    organization_name: "Apex University",
    period: "last_12_months",
    metrics: {
      total_elections: { value: 12, change_pct: 20.0 },
      eligible_voters: { value: 450, change_pct: 5.5 },
      registered_candidates: { value: 34, change_pct: -2.1 },
      active_elections: { value: 2, change_pct: null },
    },
    election_overview: {
      period: "last_12_months",
      points: [
        {
          label: "Jan 2026",
          timestamp: "2026-01-01T00:00:00Z",
          created: 3,
          closed: 2,
          published: 2,
        },
      ],
    },
    election_status: {
      total: 12,
      draft: 2,
      scheduled: 1,
      open: 2,
      closed: 4,
      published: 3,
      canceled: 0,
    },
    upcoming_deadlines: [
      {
        election_id: "el-1",
        title: "Student Council Election",
        deadline_type: "closes_at",
        deadline_at: "2026-11-10T18:00:00Z",
        status: "open",
      },
    ],
    recent_activity: [
      {
        id: "act-1",
        event_type: "election_created",
        description: "Created Student Council Election",
        timestamp: "2026-11-01T12:00:00Z",
        outcome: "success",
        actor_email: "admin@apex.edu",
      },
    ],
  };

  it("defines getDashboardSummary method on apiClient", () => {
    expect(typeof apiClient.getDashboardSummary).toBe("function");
  });

  it("calls GET /organizations/:id/dashboard/summary with default period 'last_12_months'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockSummary }),
    } as Response);

    const res = await apiClient.getDashboardSummary("org-123");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/organizations/org-123/dashboard/summary?period=last_12_months"),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(res).toEqual(mockSummary);
  });

  it("calls GET /organizations/:id/dashboard/summary with custom period", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          ...mockSummary,
          period: "last_30_days",
        },
      }),
    } as Response);

    const res = await apiClient.getDashboardSummary("org-123", "last_30_days");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/organizations/org-123/dashboard/summary?period=last_30_days"),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(res.period).toBe("last_30_days");
  });
});
