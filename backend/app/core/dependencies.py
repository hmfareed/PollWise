import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import AppException, ErrorCode
from app.core.security import ensure_utc, hash_token
from app.db.session import get_identity_session
from app.models.identity import (
    AccountStatus,
    MembershipStatus,
    OrganizationMembership,
    User,
    UserSession,
)


async def get_token_from_request(
    request: Request,
    pollwise_session: str | None = Cookie(None, alias=settings.SESSION_COOKIE_NAME),
    authorization: str | None = Header(None),
) -> str | None:
    """Extract raw session token from HttpOnly cookie or Authorization header."""
    if pollwise_session:
        return pollwise_session
    if authorization and authorization.startswith("Bearer "):
        return authorization.split("Bearer ", 1)[1].strip()
    return None


async def get_current_user_optional(
    raw_token: str | None = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_identity_session),
) -> User | None:
    """Retrieve current user from session token if present and valid."""
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    stmt = (
        select(UserSession)
        .where(
            UserSession.session_token_hash == token_hash,
            UserSession.is_revoked == False,
        )
        .options(
            selectinload(UserSession.user)
            .selectinload(User.memberships)
            .selectinload(OrganizationMembership.organization)
        )
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        return None

    now = datetime.now(UTC)

    # 1. Check absolute expiration
    if ensure_utc(session.expires_at) <= now:
        session.is_revoked = True
        await db.commit()
        return None

    # 2. Check idle timeout
    idle_delta = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if now - ensure_utc(session.last_active_at) > idle_delta:
        session.is_revoked = True
        await db.commit()
        return None

    # Update last_active_at
    session.last_active_at = now
    await db.commit()

    user = session.user
    if user.account_status != AccountStatus.ACTIVE.value:
        return None

    return user


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Enforce authentication requirement on protected endpoints."""
    if not user:
        raise AppException(
            code=ErrorCode.UNAUTHENTICATED,
            message="Authentication required. Please log in to proceed.",
        )
    return user


async def require_platform_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforce platform-level administrator access."""
    if not current_user.is_platform_admin:
        raise AppException(
            code=ErrorCode.FORBIDDEN,
            message="Platform administrator privilege required.",
        )
    return current_user


def require_organization_role(allowed_roles: list[str]) -> Callable:
    """Factory creating dependency verifying user has appropriate organization membership."""

    async def dependency(
        organization_id: uuid.UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_identity_session),
    ) -> OrganizationMembership:
        # Platform admins bypass organization role restrictions
        if current_user.is_platform_admin:
            # Return or synthesize an admin membership context
            stmt = select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == current_user.id,
            )
            res = await db.execute(stmt)
            mem = res.scalar_one_or_none()
            if mem:
                return mem
            # Synthesize mock admin membership for platform admin
            return OrganizationMembership(
                id=uuid.uuid4(),
                organization_id=organization_id,
                user_id=current_user.id,
                role="organization_admin",
                status="active",
            )

        stmt = (
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == current_user.id,
                OrganizationMembership.status == MembershipStatus.ACTIVE.value,
            )
            .options(selectinload(OrganizationMembership.organization))
        )
        res = await db.execute(stmt)
        membership = res.scalar_one_or_none()

        if not membership:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not an active member of this organization.",
            )

        if membership.role not in allowed_roles:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message=f"Insufficient role in organization. Required: {', '.join(allowed_roles)}.",
            )

        return membership

    return dependency
