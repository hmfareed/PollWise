from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiErrorDetail(BaseModel):
    code: str = Field(..., description="Stable machine-readable error code")
    message: str = Field(..., description="Human-readable error explanation")
    details: Any | None = Field(
        default=None, description="Optional field-level errors or diagnostic details"
    )


class ApiResponse(BaseModel, Generic[T]):  # noqa: UP046
    """Standardized top-level response envelope for all Pollwise API endpoints."""

    data: T | None = Field(default=None, description="Response payload on success")
    error: ApiErrorDetail | None = Field(default=None, description="Error detail on failure")
