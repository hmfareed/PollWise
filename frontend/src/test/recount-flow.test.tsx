import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { RecountRequestModal } from "../components/reports/RecountRequestModal";
import { ElectionResultsPage } from "../pages/ElectionResultsPage";
import { apiClient } from "../lib/api-client";
import type { ElectionDetail } from "../types/election";
import type { ElectionResult } from "../types/results";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("RecountRequestModal Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders modal with election title, warning note, and disabled submit button when reason is short", () => {
    render(
      <RecountRequestModal
        isOpen={true}
        onClose={vi.fn()}
        electionId="elec-123"
        electionTitle="Student Council Election 2026"
        currentVersion={1}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("Request Official Recount & Audit")).toBeInTheDocument();
    expect(screen.getByText(/Student Council Election 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Initiate Recount/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submits recount request when valid reason is entered and triggers onSuccess", async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.spyOn(apiClient, "requestRecount").mockResolvedValueOnce({
      result: {
        id: "res-v2",
        election_id: "elec-123",
        result_version: 2,
        tally_algorithm_version: "1.0",
        configuration_hash: "hash",
        ballot_count: 10,
        approval_status: "pending",
        computed_at: "2026-11-06T12:00:00Z",
        positions: [],
      },
      recount: {
        id: "rec-1",
        election_id: "elec-123",
        requester_user_id: "user-1",
        reason: "Valid dispute justification for recalculating votes",
        status: "completed",
        resulting_result_id: "res-v2",
        created_at: "2026-11-06T12:00:00Z",
      },
    });

    render(
      <RecountRequestModal
        isOpen={true}
        onClose={handleClose}
        electionId="elec-123"
        electionTitle="Student Council Election 2026"
        currentVersion={1}
        onSuccess={handleSuccess}
      />
    );

    const textarea = screen.getByPlaceholderText(/Provide detailed justification/i);
    fireEvent.change(textarea, { target: { value: "Valid dispute justification for recalculating votes" } });

    const submitBtn = screen.getByRole("button", { name: /Initiate Recount/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.requestRecount).toHaveBeenCalledWith(
        "elec-123",
        "Valid dispute justification for recalculating votes"
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});

describe("Recount Integration on ElectionResultsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders recount version indicator, notice banner, and opens recount modal on button click", async () => {
    const mockElection: ElectionDetail = {
      id: "elec-recounted-1",
      organization_id: "org-1",
      title: "Faculty Senate Recounted Election",
      description: "Recount verification",
      status: "published",
      opens_at: "2026-10-01T09:00:00Z",
      closes_at: "2026-10-05T17:00:00Z",
      timezone: "UTC",
      voting_method: "single_choice_per_position",
      configuration_version: 1,
      configuration_hash: "a".repeat(64),
      created_by: "manager-1",
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-05T18:00:00Z",
      positions: [],
    };

    const mockRecountResults: ElectionResult = {
      id: "res-v2",
      election_id: "elec-recounted-1",
      result_version: 2,
      tally_algorithm_version: "1.0",
      configuration_hash: "a".repeat(64),
      ballot_count: 50,
      approval_status: "approved",
      computed_at: "2026-10-05T19:00:00Z",
      published_at: "2026-10-05T19:30:00Z",
      positions: [],
    };

    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockElection);
    vi.spyOn(apiClient, "getResults").mockResolvedValue(mockRecountResults);
    vi.spyOn(apiClient, "getMe").mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@univ.edu",
        display_name: "Admin",
        account_status: "active",
        email_verified_at: "2026-01-01T00:00:00Z",
        is_platform_admin: false,
      },
      memberships: [
        {
          id: "mem-1",
          user_id: "admin-1",
          organization_id: "org-1",
          role: "organization_admin",
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-recounted-1/results"]}>
            <Routes>
              <Route path="/elections/:id/results" element={<ElectionResultsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Verify version badge
    await waitFor(() => {
      expect(screen.getByText(/Version 2 \(Recount\)/)).toBeInTheDocument();
      expect(screen.getByText(/Official Recounted Tally \(Version 2\)/)).toBeInTheDocument();
    });

    // Check Request Recount button is rendered
    const recountBtn = screen.getByRole("button", { name: /Request Recount/i });
    expect(recountBtn).toBeInTheDocument();

    // Click opens modal
    fireEvent.click(recountBtn);
    expect(screen.getByText("Request Official Recount & Audit")).toBeInTheDocument();
  });
});
