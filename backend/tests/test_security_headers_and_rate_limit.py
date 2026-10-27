import pytest

from app.core.rate_limit import SlidingWindowRateLimiter


@pytest.mark.asyncio
async def test_security_response_headers(test_client):
    """Verify that every HTTP response carries strict security and isolation headers."""
    res = await test_client.get("/")
    assert res.status_code == 200
    headers = res.headers

    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "camera=()" in headers["Permissions-Policy"]
    assert "default-src 'self'" in headers["Content-Security-Policy"]


@pytest.mark.asyncio
async def test_anti_caching_headers_on_sensitive_endpoints(test_client):
    """Verify that authentication and ballot endpoints disable browser caching."""
    # Auth endpoint (401 or 422 still returns response headers with no-store)
    res = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@test.com", "password": "wrongpassword123"},
    )
    assert "no-store" in res.headers.get("Cache-Control", "")
    assert res.headers.get("Pragma") == "no-cache"

    # Ballot-box endpoint
    res_bb = await test_client.post("/ballot-box/v1/ballots", json={})
    assert "no-store" in res_bb.headers.get("Cache-Control", "")
    assert res_bb.headers.get("Pragma") == "no-cache"


@pytest.mark.asyncio
async def test_sliding_window_rate_limiter_logic():
    """Verify that SlidingWindowRateLimiter tracks hits and blocks after threshold."""
    test_limiter = SlidingWindowRateLimiter()
    key = "test_ip_127_0_0_1"
    max_reqs = 3
    window = 10

    # 3 allowed requests
    for _ in range(max_reqs):
        allowed, retry_after = await test_limiter.is_allowed(key, max_reqs, window)
        assert allowed is True
        assert retry_after == 0

    # 4th request must be rejected
    allowed, retry_after = await test_limiter.is_allowed(key, max_reqs, window)
    assert allowed is False
    assert retry_after > 0
