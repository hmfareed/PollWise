"""
Pollwise Deterministic Election Tally & Results Publication Service
"""

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppException, ErrorCode
from app.models.ballot import Ballot
from app.models.election import (
    ApprovalDecision,
    ApprovalType,
    AuditEvent,
    Election,
    ElectionApproval,
    ElectionResult,
    ElectionStatus,
    Position,
)
from app.models.identity import User


class TallyService:
    @staticmethod
    async def compute_tally(
        ballot_session: AsyncSession,
        election_session: AsyncSession,
        election_id: uuid.UUID,
        actor: User,
    ) -> ElectionResult:
        """
        Deterministically tally all accepted ballots for a closed election.
        
        Strict Lifecycle Rule (Doc 08):
        - Election status must be exactly 'closed'.
        - Reads strictly anonymous ballots from ballot_db.
        - Calculates candidate vote distributions, abstentions, and winners.
        - Persists immutable results record and advances status to 'tallied'.
        """
        # 1. Verify election state
        elec_stmt = (
            select(Election)
            .where(Election.id == election_id)
            .options(selectinload(Election.positions).selectinload(Position.candidates))
        )
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != ElectionStatus.CLOSED:
            raise AppException(
                ErrorCode.INVALID_STATE_TRANSITION,
                f"Tally calculation requires election to be in status 'closed' (current: '{election.status}')",
                status_code=409,
            )

        # 2. Read all accepted ballots from ballot_db
        ballots_stmt = select(Ballot).where(Ballot.election_id == election_id)
        ballots = (await ballot_session.execute(ballots_stmt)).scalars().all()
        total_ballots = len(ballots)

        # 3. Deterministic counting structure
        # position_counts: { pos_id: { cand_id: count, "abstain": count } }
        position_results = []

        for pos in sorted(election.positions, key=lambda p: (p.display_order, str(p.id))):
            vote_counts: dict[uuid.UUID, int] = {c.id: 0 for c in pos.candidates}
            abstain_count = 0

            for b in ballots:
                # Find selection for this position in the ballot payload
                selections = b.ballot_payload.get("selections", [])
                pos_sel = next((s for s in selections if s.get("position_id") == str(pos.id)), None)
                if not pos_sel:
                    continue

                if pos_sel.get("is_abstain", False):
                    abstain_count += 1
                else:
                    for cid_str in pos_sel.get("candidate_ids", []):
                        try:
                            cid = uuid.UUID(cid_str)
                            if cid in vote_counts:
                                vote_counts[cid] += 1
                        except ValueError:
                            continue

            total_pos_votes = sum(vote_counts.values())
            candidate_results = []
            max_votes = -1
            winner_ids = []

            for cand in sorted(pos.candidates, key=lambda c: (c.display_order, str(c.id))):
                votes = vote_counts[cand.id]
                pct = (votes / total_pos_votes * 100.0) if total_pos_votes > 0 else 0.0
                candidate_results.append({
                    "candidate_id": str(cand.id),
                    "name": cand.name,
                    "votes": votes,
                    "percentage": round(pct, 2),
                })
                if votes > max_votes and votes > 0:
                    max_votes = votes
                    winner_ids = [str(cand.id)]
                elif votes == max_votes and votes > 0:
                    winner_ids.append(str(cand.id))

            position_results.append({
                "position_id": str(pos.id),
                "title": pos.title,
                "total_votes": total_pos_votes,
                "abstain_count": abstain_count,
                "candidates": candidate_results,
                "winner_ids": winner_ids,
            })

        result_payload: dict[str, Any] = {
            "election_id": str(election_id),
            "configuration_hash": election.configuration_hash or "",
            "total_ballots": total_ballots,
            "positions": position_results,
        }

        # 4. Check for existing result or insert new
        existing_res_stmt = select(ElectionResult).where(ElectionResult.election_id == election_id)
        existing_res = (await election_session.execute(existing_res_stmt)).scalar_one_or_none()

        now = datetime.now(UTC)
        if existing_res:
            existing_res.ballot_count = total_ballots
            existing_res.result_data = json.dumps(result_payload)
            existing_res.computed_at = now
            existing_res.computed_by = str(actor.id)
            existing_res.approval_status = "pending"
            res_obj = existing_res
        else:
            res_obj = ElectionResult(
                id=uuid.uuid4(),
                election_id=election_id,
                result_version=1,
                configuration_hash=election.configuration_hash or "",
                tally_algorithm_version="1.0",
                ballot_count=total_ballots,
                result_data=json.dumps(result_payload),
                computed_at=now,
                computed_by=str(actor.id),
                approval_status="pending",
            )
            election_session.add(res_obj)

        # Transition election status to 'tallied'
        election.status = ElectionStatus.TALLIED

        audit_event = AuditEvent(
            id=uuid.uuid4(),
            organization_id=election.organization_id,
            election_id=election_id,
            actor_id=actor.id,
            event_type="election.tallied",
            outcome="success",
            metadata_json=json.dumps({"total_ballots": total_ballots}),
            created_at=now,
        )
        election_session.add(audit_event)
        await election_session.commit()
        return res_obj

    @staticmethod
    async def approve_tally(
        election_session: AsyncSession,
        election_id: uuid.UUID,
        result_id: uuid.UUID,
        approver: User,
        decision: str = "approved",
        reason: str | None = None,
    ) -> ElectionApproval:
        """Record formal administrative approval of the computed election tally."""
        elec_stmt = select(Election).where(Election.id == election_id)
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != ElectionStatus.TALLIED:
            raise AppException(
                ErrorCode.INVALID_STATE_TRANSITION,
                f"Cannot approve tally: election is in status '{election.status}' (must be 'tallied')",
                status_code=409,
            )

        res_stmt = select(ElectionResult).where(
            ElectionResult.id == result_id, ElectionResult.election_id == election_id
        )
        result = (await election_session.execute(res_stmt)).scalar_one_or_none()
        if not result:
            raise AppException(ErrorCode.NOT_FOUND, "Election result record not found", status_code=404)

        now = datetime.now(UTC)
        approval = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election_id,
            approval_type=ApprovalType.PUBLICATION,
            approver_actor_id=approver.id,
            decision=decision,
            reason=reason or "Tally verified and approved by election authority",
            created_at=now,
        )
        election_session.add(approval)
        result.approval_status = "approved" if decision == ApprovalDecision.APPROVED else "rejected"

        audit_event = AuditEvent(
            id=uuid.uuid4(),
            organization_id=election.organization_id,
            election_id=election_id,
            actor_id=approver.id,
            event_type="election.tally_approved",
            outcome=decision,
            metadata_json=json.dumps({"result_id": str(result_id), "reason": reason}),
            created_at=now,
        )
        election_session.add(audit_event)
        await election_session.commit()
        return approval

    @staticmethod
    async def publish_results(
        election_session: AsyncSession,
        election_id: uuid.UUID,
        actor: User,
    ) -> Election:
        """
        Formally publish approved election results to public visibility.
        Requires prior publication approval.
        """
        elec_stmt = (
            select(Election)
            .where(Election.id == election_id)
            .options(selectinload(Election.approvals))
        )
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != ElectionStatus.TALLIED:
            raise AppException(
                ErrorCode.INVALID_STATE_TRANSITION,
                f"Cannot publish results: election status is '{election.status}' (must be 'tallied')",
                status_code=409,
            )

        # Verify formal publication approval exists directly from database
        appr_stmt = select(ElectionApproval).where(
            ElectionApproval.election_id == election_id,
            ElectionApproval.approval_type == ApprovalType.PUBLICATION,
            ElectionApproval.decision == ApprovalDecision.APPROVED,
        )
        has_approval = (await election_session.execute(appr_stmt)).scalars().first() is not None
        if not has_approval:
            raise AppException(
                ErrorCode.APPROVAL_REQUIRED,
                "Formal publication approval is required before publishing election results",
                status_code=409,
            )

        now = datetime.now(UTC)
        election.status = ElectionStatus.PUBLISHED

        res_stmt = select(ElectionResult).where(ElectionResult.election_id == election_id)
        result = (await election_session.execute(res_stmt)).scalar_one_or_none()
        if result:
            result.published_at = now

        audit_event = AuditEvent(
            id=uuid.uuid4(),
            organization_id=election.organization_id,
            election_id=election_id,
            actor_id=actor.id,
            event_type="election.published",
            outcome="success",
            metadata_json=None,
            created_at=now,
        )
        election_session.add(audit_event)
        await election_session.commit()
        return election

    @staticmethod
    async def get_results(
        election_session: AsyncSession,
        election_id: uuid.UUID,
        can_view_unapproved: bool,
    ) -> dict:
        """
        Retrieve election results.
        Strict Privacy Invariant (Doc 08 & 09):
        If election status is not 'published', results are strictly confidential
        and accessible only to authorized managers/auditors reviewing the tally.
        """
        elec_stmt = select(Election).where(Election.id == election_id)
        election = (await election_session.execute(elec_stmt)).scalar_one_or_none()
        if not election:
            raise AppException(ErrorCode.NOT_FOUND, "Election not found", status_code=404)

        if election.status != ElectionStatus.PUBLISHED and not can_view_unapproved:
            raise AppException(
                ErrorCode.RESULTS_NOT_PUBLISHED,
                "Election results are confidential and have not been published yet.",
                status_code=403,
            )

        res_stmt = select(ElectionResult).where(ElectionResult.election_id == election_id)
        result = (await election_session.execute(res_stmt)).scalar_one_or_none()
        if not result:
            raise AppException(ErrorCode.NOT_FOUND, "Results have not been computed for this election", status_code=404)

        parsed_data = json.loads(result.result_data)
        return {
            "id": result.id,
            "election_id": result.election_id,
            "configuration_hash": result.configuration_hash,
            "ballot_count": result.ballot_count,
            "approval_status": result.approval_status,
            "computed_at": result.computed_at,
            "published_at": result.published_at,
            "positions": parsed_data.get("positions", []),
        }
