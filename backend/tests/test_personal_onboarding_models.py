import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models.identity import (
    InstitutionInvitation,
    Organization,
    PersonalOnboarding,
    User,
)


@pytest.fixture
def db_session(test_identity_session):
    return test_identity_session


@pytest.mark.asyncio
async def test_personal_onboarding_model_relationships(db_session):
    user = User(
        id=uuid.uuid4(),
        email_normalized="voter@example.com",
        password_hash="hash123",
        display_name="Alice Smith",
        first_name="Alice",
        last_name="Smith",
        account_type="personal",
        mfa_enabled=False,
    )
    db_session.add(user)
    await db_session.flush()

    onboarding = PersonalOnboarding(
        user_id=user.id,
        onboarding_status="in_progress",
        current_step=2,
    )
    db_session.add(onboarding)
    await db_session.commit()

    assert onboarding.user_id == user.id
    assert onboarding.current_step == 2
    assert onboarding.onboarding_status == "in_progress"


@pytest.mark.asyncio
async def test_institution_invitation_model(db_session):
    org = Organization(
        id=uuid.uuid4(),
        name="State University",
        slug="state-university",
        status="active",
    )
    db_session.add(org)
    await db_session.flush()

    invitation = InstitutionInvitation(
        id=uuid.uuid4(),
        institution_id=org.id,
        invitation_code="UNIV-2026-XYZ",
        invitation_type="member",
        expires_at=datetime.now(UTC) + timedelta(days=7),
        max_uses=10,
        used_count=0,
        status="active",
    )
    db_session.add(invitation)
    await db_session.commit()

    assert invitation.institution_id == org.id
    assert invitation.invitation_code == "UNIV-2026-XYZ"
    assert invitation.invitation_type == "member"
    assert invitation.max_uses == 10
    assert invitation.used_count == 0
    assert invitation.status == "active"
    assert invitation.institution.name == "State University"


@pytest.mark.asyncio
async def test_user_personal_profile_fields(db_session):
    user = User(
        id=uuid.uuid4(),
        email_normalized="bob@example.com",
        password_hash="hash456",
        display_name="Bob Jones",
        first_name="Bob",
        last_name="Jones",
        phone_number="+1-555-0199",
        profile_image_url="https://example.com/avatar.png",
        preferred_language="en",
        country="US",
        mfa_enabled=True,
        account_type="personal",
    )
    db_session.add(user)
    await db_session.flush()

    now = datetime.now(UTC)
    onboarding = PersonalOnboarding(
        user=user,
        onboarding_status="completed",
        current_step=4,
        profile_completed_at=now,
        security_setup_completed_at=now,
        institution_step_completed_at=now,
        completed_at=now,
    )
    db_session.add(onboarding)
    await db_session.commit()

    assert user.first_name == "Bob"
    assert user.last_name == "Jones"
    assert user.phone_number == "+1-555-0199"
    assert user.profile_image_url == "https://example.com/avatar.png"
    assert user.preferred_language == "en"
    assert user.country == "US"
    assert user.mfa_enabled is True
    assert user.account_type == "personal"
    assert user.personal_onboarding.id == onboarding.id
    assert onboarding.user.id == user.id
    assert onboarding.profile_completed_at == now
    assert onboarding.security_setup_completed_at == now
    assert onboarding.institution_step_completed_at == now
    assert onboarding.completed_at == now
