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
