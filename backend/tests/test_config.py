import pytest

from app.core.config import Settings


def test_default_settings():
    settings = Settings()
    assert settings.APP_NAME == "Pollwise"
    assert settings.APP_ENV == "development"
    assert settings.is_production is False
    assert "http://localhost:5173" in settings.allowed_origins


def test_production_secret_validation():
    with pytest.raises(ValueError, match="SESSION_SECRET must be at least 32 characters"):
        Settings(
            APP_ENV="production",
            SESSION_SECRET="short-secret",
        )
