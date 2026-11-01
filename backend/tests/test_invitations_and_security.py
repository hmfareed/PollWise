import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.models.election import Election, ElectionStatus
from app.models.identity import (
    ElectionEligibility,
    EntitlementStatus,
    InstitutionInvitation,
    InvitationStatus,
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    PersonalOnboarding,
    User,
)


@pytest_asyncio.fixture
async def authenticated_personal_client(test_client: AsyncClient):
    payload = {
        "first_name": "Sam",
        "last_name": "Voter",
        "email": "sam.voter@example.com",
        "password": "Password123!",
        "terms_accepted": True,
    }
    reg_resp = await test_client.post("/api/v1/auth/register/personal", json=payload)
    assert reg_resp.status_code == 201

    login_resp = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "sam.voter@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    return test_client


@pytest_asyncio.fixture
async def test_org(test_identity_session):
    org = Organization(
        id=uuid.uuid4(),
        name="State University",
        slug="state-university",
        status="active",
    )
    test_identity_session.add(org)
    await test_identity_session.commit()
    await test_identity_session.refresh(org)
    return org


@pytest.mark.asyncio
async def test_invitation_validate_and_accept(
    authenticated_personal_client: AsyncClient, test_org, test_identity_session
):
    # 1. Validate invalid code -> 404
    bad_res = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/validate",
        json={"invitation_code": "INVALID-CODE"},
    )
    assert bad_res.status_code == 404
    assert bad_res.json()["error"]["code"] == "NOT_FOUND"

    # 2. Create active invitation
    invitation = InstitutionInvitation(
        id=uuid.uuid4(),
        institution_id=test_org.id,
        invitation_code="CAMPUS-VOTE-2026",
        invitation_type="member",
        expires_at=datetime.now(UTC) + timedelta(days=7),
        max_uses=5,
        used_count=0,
        status=InvitationStatus.ACTIVE.value,
    )
    test_identity_session.add(invitation)
    await test_identity_session.commit()

    # 3. Validate valid invitation (test whitespace and case normalization)
    val_res = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/validate",
        json={"invitation_code": "  campus-vote-2026  "},
    )
    assert val_res.status_code == 200
    val_data = val_res.json()["data"]
    assert val_data["invitation_code"] == "CAMPUS-VOTE-2026"
    assert val_data["institution_id"] == str(test_org.id)
    assert val_data["institution_name"] == "State University"
    assert val_data["invitation_type"] == "member"

    # 4. Accept valid invitation
    accept_res = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/accept",
        json={"invitation_code": "campus-vote-2026"},
    )
    assert accept_res.status_code == 200

    # Verify membership created in database
    user_stmt = select(User).where(User.email_normalized == "sam.voter@example.com")
    user_res = await test_identity_session.execute(user_stmt)
    user = user_res.scalar_one()

    mem_stmt = select(OrganizationMembership).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.organization_id == test_org.id,
    )
    mem_res = await test_identity_session.execute(mem_stmt)
    membership = mem_res.scalar_one()
    assert membership.role == OrganizationRole.MEMBER.value
    assert membership.status == MembershipStatus.ACTIVE.value

    # Verify invitation used_count incremented
    await test_identity_session.refresh(invitation)
    assert invitation.used_count == 1

    # Verify onboarding institution_step_completed_at updated
    onb_stmt = select(PersonalOnboarding).where(PersonalOnboarding.user_id == user.id)
    onb_res = await test_identity_session.execute(onb_stmt)
    onboarding = onb_res.scalar_one()
    assert onboarding.institution_step_completed_at is not None

    # 5. Accepting again is idempotent and doesn't duplicate membership or increment used_count
    accept_again = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/accept",
        json={"invitation_code": "campus-vote-2026"},
    )
    assert accept_again.status_code == 200
    await test_identity_session.refresh(invitation)
    assert invitation.used_count == 1


@pytest.mark.asyncio
async def test_invitation_expiry_and_exhaustion(
    authenticated_personal_client: AsyncClient, test_org, test_identity_session
):
    # Expired invitation
    expired_inv = InstitutionInvitation(
        id=uuid.uuid4(),
        institution_id=test_org.id,
        invitation_code="EXPIRED-INVITE",
        invitation_type="member",
        expires_at=datetime.now(UTC) - timedelta(days=1),
        max_uses=10,
        used_count=0,
        status=InvitationStatus.ACTIVE.value,
    )
    test_identity_session.add(expired_inv)

    # Exhausted invitation
    exhausted_inv = InstitutionInvitation(
        id=uuid.uuid4(),
        institution_id=test_org.id,
        invitation_code="EXHAUSTED-INVITE",
        invitation_type="member",
        expires_at=datetime.now(UTC) + timedelta(days=1),
        max_uses=1,
        used_count=1,
        status=InvitationStatus.EXHAUSTED.value,
    )
    test_identity_session.add(exhausted_inv)
    await test_identity_session.commit()

    # Expired check
    res_exp = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/validate",
        json={"invitation_code": "EXPIRED-INVITE"},
    )
    assert res_exp.status_code == 400

    # Exhausted check
    res_exh = await authenticated_personal_client.post(
        "/api/v1/institutions/invitations/validate",
        json={"invitation_code": "EXHAUSTED-INVITE"},
    )
    assert res_exh.status_code == 400


@pytest.mark.asyncio
async def test_mfa_setup_and_verify(
    authenticated_personal_client: AsyncClient, test_identity_session
):
    # 1. Setup MFA
    setup_res = await authenticated_personal_client.post("/api/v1/users/me/mfa/setup")
    assert setup_res.status_code == 200
    setup_data = setup_res.json()["data"]
    assert "secret" in setup_data and len(setup_data["secret"]) > 10
    assert "qr_uri" in setup_data and setup_data["qr_uri"].startswith("otpauth://totp/")
    assert "recovery_codes" in setup_data and len(setup_data["recovery_codes"]) == 8

    # 2. Verify with invalid code length (< 6)
    bad_verify = await authenticated_personal_client.post(
        "/api/v1/users/me/mfa/verify",
        json={"code": "123"},
    )
    assert bad_verify.status_code == 422

    # 3. Verify with valid 6-digit code
    verify_res = await authenticated_personal_client.post(
        "/api/v1/users/me/mfa/verify",
        json={"code": "123456"},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()["data"]
    assert verify_data.get("mfa_enabled") is True

    # Check user record in DB
    user_stmt = select(User).where(User.email_normalized == "sam.voter@example.com")
    user_res = await test_identity_session.execute(user_stmt)
    user = user_res.scalar_one()
    assert user.mfa_enabled is True

    # Check PersonalOnboarding milestone timestamp
    onb_stmt = select(PersonalOnboarding).where(PersonalOnboarding.user_id == user.id)
    onb_res = await test_identity_session.execute(onb_stmt)
    onboarding = onb_res.scalar_one()
    assert onboarding.security_setup_completed_at is not None

    # Check /api/v1/auth/me reflects mfa_enabled = True
    me_res = await authenticated_personal_client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["data"]["user"]["mfa_enabled"] is True


@pytest.mark.asyncio
async def test_user_elections_endpoint(
    authenticated_personal_client: AsyncClient,
    test_org,
    test_identity_session,
    test_election_session,
):
    # Initial state: 0 elections
    empty_res = await authenticated_personal_client.get("/api/v1/users/me/elections")
    assert empty_res.status_code == 200
    assert empty_res.json()["data"] == []

    # Get user
    user_stmt = select(User).where(User.email_normalized == "sam.voter@example.com")
    user_res = await test_identity_session.execute(user_stmt)
    user = user_res.scalar_one()

    # Add user to test_org
    membership = OrganizationMembership(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        user_id=user.id,
        role=OrganizationRole.MEMBER.value,
        status=MembershipStatus.ACTIVE.value,
    )
    test_identity_session.add(membership)
    await test_identity_session.commit()

    # Create election under test_org
    now = datetime.now(UTC)
    election = Election(
        id=uuid.uuid4(),
        organization_id=test_org.id,
        title="Student Government 2026",
        description="Annual SG election",
        status=ElectionStatus.OPEN,
        opens_at=now - timedelta(hours=1),
        closes_at=now + timedelta(days=2),
        created_by=user.id,
    )
    test_election_session.add(election)
    await test_election_session.commit()

    # Query elections endpoint
    elec_res = await authenticated_personal_client.get("/api/v1/users/me/elections")
    assert elec_res.status_code == 200
    elec_data = elec_res.json()["data"]
    assert len(elec_data) == 1
    assert elec_data[0]["id"] == str(election.id)
    assert elec_data[0]["title"] == "Student Government 2026"
    assert elec_data[0]["status"] == "open"
    assert elec_data[0]["institution_name"] == "State University"
    assert elec_data[0]["has_voted"] is False

    # Simulate user voting (entitlement redeemed)
    eligibility = ElectionEligibility(
        id=uuid.uuid4(),
        election_id=election.id,
        user_id=user.id,
        eligibility_status="eligible",
        entitlement_status=EntitlementStatus.REDEEMED.value,
    )
    test_identity_session.add(eligibility)
    await test_identity_session.commit()

    voted_res = await authenticated_personal_client.get("/api/v1/users/me/elections")
    assert voted_res.status_code == 200
    voted_data = voted_res.json()["data"]
    assert voted_data[0]["has_voted"] is True


@pytest.mark.asyncio
async def test_update_onboarding_request_enum_validation(
    authenticated_personal_client: AsyncClient,
):
    # Invalid onboarding status string should trigger 422
    bad_res = await authenticated_personal_client.patch(
        "/api/v1/users/me/onboarding",
        json={"onboarding_status": "bogus_status"},
    )
    assert bad_res.status_code == 422

    # Valid onboarding status succeeds
    good_res = await authenticated_personal_client.patch(
        "/api/v1/users/me/onboarding",
        json={"onboarding_status": "in_progress"},
    )
    assert good_res.status_code == 200
    assert good_res.json()["data"]["onboarding_status"] == "in_progress"


@pytest.mark.asyncio
async def test_unauthenticated_endpoints_rejected(test_client: AsyncClient):
    endpoints = [
        ("POST", "/api/v1/users/me/mfa/setup"),
        ("POST", "/api/v1/users/me/mfa/verify"),
        ("POST", "/api/v1/institutions/invitations/accept"),
        ("GET", "/api/v1/users/me/elections"),
    ]
    for method, path in endpoints:
        if method == "POST":
            res = await test_client.post(path, json={})
        else:
            res = await test_client.get(path)
        assert res.status_code == 401, f"{path} did not reject unauthenticated request"
