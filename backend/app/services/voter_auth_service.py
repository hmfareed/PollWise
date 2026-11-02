import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.election import Election, ElectionStatus
from app.models.voter_auth import (
    ElectionParticipation,
    ElectionVoterAuthConfig,
    ElectionVoterRecord,
    VoterOTPChallenge,
    VotingSession,
    VotingTerminal,
)
from app.services.voter_admin_service import VoterAdminService


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class VoterAuthService:
    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_otp(otp_code: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{otp_code}".encode("utf-8")).hexdigest()

    @staticmethod
    async def request_challenge(
        session: AsyncSession,
        election_id: uuid.UUID,
        raw_identifier: str,
        terminal_token: str | None = None,
    ) -> dict[str, str | int]:
        # 1. Verify election exists and is open
        election = await session.get(Election, election_id)
        if not election or election.status != ElectionStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "This election is not currently open for voting."},
            )

        now = datetime.now(UTC)
        opens_at = ensure_utc(election.opens_at)
        closes_at = ensure_utc(election.closes_at)

        if opens_at and opens_at > now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Election voting window has not started yet."},
            )
        if closes_at and closes_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Election voting window has closed."},
            )

        # 2. Get voter auth config
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        normalized, is_valid = VoterAdminService.normalize_identifier(
            raw_identifier, config.identifier_type
        )
        if not is_valid or not normalized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "VOTER_NOT_ELIGIBLE", "message": "We could not verify your eligibility for this election."},
            )

        # 3. Lookup voter record
        voter_query = select(ElectionVoterRecord).where(
            ElectionVoterRecord.election_id == election_id,
            ElectionVoterRecord.identifier_type == config.identifier_type,
            ElectionVoterRecord.normalized_identifier == normalized,
        )
        voter_res = await session.execute(voter_query)
        voter = voter_res.scalar_one_or_none()

        if not voter or voter.eligibility_status != "eligible":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "VOTER_NOT_ELIGIBLE", "message": "We could not verify your eligibility for this election."},
            )

        # 4. Check if already submitted
        part_query = select(ElectionParticipation).where(
            ElectionParticipation.election_id == election_id,
            ElectionParticipation.voter_record_id == voter.id,
        )
        part_res = await session.execute(part_query)
        if part_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "VOTER_ALREADY_SUBMITTED",
                    "message": "A ballot has already been submitted for this election using this voter record.",
                },
            )

        # 5. Generate secure 6-digit OTP
        otp_number = secrets.randbelow(1_000_000)
        otp_code = f"{otp_number:06d}"
        challenge_token = secrets.token_hex(24)
        challenge_hash = VoterAuthService.hash_token(challenge_token)
        salt = secrets.token_hex(16)
        otp_hash = f"{salt}${VoterAuthService.hash_otp(otp_code, salt)}"

        expires_at = now + timedelta(seconds=config.otp_expiry_seconds)

        challenge = VoterOTPChallenge(
            election_id=election_id,
            voter_record_id=voter.id,
            challenge_hash=challenge_hash,
            otp_hash=otp_hash,
            attempt_count=0,
            expires_at=expires_at,
        )
        session.add(challenge)
        await session.commit()

        return {
            "challenge_id": challenge_token,
            "otp_code": otp_code,
            "expires_in_seconds": config.otp_expiry_seconds,
            "identifier_label": config.identifier_label,
        }

    @staticmethod
    async def verify_challenge(
        session: AsyncSession,
        election_id: uuid.UUID,
        challenge_token: str,
        entered_otp: str,
        terminal_token: str | None = None,
    ) -> dict[str, Any]:
        challenge_hash = VoterAuthService.hash_token(challenge_token)
        chal_query = select(VoterOTPChallenge).where(
            VoterOTPChallenge.election_id == election_id,
            VoterOTPChallenge.challenge_hash == challenge_hash,
        )
        chal_res = await session.execute(chal_query)
        challenge = chal_res.scalar_one_or_none()

        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "CHALLENGE_INVALID", "message": "Verification challenge not found or invalid."},
            )

        now = datetime.now(UTC)
        if challenge.consumed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "CHALLENGE_ALREADY_USED", "message": "This verification code has already been used."},
            )
        if ensure_utc(challenge.expires_at) < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "CHALLENGE_EXPIRED", "message": "This code has expired. Generate a new code."},
            )

        config = await VoterAdminService.get_or_create_auth_config(session, election_id)

        if challenge.attempt_count >= config.otp_max_attempts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "CHALLENGE_ATTEMPTS_EXCEEDED", "message": "Maximum verification attempts exceeded."},
            )

        salt, expected_hash = challenge.otp_hash.split("$", 1)
        computed_hash = VoterAuthService.hash_otp(entered_otp.strip(), salt)

        if not secrets.compare_digest(computed_hash, expected_hash):
            challenge.attempt_count += 1
            await session.commit()
            remaining = config.otp_max_attempts - challenge.attempt_count
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INCORRECT_CODE",
                    "message": f"The code is incorrect. {remaining} attempt(s) remaining.",
                },
            )

        # Mark consumed
        challenge.consumed_at = now

        # Terminal context check
        terminal_id = None
        if terminal_token:
            term_hash = VoterAuthService.hash_token(terminal_token)
            t_res = await session.execute(
                select(VotingTerminal.id).where(VotingTerminal.auth_token_hash == term_hash)
            )
            terminal_id = t_res.scalar_one_or_none()

        # Invalidate existing active sessions for this voter if not resuming
        old_sessions_query = select(VotingSession).where(
            VotingSession.election_id == election_id,
            VotingSession.voter_record_id == challenge.voter_record_id,
            VotingSession.session_status == "active",
        )
        old_sessions_res = await session.execute(old_sessions_query)
        for old_s in old_sessions_res.scalars().all():
            old_s.session_status = "invalidated"

        # Create session
        raw_session_token = secrets.token_hex(32)
        session_token_hash = VoterAuthService.hash_token(raw_session_token)
        sess_expires_at = now + timedelta(seconds=config.session_max_duration_seconds)

        new_session = VotingSession(
            election_id=election_id,
            voter_record_id=challenge.voter_record_id,
            terminal_id=terminal_id,
            session_token_hash=session_token_hash,
            session_status="active",
            expires_at=sess_expires_at,
            last_activity_at=now,
        )
        session.add(new_session)
        await session.commit()

        return {
            "session_token": raw_session_token,
            "status": "active",
            "expires_at": sess_expires_at,
            "allow_position_skip": config.allow_position_skip,
        }

    @staticmethod
    async def get_session_by_token(
        session: AsyncSession, session_token: str
    ) -> VotingSession:
        token_hash = VoterAuthService.hash_token(session_token)
        query = select(VotingSession).where(
            VotingSession.session_token_hash == token_hash,
        )
        res = await session.execute(query)
        voting_sess = res.scalar_one_or_none()
        if not voting_sess:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_SESSION", "message": "Voting session is invalid or not found."},
            )
        now = datetime.now(UTC)
        if ensure_utc(voting_sess.expires_at) < now or voting_sess.session_status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "SESSION_EXPIRED", "message": "Voting session has expired."},
            )
        return voting_sess

    @staticmethod
    async def end_session(
        session: AsyncSession, session_token: str
    ) -> bool:
        voting_sess = await VoterAuthService.get_session_by_token(session, session_token)
        voting_sess.session_status = "cancelled"
        await session.commit()
        return True
