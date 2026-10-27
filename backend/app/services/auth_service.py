import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import AppException, ErrorCode
from app.core.security import (
    ensure_utc,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.identity import (
    AccountStatus,
    EmailVerificationToken,
    OrganizationMembership,
    PasswordResetToken,
    User,
    UserSession,
)
from app.schemas.auth import (
    MembershipSummary,
    MeResponse,
    RegisterRequest,
    UserResponse,
)


class AuthService:
    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @classmethod
    async def register(
        cls,
        db: AsyncSession,
        req: RegisterRequest,
    ) -> tuple[User, str]:
        normalized_email = cls.normalize_email(req.email)

        # Check existing user
        stmt = select(User).where(User.email_normalized == normalized_email)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="An account with this email address already exists.",
            )

        # Hash password and create user
        pw_hash = hash_password(req.password)
        user = User(
            id=uuid.uuid4(),
            email_normalized=normalized_email,
            password_hash=pw_hash,
            display_name=req.display_name.strip(),
            email_verified_at=None,
            account_status=AccountStatus.ACTIVE.value,
            is_platform_admin=False,
        )
        db.add(user)
        await db.flush()

        # Generate verification token (24-hour expiry)
        raw_token = generate_secure_token()
        token_hash = hash_token(raw_token)
        verification_token = EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
            used_at=None,
        )
        db.add(verification_token)
        await db.commit()
        await db.refresh(user)

        return user, raw_token

    @classmethod
    async def login(
        cls,
        db: AsyncSession,
        email: str,
        password: str,
        request: Request,
        response: Response,
    ) -> tuple[User, str]:
        normalized_email = cls.normalize_email(email)

        stmt = (
            select(User)
            .where(User.email_normalized == normalized_email)
            .options(
                selectinload(User.memberships).selectinload(OrganizationMembership.organization)
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise AppException(
                code=ErrorCode.UNAUTHENTICATED,
                message="Invalid email or password.",
            )

        if user.account_status != AccountStatus.ACTIVE.value:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message=f"Your account is {user.account_status}. Please contact an administrator.",
            )

        # Create session
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        now = datetime.now(UTC)
        expires_at = now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)

        session = UserSession(
            id=uuid.uuid4(),
            user_id=user.id,
            session_token_hash=token_hash,
            expires_at=expires_at,
            last_active_at=now,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            is_revoked=False,
        )
        db.add(session)
        await db.commit()

        # Set secure HttpOnly session cookie
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=raw_token,
            httponly=True,
            secure=settings.SESSION_COOKIE_SECURE,
            samesite=settings.SESSION_COOKIE_SAMESITE,
            max_age=settings.SESSION_ABSOLUTE_HOURS * 3600,
            path="/",
        )

        return user, raw_token

    @classmethod
    async def logout(
        cls,
        db: AsyncSession,
        raw_token: str | None,
        response: Response,
    ) -> None:
        if raw_token:
            token_hash = hash_token(raw_token)
            stmt = (
                update(UserSession)
                .where(UserSession.session_token_hash == token_hash)
                .values(is_revoked=True)
            )
            await db.execute(stmt)
            await db.commit()

        # Clear session cookie
        response.delete_cookie(
            key=settings.SESSION_COOKIE_NAME,
            path="/",
        )

    @classmethod
    async def verify_email(
        cls,
        db: AsyncSession,
        token: str,
    ) -> User:
        token_hash = hash_token(token)
        stmt = select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used_at == None,
        )
        result = await db.execute(stmt)
        verification_token = result.scalar_one_or_none()

        now = datetime.now(UTC)
        if not verification_token or ensure_utc(verification_token.expires_at) <= now:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invalid or expired email verification token.",
            )

        verification_token.used_at = now
        stmt_user = select(User).where(User.id == verification_token.user_id)
        user_res = await db.execute(stmt_user)
        user = user_res.scalar_one()

        user.email_verified_at = now
        await db.commit()
        await db.refresh(user)
        return user

    @classmethod
    async def forgot_password(
        cls,
        db: AsyncSession,
        email: str,
    ) -> str | None:
        """Request password recovery. Generic response to prevent account enumeration."""
        normalized_email = cls.normalize_email(email)
        stmt = select(User).where(User.email_normalized == normalized_email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            return None

        raw_token = generate_secure_token()
        token_hash = hash_token(raw_token)
        now = datetime.now(UTC)

        reset_token = PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(hours=1),
            used_at=None,
        )
        db.add(reset_token)
        await db.commit()
        return raw_token

    @classmethod
    async def reset_password(
        cls,
        db: AsyncSession,
        token: str,
        new_password: str,
    ) -> None:
        token_hash = hash_token(token)
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at == None,
        )
        result = await db.execute(stmt)
        reset_token = result.scalar_one_or_none()

        now = datetime.now(UTC)
        if not reset_token or ensure_utc(reset_token.expires_at) <= now:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invalid or expired password reset token.",
            )

        reset_token.used_at = now
        user_stmt = select(User).where(User.id == reset_token.user_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one()

        # Update password hash
        user.password_hash = hash_password(new_password)

        # Invalidate all active sessions for security
        revoke_stmt = (
            update(UserSession).where(UserSession.user_id == user.id).values(is_revoked=True)
        )
        await db.execute(revoke_stmt)
        await db.commit()

    @classmethod
    def serialize_user(cls, user: User) -> UserResponse:
        return UserResponse(
            id=user.id,
            email=user.email_normalized,
            display_name=user.display_name,
            email_verified=user.email_verified_at is not None,
            account_status=user.account_status,
            is_platform_admin=user.is_platform_admin,
            created_at=user.created_at,
        )

    @classmethod
    def serialize_me(cls, user: User) -> MeResponse:
        memberships_data: list[MembershipSummary] = []
        if user.memberships:
            for m in user.memberships:
                if m.status == "active" and m.organization:
                    memberships_data.append(
                        MembershipSummary(
                            id=m.id,
                            organization_id=m.organization_id,
                            organization_name=m.organization.name,
                            organization_slug=m.organization.slug,
                            role=m.role,
                            status=m.status,
                        )
                    )
        return MeResponse(
            user=cls.serialize_user(user),
            memberships=memberships_data,
        )
