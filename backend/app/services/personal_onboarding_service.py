import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.core.security import generate_secure_token, hash_password, hash_token
from app.models.identity import (
    AccountStatus,
    EmailVerificationToken,
    OnboardingStatus,
    PersonalOnboarding,
    User,
)
from app.schemas.auth import (
    PersonalOnboardingResponse,
    PersonalRegisterRequest,
    UpdatePersonalOnboardingRequest,
    UpdateUserProfileRequest,
)


class PersonalOnboardingService:
    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @classmethod
    async def register_personal(
        cls,
        db: AsyncSession,
        req: PersonalRegisterRequest,
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

        pw_hash = hash_password(req.password)
        first_name = req.first_name.strip()
        last_name = req.last_name.strip()
        display_name = f"{first_name} {last_name}".strip() or "Voter"

        user = User(
            id=uuid.uuid4(),
            email_normalized=normalized_email,
            password_hash=pw_hash,
            display_name=display_name,
            first_name=first_name,
            last_name=last_name,
            email_verified_at=None,
            account_status=AccountStatus.ACTIVE.value,
            is_platform_admin=False,
            account_type="personal",
            mfa_enabled=False,
            preferred_language="en",
        )
        db.add(user)
        await db.flush()

        # Initialize personal onboarding status
        onboarding = PersonalOnboarding(
            id=uuid.uuid4(),
            user_id=user.id,
            onboarding_status=OnboardingStatus.NOT_STARTED.value,
            current_step=1,
        )
        db.add(onboarding)

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
    async def get_onboarding(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> PersonalOnboarding:
        stmt = select(PersonalOnboarding).where(PersonalOnboarding.user_id == user_id)
        result = await db.execute(stmt)
        onboarding = result.scalar_one_or_none()

        if not onboarding:
            onboarding = PersonalOnboarding(
                id=uuid.uuid4(),
                user_id=user_id,
                onboarding_status=OnboardingStatus.NOT_STARTED.value,
                current_step=1,
            )
            db.add(onboarding)
            await db.commit()
            await db.refresh(onboarding)

        return onboarding

    @classmethod
    async def update_onboarding(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        req: UpdatePersonalOnboardingRequest,
    ) -> PersonalOnboarding:
        onboarding = await cls.get_onboarding(db, user_id)
        now = datetime.now(UTC)

        if req.current_step is not None:
            onboarding.current_step = req.current_step

        if req.onboarding_status is not None:
            onboarding.onboarding_status = req.onboarding_status

        # Transition status and update milestone timestamps
        if onboarding.current_step > 1 and onboarding.onboarding_status == OnboardingStatus.NOT_STARTED.value:
            onboarding.onboarding_status = OnboardingStatus.IN_PROGRESS.value

        if onboarding.current_step >= 3 and onboarding.profile_completed_at is None:
            onboarding.profile_completed_at = now

        if onboarding.current_step >= 4 and onboarding.security_setup_completed_at is None:
            onboarding.security_setup_completed_at = now

        if (
            onboarding.current_step >= 5
            or onboarding.onboarding_status == OnboardingStatus.COMPLETED.value
        ):
            if onboarding.institution_step_completed_at is None:
                onboarding.institution_step_completed_at = now
            if onboarding.completed_at is None:
                onboarding.completed_at = now
            onboarding.onboarding_status = OnboardingStatus.COMPLETED.value

        await db.commit()
        await db.refresh(onboarding)
        return onboarding

    @classmethod
    async def update_profile(
        cls,
        db: AsyncSession,
        user: User,
        req: UpdateUserProfileRequest,
    ) -> User:
        if req.first_name is not None:
            user.first_name = req.first_name.strip()
        if req.last_name is not None:
            user.last_name = req.last_name.strip()
        if req.display_name is not None:
            user.display_name = req.display_name.strip()
        elif req.first_name is not None or req.last_name is not None:
            first = user.first_name or ""
            last = user.last_name or ""
            user.display_name = f"{first} {last}".strip()

        if req.phone_number is not None:
            user.phone_number = req.phone_number.strip()
        if req.profile_image_url is not None:
            user.profile_image_url = req.profile_image_url.strip()
        if req.country is not None:
            user.country = req.country.strip()
        if req.preferred_language is not None:
            user.preferred_language = req.preferred_language.strip()

        await db.commit()
        await db.refresh(user)
        return user

    @classmethod
    def serialize_onboarding(cls, onboarding: PersonalOnboarding) -> PersonalOnboardingResponse:
        return PersonalOnboardingResponse(
            id=onboarding.id,
            user_id=onboarding.user_id,
            onboarding_status=onboarding.onboarding_status,
            current_step=onboarding.current_step,
            profile_completed_at=onboarding.profile_completed_at,
            security_setup_completed_at=onboarding.security_setup_completed_at,
            institution_step_completed_at=onboarding.institution_step_completed_at,
            completed_at=onboarding.completed_at,
            created_at=onboarding.created_at,
            updated_at=onboarding.updated_at,
        )
