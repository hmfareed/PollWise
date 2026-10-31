import pytest
from sqlalchemy import select

from app.models.identity import EmailVerificationToken, User


@pytest.mark.asyncio
async def test_register_and_login_flow(test_client, test_identity_session):
    # 1. Register
    reg_payload = {
        "email": "voter@university.edu",
        "password": "StrongPassword123!",
        "display_name": "Alice Voter",
    }
    res = await test_client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["email"] == "voter@university.edu"
    assert data["display_name"] == "Alice Voter"
    assert data["email_verified"] is False

    # 2. Duplicate registration rejected
    res_dup = await test_client.post("/api/v1/auth/register", json=reg_payload)
    assert res_dup.status_code == 422
    assert res_dup.json()["error"]["code"] == "VALIDATION_ERROR"

    # 3. Login
    login_payload = {
        "email": "voter@university.edu",
        "password": "StrongPassword123!",
    }
    res_login = await test_client.post("/api/v1/auth/login", json=login_payload)
    assert res_login.status_code == 200
    login_data = res_login.json()["data"]
    assert login_data["user"]["email"] == "voter@university.edu"

    # Verify session cookie was set
    assert "pollwise_session" in res_login.cookies

    # 4. Get Current User via session cookie
    res_me = await test_client.get("/api/v1/auth/me")
    assert res_me.status_code == 200
    me_data = res_me.json()["data"]
    assert me_data["user"]["email"] == "voter@university.edu"

    # 5. Logout
    res_logout = await test_client.post("/api/v1/auth/logout")
    assert res_logout.status_code == 200

    # 6. Access /me after logout fails
    res_me_after = await test_client.get("/api/v1/auth/me")
    assert res_me_after.status_code == 401
    assert res_me_after.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_email_verification(test_client, test_identity_session):
    # Register user
    reg_payload = {
        "email": "verify-me@university.edu",
        "password": "SecurePassword456!",
        "display_name": "Bob Verify",
    }
    await test_client.post("/api/v1/auth/register", json=reg_payload)

    # In tests, verify token existence
    stmt = (
        select(EmailVerificationToken)
        .join(User, User.id == EmailVerificationToken.user_id)
        .where(User.email_normalized == "verify-me@university.edu")
    )
    res = await test_identity_session.execute(stmt)
    token_rec = res.scalar_one()
    assert token_rec is not None
    assert token_rec.used_at is None

    # Attempting verification with wrong token
    res_bad = await test_client.post("/api/v1/auth/verify-email", json={"token": "invalid-token"})
    assert res_bad.status_code == 422
    assert res_bad.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_password_recovery(test_client, test_identity_session):
    # Register user
    reg_payload = {
        "email": "recover@university.edu",
        "password": "OldPassword123!",
        "display_name": "Charlie Recover",
    }
    await test_client.post("/api/v1/auth/register", json=reg_payload)

    # Request password recovery
    res_forgot = await test_client.post(
        "/api/v1/auth/forgot-password", json={"email": "recover@university.edu"}
    )
    assert res_forgot.status_code == 200
    assert "recovery instructions" in res_forgot.json()["data"]["message"]

    # Forgotten password for non-existent email returns generic success
    res_nonexistent = await test_client.post(
        "/api/v1/auth/forgot-password", json={"email": "nobody@university.edu"}
    )
    assert res_nonexistent.status_code == 200


@pytest.mark.asyncio
async def test_change_password(test_client):
    # 1. Register & Login
    reg_payload = {
        "email": "pwchange@university.edu",
        "password": "InitialPassword123!",
        "display_name": "Dave Change",
    }
    await test_client.post("/api/v1/auth/register", json=reg_payload)
    login_res = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@university.edu", "password": "InitialPassword123!"},
    )
    assert login_res.status_code == 200

    # 2. Change password with wrong current password
    bad_res = await test_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewValidPassword123!"},
    )
    assert bad_res.status_code == 422
    assert "Current password is incorrect" in bad_res.json()["error"]["message"]

    # 3. Change password successfully
    good_res = await test_client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "InitialPassword123!",
            "new_password": "NewValidPassword123!",
        },
    )
    assert good_res.status_code == 200
    assert "Password changed successfully" in good_res.json()["data"]["message"]

    # 4. Old password can no longer log in
    old_login = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@university.edu", "password": "InitialPassword123!"},
    )
    assert old_login.status_code == 401

    # 5. New password logs in successfully
    new_login = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@university.edu", "password": "NewValidPassword123!"},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_institutional_registration_and_resend_verification(test_client):
    # 1. Register Institution Account
    inst_payload = {
        "account_type": "institution",
        "first_name": "Dean",
        "last_name": "Henderson",
        "email": "dean.henderson@oxford-tech.edu",
        "password": "DeanSecurePassword2026!",
        "institution_name": "Oxford Institute of Technology",
        "institution_type": "University",
        "country": "United Kingdom",
        "terms_accepted": True,
    }
    res = await test_client.post("/api/v1/auth/register", json=inst_payload)
    assert res.status_code == 201
    user_data = res.json()["data"]
    assert user_data["display_name"] == "Dean Henderson"
    assert user_data["email"] == "dean.henderson@oxford-tech.edu"

    # 2. Login as the newly registered institution administrator
    login_res = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.henderson@oxford-tech.edu", "password": "DeanSecurePassword2026!"},
    )
    assert login_res.status_code == 200
    me = login_res.json()["data"]
    assert len(me["memberships"]) == 1
    assert me["memberships"][0]["organization_name"] == "Oxford Institute of Technology"
    assert me["memberships"][0]["role"] == "organization_admin"

    # 3. Resend email verification
    resend_res = await test_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "dean.henderson@oxford-tech.edu"},
    )
    assert resend_res.status_code == 200
    assert "confirmation link has been sent" in resend_res.json()["data"]["message"]

    # 4. Resend for non-existent email returns generic success (prevents account enumeration)
    generic_resend = await test_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "unknown-ghost@nowhere.edu"},
    )
    assert generic_resend.status_code == 200
