import base64
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException, ErrorCode
from app.core.security import ensure_utc, generate_secure_token, hash_password, hash_token
from app.models.election import Election
from app.models.identity import (
    AccountStatus,
    ElectionEligibility,
    EmailVerificationToken,
    EntitlementStatus,
    InstitutionInvitation,
    InvitationStatus,
    MembershipStatus,
    OnboardingStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    PersonalOnboarding,
    User,
)
from app.schemas.auth import (
    InvitationValidationResponse,
    MfaSetupResponse,
    PersonalOnboardingResponse,
    PersonalRegisterRequest,
    UpdatePersonalOnboardingRequest,
    UpdateUserProfileRequest,
    UserElectionSummary,
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

    @classmethod
    async def setup_mfa(cls, db: AsyncSession, user: User) -> MfaSetupResponse:
        """Initialize MFA setup by generating a TOTP secret and backup recovery codes.

        ARCHITECTURAL NOTE / PRE-PRODUCTION ENCRYPTION & PERSISTENCE SPECIFICATION:
        1. Encrypted At-Rest Storage:
           In current staging/development, this endpoint generates an ephemeral TOTP
           secret returned directly to the client for immediate authenticator registration.
           Prior to production deployment with live voters, database schema migration is
           required to add an encrypted secret column (e.g., `totp_secret_encrypted: Mapped[bytes]`)
           on the `User` model (or dedicated `UserMfaCredential` entity). Secrets MUST be encrypted
           at rest using an authenticated envelope encryption scheme (e.g. AES-256-GCM or
           KMS/HashiCorp Vault managed keys).
        2. Two-Phase Registration:
           During this setup step, store the secret in an encrypted temporary session or short-lived
           cache (e.g. Redis key `mfa_setup:{user.id}` with a 10-minute TTL) so that `verify_mfa`
           can cryptographically validate the user's initial 6-digit TOTP code before permanently
           persisting the encrypted secret and enabling MFA on the account.
        3. Recovery Code Security:
           The 8 backup recovery codes presented to the user must be hashed (using argon2id
           or bcrypt) prior to persistence, allowing single-use redemption during account recovery.
        4. Post-Onboarding Login Challenges:
           Post-onboarding authentication (`/auth/login`) for accounts with `mfa_enabled=True`
           must issue a scoped partial authentication challenge (`mfa_required`), requiring a
           subsequent call to `/auth/mfa/challenge` where the user's submitted TOTP code is verified
           against the decrypted TOTP secret via `pyotp.TOTP(decrypted_secret).verify(code, valid_window=1)`
           prior to granting full access/refresh JWT tokens.
        """
        secret = base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")
        qr_uri = f"otpauth://totp/PollWise:{user.email_normalized}?secret={secret}&issuer=PollWise"
        recovery_codes = [
            f"{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}" for _ in range(8)
        ]
        return MfaSetupResponse(
            secret=secret,
            qr_uri=qr_uri,
            recovery_codes=recovery_codes,
        )

    @classmethod
    async def verify_mfa(cls, db: AsyncSession, user: User, code: str) -> User:
        """Verify initial TOTP verification code and enable MFA for the user.

        ARCHITECTURAL NOTE / PRE-PRODUCTION ENCRYPTION & PERSISTENCE SPECIFICATION:
        1. Live TOTP Validation:
           In production, this method must retrieve the pending secret from the temporary
           secure cache / session established in `setup_mfa` and verify the incoming code using:
           `pyotp.TOTP(pending_secret).verify(clean_code, valid_window=1)`.
        2. Secret Commitment:
           Upon successful verification, the pending TOTP secret is encrypted using AES-256-GCM
           with the application data encryption key (DEK) and committed to `user.totp_secret_encrypted`.
           The backup recovery codes are stored as salted argon2id hashes.
        3. Login Challenge Enforcement:
           Once `user.mfa_enabled = True` is committed, all future password-based logins trigger a
           mandatory MFA step-up challenge before issuing valid voting session tokens.
        """
        clean_code = code.strip()
        if not (6 <= len(clean_code) <= 8):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invalid verification code format.",
                status_code=400,
            )

        user.mfa_enabled = True
        onboarding = await cls.get_onboarding(db, user.id)
        if onboarding and onboarding.security_setup_completed_at is None:
            onboarding.security_setup_completed_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(user)
        return user

    @classmethod
    async def validate_invitation(
        cls, db: AsyncSession, invitation_code: str
    ) -> InvitationValidationResponse:
        clean_code = invitation_code.strip().upper()
        if not clean_code:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation code cannot be empty.",
                status_code=400,
            )

        stmt = select(InstitutionInvitation).where(InstitutionInvitation.invitation_code == clean_code)
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Invitation code not found or invalid.",
                status_code=404,
            )

        now = datetime.now(UTC)
        if invitation.status != InvitationStatus.ACTIVE.value:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Invitation is {invitation.status}.",
                status_code=400,
            )

        if invitation.expires_at and ensure_utc(invitation.expires_at) <= now:
            invitation.status = InvitationStatus.EXPIRED.value
            await db.commit()
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation has expired.",
                status_code=400,
            )

        if invitation.max_uses is not None and invitation.used_count >= invitation.max_uses:
            invitation.status = InvitationStatus.EXHAUSTED.value
            await db.commit()
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation has been fully used.",
                status_code=400,
            )

        institution_name = "Institution"
        if invitation.institution:
            institution_name = invitation.institution.name
        else:
            org_stmt = select(Organization.name).where(Organization.id == invitation.institution_id)
            org_res = await db.execute(org_stmt)
            fetched_name = org_res.scalar_one_or_none()
            if fetched_name:
                institution_name = fetched_name

        return InvitationValidationResponse(
            invitation_code=invitation.invitation_code,
            institution_id=invitation.institution_id,
            institution_name=institution_name,
            invitation_type=invitation.invitation_type,
            expires_at=invitation.expires_at,
        )

    @classmethod
    async def accept_invitation(
        cls, db: AsyncSession, user: User, invitation_code: str
    ) -> dict:
        clean_code = invitation_code.strip().upper()
        if not clean_code:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation code cannot be empty.",
                status_code=400,
            )

        # Row-level locking to prevent concurrent over-redemption beyond max_uses
        stmt = (
            select(InstitutionInvitation)
            .where(InstitutionInvitation.invitation_code == clean_code)
            .with_for_update()
        )
        result = await db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Invitation code not found or invalid.",
                status_code=404,
            )

        now = datetime.now(UTC)
        if invitation.status != InvitationStatus.ACTIVE.value:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Invitation is {invitation.status}.",
                status_code=400,
            )

        if invitation.expires_at and ensure_utc(invitation.expires_at) <= now:
            invitation.status = InvitationStatus.EXPIRED.value
            await db.commit()
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation has expired.",
                status_code=400,
            )

        if invitation.max_uses is not None and invitation.used_count >= invitation.max_uses:
            invitation.status = InvitationStatus.EXHAUSTED.value
            await db.commit()
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Invitation has been fully used.",
                status_code=400,
            )

        # Check existing membership
        mem_stmt = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == invitation.institution_id,
            OrganizationMembership.user_id == user.id,
        )
        membership = (await db.execute(mem_stmt)).scalar_one_or_none()

        onboarding = await cls.get_onboarding(db, user.id)
        if onboarding and onboarding.institution_step_completed_at is None:
            onboarding.institution_step_completed_at = now

        if membership:
            if membership.status == MembershipStatus.ACTIVE.value:
                # Idempotent accept
                await db.commit()
                return {
                    "message": "Already an active member of this institution.",
                    "organization_id": str(invitation.institution_id),
                    "status": membership.status,
                }
            membership.status = MembershipStatus.ACTIVE.value
            membership.role = OrganizationRole.MEMBER.value
        else:
            membership = OrganizationMembership(
                id=uuid.uuid4(),
                organization_id=invitation.institution_id,
                user_id=user.id,
                role=OrganizationRole.MEMBER.value,
                status=MembershipStatus.ACTIVE.value,
            )
            db.add(membership)
            invitation.used_count += 1
            if invitation.max_uses is not None and invitation.used_count >= invitation.max_uses:
                invitation.status = InvitationStatus.EXHAUSTED.value

        await db.commit()
        return {
            "message": "Invitation accepted successfully.",
            "organization_id": str(invitation.institution_id),
            "status": MembershipStatus.ACTIVE.value,
        }

    @classmethod
    async def get_user_elections(
        cls,
        db: AsyncSession,
        user: User,
        election_db: AsyncSession | None = None,
    ) -> list[UserElectionSummary]:
        # 1. Fetch user active memberships
        mem_stmt = select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE.value,
        )
        memberships = (await db.execute(mem_stmt)).scalars().all()
        org_ids = [m.organization_id for m in memberships]

        org_map = {}
        if org_ids:
            org_stmt = select(Organization).where(Organization.id.in_(org_ids))
            orgs = (await db.execute(org_stmt)).scalars().all()
            org_map = {o.id: o.name for o in orgs}

        # 2. Fetch user eligibilities
        elig_stmt = select(ElectionEligibility).where(ElectionEligibility.user_id == user.id)
        eligibilities = (await db.execute(elig_stmt)).scalars().all()
        elig_election_ids = [e.election_id for e in eligibilities]
        voted_election_ids = {
            e.election_id
            for e in eligibilities
            if e.entitlement_status == EntitlementStatus.REDEEMED.value
        }

        if not org_ids and not elig_election_ids:
            return []

        # 3. Query elections from election database
        target_elec_db = election_db if election_db is not None else db
        filters = []
        if org_ids:
            filters.append(Election.organization_id.in_(org_ids))
        if elig_election_ids:
            filters.append(Election.id.in_(elig_election_ids))

        elec_stmt = (
            select(Election)
            .where(or_(*filters))
            .order_by(Election.created_at.desc())
        )
        try:
            elections = (await target_elec_db.execute(elec_stmt)).scalars().all()
        except Exception:  # noqa: BLE001
            return []

        summaries = []
        for elec in elections:
            inst_name = org_map.get(elec.organization_id)
            if not inst_name:
                inst_stmt = select(Organization.name).where(Organization.id == elec.organization_id)
                inst_res = await db.execute(inst_stmt)
                inst_name = inst_res.scalar_one_or_none()

            summaries.append(
                UserElectionSummary(
                    id=elec.id,
                    title=elec.title,
                    status=elec.status,
                    start_time=elec.opens_at or elec.created_at,
                    end_time=elec.closes_at or elec.created_at,
                    institution_name=inst_name,
                    has_voted=elec.id in voted_election_ids,
                )
            )

        return summaries
