import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import app.models.ballot
import app.models.election
import app.models.identity
from app.db.base import BallotBase, ElectionBase, IdentityBase
from app.db.session import (
    get_ballot_session,
    get_election_session,
    get_identity_session,
)
from app.main import app


@pytest_asyncio.fixture(scope="function")
async def test_identity_engine():
    """Create in-memory SQLite engine for identity tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_election_engine():
    """Create in-memory SQLite engine for election tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(ElectionBase.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_ballot_engine():
    """Create in-memory SQLite engine for ballot tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(BallotBase.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_identity_session(test_identity_engine):
    """Provide an isolated async session for identity operations."""
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
async def test_election_session(test_election_engine):
    """Provide an isolated async session for election operations."""
    session_maker = async_sessionmaker(
        bind=test_election_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def test_ballot_session(test_ballot_engine):
    """Provide an isolated async session for ballot operations."""
    session_maker = async_sessionmaker(
        bind=test_ballot_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def test_client(test_identity_session, test_election_session, test_ballot_session):
    """Async HTTP test client with identity, election, and ballot sessions overridden."""

    async def override_get_identity_session():
        yield test_identity_session

    async def override_get_election_session():
        yield test_election_session

    async def override_get_ballot_session():
        yield test_ballot_session

    app.dependency_overrides[get_identity_session] = override_get_identity_session
    app.dependency_overrides[get_election_session] = override_get_election_session
    app.dependency_overrides[get_ballot_session] = override_get_ballot_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
