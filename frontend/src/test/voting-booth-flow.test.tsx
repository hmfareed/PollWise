import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VotingBoothPage } from "../pages/VotingBoothPage";
import { apiClient } from "../lib/api-client";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("VotingBoothPage Independent Voter Experience Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("progresses smoothly through landing, identifier entry, on-screen OTP verification, candidate-per-screen ballot, skip, review, and atomic submission", async () => {
    // Mock election details
    vi.spyOn(apiClient, "getElection").mockResolvedValue({
      id: "elec-123",
      organization_id: "org-1",
      title: "2026 Student Union Executive Election",
      description: "Official election for student body representatives",
      status: "open",
      opens_at: "2026-10-01T00:00:00Z",
      closes_at: "2026-12-01T00:00:00Z",
      timezone: "UTC",
      voting_method: "single_choice_per_position",
      configuration_version: 1,
      configuration_hash: "a".repeat(64),
      created_by: "admin",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      positions: [],
    });

    // Mock voter auth config
    vi.spyOn(apiClient, "getVoterAuthConfig").mockResolvedValue({
      id: "cfg-1",
      election_id: "elec-123",
      identifier_type: "institutional_id",
      identifier_label: "Student ID",
      otp_length: 6,
      otp_expiry_seconds: 300,
      otp_max_attempts: 5,
      otp_regeneration_cooldown_seconds: 30,
      session_idle_timeout_seconds: 600,
      session_max_duration_seconds: 3600,
      allow_session_resume: true,
      allow_position_skip: true,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    });

    // Mock requestVoterChallenge -> returns on-screen OTP code
    vi.spyOn(apiClient, "requestVoterChallenge").mockResolvedValue({
      challenge_id: "chal-999",
      otp_code: "582194",
      expires_in_seconds: 300,
      identifier_label: "Student ID",
    });

    // Mock verifyVoterChallenge -> returns session token
    vi.spyOn(apiClient, "verifyVoterChallenge").mockResolvedValue({
      session_token: "sess-valid-token-123",
      status: "active",
      expires_at: "2026-12-01T01:00:00Z",
      allow_position_skip: true,
    });

    // Mock getVoterBallot -> returns 2 positions
    vi.spyOn(apiClient, "getVoterBallot").mockResolvedValue({
      election_id: "elec-123",
      election_title: "2026 Student Union Executive Election",
      allow_position_skip: true,
      positions: [
        {
          id: "pos-1",
          title: "President",
          description: "Leads the executive union",
          min_selections: 1,
          max_selections: 1,
          is_required: true,
          candidates: [
            { id: "cand-1", name: "Alice Walker", display_order: 1 },
            { id: "cand-2", name: "Bob Smith", display_order: 2 },
          ],
        },
        {
          id: "pos-2",
          title: "Treasurer",
          description: "Oversees student funds",
          min_selections: 0,
          max_selections: 1,
          is_required: false,
          candidates: [
            { id: "cand-3", name: "Charlie Davis", display_order: 1 },
          ],
        },
      ],
      draft: null,
    });

    vi.spyOn(apiClient, "saveVoterBallotDraft").mockResolvedValue({ saved: true });

    // Mock submitVoterBallot -> returns confirmation reference
    vi.spyOn(apiClient, "submitVoterBallot").mockResolvedValue({
      confirmation_reference: "PW-ELEC-492817",
      submitted_at: "2026-11-02T12:00:00Z",
      status: "accepted",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/elections/elec-123/vote"]}>
          <Routes>
            <Route path="/elections/:id/vote" element={<VotingBoothPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Landing Screen
    expect(await screen.findByText("2026 Student Union Executive Election")).toBeInTheDocument();
    expect(screen.getByText(/Back to Elections/i)).toBeInTheDocument();
    expect(screen.getByText("Voting Open")).toBeInTheDocument();
    expect(screen.getByText("Before you start")).toBeInTheDocument();
    expect(screen.getByText(/Enter your approved Student ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact election support/i)).toBeInTheDocument();
    expect(screen.getByText(/Read our privacy policy/i)).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: /start voting/i });
    fireEvent.click(startBtn);

    // 2. Identifier Entry Screen (configured as "Student ID")
    expect(await screen.findByText(/Enter your Student ID/i)).toBeInTheDocument();
    const idInput = screen.getByPlaceholderText(/Enter your Student ID/i);
    fireEvent.change(idInput, { target: { value: "STU-9900" } });
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueBtn);

    // 3. On-Screen OTP Screen (displays code directly!)
    expect(await screen.findByText(/5\s*8\s*2\s*1\s*9\s*4/)).toBeInTheDocument();
    expect(screen.getByText(/Your Pollwise verification code/i)).toBeInTheDocument();
    const otpInput = screen.getByPlaceholderText(/Enter 6-digit code/i);
    fireEvent.change(otpInput, { target: { value: "582194" } });
    const verifyBtn = screen.getByRole("button", { name: /verify code/i });
    fireEvent.click(verifyBtn);

    // 4. Ballot Instructions Screen
    expect(await screen.findByText(/Ballot Instructions/i)).toBeInTheDocument();
    const beginBtn = screen.getByRole("button", { name: /begin ballot/i });
    fireEvent.click(beginBtn);

    // 5. Position 1 of 2: President
    expect(await screen.findByText("Position 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByText("Alice Walker")).toBeInTheDocument();
    // Select Alice Walker
    const candAlice = screen.getByText("Alice Walker");
    fireEvent.click(candAlice);
    const nextBtn = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn);

    // 6. Position 2 of 2: Treasurer (Optional)
    expect(await screen.findByText("Position 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Treasurer")).toBeInTheDocument();
    // Click "Skip this Position"
    const skipBtn = screen.getByRole("button", { name: /skip this position/i });
    fireEvent.click(skipBtn);
    const reviewNavBtn = screen.getByRole("button", { name: /review selections/i });
    fireEvent.click(reviewNavBtn);

    // 7. Review Screen
    expect(await screen.findByText(/Review Your Ballot/i)).toBeInTheDocument();
    expect(screen.getByText("Alice Walker")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();

    // 8. Submit Ballot
    const submitBtn = screen.getByRole("button", { name: /submit ballot/i });
    fireEvent.click(submitBtn);

    // Confirmation Modal
    expect(await screen.findByText(/Submit your ballot\?/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /confirm and submit/i });
    fireEvent.click(confirmBtn);

    // 9. Submission Confirmed Screen with Reference
    expect(await screen.findByText("PW-ELEC-492817")).toBeInTheDocument();
    expect(screen.getByText(/Participation Confirmed/i)).toBeInTheDocument();
  });
});
