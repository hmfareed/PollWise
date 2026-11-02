import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient voter participation methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls requestVoterChallenge and receives on-screen OTP code", async () => {
    const mockResponse = {
      status: "success",
      data: {
        challenge_id: "chal-12345",
        otp_code: "482916",
        expires_in_seconds: 300,
        identifier_label: "Institutional Email",
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiClient.requestVoterChallenge("elec-1", "student@uni.edu");
    expect(res.otp_code).toBe("482916");
    expect(res.challenge_id).toBe("chal-12345");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/elections/elec-1/voter-auth/request-challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ identifier: "student@uni.edu", terminal_token: undefined }),
      })
    );
  });

  it("calls verifyVoterChallenge and receives session token", async () => {
    const mockResponse = {
      status: "success",
      data: {
        session_token: "tok-abcdef",
        status: "active",
        expires_at: "2026-11-02T13:00:00Z",
        allow_position_skip: true,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiClient.verifyVoterChallenge("elec-1", "chal-12345", "482916");
    expect(res.session_token).toBe("tok-abcdef");
    expect(res.status).toBe("active");
  });

  it("calls getVoterBallot with X-Voting-Session header", async () => {
    const mockResponse = {
      status: "success",
      data: {
        election_id: "elec-1",
        election_title: "Campus Vote",
        allow_position_skip: true,
        positions: [],
        draft: null,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiClient.getVoterBallot("elec-1", "tok-abcdef");
    expect(res.election_title).toBe("Campus Vote");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/elections/elec-1/ballot",
      expect.objectContaining({
        credentials: "include",
      })
    );
    const lastCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const callHeaders = lastCall[1]?.headers as Headers;
    expect(callHeaders.get("x-voting-session")).toBe("tok-abcdef");
  });

  it("submits voter ballot with idempotency key", async () => {
    const mockResponse = {
      status: "success",
      data: {
        confirmation_reference: "PW-ELEC-492817",
        submitted_at: "2026-11-02T12:00:00Z",
        status: "accepted",
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await apiClient.submitVoterBallot(
      "elec-1",
      "tok-abcdef",
      [{ position_id: "p-1", candidate_id: "c-1", skipped: false }],
      "idemp-123"
    );
    expect(res.confirmation_reference).toBe("PW-ELEC-492817");
  });
});
