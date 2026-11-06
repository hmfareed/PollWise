import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmergencyControlModal } from "../components/elections/EmergencyControlModal";
import { EmergencyStatusBanner } from "../components/elections/EmergencyStatusBanner";
import { VoterLandingStep } from "../components/voter/VoterLandingStep";
import type { Election } from "../types/election";

describe("Emergency Controls UI Components", () => {
  describe("EmergencyControlModal", () => {
    it("renders pause modal with election title, warning note, and disabled submit button when reason is short", () => {
      render(
        <EmergencyControlModal
          isOpen={true}
          actionType="pause"
          electionTitle="Faculty Senate Election 2026"
          isSubmitting={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(screen.getByText("Pause Election")).toBeInTheDocument();
      expect(screen.getByText(/Faculty Senate Election 2026/)).toBeInTheDocument();
      expect(screen.getByText(/Voting will be halted immediately/i)).toBeInTheDocument();

      const submitBtn = screen.getByRole("button", { name: /Confirm Pause/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/reason/i);
      fireEvent.change(textarea, { target: { value: "Netw" } });
      expect(submitBtn).toBeDisabled();

      fireEvent.change(textarea, { target: { value: "Network failure at terminal" } });
      expect(submitBtn).not.toBeDisabled();
    });

    it("calls onConfirm with reason when submitted", () => {
      const onConfirm = vi.fn();
      render(
        <EmergencyControlModal
          isOpen={true}
          actionType="pause"
          electionTitle="Faculty Senate Election 2026"
          isSubmitting={false}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      const textarea = screen.getByPlaceholderText(/reason/i);
      fireEvent.change(textarea, { target: { value: "Emergency security audit initiated" } });

      const submitBtn = screen.getByRole("button", { name: /Confirm Pause/i });
      fireEvent.click(submitBtn);

      expect(onConfirm).toHaveBeenCalledWith("Emergency security audit initiated");
    });
  });

  describe("EmergencyStatusBanner", () => {
    it("renders paused status, reason, timestamp, and action buttons", () => {
      const election: Election = {
        id: "elec-123",
        organization_id: "org-1",
        title: "Student Union Election",
        status: "paused",
        opens_at: "2026-11-06T10:00:00Z",
        closes_at: "2026-11-06T20:00:00Z",
        timezone: "UTC",
        voting_method: "single_choice",
        configuration_version: 1,
        paused_at: "2026-11-06T14:30:00Z",
        pause_reason: "Power outage at Central Library polling station",
        created_by: "user-1",
        created_at: "2026-11-06T08:00:00Z",
        updated_at: "2026-11-06T14:30:00Z",
      };

      const onResume = vi.fn();
      const onClose = vi.fn();

      render(
        <EmergencyStatusBanner
          election={election}
          onResume={onResume}
          onClose={onClose}
        />
      );

      expect(screen.getByText("Election is Temporarily Paused")).toBeInTheDocument();
      expect(screen.getByText(/Power outage at Central Library polling station/)).toBeInTheDocument();

      const resumeBtn = screen.getByRole("button", { name: /Resume Election/i });
      fireEvent.click(resumeBtn);
      expect(onResume).toHaveBeenCalled();

      const closeBtn = screen.getByRole("button", { name: /Close Election/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("VoterLandingStep Paused State", () => {
    it("renders paused status warning and disables Start Voting button", () => {
      render(
        <VoterLandingStep
          electionTitle="Student Union Election"
          electionDescription="Annual elections"
          isOpen={false}
          electionStatus="paused"
          onStart={vi.fn()}
        />
      );

      expect(screen.getByText("Voting Temporarily Paused")).toBeInTheDocument();
      expect(screen.getByText(/temporarily paused by election administrators/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Start Voting/i })).toBeDisabled();
    });
  });
});
