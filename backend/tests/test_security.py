from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_argon2id_password_hashing():
    password = "SuperSecurePassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_token_generation_and_hashing():
    token1 = generate_secure_token(32)
    token2 = generate_secure_token(32)

    assert token1 != token2
    assert len(token1) >= 40

    hash1 = hash_token(token1)
    hash2 = hash_token(token2)

    assert len(hash1) == 64  # SHA-256 hex string
    assert hash1 != hash2
    assert hash_token(token1) == hash1
