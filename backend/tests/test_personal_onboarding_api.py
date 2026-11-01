import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.identity import (
    EmailVerificationToken,
    OrganizationMembership,
    PersonalOnboarding,
    User,
)


@pytest.fixture
def client(test_client):
    return test_client


@pytest.mark.asyncio
async def test_personal_registration_and_onboarding_flow(client: AsyncClient, test_identity_session):
    payload = {
        "first_name": "  Jane  ",
        "last_name": "  Doe  ",
        "email": "Jane.Doe@example.com",
        "password": "SecurePassword123!",
        "terms_accepted": True,
    }
    resp = await client.post("/api/v1/auth/register/personal", json=payload)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["email"] == "jane.doe@example.com"
    assert data["display_name"] == "Jane Doe"
    assert data["first_name"] == "Jane"
    assert data["last_name"] == "Doe"
    assert data["email_verified"] is False
    assert data["account_type"] == "personal"
    assert data["mfa_enabled"] is False

    # Verify no organization membership was created
    user_stmt = select(User).where(User.email_normalized == "jane.doe@example.com")
    user_res = await test_identity_session.execute(user_stmt)
    user = user_res.scalar_one()

    mem_stmt = select(OrganizationMembership).where(OrganizationMembership.user_id == user.id)
    mem_res = await test_identity_session.execute(mem_stmt)
    assert mem_res.scalars().all() == []

    # Verify PersonalOnboarding initialized with step 1 and not_started
    onboarding_stmt = select(PersonalOnboarding).where(PersonalOnboarding.user_id == user.id)
    onboarding_res = await test_identity_session.execute(onboarding_stmt)
    onboarding = onboarding_res.scalar_one()
    assert onboarding.current_step == 1
    assert onboarding.onboarding_status == "not_started"

    # Verify email verification token generated
    tok_stmt = select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    tok_res = await test_identity_session.execute(tok_stmt)
    token_rec = tok_res.scalar_one_or_none()
    assert token_rec is not None


@pytest.mark.asyncio
async def test_personal_registration_validation(client: AsyncClient):
    # Duplicate email rejection
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "dup@example.com",
        "password": "SecurePassword123!",
        "terms_accepted": True,
    }
    resp1 = await client.post("/api/v1/auth/register/personal", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register/personal", json=payload)
    assert resp2.status_code == 422
    assert resp2.json()["error"]["code"] == "VALIDATION_ERROR"

    # Terms not accepted
    unaccepted_terms = {
        "first_name": "Bob",
        "last_name": "Smith",
        "email": "bob@example.com",
        "password": "SecurePassword123!",
        "terms_accepted": False,
    }
    resp_terms = await client.post("/api/v1/auth/register/personal", json=unaccepted_terms)
    assert resp_terms.status_code == 422

    # Short password
    short_pw = {
        "first_name": "Alice",
        "last_name": "Wonder",
        "email": "alice@example.com",
        "password": "short",
        "terms_accepted": True,
    }
    resp_short = await client.post("/api/v1/auth/register/personal", json=short_pw)
    assert resp_short.status_code == 422

    # Whitespace-only name rejected
    ws_name = {
        "first_name": "   ",
        "last_name": "Wonder",
        "email": "alice2@example.com",
        "password": "SecurePassword123!",
        "terms_accepted": True,
    }
    resp_ws = await client.post("/api/v1/auth/register/personal", json=ws_name)
    assert resp_ws.status_code == 422


@pytest.mark.asyncio
async def test_onboarding_and_profile_endpoints(client: AsyncClient, test_identity_session):
    # 1. Register
    reg_payload = {
        "first_name": "Mark",
        "last_name": "Twain",
        "email": "mark.twain@example.com",
        "password": "AdventurePassword123!",
        "terms_accepted": True,
    }
    reg_res = await client.post("/api/v1/auth/register/personal", json=reg_payload)
    assert reg_res.status_code == 201

    # 2. Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "mark.twain@example.com", "password": "AdventurePassword123!"},
    )
    assert login_res.status_code == 200

    # 3. Get onboarding status
    onb_res = await client.get("/api/v1/users/me/onboarding")
    assert onb_res.status_code == 200
    onb_data = onb_res.json()["data"]
    assert onb_data["current_step"] == 1
    assert onb_data["onboarding_status"] == "not_started"

    # 4. Update onboarding progress
    patch_onb = await client.patch(
        "/api/v1/users/me/onboarding",
        json={"current_step": 2, "onboarding_status": "in_progress"},
    )
    assert patch_onb.status_code == 200
    patched_data = patch_onb.json()["data"]
    assert patched_data["current_step"] == 2
    assert patched_data["onboarding_status"] == "in_progress"

    # 5. Complete onboarding progress
    complete_onb = await client.patch(
        "/api/v1/users/me/onboarding",
        json={"current_step": 5, "onboarding_status": "completed"},
    )
    assert complete_onb.status_code == 200
    comp_data = complete_onb.json()["data"]
    assert comp_data["current_step"] == 5
    assert comp_data["onboarding_status"] == "completed"
    assert comp_data["completed_at"] is not None

    # 6. Update user profile via /users/me/profile
    profile_payload = {
        "first_name": "Samuel",
        "last_name": "Clemens",
        "phone_number": "+1-555-0198",
        "country": "United States",
        "preferred_language": "en",
    }
    prof_res = await client.patch("/api/v1/users/me/profile", json=profile_payload)
    assert prof_res.status_code == 200
    user_data = prof_res.json()["data"]
    assert user_data["first_name"] == "Samuel"
    assert user_data["last_name"] == "Clemens"
    assert user_data["display_name"] == "Samuel Clemens"
    assert user_data["phone_number"] == "+1-555-0198"
    assert user_data["country"] == "United States"

    # 7. Update user profile via /users/me alias
    alias_res = await client.patch(
        "/api/v1/users/me",
        json={"display_name": "Mark Twain (Pen Name)"},
    )
    assert alias_res.status_code == 200
    assert alias_res.json()["data"]["display_name"] == "Mark Twain (Pen Name)"


@pytest.mark.asyncio
async def test_onboarding_milestone_timestamps(client: AsyncClient):
    reg_payload = {
        "first_name": "George",
        "last_name": "Eliot",
        "email": "george.eliot@example.com",
        "password": "MiddlemarchPassword123!",
        "terms_accepted": True,
    }
    await client.post("/api/v1/auth/register/personal", json=reg_payload)
    await client.post(
        "/api/v1/auth/login",
        json={"email": "george.eliot@example.com", "password": "MiddlemarchPassword123!"},
    )

    # Step 3 completes profile
    res_step3 = await client.patch(
        "/api/v1/users/me/onboarding",
        json={"current_step": 3},
    )
    assert res_step3.status_code == 200
    data3 = res_step3.json()["data"]
    assert data3["current_step"] == 3
    assert data3["profile_completed_at"] is not None

    # Step 4 completes security
    res_step4 = await client.patch(
        "/api/v1/users/me/onboarding",
        json={"current_step": 4},
    )
    assert res_step4.status_code == 200
    data4 = res_step4.json()["data"]
    assert data4["current_step"] == 4
    assert data4["security_setup_completed_at"] is not None

    # Step 5 completes institution and whole onboarding
    res_step5 = await client.patch(
        "/api/v1/users/me/onboarding",
        json={"current_step": 5},
    )
    assert res_step5.status_code == 200
    data5 = res_step5.json()["data"]
    assert data5["current_step"] == 5
    assert data5["institution_step_completed_at"] is not None
    assert data5["completed_at"] is not None
    assert data5["onboarding_status"] == "completed"


@pytest.mark.asyncio
async def test_auto_creates_missing_onboarding_for_existing_user(client: AsyncClient, test_identity_session):
    # Register an institutional or standard user without personal onboarding
    reg_payload = {
        "email": "existing_user@example.com",
        "password": "ExistingUserPassword123!",
        "display_name": "Existing User",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)
    await client.post(
        "/api/v1/auth/login",
        json={"email": "existing_user@example.com", "password": "ExistingUserPassword123!"},
    )

    # Calling /users/me/onboarding will lazily auto-create PersonalOnboarding
    res = await client.get("/api/v1/users/me/onboarding")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["current_step"] == 1
    assert data["onboarding_status"] == "not_started"


@pytest.mark.asyncio
async def test_unauthenticated_endpoints_rejected(client: AsyncClient):
    res1 = await client.get("/api/v1/users/me/onboarding")
    assert res1.status_code == 401

    res2 = await client.patch("/api/v1/users/me/onboarding", json={"current_step": 2})
    assert res2.status_code == 401

    res3 = await client.patch("/api/v1/users/me/profile", json={"first_name": "Anon"})
    assert res3.status_code == 401
