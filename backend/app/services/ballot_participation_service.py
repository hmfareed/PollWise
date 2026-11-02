import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ballot import Ballot
from app.models.election import Candidate, Election, ElectionStatus, Position
from app.models.voter_auth import (
    ElectionParticipation,
    ElectionVoterAuthConfig,
    ElectionVoterRecord,
    VotingSession,
)
from app.schemas.voter_auth import BallotSelectionItem
from app.services.voter_admin_service import VoterAdminService
from app.services.voter_auth_service import VoterAuthService, ensure_utc


class BallotParticipationService:
    @staticmethod
    async def get_ballot_structure(
        election_session: AsyncSession,
        election_id: uuid.UUID,
        session_token: str,
    ) -> dict[str, Any]:
        voting_sess = await VoterAuthService.get_session_by_token(election_session, session_token)
        if voting_sess.election_id != election_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_MISMATCH", "message": "Session does not match this election."},
            )

        election = await election_session.get(Election, election_id)
        if not election or election.status != ElectionStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Election is not open."},
            )

        config = await VoterAdminService.get_or_create_auth_config(election_session, election_id)

        # Positions ordered by display_order
        pos_query = (
            select(Position)
            .where(Position.election_id == election_id)
            .order_by(Position.display_order, Position.id)
        )
        pos_res = await election_session.execute(pos_query)
        positions = pos_res.scalars().all()

        serialized_positions = []
        for pos in positions:
            active_cands = [c for c in pos.candidates if c.status == "active"]
            sorted_cands = sorted(active_cands, key=lambda c: (c.display_order, str(c.id)))
            serialized_positions.append(
                {
                    "id": str(pos.id),
                    "title": pos.title,
                    "description": pos.description,
                    "min_selections": pos.min_selections,
                    "max_selections": pos.max_selections,
                    "is_required": pos.min_selections >= 1,
                    "candidates": [
                        {
                            "id": str(cand.id),
                            "name": cand.name,
                            "biography": cand.biography,
                            "photo_url": cand.photo_url,
                            "display_order": cand.display_order,
                        }
                        for cand in sorted_cands
                    ],
                }
            )

        return {
            "election_id": str(election_id),
            "election_title": election.title,
            "allow_position_skip": config.allow_position_skip,
            "positions": serialized_positions,
            "draft": voting_sess.draft_payload,
        }

    @staticmethod
    async def save_draft(
        election_session: AsyncSession,
        election_id: uuid.UUID,
        session_token: str,
        draft_payload: dict[str, Any],
    ) -> bool:
        voting_sess = await VoterAuthService.get_session_by_token(election_session, session_token)
        if voting_sess.election_id != election_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_MISMATCH", "message": "Session does not match this election."},
            )

        voting_sess.draft_payload = draft_payload
        voting_sess.last_activity_at = datetime.now(UTC)
        await election_session.commit()
        return True

    @staticmethod
    async def submit_ballot_atomic(
        election_session: AsyncSession,
        ballot_session: AsyncSession,
        election_id: uuid.UUID,
        session_token: str,
        selections: list[BallotSelectionItem],
        idempotency_key: str,
    ) -> dict[str, Any]:
        # 1. Look up voting session
        token_hash = VoterAuthService.hash_token(session_token)
        sess_query = select(VotingSession).where(
            VotingSession.session_token_hash == token_hash,
            VotingSession.election_id == election_id,
        )
        sess_res = await election_session.execute(sess_query)
        voting_sess = sess_res.scalar_one_or_none()

        if not voting_sess:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_SESSION", "message": "Session not found."},
            )

        # Idempotency check: if already submitted with this key
        if voting_sess.session_status == "submitted":
            if voting_sess.idempotency_key and voting_sess.idempotency_key == idempotency_key:
                return {
                    "confirmation_reference": voting_sess.confirmation_reference,
                    "submitted_at": voting_sess.last_activity_at,
                    "status": "accepted",
                }
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "BALLOT_ALREADY_SUBMITTED", "message": "Ballot has already been submitted."},
            )

        now = datetime.now(UTC)
        if ensure_utc(voting_sess.expires_at) < now or voting_sess.session_status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "SESSION_EXPIRED", "message": "Voting session has expired."},
            )

        # 2. Check election open window
        election = await election_session.get(Election, election_id)
        if not election or election.status != ElectionStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Election is not open."},
            )
        opens_at = ensure_utc(election.opens_at)
        closes_at = ensure_utc(election.closes_at)
        if opens_at and opens_at > now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Voting has not opened yet."},
            )
        if closes_at and closes_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ELECTION_NOT_OPEN", "message": "Voting has closed."},
            )

        # 3. Check voter eligibility and participation
        voter = await election_session.get(ElectionVoterRecord, voting_sess.voter_record_id)
        if not voter or voter.eligibility_status != "eligible":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "VOTER_NOT_ELIGIBLE", "message": "Voter is not eligible to submit."},
            )

        part_query = select(ElectionParticipation).where(
            ElectionParticipation.election_id == election_id,
            ElectionParticipation.voter_record_id == voter.id,
        )
        part_res = await election_session.execute(part_query)
        if part_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "VOTER_ALREADY_SUBMITTED", "message": "A ballot has already been submitted for this voter."},
            )

        # 4. Validate ballot selections
        pos_query = select(Position).where(Position.election_id == election_id)
        pos_res = await election_session.execute(pos_query)
        positions_by_id = {pos.id: pos for pos in pos_res.scalars().all()}

        selections_by_pos = {sel.position_id: sel for sel in selections}

        ballot_payload_items = []
        for pos_id, pos in positions_by_id.items():
            sel = selections_by_pos.get(pos_id)
            if not sel:
                if pos.min_selections >= 1:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "BALLOT_INVALID", "message": f"Required position '{pos.title}' is not answered."},
                    )
                continue

            if sel.skipped:
                if pos.min_selections >= 1:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "BALLOT_INVALID", "message": f"Required position '{pos.title}' cannot be skipped."},
                    )
                ballot_payload_items.append({"position_id": str(pos_id), "skipped": True})
            else:
                if not sel.candidate_id:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "BALLOT_INVALID", "message": f"Candidate selection missing for position '{pos.title}'."},
                    )
                valid_cand_ids = {c.id for c in pos.candidates if c.status == "active"}
                if sel.candidate_id not in valid_cand_ids:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"code": "BALLOT_INVALID", "message": "Selected candidate does not belong to this position."},
                    )
                ballot_payload_items.append(
                    {
                        "position_id": str(pos_id),
                        "candidate_id": str(sel.candidate_id),
                        "skipped": False,
                    }
                )

        # 5. Coordinated Two-Database Commit
        conf_ref = f"PW-{str(election_id)[:4].upper()}-{secrets.token_hex(4).upper()}"
        
        # Insert anonymous ballot into ballot_db (NO voter or session link)
        anonymous_ballot = Ballot(
            election_id=election_id,
            configuration_hash=election.configuration_hash or "unlocked_draft_hash",
            ballot_payload={"choices": ballot_payload_items},
            accepted_at=now,
        )
        ballot_session.add(anonymous_ballot)

        # Record participation in election_db
        participation = ElectionParticipation(
            election_id=election_id,
            voter_record_id=voter.id,
            participation_status="submitted",
            submitted_at=now,
            confirmation_reference=conf_ref,
        )
        election_session.add(participation)

        # Update session
        voting_sess.session_status = "submitted"
        voting_sess.idempotency_key = idempotency_key
        voting_sess.confirmation_reference = conf_ref
        voting_sess.last_activity_at = now

        try:
            await ballot_session.commit()
            await election_session.commit()
        except Exception:
            await ballot_session.rollback()
            await election_session.rollback()
            raise

        return {
            "confirmation_reference": conf_ref,
            "submitted_at": now,
            "status": "accepted",
        }
