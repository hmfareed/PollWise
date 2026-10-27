from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Authoritative Pollwise configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "Pollwise"
    APP_ENV: str = Field(
        default="development", description="development | testing | staging | production"
    )
    LOG_LEVEL: str = Field(default="INFO", description="Standard logging level")

    # Databases (Logical separation per ADR-001 and docs 03-06)
    IDENTITY_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/identity_db",
        description="Connection URL for Identity DB",
    )
    ELECTION_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/election_db",
        description="Connection URL for Election DB",
    )
    BALLOT_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/ballot_db",
        description="Connection URL for Ballot DB",
    )

    # Security & Sessions
    SESSION_SECRET: str = Field(
        default="pollwise-dev-session-secret-must-be-replaced-in-production-min32chars",
        description="Secret key for signing session cookies",
    )
    SESSION_IDLE_MINUTES: int = 60
    SESSION_ABSOLUTE_HOURS: int = 12
    SESSION_COOKIE_NAME: str = "pollwise_session"
    SESSION_COOKIE_SECURE: bool = False  # Set True in production
    SESSION_COOKIE_SAMESITE: str = "lax"

    # Origins & Boundaries
    FRONTEND_ORIGIN: str = Field(
        default="http://localhost:5173",
        description="Primary frontend origin for CORS",
    )
    ADDITIONAL_ALLOWED_ORIGINS: list[str] = []

    BALLOT_BOX_BASE_URL: str = Field(
        default="http://localhost:8000/ballot-box/v1",
        description="Base URL for the isolated ballot-box service",
    )
    BALLOT_BOX_SERVICE_TOKEN: str = Field(
        default="pollwise-internal-ballot-box-token-dev",
        description="Service-to-service auth token for internal coordination",
    )
    CREDENTIAL_HMAC_KEY: str = Field(
        default="pollwise-ballot-box-hmac-key-dev-only-change-in-prod",
        description="HMAC key used solely by ballot-box to decouple credential hashes",
    )
    CREDENTIAL_SIGNING_SECRET: str = Field(
        default="pollwise-credential-signing-secret-dev-min32chars",
        description="Secret key for signing single-use voter credentials",
    )

    # Operational Limits
    MAX_UPLOAD_MB: int = 10
    RATE_LIMIT_LOGIN_PER_MIN: int = 10
    EMAIL_PROVIDER_API_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.APP_ENV.lower() == "testing"

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.FRONTEND_ORIGIN]
        for orig in self.ADDITIONAL_ALLOWED_ORIGINS:
            if orig and orig not in origins:
                origins.append(orig)
        return origins

    @field_validator("SESSION_SECRET")
    @classmethod
    def validate_session_secret(cls, v: str, info) -> str:
        # In production, require strong secrets
        env = info.data.get("APP_ENV", "development")
        if env == "production" and (len(v) < 32 or "dev" in v):
            raise ValueError(
                "SESSION_SECRET must be at least 32 characters and not contain dev strings in production"
            )
        return v


settings = Settings()
