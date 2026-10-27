"""
Pollwise Voter Eligibility & Credential Issuance Service (Identity DB)
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppException, ErrorCode
from app.core.security import (
    ensure_utc,
    hash_token,
    sign_credential,
)
from app.models.election import Election
from app.models.identity import ElectionEligibility, User, VotingCredential


class EligibilityService:
    @staticmethod
    async def list_eligibility(
        session: AsyncSession, election_id: uuid.UUID
    ) -> list[tuple[ElectionEligibility, str | None, str | None]]:
        """List all eligibility records for an election with user details."""
        stmt = (
            select(
                ElectionEligibility,
                User.email_normalized,
                User.display_name,
            )
            .join(User, ElectionEligibility.user_id == User.id)
            .where(ElectionEligibility.election_id == election_id)
        )
        result = await session.execute(stmt)
        return list(result.all())

    @staticmethod
    async def add_eligible_voter(
        session: AsyncSession,
        election_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
        email: str | None = None,
    ) -> ElectionEligibility:
        """Add a single user to an election eligibility roll."""
        if not user_id and not email:
            raise AppException(
                ErrorCode.VALIDATION_ERROR,
                "Either user_id or email must be provided",
                status_code=422,
            )

        if email:
            normalized_email = email.strip().lower()
            stmt = select(User).where(User.email_normalized == normalized_email)
            user = (await session.execute(stmt)).scalar_one_or_none()
            if not user:
                raise AppException(
                    ErrorCode.NOT_FOUND,
                    f"User with email '{normalized_email}' not found in institution",
                    status_code=404,
                )
            target_user_id = user.id
        else:
            target_user_id = user_id

        # Check for duplicate eligibility
        existing_stmt = select(ElectionEligibility).where(
            ElectionEligibility.election_id == election_id,
            ElectionEligibility.user_id == target_user_id,
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            return existing

        record = ElectionEligibility(
            election_id=election_id,
            user_id=target_user_id,
            eligibility_status="eligible",
            entitlement_status="unused",
        )
        session.add(record)
        await session.flush()
        return record

    @staticmethod
    async def bulk_import_eligibility(
        session: AsyncSession,
        election_id: uuid.UUID,
        emails: list[str],
    ) -> dict:
        """Bulk import eligible voters by list of institutional email addresses."""
        added = 0
        already_eligible = 0
        not_found = []

        for email_raw in emails:
            norm_email = email_raw.strip().lower()
            stmt = select(User).where(User.email_normalized == norm_email)
            user = (await session.execute(stmt)).scalar_one_or_none()
            if not user:
                not_found.append(norm_email)
                continue

            existing_stmt = select(ElectionEligibility).where(
                ElectionEligibility.election_id == election_id,
                ElectionEligibility.user_id == user.id,
            )
            existing = (await session.execute(existing_stmt)).scalar_one_or_none()
            if existing:
                already_eligible += 1
                continue

            record = ElectionEligibility(
                election_id=election_id,
                user_id=user.id,
                eligibility_status="eligible",
                entitlement_status="unused",
            )
            session.add(record)
            added += 1

        await session.flush()
        return {
            "total_processed": len(emails),
            "added": added,
            "already_eligible": already_eligible,
            "not_found": not_found,
        }

    @staticmethod
    async def revoke_eligibility(
        session: AsyncSession,
        election_id: uuid.UUID,
        record_id: uuid.UUID,
    ) -> None:
        """Revoke a voter's eligibility prior to voting."""
        stmt = select(ElectionEligibility).where(
            ElectionEligibility.id == record_id,
            ElectionEligibility.election_id == election_id,
        )
        record = (await session.execute(stmt)).scalar_one_or_none()
        if not record:
            raise AppException(ErrorCode.NOT_FOUND, "Eligibility record not found", status_code=404)

        if record.entitlement_status == "redeemed":
            raise AppException(
                ErrorCode.BALLOT_ALREADY_ACCEPTED,
                "Cannot revoke eligibility: voter has already redeemed their ballot",
                status_code=409,
            )

        record.eligibility_status = "revoked"
        record.entitlement_status = "revoked"
        await session.flush()

    @staticmethod
    async def get_user_participation(
        session: AsyncSession,
        election_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> dict:
        """Check user's participation status without exposing any ballot choices."""
        stmt = select(ElectionEligibility).where(
            ElectionEligibility.election_id == election_id,
            ElectionEligibility.user_id == user_id,
        )
        record = (await session.execute(stmt)).scalar_one_or_none()
        if not record:
            return {
                "election_id": election_id,
                "is_eligible": False,
                "eligibility_status": None,
                "entitlement_status": None,
                "has_voted": False,
            }

        return {
            "election_id": election_id,
            "is_eligible": record.eligibility_status == "eligible",
            "eligibility_status": record.eligibility_status,
            "entitlement_status": record.entitlement_status,
            "has_voted": record.entitlement_status in ("issued", "redeemed"),
        }

    @staticmethod
    async def issue_voting_credential(
        identity_session: AsyncSession,
        election_session: AsyncSession,
        election_id: uuid.UUID,
        user: User,
    ) -> dict:
        """
        Authorize and issue a single-use bearer voting credential.
        
        Strict Invariants (Doc 06 & 20):
        1. User must have email verified.
        2. Election must be in status 'open'.
        3. User must be registered as 'eligible'.
        4. Entitlement must be 'unused'.
        5. Generated credential is high entropy (>=128 bit) and signed.
        6. Credential hash is stored in identity_db; plaintext returned once.
        7. Entitlement transitions atomically to 'issued'.
        """
        # 1. Verification of identity requirements
        if not user.email_verified_at:
            raise AppException(
                ErrorCode.EMAIL_NOT_VERIFIED,
                "Email verification is strictly required prior to obtaining a voting credential",
                status_code=403,
            )

        # 2. Verification of election state in election_db
        elec_stmt = select(Election).where(Election.id == election_id)
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != "open":
            raise AppException(
                ErrorCode.ELECTION_NOT_OPEN,
                f"Voting credential cannot be issued: election status is '{election.status}' (must be 'open')",
                status_code=409,
            )

        now = ensure_utc(datetime.now(UTC))
        if election.closes_at and ensure_utc(election.closes_at) <= now:
            raise AppException(
                ErrorCode.ELECTION_CLOSED,
                "Voting credential cannot be issued: election voting window has closed",
                status_code=409,
            )

        # 3. Verification of eligibility in identity_db
        elig_stmt = select(ElectionEligibility).where(
            ElectionEligibility.election_id == election_id,
            ElectionEligibility.user_id == user.id,
        )
        eligibility = (await identity_session.execute(elig_stmt)).scalar_one_or_none()
        if not eligibility or eligibility.eligibility_status != "eligible":
            raise AppException(
                ErrorCode.NOT_ELIGIBLE,
                "You are not on the verified voter roll for this election",
                status_code=403,
            )

        if eligibility.entitlement_status != "unused":
            raise AppException(
                ErrorCode.CREDENTIAL_ALREADY_ISSUED,
                "Voting credential has already been issued for this entitlement",
                status_code=409,
            )

        # 4. Generate high-entropy CSPRNG nonce and signed bearer token
        raw_nonce = uuid.uuid4().hex + uuid.uuid4().hex  # 256 bits of entropy
        credential_token = sign_credential(
            settings.CREDENTIAL_SIGNING_SECRET,
            str(election_id),
            raw_nonce,
        )

        # 5. Persist issuance in identity_db (salt/hash for one-time issuance tracking)
        cred_record = VotingCredential(
            election_id=election_id,
            eligibility_id=eligibility.id,
            credential_hash=hash_token(credential_token),
            status="issued",
            issued_at=now,
            expires_at=election.closes_at,
        )
        identity_session.add(cred_record)

        # Atomically advance entitlement status to 'issued'
        eligibility.entitlement_status = "issued"
        await identity_session.flush()

        return {
            "election_id": election_id,
            "credential": credential_token,
            "expires_at": election.closes_at,
        }

    @staticmethod
    async def confirm_redemption(
        session: AsyncSession,
        election_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Mark user entitlement as redeemed upon receipt confirmation."""
        stmt = select(ElectionEligibility).where(
            ElectionEligibility.election_id == election_id,
            ElectionEligibility.user_id == user_id,
        )
        record = (await session.execute(stmt)).scalar_one_or_none()
        if record and record.entitlement_status == "issued":
            record.entitlement_status = "redeemed"
            await session.flush()
