import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { VoterLandingStep } from "../components/voter/VoterLandingStep";
import { IdentifierEntryStep } from "../components/voter/IdentifierEntryStep";
import { OTPVerificationStep } from "../components/voter/OTPVerificationStep";
import { BallotInstructionsStep } from "../components/voter/BallotInstructionsStep";
import { PositionVoteStep } from "../components/voter/PositionVoteStep";
import { BallotReviewStep } from "../components/voter/BallotReviewStep";
import { SubmissionConfirmedStep } from "../components/voter/SubmissionConfirmedStep";
import type { VoterBallotStructure, BallotPosition } from "../types/voter-participation";

type FlowPhase =
  | "landing"
  | "identifier"
  | "otp"
  | "instructions"
  | "voting"
  | "review"
  | "confirmed";

interface VotingBoothPageProps {
  terminalToken?: string;
  isKiosk?: boolean;
  onKioskReset?: () => void;
}

export const VotingBoothPage: React.FC<VotingBoothPageProps> = ({
  terminalToken,
  isKiosk = false,
  onKioskReset,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Phase State
  const [phase, setPhase] = useState<FlowPhase>("landing");

  // Authentication State
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Errors & Loading
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ballot State
  const [ballot, setBallot] = useState<VoterBallotStructure | null>(null);
  const [currentPositionIdx, setCurrentPositionIdx] = useState(0);
  // Selections: { [positionId]: { candidateId?: string | null; skipped: boolean } }
  const [selections, setSelections] = useState<
    Record<string, { candidateId?: string | null; skipped: boolean }>
  >({});
  const [confirmationReference, setConfirmationReference] = useState<string | null>(null);

  // 1. Fetch Election Details
  const { data: election, isLoading: isElectionLoading } = useQuery({
    queryKey: ["election", id],
    queryFn: () => apiClient.getElection(id!),
    enabled: !!id,
  });

  // 2. Fetch Voter Auth Configuration
  const { data: authConfig } = useQuery({
    queryKey: ["voter-auth-config", id],
    queryFn: () => apiClient.getVoterAuthConfig(id!),
    enabled: !!id,
  });

  // Handle Challenge Request (Identifier Submission)
  const handleRequestChallenge = async (inputIdentifier: string) => {
    if (!id) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await apiClient.requestVoterChallenge(id, inputIdentifier, terminalToken);
      setIdentifier(inputIdentifier);
      setChallengeId(resp.challenge_id);
      setOtpCode(resp.otp_code);
      setOtpExpiresIn(resp.expires_in_seconds);
      setPhase("otp");
    } catch (err: any) {
      setAuthError(err?.message || "Could not verify your eligibility for this election.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Challenge Verification (Entered OTP)
  const handleVerifyChallenge = async (enteredOtp: string) => {
    if (!id || !challengeId) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await apiClient.verifyVoterChallenge(id, challengeId, enteredOtp, terminalToken);
      setSessionToken(resp.session_token);

      // Fetch ballot with authenticated session token
      const ballotData = await apiClient.getVoterBallot(id, resp.session_token);
      setBallot(ballotData);

      // Hydrate draft if present
      if (ballotData.draft?.selections) {
        const initialSelections: Record<string, { candidateId?: string | null; skipped: boolean }> = {};
        for (const s of ballotData.draft.selections) {
          initialSelections[s.position_id] = {
            candidateId: s.candidate_id,
            skipped: s.skipped,
          };
        }
        setSelections(initialSelections);
      }

      setPhase("instructions");
    } catch (err: any) {
      setAuthError(err?.message || "Invalid or expired verification code.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Regenerate OTP
  const handleRegenerateOtp = async () => {
    if (!identifier) return;
    await handleRequestChallenge(identifier);
  };

  // Save Draft Helper
  const syncDraft = async (
    updatedSelections: Record<string, { candidateId?: string | null; skipped: boolean }>
  ) => {
    if (!id || !sessionToken) return;
    const items = Object.entries(updatedSelections).map(([posId, val]) => ({
      position_id: posId,
      candidate_id: val.candidateId || null,
      skipped: val.skipped,
    }));
    try {
      await apiClient.saveVoterBallotDraft(id, sessionToken, { selections: items });
    } catch {
      // Draft save failure is non-blocking
    }
  };

  // Candidate Selection
  const handleSelectCandidate = (candidateId: string) => {
    if (!ballot) return;
    const currentPos = ballot.positions[currentPositionIdx];
    const updated = {
      ...selections,
      [currentPos.id]: { candidateId, skipped: false },
    };
    setSelections(updated);
    syncDraft(updated);
  };

  // Skip Position
  const handleSkipPosition = () => {
    if (!ballot) return;
    const currentPos = ballot.positions[currentPositionIdx];
    const isCurrentlySkipped = !!selections[currentPos.id]?.skipped;
    const updated = {
      ...selections,
      [currentPos.id]: {
        candidateId: null,
        skipped: !isCurrentlySkipped,
      },
    };
    setSelections(updated);
    syncDraft(updated);
  };

  // Navigation
  const handleNextPosition = () => {
    if (!ballot) return;
    if (currentPositionIdx < ballot.positions.length - 1) {
      setCurrentPositionIdx((prev) => prev + 1);
    } else {
      setPhase("review");
    }
  };

  const handlePreviousPosition = () => {
    if (currentPositionIdx > 0) {
      setCurrentPositionIdx((prev) => prev - 1);
    }
  };

  const handleEditPosition = (index: number) => {
    setCurrentPositionIdx(index);
    setPhase("voting");
  };

  // Final Atomic Submission
  const handleSubmitBallot = async () => {
    if (!id || !sessionToken || !ballot) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const idempotencyKey = `sub-${sessionToken.slice(0, 16)}-${Date.now()}`;
      const payloadItems = ballot.positions.map((pos) => {
        const sel = selections[pos.id];
        return {
          position_id: pos.id,
          candidate_id: sel?.candidateId || null,
          skipped: sel ? sel.skipped : false,
        };
      });

      const receipt = await apiClient.submitVoterBallot(
        id,
        sessionToken,
        payloadItems,
        idempotencyKey
      );
      setConfirmationReference(receipt.confirmation_reference);
      setPhase("confirmed");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit ballot. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Finish / Reset Terminal
  const handleFinish = () => {
    if (isKiosk && onKioskReset) {
      onKioskReset();
      return;
    }
    // Mobile or personal device: redirect to public election page or home
    navigate(`/elections/${id}`);
  };

  if (isElectionLoading || !election) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading election details...
        </div>
      </div>
    );
  }

  const isOpen = election.status === "open";
  const label = authConfig?.identifier_label || "Institutional Identifier";
  const idType = authConfig?.identifier_type || "institutional_email";

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6">
      {phase === "landing" && (
        <VoterLandingStep
          electionTitle={election.title}
          electionDescription={election.description}
          opensAt={election.opens_at}
          closesAt={election.closes_at}
          isOpen={isOpen}
          onStart={() => setPhase("identifier")}
        />
      )}

      {phase === "identifier" && (
        <IdentifierEntryStep
          identifierLabel={label}
          identifierType={idType}
          isLoading={isAuthLoading}
          error={authError}
          onSubmit={handleRequestChallenge}
          onBack={() => setPhase("landing")}
        />
      )}

      {phase === "otp" && otpCode && (
        <OTPVerificationStep
          otpCode={otpCode}
          expiresInSeconds={otpExpiresIn}
          isLoading={isAuthLoading}
          error={authError}
          onVerify={handleVerifyChallenge}
          onRegenerate={handleRegenerateOtp}
          onChangeIdentifier={() => {
            setAuthError(null);
            setPhase("identifier");
          }}
        />
      )}

      {phase === "instructions" && ballot && (
        <BallotInstructionsStep
          electionTitle={ballot.election_title}
          totalPositions={ballot.positions.length}
          allowSkip={ballot.allow_position_skip}
          onBegin={() => setPhase("voting")}
        />
      )}

      {phase === "voting" && ballot && ballot.positions[currentPositionIdx] && (
        <PositionVoteStep
          position={ballot.positions[currentPositionIdx]}
          currentIndex={currentPositionIdx}
          totalPositions={ballot.positions.length}
          selectedCandidateId={selections[ballot.positions[currentPositionIdx].id]?.candidateId}
          isSkipped={!!selections[ballot.positions[currentPositionIdx].id]?.skipped}
          onSelectCandidate={handleSelectCandidate}
          onSkipPosition={handleSkipPosition}
          onPrevious={handlePreviousPosition}
          onNext={handleNextPosition}
        />
      )}

      {phase === "review" && ballot && (
        <BallotReviewStep
          electionTitle={ballot.election_title}
          positions={ballot.positions}
          selections={selections}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onEditPosition={handleEditPosition}
          onSubmit={handleSubmitBallot}
          onBackToBallot={() => setPhase("voting")}
        />
      )}

      {phase === "confirmed" && confirmationReference && (
        <SubmissionConfirmedStep
          confirmationReference={confirmationReference}
          isKiosk={isKiosk}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
};
