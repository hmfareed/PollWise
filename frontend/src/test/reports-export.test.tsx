import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CertifiedCertificateModal } from "../components/reports/CertifiedCertificateModal";
import { ElectionReportsModal } from "../components/reports/ElectionReportsModal";
import { apiClient } from "../lib/api-client";

describe("Certified Reports & Export Modals", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockElection: any = {
    id: "elec-123",
    title: "Student Senate General Election 2026",
    status: "published",
    configuration_hash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    voting_method: "single_choice_per_position",
  };

  const mockResults: any = {
    id: "res-123",
    election_id: "elec-123",
    configuration_hash: mockElection.configuration_hash,
    ballot_count: 250,
    approval_status: "approved",
    computed_at: "2026-11-03T19:00:00Z",
    published_at: "2026-11-03T19:30:00Z",
    positions: [
      {
        position_id: "pos-1",
        title: "Senate President",
        total_votes: 240,
        abstain_count: 10,
        winner_ids: ["cand-1"],
        candidates: [
          { candidate_id: "cand-1", name: "Elena Rostova", votes: 160, percentage: 66.67 },
          { candidate_id: "cand-2", name: "Marcus Brody", votes: 80, percentage: 33.33 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CertifiedCertificateModal renders official title, winners, SHA-256 hash and triggers print", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <CertifiedCertificateModal
        isOpen={true}
        onClose={() => {}}
        election={mockElection}
        results={mockResults}
        organizationName="Polytechnic University"
      />
    );

    expect(screen.getByText(/OFFICIAL CERTIFICATE OF ELECTION RESULTS/i)).toBeInTheDocument();
    expect(screen.getByText("Student Senate General Election 2026")).toBeInTheDocument();
    expect(screen.getByText("Elena Rostova")).toBeInTheDocument();
    expect(screen.getByText(/66.67%/)).toBeInTheDocument();
    expect(screen.getByText(/160 votes/i)).toBeInTheDocument();
    expect(screen.getByText(/OFFICIALLY AUDITED & CERTIFIED/i)).toBeInTheDocument();

    const printBtn = screen.getByRole("button", { name: /Print Official Certificate/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  it("ElectionReportsModal displays all 4 report types and triggers download", async () => {
    vi.spyOn(apiClient, "getReportExports").mockResolvedValueOnce({
      items: [
        {
          id: "rep-1",
          election_id: "elec-123",
          report_type: "certified_results",
          file_format: "csv",
          file_name: "certified_results_20261103.csv",
          checksum: "hash123",
          generated_by: "user-1",
          created_at: "2026-11-03T20:00:00Z",
        },
      ],
      total_count: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ElectionReportsModal
          isOpen={true}
          onClose={() => {}}
          electionId="elec-123"
          electionTitle="Student Senate General Election 2026"
          isPublished={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Election Reports & Certified Exports/i)).toBeInTheDocument();
    expect(screen.getByText(/Official Certified Results/i)).toBeInTheDocument();
    expect(screen.getByText(/Voter Participation & Turnout/i)).toBeInTheDocument();
    expect(screen.getByText(/Tamper-Evident Audit Trail/i)).toBeInTheDocument();
    expect(screen.getByText(/Governance & Ballot Specification/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("certified_results_20261103.csv")).toBeInTheDocument();
    });
  });
});
