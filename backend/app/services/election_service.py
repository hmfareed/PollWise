import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppException, ErrorCode
from app.models.election import (
    ApprovalDecision,
    ApprovalType,
    AuditEvent,
    Candidate,
    Election,
    ElectionApproval,
    ElectionStatus,
    Position,
)
from app.models.identity import User
from app.schemas.election import (
    CancelElectionRequest,
    CreateCandidateRequest,
    CreateElectionRequest,
    CreatePositionRequest,
    LaunchApprovalRequest,
    UpdateCandidateRequest,
    UpdateElectionRequest,
    UpdatePositionRequest,
)


class ElectionService:
    @classmethod
    async def record_audit_event(
        cls,
        db: AsyncSession,
        event_type: str,
        actor_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        election_id: uuid.UUID | None = None,
        outcome: str = "success",
        metadata: dict | None = None,
    ) -> AuditEvent:
        """Record an immutable, non-sensitive audit event (Doc 05 & 19)."""
        event = AuditEvent(
            id=uuid.uuid4(),
            organization_id=organization_id,
            election_id=election_id,
            actor_id=actor_id,
            event_type=event_type,
            outcome=outcome,
            metadata_json=json.dumps(metadata or {}),
            created_at=datetime.now(UTC),
        )
        db.add(event)
        await db.commit()
        return event

    @classmethod
    async def create_election(
        cls,
        db: AsyncSession,
        user: User,
        req: CreateElectionRequest,
    ) -> Election:
        election = Election(
            id=uuid.uuid4(),
            organization_id=req.organization_id,
            title=req.title.strip(),
            description=req.description.strip() if req.description else None,
            status=ElectionStatus.DRAFT,
            opens_at=req.opens_at,
            closes_at=req.closes_at,
            timezone=req.timezone,
            voting_method="single_choice_per_position",
            configuration_version=1,
            configuration_hash=None,
            created_by=user.id,
        )
        db.add(election)
        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_CREATED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"title": election.title},
        )
        return election

    @classmethod
    async def get_election(
        cls,
        db: AsyncSession,
        election_id: uuid.UUID,
        include_positions: bool = True,
    ) -> Election:
        stmt = select(Election).where(Election.id == election_id)
        if include_positions:
            stmt = stmt.options(
                selectinload(Election.positions).selectinload(Position.candidates),
                selectinload(Election.approvals),
            )
        res = await db.execute(stmt)
        election = res.scalar_one_or_none()
        if not election:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Election not found.",
            )
        return election

    @classmethod
    async def list_elections(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> list[Election]:
        stmt = select(Election).order_by(Election.created_at.desc())
        if organization_id:
            stmt = stmt.where(Election.organization_id == organization_id)
        if status:
            stmt = stmt.where(Election.status == status)

        stmt = stmt.options(
            selectinload(Election.positions).selectinload(Position.candidates),
            selectinload(Election.approvals),
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    async def update_election(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
        req: UpdateElectionRequest,
    ) -> Election:
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message=f"Cannot edit election in '{election.status}' state. Configuration is locked.",
            )

        if req.title is not None:
            election.title = req.title.strip()
        if req.description is not None:
            election.description = req.description.strip()
        if req.opens_at is not None:
            election.opens_at = req.opens_at
        if req.closes_at is not None:
            election.closes_at = req.closes_at
        if req.timezone is not None:
            election.timezone = req.timezone

        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_UPDATED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"updated_fields": list(req.model_dump(exclude_unset=True).keys())},
        )
        return election

    @classmethod
    async def add_position(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
        req: CreatePositionRequest,
    ) -> Position:
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message="Cannot add positions to a locked or scheduled election.",
            )

        position = Position(
            id=uuid.uuid4(),
            election_id=election_id,
            title=req.title.strip(),
            description=req.description.strip() if req.description else None,
            min_selections=req.min_selections,
            max_selections=req.max_selections,
            display_order=req.display_order,
        )
        db.add(position)
        await db.commit()
        await db.refresh(position)

        await cls.record_audit_event(
            db=db,
            event_type="POSITION_ADDED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"position_id": str(position.id), "title": position.title},
        )
        return position

    @classmethod
    async def update_position(
        cls,
        db: AsyncSession,
        user: User,
        position_id: uuid.UUID,
        req: UpdatePositionRequest,
    ) -> Position:
        stmt = (
            select(Position)
            .where(Position.id == position_id)
            .options(selectinload(Position.election))
        )
        res = await db.execute(stmt)
        position = res.scalar_one_or_none()
        if not position:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Position not found.")

        if position.election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message="Cannot update positions in a locked election.",
            )

        if req.title is not None:
            position.title = req.title.strip()
        if req.description is not None:
            position.description = req.description.strip()
        if req.min_selections is not None:
            position.min_selections = req.min_selections
        if req.max_selections is not None:
            position.max_selections = req.max_selections
        if req.display_order is not None:
            position.display_order = req.display_order

        await db.commit()
        await db.refresh(position)
        return position

    @classmethod
    async def delete_position(
        cls,
        db: AsyncSession,
        user: User,
        position_id: uuid.UUID,
    ) -> None:
        stmt = (
            select(Position)
            .where(Position.id == position_id)
            .options(selectinload(Position.election))
        )
        res = await db.execute(stmt)
        position = res.scalar_one_or_none()
        if not position:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Position not found.")

        if position.election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message="Cannot delete positions from a locked election.",
            )

        election_id = position.election_id
        org_id = position.election.organization_id
        await db.delete(position)
        await db.commit()

        await cls.record_audit_event(
            db=db,
            event_type="POSITION_DELETED",
            actor_id=user.id,
            organization_id=org_id,
            election_id=election_id,
            metadata={"position_id": str(position_id)},
        )

    @classmethod
    async def add_candidate(
        cls,
        db: AsyncSession,
        user: User,
        position_id: uuid.UUID,
        req: CreateCandidateRequest,
    ) -> Candidate:
        stmt = (
            select(Position)
            .where(Position.id == position_id)
            .options(selectinload(Position.election))
        )
        res = await db.execute(stmt)
        position = res.scalar_one_or_none()
        if not position:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Position not found.")

        if position.election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED, message="Cannot add candidates to a locked election."
            )

        candidate = Candidate(
            id=uuid.uuid4(),
            position_id=position_id,
            name=req.name.strip(),
            biography=req.biography.strip() if req.biography else None,
            photo_url=req.photo_url.strip() if req.photo_url else None,
            display_order=req.display_order,
            status="active",
        )
        db.add(candidate)
        await db.commit()
        await db.refresh(candidate)

        await cls.record_audit_event(
            db=db,
            event_type="CANDIDATE_ADDED",
            actor_id=user.id,
            organization_id=position.election.organization_id,
            election_id=position.election_id,
            metadata={"candidate_id": str(candidate.id), "name": candidate.name},
        )
        return candidate

    @classmethod
    async def update_candidate(
        cls,
        db: AsyncSession,
        user: User,
        candidate_id: uuid.UUID,
        req: UpdateCandidateRequest,
    ) -> Candidate:
        stmt = (
            select(Candidate)
            .where(Candidate.id == candidate_id)
            .options(selectinload(Candidate.position).selectinload(Position.election))
        )
        res = await db.execute(stmt)
        candidate = res.scalar_one_or_none()
        if not candidate:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Candidate not found.")

        election = candidate.position.election
        if election.status != ElectionStatus.DRAFT and (
            req.name is not None
            or req.biography is not None
            or req.photo_url is not None
            or req.display_order is not None
        ):
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message="Candidate details are locked once scheduled.",
            )

        if req.name is not None:
            candidate.name = req.name.strip()
        if req.biography is not None:
            candidate.biography = req.biography.strip()
        if req.photo_url is not None:
            candidate.photo_url = req.photo_url.strip()
        if req.display_order is not None:
            candidate.display_order = req.display_order
        if req.status is not None:
            candidate.status = req.status

        await db.commit()
        await db.refresh(candidate)
        return candidate

    @classmethod
    async def delete_candidate(
        cls,
        db: AsyncSession,
        user: User,
        candidate_id: uuid.UUID,
    ) -> None:
        stmt = (
            select(Candidate)
            .where(Candidate.id == candidate_id)
            .options(selectinload(Candidate.position).selectinload(Position.election))
        )
        res = await db.execute(stmt)
        candidate = res.scalar_one_or_none()
        if not candidate:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Candidate not found.")

        election = candidate.position.election
        if election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.CONFIG_LOCKED,
                message="Cannot delete candidates from a locked election.",
            )

        election_id = election.id
        org_id = election.organization_id
        await db.delete(candidate)
        await db.commit()

        await cls.record_audit_event(
            db=db,
            event_type="CANDIDATE_DELETED",
            actor_id=user.id,
            organization_id=org_id,
            election_id=election_id,
            metadata={"candidate_id": str(candidate_id)},
        )

    @classmethod
    async def approve_launch(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
        req: LaunchApprovalRequest,
    ) -> ElectionApproval:
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message="Launch approval can only be recorded for draft elections.",
            )

        approval = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election_id,
            approval_type=ApprovalType.LAUNCH,
            approver_actor_id=user.id,
            decision=req.decision,
            reason=req.reason,
            created_at=datetime.now(UTC),
        )
        db.add(approval)
        await db.commit()
        await db.refresh(approval)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_LAUNCH_APPROVAL_RECORDED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"decision": req.decision, "reason": req.reason},
        )
        return approval

    @classmethod
    async def schedule_election(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
    ) -> Election:
        """Validate all prerequisites, freeze configuration, and transition to SCHEDULED (Doc 08)."""
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.DRAFT:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=f"Cannot schedule election from '{election.status}' state. Must be 'draft'.",
            )

        # 1. Validate schedule
        if not election.opens_at or not election.closes_at:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Opening and closing timestamps must be specified prior to scheduling.",
            )
        if election.closes_at <= election.opens_at:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Closing time must be strictly after opening time.",
            )

        # 2. Validate ballot structure
        if not election.positions:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Election must contain at least one position before scheduling.",
            )

        for pos in election.positions:
            active_cands = [c for c in pos.candidates if c.status == "active"]
            if not active_cands:
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=f"Position '{pos.title}' has no active candidates.",
                )

        # 3. Check for launch approval
        approved = any(
            a.approval_type == ApprovalType.LAUNCH and a.decision == ApprovalDecision.APPROVED
            for a in election.approvals
        )
        if not approved:
            raise AppException(
                code=ErrorCode.APPROVAL_REQUIRED,
                message="Formal launch approval is required before scheduling.",
            )

        # 4. Compute and freeze configuration hash
        config_hash = election.compute_configuration_hash()
        election.configuration_hash = config_hash
        election.status = ElectionStatus.SCHEDULED

        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_SCHEDULED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"configuration_hash": config_hash},
        )
        return election

    @classmethod
    async def open_election(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
    ) -> Election:
        """Transition election to OPEN state, verifying configuration hash integrity."""
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.SCHEDULED:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=f"Cannot open election from '{election.status}' state. Must be 'scheduled'.",
            )

        # Re-compute hash to verify zero tampering during scheduled state
        current_hash = election.compute_configuration_hash()
        if election.configuration_hash != current_hash:
            raise AppException(
                code=ErrorCode.CONFIG_HASH_MISMATCH,
                message="Ballot configuration integrity check failed. Configuration hash has changed.",
            )

        election.status = ElectionStatus.OPEN
        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_OPENED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"configuration_hash": election.configuration_hash},
        )
        return election

    @classmethod
    async def close_election(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
    ) -> Election:
        """Transition election to CLOSED state, stopping further voting."""
        election = await cls.get_election(db, election_id)
        if election.status != ElectionStatus.OPEN:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=f"Cannot close election from '{election.status}' state. Must be 'open'.",
            )

        election.status = ElectionStatus.CLOSED
        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_CLOSED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={},
        )
        return election

    @classmethod
    async def cancel_election(
        cls,
        db: AsyncSession,
        user: User,
        election_id: uuid.UUID,
        req: CancelElectionRequest,
    ) -> Election:
        """Cancel an election under documented audit policy (Doc 08)."""
        election = await cls.get_election(db, election_id)
        if election.status in (ElectionStatus.PUBLISHED, ElectionStatus.CANCELED):
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=f"Cannot cancel election in '{election.status}' state.",
            )

        election.status = ElectionStatus.CANCELED
        await db.commit()
        await db.refresh(election)

        await cls.record_audit_event(
            db=db,
            event_type="ELECTION_CANCELED",
            actor_id=user.id,
            organization_id=election.organization_id,
            election_id=election.id,
            metadata={"reason": req.reason},
        )
        return election

    @classmethod
    async def get_audit_trail(
        cls,
        db: AsyncSession,
        election_id: uuid.UUID,
    ) -> list[AuditEvent]:
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.election_id == election_id)
            .order_by(AuditEvent.created_at.asc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())
