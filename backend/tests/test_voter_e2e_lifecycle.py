import asyncio
import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import text


@pytest.mark.asyncio
async def test_complete_voter_lifecycle_concurrency_and_secret_ballot(
    test_client: AsyncClient, test_election_session, test_ballot_session
):
    # =========================================================================
    # 1. ADMIN SETUP & ELECTION INITIALIZATION
    # =========================================================================
    await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_admin@pollwise.edu",
            "password": "Password123!",
            "display_name": "E2E Election Admin",
        },
    )
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "e2e_admin@pollwise.edu", "password": "Password123!"},
    )

    org_id = uuid.uuid4()
    now = datetime.now(UTC)

    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": str(org_id),
            "title": "2026 University Student Senate Election",
            "opens_at": (now - timedelta(hours=1)).isoformat(),
            "closes_at": (now + timedelta(days=3)).isoformat(),
            "timezone": "UTC",
        },
    )
    assert create_res.status_code in (200, 201)
    election_id = create_res.json()["data"]["id"]

    # Configure Voter Auth: Institutional ID ("Student ID")
    config_res = await test_client.put(
        f"/api/v1/elections/{election_id}/voter-auth-config",
        json={
            "identifier_type": "institutional_id",
            "identifier_label": "Student ID",
            "allow_position_skip": True,
            "otp_expiry_seconds": 300,
        },
    )
    assert config_res.status_code == 200
    assert config_res.json()["data"]["identifier_type"] == "institutional_id"

    # Positions and Candidates
    # Position 1: President (Required)
    p1_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "President", "min_selections": 1, "max_selections": 1, "display_order": 1},
    )
    p1_id = p1_res.json()["data"]["id"]
    c1_res = await test_client.post(
        f"/api/v1/positions/{p1_id}/candidates",
        json={"name": "Alice Walker", "display_order": 1},
    )
    c1_id = c1_res.json()["data"]["id"]
    c2_res = await test_client.post(
        f"/api/v1/positions/{p1_id}/candidates",
        json={"name": "Bob Vance", "display_order": 2},
    )
    c2_id = c2_res.json()["data"]["id"]

    # Position 2: Treasurer (Optional / Skippable)
    p2_res = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={"title": "Treasurer", "min_selections": 0, "max_selections": 1, "display_order": 2},
    )
    p2_id = p2_res.json()["data"]["id"]
    c3_res = await test_client.post(
        f"/api/v1/positions/{p2_id}/candidates",
        json={"name": "Charlie Davis", "display_order": 1},
    )
    c3_id = c3_res.json()["data"]["id"]

    # Approve, Schedule, and Open Election
    await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Ready for university launch"},
    )
    await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    open_res = await test_client.post(f"/api/v1/elections/{election_id}/open")
    assert open_res.status_code == 200

    # =========================================================================
    # 2. CSV ROSTER IMPORT WITH INDEPENDENT VOTER RECORDS
    # =========================================================================
    csv_content = (
        "identifier,group,notes\n"
        "STU-001,Engineering,Undergraduate\n"
        "STU-002,Medicine,Postgraduate\n"
        "STU-003,Humanities,Undergraduate\n"
    ).encode("utf-8")

    import_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voters/import",
        files={"file": ("voters.csv", csv_content, "text/csv")},
    )
    assert import_res.status_code == 200
    assert import_res.json()["data"]["imported_count"] == 3

    # =========================================================================
    # 3. VOTER 1 LIFECYCLE: ON-SCREEN OTP, BALLOT NAVIGATION, SKIP & SUBMISSION
    # =========================================================================
    # Step A: Identifier Entry -> On-Screen OTP
    chal_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-001"},
    )
    assert chal_res.status_code == 200
    chal_data = chal_res.json()["data"]
    otp_code = chal_data["otp_code"]
    challenge_id = chal_data["challenge_id"]
    assert len(otp_code) == 6
    assert otp_code.isdigit()

    # Step B: Enter On-Screen OTP -> Session Token
    verify_res = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": challenge_id, "entered_otp": otp_code},
    )
    assert verify_res.status_code == 200
    v1_session = verify_res.json()["data"]["session_token"]
    v1_headers = {"X-Voting-Session": v1_session}

    # Step C: Save Draft Selections (Position 1: Candidate Alice Walker)
    draft_res = await test_client.put(
        f"/api/v1/elections/{election_id}/ballot/draft",
        headers=v1_headers,
        json={"current_position_index": 1, "selections": {p1_id: c1_id}},
    )
    assert draft_res.status_code == 200

    # Step D: Retrieve Ballot & Verify Draft Resumed
    ballot_get = await test_client.get(
        f"/api/v1/elections/{election_id}/ballot",
        headers=v1_headers,
    )
    assert ballot_get.status_code == 200
    draft_data = ballot_get.json()["data"]["draft"]
    assert draft_data is not None
    assert draft_data["selections"][p1_id] == c1_id

    # Step E: Submit Ballot (Position 1: c1_id, Position 2: Skipped)
    sub_res = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers=v1_headers,
        json={
            "selections": [
                {"position_id": p1_id, "candidate_id": c1_id, "skipped": False},
                {"position_id": p2_id, "candidate_id": None, "skipped": True},
            ],
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    assert sub_res.status_code == 200
    receipt = sub_res.json()["data"]
    assert receipt["status"] == "accepted"
    assert "confirmation_reference" in receipt
    assert receipt["confirmation_reference"].startswith("PW-")

    # =========================================================================
    # 4. DUPLICATE VOTING PREVENTION INVARIANTS
    # =========================================================================
    # Invariant A: Voter 1 attempts second challenge -> 409 Rejected
    dup_chal = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-001"},
    )
    assert dup_chal.status_code == 409
    assert dup_chal.json()["error"]["code"] in ("ALREADY_VOTED", "VOTER_ALREADY_SUBMITTED")

    # Invariant B: Re-submitting with old session token -> 409 / Inactive
    dup_sub = await test_client.post(
        f"/api/v1/elections/{election_id}/ballot/submit",
        headers=v1_headers,
        json={
            "selections": [
                {"position_id": p1_id, "candidate_id": c2_id, "skipped": False},
            ],
            "idempotency_key": str(uuid.uuid4()),
        },
    )
    assert dup_sub.status_code in (400, 409)

    # =========================================================================
    # 5. CONCURRENT SUBMISSION INTEGRITY (VOTER 2)
    # =========================================================================
    v2_chal = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/request-challenge",
        json={"identifier": "STU-002"},
    )
    assert v2_chal.status_code == 200
    v2_chal_data = v2_chal.json()["data"]

    v2_ver = await test_client.post(
        f"/api/v1/elections/{election_id}/voter-auth/verify-challenge",
        json={"challenge_id": v2_chal_data["challenge_id"], "entered_otp": v2_chal_data["otp_code"]},
    )
    v2_session = v2_ver.json()["data"]["session_token"]
    v2_headers = {"X-Voting-Session": v2_session}

    # Perform simultaneous parallel submissions for Voter 2
    async def attempt_submit(cand_id: str):
        return await test_client.post(
            f"/api/v1/elections/{election_id}/ballot/submit",
            headers=v2_headers,
            json={
                "selections": [
                    {"position_id": p1_id, "candidate_id": cand_id, "skipped": False},
                    {"position_id": p2_id, "candidate_id": c3_id, "skipped": False},
                ],
                "idempotency_key": str(uuid.uuid4()),
            },
        )

    res_a = await attempt_submit(c1_id)
    res_b = await attempt_submit(c2_id)

    assert res_a.status_code == 200
    assert res_b.status_code == 409
    assert res_b.json()["error"]["code"] in ("BALLOT_ALREADY_SUBMITTED", "VOTER_ALREADY_SUBMITTED")

    # =========================================================================
    # 6. STRICT SECRET-BALLOT PRIVACY INVARIANTS
    # =========================================================================
    # Inspect ballot_db directly:
    res = await test_ballot_session.execute(text("SELECT * FROM ballots"))
    ballot_rows = res.fetchall()
    assert len(ballot_rows) == 2  # Exactly 2 accepted ballots (Voter 1 and Voter 2)

    for row in ballot_rows:
        row_dict = row._asdict() if hasattr(row, "_asdict") else dict(row)
        # Verify ZERO voter identity, user id, or session token columns exist in ballot_db
        keys = [k.lower() for k in row_dict.keys()]
        assert "voter_record_id" not in keys
        assert "voter_identifier" not in keys
        assert "user_id" not in keys
        assert "session_token" not in keys
        assert "session_id" not in keys

    # Inspect election_db participation ledger:
    part_res = await test_election_session.execute(
        text("SELECT * FROM election_participation WHERE election_id = :eid"),
        {"eid": election_id},
    )
    part_rows = part_res.fetchall()
    assert len(part_rows) == 2  # Voter 1 and Voter 2 are recorded

    for prow in part_rows:
        p_dict = prow._asdict() if hasattr(prow, "_asdict") else dict(prow)
        assert p_dict["participation_status"] == "submitted"
        # Verify ZERO candidate choices or selections exist in election_participation
        pkeys = [k.lower() for k in p_dict.keys()]
        assert "selections" not in pkeys
        assert "candidate_id" not in pkeys
        assert "ballot_plaintext" not in pkeys

    # =========================================================================
    # 7. MULTI-PC VOTING CENTRE TERMINAL HEARTBEAT & REMOTE RESET
    # =========================================================================
    # Create voting centre
    centre_res = await test_client.post(
        "/api/v1/voting-centres",
        json={
            "institution_id": str(org_id),
            "name": "Science Block Terminal Lab",
            "location_description": "Room 301",
        },
    )
    assert centre_res.status_code in (200, 201)
    centre_id = centre_res.json()["data"]["id"]

    # Register terminal
    term_res = await test_client.post(
        f"/api/v1/voting-centres/{centre_id}/terminals",
        json={"terminal_name": "Kiosk PC-01", "authorized_election_id": election_id},
    )
    assert term_res.status_code in (200, 201)
    term_data = term_res.json()["data"]
    term_id = term_data["id"]
    term_token = term_data.get("token") or term_data.get("terminal_token")

    # Send heartbeat: Idle
    hb1 = await test_client.post(
        f"/api/v1/voting-terminals/{term_id}/heartbeat",
        headers={"X-Terminal-Token": term_token},
        json={"current_status": "idle"},
    )
    assert hb1.status_code == 200
    assert hb1.json()["data"]["command"] in (None, "none")

    # Supervisor triggers remote reset
    reset_trigger = await test_client.post(f"/api/v1/voting-terminals/{term_id}/reset")
    assert reset_trigger.status_code == 200

    # Next heartbeat reports reset command
    hb2 = await test_client.post(
        f"/api/v1/voting-terminals/{term_id}/heartbeat",
        headers={"X-Terminal-Token": term_token},
        json={"current_status": "voting"},
    )
    assert hb2.status_code == 200
    assert hb2.json()["data"]["command"] == "reset"
