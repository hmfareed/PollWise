import pytest

from app.db.session import check_database_health, create_engine_and_maker


@pytest.mark.asyncio
async def test_sqlite_engine_health():
    engine, _ = create_engine_and_maker("sqlite+aiosqlite:///:memory:")
    health = await check_database_health(engine, "test_memory_db")
    assert health.connected is True
    assert health.database == "test_memory_db"
    assert health.latency_ms >= 0.0
    assert health.error is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_unreachable_engine_health():
    engine, _ = create_engine_and_maker(
        "postgresql+asyncpg://invalid:invalid@localhost:9999/nonexistent"
    )
    health = await check_database_health(engine, "unreachable_db")
    assert health.connected is False
    assert health.database == "unreachable_db"
    assert health.error is not None
    await engine.dispose()
