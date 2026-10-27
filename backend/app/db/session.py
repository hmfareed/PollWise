import time
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.schemas.health import DatabaseHealthStatus


def create_engine_and_maker(url: str) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create async SQLAlchemy engine and session factory with connection pooling."""
    is_sqlite = url.startswith("sqlite")
    kwargs = {"echo": False}
    if not is_sqlite:
        kwargs.update(
            {
                "pool_pre_ping": True,
                "pool_size": 10,
                "max_overflow": 20,
            }
        )
    engine = create_async_engine(url, **kwargs)
    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    return engine, session_maker


# Initialize isolated engines and session makers
identity_engine, identity_session_maker = create_engine_and_maker(settings.IDENTITY_DATABASE_URL)
election_engine, election_session_maker = create_engine_and_maker(settings.ELECTION_DATABASE_URL)
ballot_engine, ballot_session_maker = create_engine_and_maker(settings.BALLOT_DATABASE_URL)


async def get_identity_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an isolated Identity DB session."""
    async with identity_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_election_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an isolated Election DB session."""
    async with election_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_ballot_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an isolated Ballot DB session (Ballot-box service)."""
    async with ballot_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_database_health(engine: AsyncEngine, db_name: str) -> DatabaseHealthStatus:
    """Execute a low-overhead connectivity check against an engine."""
    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency = (time.perf_counter() - start) * 1000.0
        return DatabaseHealthStatus(
            connected=True,
            database=db_name,
            latency_ms=round(latency, 2),
            error=None,
        )
    except Exception as e:  # noqa: BLE001
        latency = (time.perf_counter() - start) * 1000.0
        return DatabaseHealthStatus(
            connected=False,
            database=db_name,
            latency_ms=round(latency, 2),
            error=str(e),
        )


async def check_all_databases() -> dict[str, DatabaseHealthStatus]:
    """Check connectivity to all three logically isolated databases."""
    return {
        "identity_db": await check_database_health(identity_engine, "identity_db"),
        "election_db": await check_database_health(election_engine, "election_db"),
        "ballot_db": await check_database_health(ballot_engine, "ballot_db"),
    }
