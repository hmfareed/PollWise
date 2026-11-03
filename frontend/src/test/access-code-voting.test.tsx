import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessCodeManager } from "../components/admin/AccessCodeManager";
import { VotingBoothPage } from "../pages/VotingBoothPage";
import { apiClient } from "../lib/api-client";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("Physical Access Code & Student ID Voting Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AccessCodeManager displays metrics, generates codes, and opens printable slips modal", async () => {
    const queryClient = createTestQueryClient();

    // Mock getAccessCodes
    vi.spyOn(apiClient, "getAccessCodes").mockResolvedValue({
      items: [
        {
          id: "code-1",
          election_id: "elec-123",
          code: "PW-7K9M-2X4L",
          status: "unused",
          created_at: "2026-11-03T10:00:00Z",
        },
        {
          id: "code-2",
          election_id: "elec-123",
          code: "PW-3H8J-9B1P",
          status: "used",
          used_by_student_id: "STU-8888",
          used_at: "2026-11-03T11:00:00Z",
          created_at: "2026-11-03T10:00:00Z",
        },
      ],
      total_count: 2,
      unused_count: 1,
      used_count: 1,
    });

    // Mock generateAccessCodes
    vi.spyOn(apiClient, "generateAccessCodes").mockResolvedValue({
      items: [
        {
          id: "code-3",
          election_id: "elec-123",
          code: "PW-A1B2-C3D4",
          status: "unused",
          created_at: "2026-11-03T12:00:00Z",
        },
      ],
      total_count: 3,
      unused_count: 2,
      used_count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AccessCodeManager electionId="elec-123" electionTitle="Student Council Election" />
      </QueryClientProvider>
    );

    // Verify metric cards and table items after query resolves
    expect(await screen.findByText("Total Generated")).toBeInTheDocument();
    expect(await screen.findByText("PW-7K9M-2X4L")).toBeInTheDocument();
    expect(screen.getByText("Available (Unused Slips)")).toBeInTheDocument();
    expect(screen.getByText("STU-8888")).toBeInTheDocument();

    // Open Printable Slips Modal
    const printBtn = screen.getByRole("button", { name: /print slips/i });
    fireEvent.click(printBtn);

    expect(await screen.findByText("Printable Voter Slips")).toBeInTheDocument();
    expect(screen.getByText("Print Slips Now")).toBeInTheDocument();
    expect(screen.getAllByText("PollWise Official Voter Slip").length).toBeGreaterThan(0);
  });

  it("VotingBoothPage walks voter through Access Code verification, Student ID entry, and ballot submission", async () => {
    const queryClient = createTestQueryClient();

    // Mock election details
    vi.spyOn(apiClient, "getElection").mockResolvedValue({
      id: "elec-123",
      organization_id: "org-1",
      title: "Faculty Representative Election",
      description: "Cast your vote for Faculty Representative",
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

    // Mock getAccessCodes so VotingBoothPage knows physical slips are active
    vi.spyOn(apiClient, "getAccessCodes").mockResolvedValue({
      items: [
        {
          id: "code-1",
          election_id: "elec-123",
          code: "PW-7K9M-2X4L",
          status: "unused",
          created_at: "2026-11-03T10:00:00Z",
        },
      ],
      total_count: 1,
      unused_count: 1,
      used_count: 0,
    });

    // Mock verifyAccessCode
    vi.spyOn(apiClient, "verifyAccessCode").mockResolvedValue({
      valid: true,
      code: "PW-7K9M-2X4L",
      election_id: "elec-123",
      election_title: "Faculty Representative Election",
    });

    // Mock claimAccessCode
    vi.spyOn(apiClient, "claimAccessCode").mockResolvedValue({
      session_token: "mock-sess-token-456",
      status: "active",
      expires_at: "2026-12-01T01:00:00Z",
      allow_position_skip: true,
    });

    // Mock getVoterBallot
    vi.spyOn(apiClient, "getVoterBallot").mockResolvedValue({
      election_id: "elec-123",
      election_title: "Faculty Representative Election",
      allow_position_skip: true,
      positions: [
        {
          id: "pos-1",
          title: "Representative",
          description: "Choose 1 representative",
          min_selections: 1,
          max_selections: 1,
          is_required: true,
          candidates: [
            { id: "cand-1", name: "Candidate Alpha", display_order: 1 },
            { id: "cand-2", name: "Candidate Beta", display_order: 2 },
          ],
        },
      ],
    });

    // Mock submitVoterBallot
    vi.spyOn(apiClient, "submitVoterBallot").mockResolvedValue({
      confirmation_reference: "PW-CONF-998877",
      submitted_at: "2026-11-03T12:00:00Z",
      status: "accepted",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/elections/elec-123/vote"]}>
          <Routes>
            <Route path="/elections/:id/vote" element={<VotingBoothPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Landing: click "Start Voting"
    const startBtn = await screen.findByRole("button", { name: /start voting/i });
    fireEvent.click(startBtn);

    // 2. Step 1: Access Code Entry
    expect(await screen.findByText("Enter Voting Access Code")).toBeInTheDocument();
    const codeInput = screen.getByPlaceholderText("PW-XXXX-XXXX");
    fireEvent.change(codeInput, { target: { value: "pw-7k9m-2x4l" } });

    const verifyBtn = screen.getByRole("button", { name: /verify code/i });
    fireEvent.click(verifyBtn);

    // 3. Step 2: Student ID Entry
    expect(await screen.findByText("Enter Your Student ID")).toBeInTheDocument();
    expect(screen.getByText("PW-7K9M-2X4L")).toBeInTheDocument();

    const stuInput = screen.getByPlaceholderText("e.g. STU-12345");
    fireEvent.change(stuInput, { target: { value: "STU-9999" } });

    const proceedBtn = screen.getByRole("button", { name: /proceed to ballot/i });
    fireEvent.click(proceedBtn);

    // 4. Step 3: Instructions & Voting
    expect(await screen.findByText("Ballot Instructions")).toBeInTheDocument();
    const beginBtn = screen.getByRole("button", { name: /begin ballot/i });
    fireEvent.click(beginBtn);

    // 5. Select Candidate Alpha
    expect(await screen.findByText("Candidate Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Candidate Alpha"));

    const nextOrReviewBtn = screen.getByRole("button", { name: /review selections|next position/i });
    fireEvent.click(nextOrReviewBtn);

    // 6. Review & Submit
    expect(await screen.findByText("Review Your Ballot")).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: /submit ballot/i });
    fireEvent.click(submitBtn);

    // Confirm submission modal
    const confirmBtn = await screen.findByRole("button", { name: /confirm and submit/i });
    fireEvent.click(confirmBtn);

    // 7. Confirmed Screen
    expect(await screen.findByText("Ballot Successfully Cast")).toBeInTheDocument();
    expect(screen.getByText("PW-CONF-998877")).toBeInTheDocument();

    // 8. Next Voter in Line -> resets immediately to code entry
    const nextVoterBtn = screen.getByRole("button", { name: /next voter/i });
    fireEvent.click(nextVoterBtn);

    expect(await screen.findByText("Enter Voting Access Code")).toBeInTheDocument();
  });
});
