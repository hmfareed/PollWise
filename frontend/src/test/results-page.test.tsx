import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
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

const mockPublishedElection: ElectionDetail = {
  id: "elec-pub-1",
  organization_id: "org-1",
  title: "Faculty Board Election 2026",
  description: "Annual representative board election",
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

const mockResults: ElectionResult = {
  id: "res-1",
  election_id: "elec-pub-1",
  configuration_hash: "a".repeat(64),
  ballot_count: 42,
  approval_status: "approved",
  computed_at: "2026-10-05T17:30:00Z",
  published_at: "2026-10-05T18:00:00Z",
  positions: [
    {
      position_id: "pos-1",
      title: "Dean of Faculty",
      total_votes: 42,
      abstain_count: 2,
      winner_ids: ["cand-winner"],
      candidates: [
        {
          candidate_id: "cand-winner",
          name: "Dr. Eleanor Vance",
          votes: 28,
          percentage: 66.67,
        },
        {
          candidate_id: "cand-other",
          name: "Dr. Marcus Brody",
          votes: 14,
          percentage: 33.33,
        },
      ],
    },
  ],
};

describe("ElectionResultsPage", () => {
  it("renders published election results with winner indicator and counts", async () => {
    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockPublishedElection);
    vi.spyOn(apiClient, "getResults").mockResolvedValue(mockResults);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/elections/elec-pub-1/results"]}>
            <Routes>
              <Route path="/elections/:id/results" element={<ElectionResultsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Faculty Board Election 2026" })).toBeInTheDocument();
    expect(screen.getByText("Published & Publicly Auditable")).toBeInTheDocument();
    expect(screen.getByText("Dean of Faculty")).toBeInTheDocument();
    expect(screen.getByText("Dr. Eleanor Vance")).toBeInTheDocument();
    expect(screen.getByText("Elected")).toBeInTheDocument();
    expect(screen.getByText("Dr. Marcus Brody")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("(66.67%)")).toBeInTheDocument();
  });
});
