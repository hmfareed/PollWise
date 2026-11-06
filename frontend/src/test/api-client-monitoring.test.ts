import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient Emergency Controls & Live Monitoring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls pauseElection with mandatory reason", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "elec-123",
          status: "paused",
          paused_at: "2026-11-06T20:00:00Z",
          pause_reason: "Network disruption at terminal centre",
        },
        error: null,
      }),
    } as Response);

    const result = await apiClient.pauseElection("elec-123", "Network disruption at terminal centre");
    expect(result.status).toBe("paused");
    expect(result.pause_reason).toBe("Network disruption at terminal centre");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/elections/elec-123/pause"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Network disruption at terminal centre" }),
      })
    );
  });

  it("calls resumeElection with optional reason", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: "elec-123",
          status: "open",
          paused_at: null,
          pause_reason: null,
        },
        error: null,
      }),
    } as Response);

    const result = await apiClient.resumeElection("elec-123", "Connectivity restored");
    expect(result.status).toBe("open");
    expect(result.paused_at).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/elections/elec-123/resume"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Connectivity restored" }),
      })
    );
  });

  it("calls getElectionMonitoring and returns typed monitoring data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          election_id: "elec-123",
          status: "open",
          total_eligible: 100,
          ballots_cast: 45,
          turnout_percentage: 45.0,
          velocity: [
            { timestamp: "2026-11-06T19:00:00Z", ballots_count: 20, cumulative_ballots: 20 },
            { timestamp: "2026-11-06T20:00:00Z", ballots_count: 25, cumulative_ballots: 45 },
          ],
          departmental_turnout: [
            { department: "Engineering", eligible_count: 80, voted_count: 40, turnout_percentage: 50.0, is_suppressed: false },
            { department: "Other / Small Groups (< 10 voters)", eligible_count: 20, voted_count: 5, turnout_percentage: 25.0, is_suppressed: true },
          ],
          health: {
            ballot_box_status: "healthy",
            credential_service_status: "healthy",
            database_status: "healthy",
          },
        },
        error: null,
      }),
    } as Response);

    const data = await apiClient.getElectionMonitoring("elec-123");
    expect(data.election_id).toBe("elec-123");
    expect(data.turnout_percentage).toBe(45.0);
    expect(data.velocity).toHaveLength(2);
    expect(data.departmental_turnout[1].is_suppressed).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/elections/elec-123/monitoring"),
      expect.anything()
    );
  });
});
