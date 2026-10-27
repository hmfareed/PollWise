import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db.base import IdentityBase
from app.db.session import get_identity_session
from app.main import app


@pytest_asyncio.fixture(scope="function")
async def test_identity_engine():
    """Create in-memory SQLite engine for identity tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)

    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_identity_session(test_identity_engine):
    """Provide an isolated async session for database operations."""
    session_maker = async_sessionmaker(
        bind=test_identity_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def test_client(test_identity_session):
    """Async HTTP test client with get_identity_session overridden."""

    async def override_get_identity_session():
        yield test_identity_session

    app.dependency_overrides[get_identity_session] = override_get_identity_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
