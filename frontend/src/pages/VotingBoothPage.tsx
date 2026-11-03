import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Vote, ShieldCheck } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { VoterLandingStep } from "../components/voter/VoterLandingStep";
import { IdentifierEntryStep } from "../components/voter/IdentifierEntryStep";
import { OTPVerificationStep } from "../components/voter/OTPVerificationStep";
import { AccessCodeEntryStep } from "../components/voter/AccessCodeEntryStep";
import { StudentIDEntryStep } from "../components/voter/StudentIDEntryStep";
import { BallotInstructionsStep } from "../components/voter/BallotInstructionsStep";
import { PositionVoteStep } from "../components/voter/PositionVoteStep";
import { BallotReviewStep } from "../components/voter/BallotReviewStep";
import { SubmissionConfirmedStep } from "../components/voter/SubmissionConfirmedStep";
import type { VoterBallotStructure, BallotPosition } from "../types/voter-participation";

type FlowPhase =
  | "landing"
  | "access_code"
  | "student_id"
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
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<string>("");
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

  // 3. Fetch Access Codes Summary to detect if physical slips are active
  const { data: accessCodesData } = useQuery({
    queryKey: ["access-codes", id],
    queryFn: () => apiClient.getAccessCodes(id!),
    enabled: !!id,
    retry: false,
  });

  const hasAccessCodes = (accessCodesData?.total_count || 0) > 0;

  // Handle Access Code Verification (Physical Voter Slip)
  const handleVerifyAccessCode = async (inputCode: string) => {
    if (!id) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await apiClient.verifyAccessCode(id, inputCode);
      setVerifiedAccessCode(resp.code);
      setPhase("student_id");
    } catch (err: any) {
      setAuthError(err?.message || "Invalid access code. Please check your physical voter slip.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Access Code Claim with Student ID
  const handleClaimAccessCode = async (inputStudentId: string) => {
    if (!id || !verifiedAccessCode) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await apiClient.claimAccessCode(id, verifiedAccessCode, inputStudentId, terminalToken);
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
      setAuthError(err?.message || "Could not verify Student ID or start session.");
    } finally {
      setIsAuthLoading(false);
    }
  };

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

  // Finish / Reset Voting Booth for the next voter in line
  const handleFinish = () => {
    // Clear all voter session and authentication state
    setSessionToken(null);
    setVerifiedAccessCode("");
    setIdentifier("");
    setChallengeId(null);
    setOtpCode(null);
    setBallot(null);
    setSelections({});
    setConfirmationReference(null);
    setCurrentPositionIdx(0);
    setAuthError(null);
    setSubmitError(null);

    // Kiosk reset if configured
    if (isKiosk && onKioskReset) {
      onKioskReset();
    }

    // Always reset to code entry for the next voter in line
    setPhase("access_code");
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex flex-col justify-between">
      {/* Top Standalone Brand Bar */}
      <header className="border-b border-border/70 bg-card/90 backdrop-blur-sm px-6 py-4 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold text-sm">
              <Vote className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-foreground block leading-none">
                PollWise
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                Official Voting Booth
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline font-medium">Secret Ballot Protected</span>
          </div>
        </div>
      </header>

      {/* Main Ballot Content */}
      <main className="flex-1 py-8 px-4 sm:px-6">
        {phase === "landing" && (
          <VoterLandingStep
            electionTitle={election.title}
            electionDescription={election.description}
            opensAt={election.opens_at}
            closesAt={election.closes_at}
            isOpen={isOpen}
            electionStatus={election.status}
            electionId={id}
            onStart={() => {
              setAuthError(null);
              setPhase(hasAccessCodes ? "access_code" : "identifier");
            }}
          />
        )}

        {phase === "access_code" && (
          <AccessCodeEntryStep
            onVerify={handleVerifyAccessCode}
            isLoading={isAuthLoading}
            error={authError}
            onClearError={() => setAuthError(null)}
            onBack={() => setPhase("landing")}
            onSwitchToIdentifier={() => {
              setAuthError(null);
              setPhase("identifier");
            }}
            identifierLabel={label}
          />
        )}

        {phase === "student_id" && (
          <StudentIDEntryStep
            verifiedCode={verifiedAccessCode}
            onClaim={handleClaimAccessCode}
            isLoading={isAuthLoading}
            error={authError}
            onClearError={() => setAuthError(null)}
            onChangeCode={() => {
              setAuthError(null);
              setPhase("access_code");
            }}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 px-6 text-center text-[11px] text-muted-foreground">
        PollWise Secure Institutional Voting Platform · Your vote is secret and decoupled from your identity
      </footer>
    </div>
  );
};
