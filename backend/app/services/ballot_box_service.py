"""
Pollwise Isolated Ballot-Box Service (ballot_db)

Strict Architectural Constraints (Docs 06, 09, 20):
1. Runs inside the isolated ballot_db boundary.
2. Accepts NO voter identifiers (no user_id, email, session token).
3. Verifies election status and frozen configuration hash.
4. Validates all ballot choices against position constraints and candidates.
5. In ONE atomic transaction:
   - Records credential redemption using keyed HMAC (prevents replay and cross-db correlation).
   - Inserts anonymous ballot record and normalized choices.
6. Returns cryptographically random, non-identifying receipt reference.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppException, ErrorCode
from app.core.security import (
    compute_ballot_redemption_hash,
    ensure_utc,
    generate_receipt_reference,
    verify_credential_signature,
)
from app.models.ballot import Ballot, BallotChoice, BallotCredentialRedemption
from app.models.election import Candidate, Election, Position
from app.schemas.ballot import BallotSubmitRequest


class BallotBoxService:
    @staticmethod
    async def submit_ballot(
        ballot_session: AsyncSession,
        election_session: AsyncSession,
        request: BallotSubmitRequest,
    ) -> dict[str, str]:
        election_id = request.election_id
        credential = request.credential

        # 1. Cryptographically verify credential bearer token
        is_valid, cred_election_id = verify_credential_signature(
            settings.CREDENTIAL_SIGNING_SECRET, credential
        )
        if not is_valid:
            raise AppException(
                ErrorCode.CREDENTIAL_INVALID,
                "Invalid or tampered voting credential",
                status_code=401,
            )

        if cred_election_id != str(election_id):
            raise AppException(
                ErrorCode.CREDENTIAL_WRONG_ELECTION,
                "Voting credential is not authorized for this election",
                status_code=403,
            )

        # 2. Check election state and frozen configuration in election_db
        elec_stmt = (
            select(Election)
            .where(Election.id == election_id)
        )
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != "open":
            raise AppException(
                ErrorCode.ELECTION_NOT_OPEN,
                f"Cannot accept ballot: election is in status '{election.status}' (must be 'open')",
                status_code=409,
            )

        now = ensure_utc(datetime.now(UTC))
        if election.closes_at and ensure_utc(election.closes_at) <= now:
            raise AppException(
                ErrorCode.ELECTION_CLOSED,
                "Cannot accept ballot: election voting window has closed",
                status_code=409,
            )

        if not election.configuration_hash:
            raise AppException(
                ErrorCode.CONFIG_HASH_MISMATCH,
                "Election configuration hash is missing or corrupted",
                status_code=409,
            )

        # 3. Load positions and candidates to validate ballot choices
        pos_stmt = select(Position).where(Position.election_id == election_id)
        positions = (await election_session.execute(pos_stmt)).scalars().all()
        position_map = {p.id: p for p in positions}

        # Check that selections match ballot positions
        submitted_positions = {s.position_id for s in request.selections}
        for pos_id in submitted_positions:
            if pos_id not in position_map:
                raise AppException(
                    ErrorCode.BALLOT_INVALID,
                    f"Position '{pos_id}' does not belong to this election",
                    status_code=422,
                )

        # Validate candidate choices for each position
        validated_choices = []
        for selection in request.selections:
            pos = position_map[selection.position_id]

            if selection.is_abstain:
                if selection.candidate_ids:
                    raise AppException(
                        ErrorCode.BALLOT_INVALID,
                        f"Abstaining positions cannot include candidate selections for '{pos.title}'",
                        status_code=422,
                    )
                validated_choices.append({
                    "position_id": pos.id,
                    "candidate_id": None,
                    "is_abstain": True,
                })
            else:
                if len(selection.candidate_ids) == 0 and pos.min_selections > 0:
                    raise AppException(
                        ErrorCode.BALLOT_INVALID,
                        f"Position '{pos.title}' requires at least {pos.min_selections} candidate(s)",
                        status_code=422,
                    )

                if len(selection.candidate_ids) > pos.max_selections:
                    raise AppException(
                        ErrorCode.BALLOT_INVALID,
                        f"Too many candidates selected for position '{pos.title}' (max: {pos.max_selections})",
                        status_code=422,
                    )

                # Check duplicate selections within position
                if len(selection.candidate_ids) != len(set(selection.candidate_ids)):
                    raise AppException(
                        ErrorCode.BALLOT_INVALID,
                        f"Duplicate candidate selections detected for position '{pos.title}'",
                        status_code=422,
                    )

                # Verify each selected candidate exists and belongs to this position
                for cand_id in selection.candidate_ids:
                    cand_stmt = select(Candidate).where(
                        Candidate.id == cand_id, Candidate.position_id == pos.id
                    )
                    cand = (await election_session.execute(cand_stmt)).scalar_one_or_none()
                    if not cand or cand.status != "active":
                        raise AppException(
                            ErrorCode.BALLOT_INVALID,
                            f"Selected candidate '{cand_id}' is invalid or inactive for position '{pos.title}'",
                            status_code=422,
                        )

                    validated_choices.append({
                        "position_id": pos.id,
                        "candidate_id": cand.id,
                        "is_abstain": False,
                    })

        # 4. Atomic redemption and ballot insertion in ballot_db
        # Compute keyed HMAC hash (prevents correlation across databases)
        redemption_hash = compute_ballot_redemption_hash(
            settings.CREDENTIAL_HMAC_KEY, credential
        )

        receipt = generate_receipt_reference()
        ballot_id = uuid.uuid4()

        try:
            # Insert redemption record
            redemption = BallotCredentialRedemption(
                election_id=election_id,
                credential_hash=redemption_hash,
                status="accepted",
                redeemed_at=now,
            )
            ballot_session.add(redemption)

            # Insert anonymous ballot
            ballot = Ballot(
                id=ballot_id,
                election_id=election_id,
                configuration_hash=election.configuration_hash,
                ballot_payload={
                    "election_id": str(election_id),
                    "configuration_hash": election.configuration_hash,
                    "selections": [
                        {
                            "position_id": str(s.position_id),
                            "candidate_ids": [str(c) for c in s.candidate_ids],
                            "is_abstain": s.is_abstain,
                        }
                        for s in request.selections
                    ],
                },
                accepted_at=now,
                integrity_metadata={"receipt_reference": receipt},
            )
            ballot_session.add(ballot)

            # Insert normalized ballot choices
            for choice in validated_choices:
                bc = BallotChoice(
                    ballot_id=ballot_id,
                    position_id=choice["position_id"],
                    candidate_id=choice["candidate_id"],
                    is_abstain=choice["is_abstain"],
                )
                ballot_session.add(bc)

            await ballot_session.commit()

        except IntegrityError:
            await ballot_session.rollback()
            raise AppException(
                ErrorCode.BALLOT_ALREADY_ACCEPTED,
                "This voting entitlement has already been used.",
                status_code=409,
            )

        return {
            "status": "accepted",
            "receipt_reference": receipt,
        }
