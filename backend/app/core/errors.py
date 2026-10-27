from enum import Enum
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MALFORMED_REQUEST = "MALFORMED_REQUEST"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    REAUTH_REQUIRED = "REAUTH_REQUIRED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    CREDENTIAL_ALREADY_ISSUED = "CREDENTIAL_ALREADY_ISSUED"
    ELECTION_NOT_OPEN = "ELECTION_NOT_OPEN"
    ELECTION_CLOSED = "ELECTION_CLOSED"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    CONFIG_LOCKED = "CONFIG_LOCKED"
    CREDENTIAL_INVALID = "CREDENTIAL_INVALID"
    CREDENTIAL_WRONG_ELECTION = "CREDENTIAL_WRONG_ELECTION"
    BALLOT_ALREADY_ACCEPTED = "BALLOT_ALREADY_ACCEPTED"
    BALLOT_INVALID = "BALLOT_INVALID"
    CONFIG_HASH_MISMATCH = "CONFIG_HASH_MISMATCH"
    IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"
    IDENTITY_FIELD_REJECTED = "IDENTITY_FIELD_REJECTED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    RESULTS_NOT_PUBLISHED = "RESULTS_NOT_PUBLISHED"
    IMPORT_INVALID = "IMPORT_INVALID"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# Use UNPROCESSABLE_CONTENT (status 422)
HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)

ERROR_STATUS_MAP: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION_ERROR: HTTP_422,
    ErrorCode.MALFORMED_REQUEST: status.HTTP_400_BAD_REQUEST,
    ErrorCode.UNAUTHENTICATED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.SESSION_EXPIRED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.REAUTH_REQUIRED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.FORBIDDEN: status.HTTP_403_FORBIDDEN,
    ErrorCode.NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.EMAIL_NOT_VERIFIED: status.HTTP_403_FORBIDDEN,
    ErrorCode.NOT_ELIGIBLE: status.HTTP_403_FORBIDDEN,
    ErrorCode.CREDENTIAL_ALREADY_ISSUED: status.HTTP_409_CONFLICT,
    ErrorCode.ELECTION_NOT_OPEN: status.HTTP_409_CONFLICT,
    ErrorCode.ELECTION_CLOSED: status.HTTP_409_CONFLICT,
    ErrorCode.INVALID_STATE_TRANSITION: status.HTTP_409_CONFLICT,
    ErrorCode.CONFIG_LOCKED: status.HTTP_409_CONFLICT,
    ErrorCode.CREDENTIAL_INVALID: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.CREDENTIAL_WRONG_ELECTION: status.HTTP_403_FORBIDDEN,
    ErrorCode.BALLOT_ALREADY_ACCEPTED: status.HTTP_409_CONFLICT,
    ErrorCode.BALLOT_INVALID: HTTP_422,
    ErrorCode.CONFIG_HASH_MISMATCH: status.HTTP_409_CONFLICT,
    ErrorCode.IDEMPOTENCY_CONFLICT: status.HTTP_409_CONFLICT,
    ErrorCode.IDENTITY_FIELD_REJECTED: HTTP_422,
    ErrorCode.APPROVAL_REQUIRED: status.HTTP_409_CONFLICT,
    ErrorCode.RESULTS_NOT_PUBLISHED: status.HTTP_403_FORBIDDEN,
    ErrorCode.IMPORT_INVALID: HTTP_422,
    ErrorCode.RATE_LIMITED: status.HTTP_429_TOO_MANY_REQUESTS,
    ErrorCode.INTERNAL_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


class AppException(Exception):
    """Domain-specific exception mapping directly to standardized API errors."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int | None = None,
        details: Any | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code or ERROR_STATUS_MAP.get(code, status.HTTP_400_BAD_REQUEST)
        self.details = details
        super().__init__(message)


def create_error_response(
    code: str,
    message: str,
    status_code: int,
    details: Any | None = None,
) -> JSONResponse:
    error_payload = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_payload["details"] = details

    return JSONResponse(
        status_code=status_code,
        content={
            "data": None,
            "error": error_payload,
        },
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return create_error_response(
        code=exc.code.value,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = []
    for err in exc.errors():
        details.append(
            {
                "loc": err.get("loc"),
                "msg": err.get("msg"),
                "type": err.get("type"),
            }
        )
    return create_error_response(
        code=ErrorCode.VALIDATION_ERROR.value,
        message="Request validation failed",
        status_code=HTTP_422,
        details=details,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = ErrorCode.INTERNAL_ERROR.value
    if exc.status_code == status.HTTP_404_NOT_FOUND:
        code = ErrorCode.NOT_FOUND.value
    elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = ErrorCode.UNAUTHENTICATED.value
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = ErrorCode.FORBIDDEN.value
    elif exc.status_code == status.HTTP_400_BAD_REQUEST:
        code = ErrorCode.MALFORMED_REQUEST.value

    return create_error_response(
        code=code,
        message=str(exc.detail) if exc.detail else "An HTTP error occurred",
        status_code=exc.status_code,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Do not leak internal stack traces or internal details in responses
    return create_error_response(
        code=ErrorCode.INTERNAL_ERROR.value,
        message="An unexpected server error occurred",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
