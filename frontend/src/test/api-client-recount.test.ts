import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient Recount & Dispute Methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requestRecount calls POST /elections/:id/recount with reason payload", async () => {
    const electionId = "elec-123";
    const reason = "Formal audit dispute lodged by candidates.";

    const mockResponse = {
      data: {
        result: {
          id: "res-v2",
          election_id: electionId,
          result_version: 2,
          tally_algorithm_version: "1.0",
          configuration_hash: "hash",
          ballot_count: 50,
          approval_status: "pending",
          computed_at: "2026-11-06T12:00:00Z",
          positions: [],
        },
        recount: {
          id: "recount-1",
          election_id: electionId,
          requester_user_id: "user-1",
          reason,
          status: "completed",
          resulting_result_id: "res-v2",
          created_at: "2026-11-06T12:00:00Z",
          resolved_at: "2026-11-06T12:00:00Z",
        },
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.requestRecount(electionId, reason);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/elections/${electionId}/recount`),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ reason }),
      })
    );
    expect(result.result.result_version).toBe(2);
    expect(result.recount.status).toBe("completed");
    expect(result.recount.reason).toBe(reason);
  });

  it("getRecounts calls GET /elections/:id/recounts and returns history array", async () => {
    const electionId = "elec-123";
    const mockResponse = {
      data: [
        {
          id: "recount-1",
          election_id: electionId,
          requester_user_id: "user-1",
          reason: "Prior recount",
          status: "completed",
          resulting_result_id: "res-v2",
          created_at: "2026-11-06T12:00:00Z",
          resolved_at: "2026-11-06T12:00:00Z",
        },
      ],
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.getRecounts(electionId);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/elections/${electionId}/recounts`),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("recount-1");
  });
});
