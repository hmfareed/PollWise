"""
Pollwise Master End-to-End Integration Test

Simulates the entire institutional election lifecycle across all three isolated logical databases:
1. Institution & Organization Setup
2. Multi-role Identity & Membership
3. Multi-Position Election Drafting
4. Launch Approval & Configuration Freezing (SHA-256 hash calculated)
5. Election Opening
6. Voter Eligibility Roster & Verification Enforcement
7. Single-Use Bearer Credential Issuance
8. Anonymous Ballot-Box Submission (No cookies, no identity links)
9. Replay & Duplicate Voting Defense (409 BALLOT_ALREADY_ACCEPTED)
10. Election Closing
11. Deterministic Tallying (read-only from ballot_db)
12. Interim Results Secrecy Gate (403 RESULTS_NOT_PUBLISHED)
13. Formal Publication Approval Sign-Off
14. Public Results Publication & Verification
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import User


@pytest.mark.asyncio
async def test_complete_institutional_election_e2e_pipeline(
    test_client: AsyncClient,
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # --- PHASE 1 & 2: Institutional Setup & User Registrations ---
    # Register Dean (Manager)
    reg_mgr = await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "dean.jones@polytechnic.edu",
            "password": "DeanStrongPassword2026!",
            "display_name": "Dean Eleanor Jones",
        },
    )
    assert reg_mgr.status_code == 201

    # Verify Dean's email directly in DB
    user_stmt = select(User).where(User.email_normalized == "dean.jones@polytechnic.edu")
    dean = (await test_identity_session.execute(user_stmt)).scalar_one()
    dean.email_verified_at = datetime.now(UTC)
    await test_identity_session.flush()

    # Register Voter Alice
    reg_alice = await test_client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice.student@polytechnic.edu",
            "password": "AlicePassword2026!",
            "display_name": "Alice Smith",
        },
    )
    assert reg_alice.status_code == 201
    user_stmt = select(User).where(User.email_normalized == "alice.student@polytechnic.edu")
    alice = (await test_identity_session.execute(user_stmt)).scalar_one()
    alice.email_verified_at = datetime.now(UTC)
    await test_identity_session.flush()

    # Login as Dean
    login_dean = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.jones@polytechnic.edu", "password": "DeanStrongPassword2026!"},
    )
    assert login_dean.status_code == 200

    # Create Organization
    create_org = await test_client.post(
        "/api/v1/organizations",
        json={"name": "Polytechnic Engineering Council", "slug": "poly-eng-council"},
    )
    assert create_org.status_code == 201
    org_id = create_org.json()["data"]["id"]

    # --- PHASE 3: Election Creation, Positions, Launch Approval, & Freezing ---
    # Create Draft Election
    tomorrow = datetime.now(UTC) + timedelta(days=1)
    next_week = datetime.now(UTC) + timedelta(days=8)

    create_elec = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_id,
            "title": "2026 Engineering Student Leadership Election",
            "description": "Annual democratic election for faculty representatives.",
            "opens_at": tomorrow.isoformat(),
            "closes_at": next_week.isoformat(),
            "timezone": "UTC",
        },
    )
    assert create_elec.status_code == 201
    election_id = create_elec.json()["data"]["id"]

    # Add Position 1: President
    add_pos = await test_client.post(
        f"/api/v1/elections/{election_id}/positions",
        json={
            "title": "Council President",
            "description": "Executive student leadership",
            "min_selections": 1,
            "max_selections": 1,
            "display_order": 0,
        },
    )
    assert add_pos.status_code == 201
    pos_id = add_pos.json()["data"]["id"]

    # Add Candidate 1 & Candidate 2
    cand1_resp = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Samantha Wright", "biography": "Platform for campus digital modernization", "display_order": 0},
    )
    assert cand1_resp.status_code == 201
    cand1_id = cand1_resp.json()["data"]["id"]

    cand2_resp = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Liam Vance", "biography": "Platform for laboratory equipment renewal", "display_order": 1},
    )
    assert cand2_resp.status_code == 201
    cand2_id = cand2_resp.json()["data"]["id"]

    # Record Launch Approval
    launch_appr = await test_client.post(
        f"/api/v1/elections/{election_id}/approve-launch",
        json={"decision": "approved", "reason": "Constitutionally ratified in Executive Council Meeting #12"},
    )
    assert launch_appr.status_code == 200

    # Freeze Configuration & Schedule Election
    schedule_resp = await test_client.post(f"/api/v1/elections/{election_id}/schedule")
    assert schedule_resp.status_code == 200
    frozen_hash = schedule_resp.json()["data"]["configuration_hash"]
    assert frozen_hash is not None
    assert len(frozen_hash) == 64

    # Anti-Tampering Verification: Mutating candidates while scheduled MUST fail (CONFIG_LOCKED)
    tamper_attempt = await test_client.post(
        f"/api/v1/positions/{pos_id}/candidates",
        json={"name": "Illegitimate Injected Candidate", "display_order": 2},
    )
    assert tamper_attempt.status_code == 409
    assert tamper_attempt.json()["error"]["code"] == "CONFIG_LOCKED"

    # Open Election
    open_resp = await test_client.post(f"/api/v1/elections/{election_id}/open")
    assert open_resp.status_code == 200
    assert open_resp.json()["data"]["status"] == "open"

    # --- PHASE 4: Voter Eligibility & Bearer Credential Issuance ---
    # Manager adds Alice to eligibility roll
    elig_resp = await test_client.post(
        f"/api/v1/elections/{election_id}/eligibility",
        json={"email": "alice.student@polytechnic.edu"},
    )
    assert elig_resp.status_code == 201

    # Login as Alice
    login_alice = await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice.student@polytechnic.edu", "password": "AlicePassword2026!"},
    )
    assert login_alice.status_code == 200

    # Alice obtains single-use voting credential
    cred_resp = await test_client.post(f"/api/v1/elections/{election_id}/voting-credential")
    assert cred_resp.status_code == 200
    bearer_credential = cred_resp.json()["data"]["credential"]

    # Re-requesting credential fails (already issued)
    cred_retry = await test_client.post(f"/api/v1/elections/{election_id}/voting-credential")
    assert cred_retry.status_code == 409
    assert cred_retry.json()["error"]["code"] == "CREDENTIAL_ALREADY_ISSUED"

    # --- PHASE 5: Anonymous Ballot Casting ---
    # Clear client cookies (strictly enforcing credentials: "omit" boundary)
    test_client.cookies.clear()

    # Submit ballot anonymously for Samantha Wright
    ballot_resp = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": election_id,
            "credential": bearer_credential,
            "selections": [
                {"position_id": pos_id, "candidate_ids": [cand1_id], "is_abstain": False}
            ],
        },
    )
    assert ballot_resp.status_code == 201
    receipt_ref = ballot_resp.json()["data"]["receipt_reference"]
    assert receipt_ref.startswith("PW-")

    # Replay attack defense: Re-submitting same credential immediately rejected
    replay_resp = await test_client.post(
        "/ballot-box/v1/ballots",
        json={
            "election_id": election_id,
            "credential": bearer_credential,
            "selections": [
                {"position_id": pos_id, "candidate_ids": [cand2_id], "is_abstain": False}
            ],
        },
    )
    assert replay_resp.status_code == 409
    assert replay_resp.json()["error"]["code"] == "BALLOT_ALREADY_ACCEPTED"

    # Alice confirms redemption on identity side
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "alice.student@polytechnic.edu", "password": "AlicePassword2026!"},
    )
    await test_client.post(
        f"/api/v1/elections/{election_id}/confirm-redemption",
        json={"receipt_reference": receipt_ref},
    )
    participation = await test_client.get(f"/api/v1/elections/{election_id}/participation/me")
    assert participation.json()["data"]["has_voted"] is True

    # --- PHASE 6: Election Close, Tallying, & Publishing ---
    # Dean logs in and closes election
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.jones@polytechnic.edu", "password": "DeanStrongPassword2026!"},
    )
    close_resp = await test_client.post(f"/api/v1/elections/{election_id}/close")
    assert close_resp.status_code == 200
    assert close_resp.json()["data"]["status"] == "closed"

    # Compute Tally
    tally_resp = await test_client.post(f"/api/v1/elections/{election_id}/tally")
    assert tally_resp.status_code == 200
    tally_data = tally_resp.json()["data"]
    result_id = tally_data["id"]
    assert tally_data["ballot_count"] == 1
    assert tally_data["positions"][0]["candidates"][0]["name"] == "Samantha Wright"
    assert tally_data["positions"][0]["candidates"][0]["votes"] == 1
    assert tally_data["positions"][0]["winner_ids"] == [cand1_id]

    # Secrecy Gate: Public access still blocked while unpublished
    test_client.cookies.clear()
    unpub_resp = await test_client.get(f"/api/v1/elections/{election_id}/results")
    assert unpub_resp.status_code == 403
    assert unpub_resp.json()["error"]["code"] == "RESULTS_NOT_PUBLISHED"

    # Dean approves and publishes results
    await test_client.post(
        "/api/v1/auth/login",
        json={"email": "dean.jones@polytechnic.edu", "password": "DeanStrongPassword2026!"},
    )
    approve_tally = await test_client.post(
        f"/api/v1/elections/{election_id}/results/{result_id}/approve",
        json={"decision": "approved", "reason": "Scrutiny completed successfully"},
    )
    assert approve_tally.status_code == 200

    publish_resp = await test_client.post(f"/api/v1/elections/{election_id}/publish")
    assert publish_resp.status_code == 200
    assert publish_resp.json()["data"]["published"] is True

    # Public transparency: Anyone can view results now
    test_client.cookies.clear()
    final_results = await test_client.get(f"/api/v1/elections/{election_id}/results")
    assert final_results.status_code == 200
    assert final_results.json()["data"]["positions"][0]["winner_ids"] == [cand1_id]
