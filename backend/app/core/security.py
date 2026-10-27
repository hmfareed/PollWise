import base64
import hashlib
import hmac
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


def compute_hmac(key: str, data: str) -> str:
    """Compute an HMAC-SHA256 digest using a secret key."""
    return hmac.new(key.encode("utf-8"), data.encode("utf-8"), hashlib.sha256).hexdigest()


def sign_credential(secret_key: str, election_id: str, nonce: str) -> str:
    """
    Produce a tamper-proof election-scoped voting credential bearer token.
    Format: base64(election_id.nonce.sig)
    """
    raw_payload = f"{election_id}:{nonce}"
    sig = compute_hmac(secret_key, raw_payload)
    token_str = f"{raw_payload}:{sig}"
    return base64.urlsafe_b64encode(token_str.encode("utf-8")).decode("utf-8")


def verify_credential_signature(secret_key: str, credential_token: str) -> tuple[bool, str | None]:
    """
    Verify that the credential was signed by the election authority key.
    Returns (is_valid, election_id).
    """
    try:
        decoded = base64.urlsafe_b64decode(credential_token.encode("utf-8")).decode("utf-8")
        parts = decoded.split(":")
        if len(parts) != 3:
            return False, None
        election_id, nonce, sig = parts
        expected_sig = compute_hmac(secret_key, f"{election_id}:{nonce}")
        if not hmac.compare_digest(sig, expected_sig):
            return False, None
        return True, election_id
    except Exception:  # noqa: BLE001
        return False, None


def compute_ballot_redemption_hash(ballot_hmac_key: str, credential_token: str) -> str:
    """
    Compute a keyed HMAC-SHA256 hash of the credential token for ballot_db storage.
    Using a ballot-box-specific HMAC key guarantees that the hash stored in ballot_db
    cannot be correlated with identity_db credential hashes even if both DBs are dumped.
    """
    return compute_hmac(ballot_hmac_key, credential_token)


def generate_receipt_reference() -> str:
    """
    Generate a non-identifying random receipt reference for voter confirmation.
    Format: PW-XXXX-XXXX-XXXX
    """
    random_part = secrets.token_hex(6).upper()
    return f"PW-{random_part[0:4]}-{random_part[4:8]}-{random_part[8:12]}"


def ensure_utc(dt: datetime | None) -> datetime:
    """Ensure a datetime object is timezone-aware in UTC (accommodates SQLite naive returns)."""
    if dt is None:
        return datetime.now(UTC)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt
