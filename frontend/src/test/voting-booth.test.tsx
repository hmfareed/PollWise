import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../features/auth/authContextDef";
import { VotingBoothPage } from "../pages/VotingBoothPage";
import { apiClient } from "../lib/api-client";
import type { ElectionDetail } from "../types/election";
import type { User } from "../types/auth";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockUser: User = {
  id: "user-alice",
  email: "alice@university.edu",
  display_name: "Alice Voter",
  email_verified: true,
  account_status: "active",
  is_platform_admin: false,
  created_at: "2026-10-01T09:00:00Z",
};

const mockOpenElection: ElectionDetail = {
  id: "elec-open-1",
  organization_id: "org-1",
  title: "Student Union Executive Election 2026",
  description: "Official annual election",
  status: "open",
  opens_at: "2026-10-01T09:00:00Z",
  closes_at: "2026-11-01T17:00:00Z",
  timezone: "UTC",
  voting_method: "single_choice_per_position",
  configuration_version: 1,
  configuration_hash: "a".repeat(64),
  created_by: "manager-1",
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  positions: [
    {
      id: "pos-pres",
      election_id: "elec-open-1",
      title: "President",
      description: "Chief executive officer",
      min_selections: 1,
      max_selections: 1,
      display_order: 0,
      candidates: [
        {
          id: "cand-1",
          position_id: "pos-pres",
          name: "Candidate Alpha",
          biography: "Champion of student welfare",
          photo_url: null,
          display_order: 0,
          status: "active",
          created_at: "2026-10-01T09:00:00Z",
        },
        {
          id: "cand-2",
          position_id: "pos-pres",
          name: "Candidate Beta",
          biography: "Advocate for campus sustainability",
          photo_url: null,
          display_order: 1,
          status: "active",
          created_at: "2026-10-01T09:00:00Z",
        },
      ],
    },
  ],
};

describe("VotingBoothPage Integration", () => {
  it("renders Authentication Required when user is unauthenticated", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: null,
            memberships: [],
            isAuthenticated: false,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/elections/elec-open-1/vote"]}>
            <Routes>
              <Route path="/elections/:id/vote" element={<VotingBoothPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Authentication Required/i })).toBeInTheDocument();
  });

  it("handles complete ballot casting flow with receipt confirmation", async () => {
    vi.spyOn(apiClient, "getElection").mockResolvedValue(mockOpenElection);
    vi.spyOn(apiClient, "getMyParticipation").mockResolvedValue({
      election_id: "elec-open-1",
      is_eligible: true,
      eligibility_status: "eligible",
      entitlement_status: "unused",
      has_voted: false,
    });
    vi.spyOn(apiClient, "requestVotingCredential").mockResolvedValue({
      election_id: "elec-open-1",
      credential: "signed-bearer-token-secret-1234567890",
    });
    vi.spyOn(apiClient, "submitBallot").mockResolvedValue({
      status: "accepted",
      receipt_reference: "PW-A1B2-C3D4-E5F6",
    });
    vi.spyOn(apiClient, "confirmRedemption").mockResolvedValue({
      status: "redeemed",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: mockUser,
            memberships: [],
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/elections/elec-open-1/vote"]}>
            <Routes>
              <Route path="/elections/:id/vote" element={<VotingBoothPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    // 1. Initial Gate: Pre-ballot credential issuance
    expect(await screen.findByRole("heading", { name: /Enter Voting Booth/i })).toBeInTheDocument();
    expect(screen.getByText("alice@university.edu")).toBeInTheDocument();

    const authorizeButton = screen.getByRole("button", { name: /Authorize & Open Ballot/i });
    fireEvent.click(authorizeButton);

    // 2. Active Ballot: Candidate Selection
    expect(await screen.findByText("Official Ballot")).toBeInTheDocument();
    expect(screen.getByText("Candidate Alpha")).toBeInTheDocument();
    expect(screen.getByText("Candidate Beta")).toBeInTheDocument();

    // Select Candidate Alpha
    fireEvent.click(screen.getByText("Candidate Alpha"));

    // Proceed to Review
    const reviewButton = screen.getByRole("button", { name: /Review Ballot Selections/i });
    fireEvent.click(reviewButton);

    // 3. Review Stage
    expect(await screen.findByRole("heading", { name: /Review Your Ballot/i })).toBeInTheDocument();
    expect(screen.getByText("Candidate Alpha")).toBeInTheDocument();
    expect(screen.getByText("Irreversible Submission Notice")).toBeInTheDocument();

    // 4. Submit Secret Ballot
    const submitButton = screen.getByRole("button", { name: /Cast Secret Ballot/i });
    fireEvent.click(submitButton);

    // 5. Verified Receipt Screen
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Ballot Successfully Cast/i })).toBeInTheDocument();
    });
    expect(screen.getByText("PW-A1B2-C3D4-E5F6")).toBeInTheDocument();
    expect(screen.getByText("Ballot Secrecy Guarantee")).toBeInTheDocument();
  });
});
