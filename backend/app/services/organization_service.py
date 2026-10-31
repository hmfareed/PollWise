import json
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppException, ErrorCode
from app.models.identity import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    OrganizationStatus,
    User,
)
from app.schemas.organization import (
    AddMemberRequest,
    CreateOrganizationRequest,
    MemberDetailResponse,
    OrganizationOnboardingRequest,
    OrganizationResponse,
    UpdateMemberRequest,
    UpdateOrganizationRequest,
)

_audit_log = logging.getLogger("pollwise.audit")


class OrganizationService:
    @staticmethod
    def slugify(text: str) -> str:
        slug = re.sub(r"[^\w\s-]", "", text.lower()).strip()
        slug = re.sub(r"[-\s]+", "-", slug)
        return slug or f"org-{uuid.uuid4().hex[:8]}"

    @classmethod
    async def create_organization(
        cls,
        db: AsyncSession,
        creator: User,
        req: CreateOrganizationRequest,
    ) -> Organization:
        slug = req.slug or cls.slugify(req.name)

        # Check slug uniqueness
        stmt = select(Organization).where(Organization.slug == slug)
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            slug = f"{slug}-{uuid.uuid4().hex[:4]}"

        org = Organization(
            id=uuid.uuid4(),
            name=req.name.strip(),
            slug=slug,
            status="active",
        )
        db.add(org)
        await db.flush()

        # Creator automatically becomes Organization Admin
        creator_membership = OrganizationMembership(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=creator.id,
            role=OrganizationRole.ORGANIZATION_ADMIN.value,
            status=MembershipStatus.ACTIVE.value,
        )
        db.add(creator_membership)
        await db.commit()
        await db.refresh(org)
        return org

    @classmethod
    async def get_organization(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
    ) -> Organization:
        stmt = select(Organization).where(Organization.id == org_id)
        res = await db.execute(stmt)
        org = res.scalar_one_or_none()
        if not org:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Organization not found.",
            )
        return org

    @classmethod
    async def list_organizations(
        cls,
        db: AsyncSession,
        user: User,
    ) -> list[Organization]:
        if user.is_platform_admin:
            stmt = select(Organization).order_by(Organization.created_at.desc())
            res = await db.execute(stmt)
            return list(res.scalars().all())

        stmt = (
            select(Organization)
            .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
            .where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.status == MembershipStatus.ACTIVE.value,
            )
            .order_by(Organization.created_at.desc())
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    async def update_organization(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        req: UpdateOrganizationRequest,
    ) -> Organization:
        org = await cls.get_organization(db, org_id)
        if req.name is not None:
            org.name = req.name.strip()
        if req.status is not None:
            org.status = req.status
        await db.commit()
        await db.refresh(org)
        return org

    @classmethod
    async def complete_onboarding(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        req: OrganizationOnboardingRequest,
    ) -> Organization:
        org = await cls.get_organization(db, org_id)

        if req.institution_name:
            org.name = req.institution_name.strip()

        existing_meta = json.loads(org.metadata_json) if org.metadata_json else {}
        onboarding_data = req.model_dump(exclude={"is_completed", "institution_name"})
        existing_meta.update(onboarding_data)
        org.metadata_json = json.dumps(existing_meta)

        if req.is_completed:
            org.status = "active"
        else:
            org.status = "draft"

        await db.commit()
        await db.refresh(org)
        return org

    @staticmethod
    def serialize_organization(org: Organization) -> OrganizationResponse:
        meta = json.loads(org.metadata_json) if org.metadata_json else None
        return OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            status=org.status,
            metadata=meta,
            created_at=org.created_at,
        )

    @classmethod
    async def list_members(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
    ) -> list[MemberDetailResponse]:
        stmt = (
            select(OrganizationMembership)
            .where(OrganizationMembership.organization_id == org_id)
            .options(selectinload(OrganizationMembership.user))
            .order_by(OrganizationMembership.created_at.asc())
        )
        res = await db.execute(stmt)
        memberships = res.scalars().all()

        details: list[MemberDetailResponse] = []
        for m in memberships:
            details.append(
                MemberDetailResponse(
                    id=m.id,
                    user_id=m.user_id,
                    email=m.user.email_normalized,
                    display_name=m.user.display_name,
                    role=m.role,
                    status=m.status,
                    created_at=m.created_at,
                )
            )
        return details

    @classmethod
    async def add_member(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        req: AddMemberRequest,
    ) -> MemberDetailResponse:
        norm_email = req.email.strip().lower()
        stmt_user = select(User).where(User.email_normalized == norm_email)
        res_user = await db.execute(stmt_user)
        user = res_user.scalar_one_or_none()

        if not user:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message=f"No registered user found with email '{norm_email}'. Users must register first.",
            )

        # Check existing membership
        stmt_mem = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user.id,
        )
        res_mem = await db.execute(stmt_mem)
        existing = res_mem.scalar_one_or_none()

        if existing:
            if existing.status == MembershipStatus.ACTIVE.value:
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="User is already an active member of this organization.",
                )
            # Reactivate
            existing.status = MembershipStatus.ACTIVE.value
            existing.role = req.role
            await db.commit()
            return MemberDetailResponse(
                id=existing.id,
                user_id=user.id,
                email=user.email_normalized,
                display_name=user.display_name,
                role=existing.role,
                status=existing.status,
                created_at=existing.created_at,
            )

        membership = OrganizationMembership(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user.id,
            role=req.role,
            status=MembershipStatus.ACTIVE.value,
        )
        db.add(membership)
        await db.commit()
        await db.refresh(membership)

        return MemberDetailResponse(
            id=membership.id,
            user_id=user.id,
            email=user.email_normalized,
            display_name=user.display_name,
            role=membership.role,
            status=membership.status,
            created_at=membership.created_at,
        )

    @classmethod
    async def update_member(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        member_id: uuid.UUID,
        req: UpdateMemberRequest,
    ) -> MemberDetailResponse:
        stmt = (
            select(OrganizationMembership)
            .where(
                OrganizationMembership.id == member_id,
                OrganizationMembership.organization_id == org_id,
            )
            .options(selectinload(OrganizationMembership.user))
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()
        if not mem:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Membership record not found.",
            )

        if req.role is not None:
            mem.role = req.role
        if req.status is not None:
            mem.status = req.status

        await db.commit()
        await db.refresh(mem)

        return MemberDetailResponse(
            id=mem.id,
            user_id=mem.user_id,
            email=mem.user.email_normalized,
            display_name=mem.user.display_name,
            role=mem.role,
            status=mem.status,
            created_at=mem.created_at,
        )

    @classmethod
    async def submit_for_review(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        actor: User,
    ) -> Organization:
        """Transition organization status from draft → pending_verification (Spec §5.1a)."""
        org = await cls.get_organization(db, org_id)

        if org.status != OrganizationStatus.DRAFT.value:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=(
                    f"Organization must be in 'draft' status to submit for review. "
                    f"Current status: '{org.status}'."
                ),
            )

        org.status = OrganizationStatus.PENDING_VERIFICATION.value
        await db.commit()
        await db.refresh(org)

        _audit_log.info(
            "SECURITY_EVENT org_submit_for_review org_id=%s actor_id=%s",
            org_id,
            actor.id,
        )
        return org

    # Allowed platform-admin status transitions (Spec §5.1b)
    _PLATFORM_STATUS_TRANSITIONS: dict[str, set[str]] = {
        OrganizationStatus.PENDING_VERIFICATION.value: {
            OrganizationStatus.VERIFIED.value,
            OrganizationStatus.REJECTED.value,
        },
        OrganizationStatus.VERIFIED.value: {
            OrganizationStatus.SUSPENDED.value,
        },
        OrganizationStatus.ACTIVE.value: {
            OrganizationStatus.SUSPENDED.value,
            OrganizationStatus.VERIFIED.value,
        },
        OrganizationStatus.REJECTED.value: {
            OrganizationStatus.PENDING_VERIFICATION.value,
        },
        OrganizationStatus.SUSPENDED.value: {
            OrganizationStatus.VERIFIED.value,
            OrganizationStatus.ACTIVE.value,
        },
        OrganizationStatus.DRAFT.value: {
            OrganizationStatus.REJECTED.value,
            OrganizationStatus.SUSPENDED.value,
        },
    }

    @classmethod
    async def update_org_status(
        cls,
        db: AsyncSession,
        org_id: uuid.UUID,
        new_status: str,
        reason: str | None,
        actor: User,
    ) -> Organization:
        """Update organization status (platform admin only, Spec §5.1b)."""
        org = await cls.get_organization(db, org_id)

        allowed_next = cls._PLATFORM_STATUS_TRANSITIONS.get(org.status, set())
        if new_status not in allowed_next:
            raise AppException(
                code=ErrorCode.INVALID_STATE_TRANSITION,
                message=(
                    f"Cannot transition organization from '{org.status}' to '{new_status}'. "
                    f"Allowed transitions: {sorted(allowed_next) or 'none'}."
                ),
            )

        old_status = org.status
        org.status = new_status
        await db.commit()
        await db.refresh(org)

        _audit_log.info(
            "SECURITY_EVENT org_status_updated org_id=%s actor_id=%s "
            "old_status=%s new_status=%s reason=%r",
            org_id,
            actor.id,
            old_status,
            new_status,
            reason,
        )
        return org
