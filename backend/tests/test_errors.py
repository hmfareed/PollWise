import pytest

from app.core.errors import AppException, ErrorCode


def test_app_exception_status_mapping():
    exc = AppException(code=ErrorCode.BALLOT_ALREADY_ACCEPTED, message="Entitlement already used")
    assert exc.code == ErrorCode.BALLOT_ALREADY_ACCEPTED
    assert exc.status_code == 409
    assert exc.message == "Entitlement already used"


def test_custom_status_code_override():
    exc = AppException(
        code=ErrorCode.VALIDATION_ERROR, message="Custom validation", status_code=400
    )
    assert exc.status_code == 400


@pytest.mark.asyncio
async def test_error_envelope_format(test_client):
    # Request a non-existent route to trigger the 404 handler
    response = await test_client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404
    body = response.json()
    assert body["data"] is None
    assert body["error"]["code"] == "NOT_FOUND"
    assert "Not Found" in body["error"]["message"]
