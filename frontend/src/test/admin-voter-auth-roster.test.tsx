import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { VoterAuthConfigCard } from "../components/admin/VoterAuthConfigCard";
import { VoterCSVImportModal } from "../components/admin/VoterCSVImportModal";
import { VoterRosterTable } from "../components/admin/VoterRosterTable";
import { apiClient } from "../lib/api-client";
import type { VoterAuthConfig, VoterRecord, VoterCSVPreviewReport } from "../types/voter-participation";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockAuthConfig: VoterAuthConfig = {
  id: "cfg-1",
  election_id: "elec-123",
  identifier_type: "institutional_email",
  identifier_label: "Institutional Email",
  identifier_normalization_rules: { trim_whitespace: true, case_insensitive: true },
  otp_length: 6,
  otp_expiry_seconds: 300,
  otp_max_attempts: 3,
  otp_regeneration_cooldown_seconds: 30,
  session_idle_timeout_seconds: 600,
  session_max_duration_seconds: 1800,
  allow_session_resume: true,
  allow_position_skip: true,
  configuration_locked_at: null,
  created_at: "2026-11-02T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
};

const mockVoters: VoterRecord[] = [
  {
    id: "rec-1",
    election_id: "elec-123",
    identifier_type: "institutional_id",
    normalized_identifier: "STU-1001",
    voter_reference_id: "VR-001",
    eligibility_status: "eligible",
    voter_group: "Computer Science",
    source: "csv_import",
    created_at: "2026-11-02T10:00:00Z",
  },
  {
    id: "rec-2",
    election_id: "elec-123",
    identifier_type: "institutional_id",
    normalized_identifier: "STU-1002",
    voter_reference_id: "VR-002",
    eligibility_status: "ineligible",
    voter_group: "Mathematics",
    source: "manual",
    created_at: "2026-11-02T10:05:00Z",
  },
];

describe("VoterAuthConfigCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders configuration and updates identifier type and label", async () => {
    vi.spyOn(apiClient, "getVoterAuthConfig").mockResolvedValue(mockAuthConfig);
    const updateSpy = vi.spyOn(apiClient, "updateVoterAuthConfig").mockResolvedValue({
      ...mockAuthConfig,
      identifier_type: "institutional_id",
      identifier_label: "Student ID",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VoterAuthConfigCard electionId="elec-123" />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Voter Authentication Method/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Institutional Email")).toBeInTheDocument();

    // Toggle identifier type to Institutional ID
    const idRadio = screen.getByLabelText(/Institutional ID/i);
    fireEvent.click(idRadio);

    // Change label to "Student ID"
    const labelInput = screen.getByLabelText(/Voter Interface Field Label/i);
    fireEvent.change(labelInput, { target: { value: "Student ID" } });

    // Save changes
    const saveBtn = screen.getByRole("button", { name: /save configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("elec-123", expect.objectContaining({
        identifier_type: "institutional_id",
        identifier_label: "Student ID",
      }));
    });
  });

  it("locks the configuration when lock button is confirmed", async () => {
    vi.spyOn(apiClient, "getVoterAuthConfig").mockResolvedValue(mockAuthConfig);
    const lockSpy = vi.spyOn(apiClient, "lockVoterAuthConfig").mockResolvedValue({
      ...mockAuthConfig,
      configuration_locked_at: "2026-11-02T11:00:00Z",
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VoterAuthConfigCard electionId="elec-123" />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Voter Authentication Method/i)).toBeInTheDocument();
    const lockBtn = screen.getByRole("button", { name: /lock configuration/i });
    fireEvent.click(lockBtn);

    // Confirm dialog
    const confirmBtn = screen.getByRole("button", { name: /confirm lock/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(lockSpy).toHaveBeenCalledWith("elec-123");
    });
  });
});

describe("VoterCSVImportModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles CSV file upload, preview summary, and commit", async () => {
    const previewData: VoterCSVPreviewReport = {
      valid_count: 50,
      duplicate_count: 2,
      invalid_count: 1,
      sample_records: [
        { identifier: "stu-101", voter_group: "Engineering", eligibility_status: "eligible" },
      ],
      errors: ["Row 4: Invalid email format"],
    };

    const previewSpy = vi.spyOn(apiClient, "previewVoterRollCSV").mockResolvedValue(previewData);
    const importSpy = vi.spyOn(apiClient, "importVoterRollCSV").mockResolvedValue({ imported_count: 50 });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <VoterCSVImportModal
        isOpen={true}
        electionId="elec-123"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText(/Import Voter Roll CSV/i)).toBeInTheDocument();

    const file = new File(["identifier,group\nstu-101,Engineering"], "voters.csv", { type: "text/csv" });
    const input = screen.getByTestId("voter-csv-file-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith("elec-123", file);
    });

    // Check preview summary is rendered
    expect(await screen.findByText(/50 Valid Records/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Duplicates/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 4: Invalid email format/i)).toBeInTheDocument();

    // Commit import
    const commitBtn = screen.getByRole("button", { name: /confirm and import/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith("elec-123", file);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe("VoterRosterTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists voters, searches, adds single voter, and deletes voter", async () => {
    vi.spyOn(apiClient, "listVoterRoll").mockResolvedValue(mockVoters);
    const addSpy = vi.spyOn(apiClient, "addSingleVoter").mockResolvedValue({
      id: "rec-3",
      election_id: "elec-123",
      identifier_type: "institutional_id",
      normalized_identifier: "STU-9999",
      eligibility_status: "eligible",
      source: "manual",
      created_at: "2026-11-02T12:00:00Z",
    });
    const deleteSpy = vi.spyOn(apiClient, "deleteVoter").mockResolvedValue({ deleted: true });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VoterRosterTable electionId="elec-123" identifierLabel="Student ID" />
      </QueryClientProvider>
    );

    // 1. Renders records
    expect(await screen.findByText("STU-1001")).toBeInTheDocument();
    expect(screen.getByText("STU-1002")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();

    // 2. Add Single Voter Dialog
    const addBtn = screen.getByRole("button", { name: /add voter/i });
    fireEvent.click(addBtn);

    const inputId = screen.getByPlaceholderText(/Enter Student ID/i);
    fireEvent.change(inputId, { target: { value: "STU-9999" } });

    const submitAddBtn = screen.getByRole("button", { name: /save voter/i });
    fireEvent.click(submitAddBtn);

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith("elec-123", expect.objectContaining({
        identifier: "STU-9999",
      }));
    });

    // 3. Delete a voter
    const deleteBtns = screen.getAllByRole("button", { name: /delete voter/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("elec-123", "rec-1");
    });
  });
});
