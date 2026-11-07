import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_election_create_and_update_with_photo_url(test_client: AsyncClient):
    # 1. Register & Login as institutional admin
    email = f"photo_admin_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "display_name": "Photo Admin"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )

    org_id = str(uuid.uuid4())

    # 2. Create election with photo_url
    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_id,
            "title": "SRC Presidential Election",
            "description": "Student Representative Council Election",
            "photo_url": "/static/uploads/elections/src-logo.png",
        },
    )
    assert create_res.status_code == 201
    election = create_res.json()["data"]
    assert election["photo_url"] == "/static/uploads/elections/src-logo.png"

    # 3. Fetch detail and check photo_url
    elec_id = election["id"]
    get_res = await test_client.get(f"/api/v1/elections/{elec_id}")
    assert get_res.status_code == 200
    assert get_res.json()["data"]["photo_url"] == "/static/uploads/elections/src-logo.png"

    # 4. Update election photo_url to a new URL
    patch_res = await test_client.patch(
        f"/api/v1/elections/{elec_id}",
        json={"photo_url": "/static/uploads/elections/src-logo-v2.png"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["photo_url"] == "/static/uploads/elections/src-logo-v2.png"

    # 5. Update election photo_url to None (removal)
    patch_clear = await test_client.patch(
        f"/api/v1/elections/{elec_id}",
        json={"photo_url": None},
    )
    assert patch_clear.status_code == 200
    assert patch_clear.json()["data"]["photo_url"] is None


@pytest.mark.asyncio
async def test_upload_election_photo(test_client: AsyncClient):
    import io
    email = f"photo_uploader_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "display_name": "Uploader"},
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )

    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    files = {"file": ("election_logo.png", io.BytesIO(fake_png), "image/png")}
    res = await test_client.post("/api/v1/uploads/election-photo", files=files)
    assert res.status_code == 201
    photo_url = res.json()["data"]["photo_url"]
    assert photo_url.startswith("/static/uploads/elections/")
    assert photo_url.endswith(".png")

    # Fetch static file to verify it was saved and served
    get_res = await test_client.get(photo_url)
    assert get_res.status_code == 200
    assert get_res.content == fake_png
