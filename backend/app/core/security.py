import hashlib
import secrets
from datetime import UTC, datetime

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Initialize Argon2id hasher with secure parameters
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MB
    parallelism=1,
    hash_len=32,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):  # noqa: BLE001
        return False


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a high-entropy cryptographically secure random token."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    """Hash a sensitive token using SHA-256 for persistent database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def ensure_utc(dt: datetime | None) -> datetime:
    """Ensure a datetime object is timezone-aware in UTC (accommodates SQLite naive returns)."""
    if dt is None:
        return datetime.now(UTC)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt
