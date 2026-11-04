import io
import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_candidate_photo_upload_and_serving(test_client: AsyncClient):
    # 1. Register & login
    email = f"photo_admin_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "display_name": "Photo Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )

    # 2. Upload valid PNG image
    fake_png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    files = {"file": ("avatar.png", io.BytesIO(fake_png_bytes), "image/png")}
    res = await test_client.post("/api/v1/uploads/candidate-photo", files=files)
    assert res.status_code in (200, 201), res.text
    data = res.json()["data"]
    assert "photo_url" in data
    photo_url = data["photo_url"]
    assert photo_url.startswith("/static/uploads/candidates/")
    assert photo_url.endswith(".png")

    # 3. Retrieve uploaded image via static file serving
    get_res = await test_client.get(photo_url)
    assert get_res.status_code == 200
    assert get_res.content == fake_png_bytes

    # 4. Attempt upload of disallowed mime type / extension
    bad_files = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}
    bad_res = await test_client.post("/api/v1/uploads/candidate-photo", files=bad_files)
    assert bad_res.status_code == 400
    assert "Invalid image format" in bad_res.text or "Only image files" in bad_res.text

    # 5. Attempt upload exceeding max size (e.g. 5MB)
    huge_bytes = b"0" * (5 * 1024 * 1024 + 1024)
    huge_files = {"file": ("big.jpg", io.BytesIO(huge_bytes), "image/jpeg")}
    huge_res = await test_client.post("/api/v1/uploads/candidate-photo", files=huge_files)
    assert huge_res.status_code in (400, 413)
    assert "exceeds" in huge_res.text.lower() or "size" in huge_res.text.lower()

    # 6. Verify candidate creation accepts photo_url
    from datetime import UTC, datetime, timedelta
    now = datetime.now(UTC)
    create_elec = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(uuid.uuid4()),
            "title": "Photo Election",
            "opens_at": (now + timedelta(days=1)).isoformat(),
            "closes_at": (now + timedelta(days=2)).isoformat(),
        },
    )
    election_id = create_elec.json()["data"]["id"]

    create_pos = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "President", "max_selections": 1},
    )
    position_id = create_pos.json()["data"]["id"]

    create_cand = await test_client.post(
        f"/api/v1/positions/{position_id}/candidates",
        json={
            "name": "Alex Smith",
            "biography": "Platform statement",
            "photo_url": photo_url,
            "display_order": 1,
        },
    )
    assert create_cand.status_code == 201
    cand_data = create_cand.json()["data"]
    assert cand_data["name"] == "Alex Smith"
    assert cand_data["photo_url"] == photo_url

    # Check election detail includes candidate photo_url
    get_elec = await test_client.get(f"/api/v1/elections/{election_id}")
    assert get_elec.status_code == 200
    pos_detail = get_elec.json()["data"]["positions"][0]
    cand_detail = pos_detail["candidates"][0]
    assert cand_detail["photo_url"] == photo_url
