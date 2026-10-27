import pytest

from app.db import session as db_session
from app.schemas.health import DatabaseHealthStatus


@pytest.mark.asyncio
async def test_root_endpoint(test_client):
    response = await test_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Pollwise API"
    assert data["status"] == "operational"


@pytest.mark.asyncio
async def test_health_endpoint(test_client):
    response = await test_client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["error"] is None
    assert payload["data"]["status"] == "healthy"
    assert payload["data"]["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_readiness_endpoint_all_healthy(test_client, monkeypatch):
    async def mock_check_all():
        return {
            "identity_db": DatabaseHealthStatus(
                connected=True, database="identity_db", latency_ms=1.2
            ),
            "election_db": DatabaseHealthStatus(
                connected=True, database="election_db", latency_ms=0.9
            ),
            "ballot_db": DatabaseHealthStatus(connected=True, database="ballot_db", latency_ms=1.0),
        }

    monkeypatch.setattr(db_session, "check_all_databases", mock_check_all)

    response = await test_client.get("/api/v1/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["error"] is None
    assert payload["data"]["ready"] is True
    assert payload["data"]["databases"]["identity_db"]["connected"] is True


@pytest.mark.asyncio
async def test_readiness_endpoint_degraded(test_client, monkeypatch):
    async def mock_check_all_degraded():
        return {
            "identity_db": DatabaseHealthStatus(
                connected=True, database="identity_db", latency_ms=1.2
            ),
            "election_db": DatabaseHealthStatus(
                connected=False, database="election_db", latency_ms=10.0, error="Connection refused"
            ),
            "ballot_db": DatabaseHealthStatus(connected=True, database="ballot_db", latency_ms=1.0),
        }

    monkeypatch.setattr(db_session, "check_all_databases", mock_check_all_degraded)

    response = await test_client.get("/api/v1/ready")
    assert response.status_code == 503
    payload = response.json()
    assert payload["data"]["ready"] is False
    assert payload["data"]["databases"]["election_db"]["connected"] is False
