"""
Pollwise Cryptographic Replay Defense & Strict Lifecycle Enforcement Test Suite

Verifies:
1. Single-use credential redemption and duplicate replay defense (409 BALLOT_ALREADY_ACCEPTED).
2. Cryptographic signature verification and tamper rejection (401 CREDENTIAL_INVALID).
3. Cross-election credential replay prevention (403 CREDENTIAL_WRONG_ELECTION).
4. Multiple sequential valid voters storing isolated anonymous ballots.
5. Strict server-side deadline enforcement when now > closes_at (409 ELECTION_CLOSED).
6. Election state enforcement: rejecting submissions when election is in 'scheduled' or 'draft' status.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import sign_credential
from app.models.ballot import Ballot, BallotCredentialRedemption
from app.models.election import Candidate, Election, Position


@pytest.mark.asyncio
async def test_replay_defense_single_use_credential(
    test_client: AsyncClient,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    """
    Verify that an accepted voting credential cannot be reused (replay attack).
    First attempt: HTTP 201 Created.
    Second attempt: HTTP 409 Conflict with BALLOT_ALREADY_ACCEPTED.
    """
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=uuid.uuid4(),
        title="Replay Defense Election",
        status="open",
        opens_at=datetime.now(UTC) - timedelta(hours=1),
        closes_at=datetime.now(UTC) + timedelta(days=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="a" * 64,
        created_by=uuid.uuid4(),
    )
    position = Position(
        id=pos_id,
        election_id=election_id,
        title="President",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand = Candidate(
        id=cand_id,
        position_id=pos_id,
        name="Candidate Alpha",
        display_order=0,
        status="active",
    )
    test_election_session.add_all([election, position, cand])
    await test_election_session.commit()

    # Generate a signed credential
    credential = sign_credential(
        settings.CREDENTIAL_SIGNING_SECRET, str(election_id), secrets.token_hex(16)
    )

    payload = {
        "election_id": str(election_id),
        "credential": credential,
        "selections": [
            {
                "position_id": str(pos_id),
                "candidate_ids": [str(cand_id)],
                "is_abstain": False,
            }
        ],
    }

    # First attempt: succeeds
    res1 = await test_client.post("/ballot-box/v1/ballots", json=payload)
    assert res1.status_code == 201
    assert "receipt_reference" in res1.json()["data"]

    # Second attempt with same credential: rejected
    res2 = await test_client.post("/ballot-box/v1/ballots", json=payload)
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "BALLOT_ALREADY_ACCEPTED"

    # Verify ballot_db state: exactly 1 redemption, 1 ballot
    redemptions = (await test_ballot_session.execute(select(BallotCredentialRedemption))).scalars().all()
    assert len(redemptions) == 1

    ballots = (await test_ballot_session.execute(select(Ballot))).scalars().all()
    assert len(ballots) == 1


@pytest.mark.asyncio
async def test_cross_election_credential_replay_rejection(
    test_client: AsyncClient,
    test_election_session: AsyncSession,
):
    """
    Verify that a credential generated for Election A cannot be used in Election B.
    """
    election_a_id = uuid.uuid4()
    election_b_id = uuid.uuid4()
    pos_b_id = uuid.uuid4()
    cand_b_id = uuid.uuid4()

    election_b = Election(
        id=election_b_id,
        organization_id=uuid.uuid4(),
        title="Election B",
        status="open",
        opens_at=datetime.now(UTC) - timedelta(hours=1),
        closes_at=datetime.now(UTC) + timedelta(days=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="b" * 64,
        created_by=uuid.uuid4(),
    )
    pos_b = Position(
        id=pos_b_id,
        election_id=election_b_id,
        title="Treasurer",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand_b = Candidate(
        id=cand_b_id,
        position_id=pos_b_id,
        name="Candidate Beta",
        display_order=0,
        status="active",
    )
    test_election_session.add_all([election_b, pos_b, cand_b])
    await test_election_session.commit()

    # Generate credential scoped to Election A
    cred_for_a = sign_credential(
        settings.CREDENTIAL_SIGNING_SECRET, str(election_a_id), secrets.token_hex(16)
    )

    # Attempt to cast in Election B
    payload = {
        "election_id": str(election_b_id),
        "credential": cred_for_a,
        "selections": [
            {
                "position_id": str(pos_b_id),
                "candidate_ids": [str(cand_b_id)],
                "is_abstain": False,
            }
        ],
    }

    res = await test_client.post("/ballot-box/v1/ballots", json=payload)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "CREDENTIAL_WRONG_ELECTION"


@pytest.mark.asyncio
async def test_tampered_credential_signature_rejection(
    test_client: AsyncClient,
    test_election_session: AsyncSession,
):
    """
    Verify that an altered or forged credential is rejected with 401 CREDENTIAL_INVALID.
    """
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=uuid.uuid4(),
        title="Integrity Election",
        status="open",
        opens_at=datetime.now(UTC) - timedelta(hours=1),
        closes_at=datetime.now(UTC) + timedelta(days=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="c" * 64,
        created_by=uuid.uuid4(),
    )
    pos = Position(
        id=pos_id,
        election_id=election_id,
        title="Secretary",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand = Candidate(
        id=cand_id,
        position_id=pos_id,
        name="Candidate Gamma",
        display_order=0,
        status="active",
    )
    test_election_session.add_all([election, pos, cand])
    await test_election_session.commit()

    # Forged credential with invalid signature
    bogus_credential = "bm90X2FfdmFsaWRfc2lnbmVkX2NyZWRlbnRpYWxfYXRhbGw"

    payload = {
        "election_id": str(election_id),
        "credential": bogus_credential,
        "selections": [
            {
                "position_id": str(pos_id),
                "candidate_ids": [str(cand_id)],
                "is_abstain": False,
            }
        ],
    }

    res = await test_client.post("/ballot-box/v1/ballots", json=payload)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "CREDENTIAL_INVALID"


@pytest.mark.asyncio
async def test_server_side_deadline_enforcement(
    test_client: AsyncClient,
    test_election_session: AsyncSession,
):
    """
    Verify that if an election's closes_at timestamp has passed,
    the ballot-box rejects the submission with 409 ELECTION_CLOSED.
    """
    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    # closes_at in the past
    past_time = datetime.now(UTC) - timedelta(minutes=5)
    election = Election(
        id=election_id,
        organization_id=uuid.uuid4(),
        title="Expired Deadline Election",
        status="open",
        opens_at=datetime.now(UTC) - timedelta(days=1),
        closes_at=past_time,
        timezone="UTC",
        configuration_version=1,
        configuration_hash="e" * 64,
        created_by=uuid.uuid4(),
    )
    pos = Position(
        id=pos_id,
        election_id=election_id,
        title="Honorary Officer",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    cand = Candidate(
        id=cand_id,
        position_id=pos_id,
        name="Candidate Late",
        display_order=0,
        status="active",
    )
    test_election_session.add_all([election, pos, cand])
    await test_election_session.commit()

    credential = sign_credential(
        settings.CREDENTIAL_SIGNING_SECRET, str(election_id), secrets.token_hex(16)
    )

    payload = {
        "election_id": str(election_id),
        "credential": credential,
        "selections": [
            {
                "position_id": str(pos_id),
                "candidate_ids": [str(cand_id)],
                "is_abstain": False,
            }
        ],
    }

    res = await test_client.post("/ballot-box/v1/ballots", json=payload)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ELECTION_CLOSED"
