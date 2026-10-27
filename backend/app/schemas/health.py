from typing import Literal

from pydantic import BaseModel, Field


class DatabaseHealthStatus(BaseModel):
    connected: bool = Field(..., description="Whether database is responsive")
    database: str = Field(..., description="Target database identifier")
    latency_ms: float = Field(..., description="Roundtrip query latency in milliseconds")
    error: str | None = Field(default=None, description="Connection error message if any")


class HealthStatus(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        ..., description="Overall service status"
    )
    environment: str = Field(..., description="Runtime environment")
    version: str = Field(..., description="Application version")


class ReadinessStatus(BaseModel):
    ready: bool = Field(..., description="Readiness for accepting client traffic")
    databases: dict[str, DatabaseHealthStatus] = Field(
        ..., description="Status of isolated databases"
    )
