"""
Tests for TallyService recount and dispute handling workflow.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppException
from app.models.ballot import Ballot
from app.models.election import Candidate, Election, ElectionResult, Position, RecountStatus
from app.models.identity import Organization, OrganizationMembership, User
from app.services.tally_service import TallyService


@pytest.mark.asyncio
async def test_recount_service_workflow(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    # Setup Actor and Org
    actor = User(
        id=uuid.uuid4(),
        email_normalized="auditor.lead@institution.edu",
        password_hash="hash",
        display_name="Auditor Lead",
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="State College", slug="state-college", status="active")
    test_identity_session.add_all([actor, org])
    await test_identity_session.flush()

    election_id = uuid.uuid4()
    pos_id = uuid.uuid4()
    c1_id = uuid.uuid4()
    c2_id = uuid.uuid4()

    election = Election(
        id=election_id,
        organization_id=org.id,
        title="Faculty Senate 2026",
        status="closed",
        opens_at=datetime.now(UTC) - timedelta(days=2),
        closes_at=datetime.now(UTC) - timedelta(hours=1),
        timezone="UTC",
        configuration_version=1,
        configuration_hash="f" * 64,
        created_by=actor.id,
    )
    pos = Position(
        id=pos_id,
        election_id=election_id,
        title="Chair",
        min_selections=1,
        max_selections=1,
        display_order=0,
    )
    c1 = Candidate(id=c1_id, position_id=pos_id, name="Candidate Alpha", display_order=0, status="active")
    c2 = Candidate(id=c2_id, position_id=pos_id, name="Candidate Beta", display_order=1, status="active")
    test_election_session.add_all([election, pos, c1, c2])
    await test_election_session.commit()

    # Add ballots to ballot_session
    b1 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="f" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c1_id)]}]},
    )
    b2 = Ballot(
        id=uuid.uuid4(),
        election_id=election_id,
        configuration_hash="f" * 64,
        ballot_payload={"selections": [{"position_id": str(pos_id), "candidate_ids": [str(c2_id)]}]},
    )
    test_ballot_session.add_all([b1, b2])
    await test_ballot_session.commit()

    # Initial compute_tally (produces version 1)
    res_v1 = await TallyService.compute_tally(test_ballot_session, test_election_session, election_id, actor)
    assert res_v1.result_version == 1
    assert res_v1.ballot_count == 2
    assert res_v1.approval_status == "pending"

    # Now election is in 'tallied' state. Execute recount
    new_res, recount_req = await TallyService.recount_election(
        ballot_session=test_ballot_session,
        election_session=test_election_session,
        election_id=election_id,
        actor=actor,
        reason="Dispute regarding initial electronic tally verification",
    )

    # Verify recount produces version 2 without overwriting version 1
    assert new_res.result_version == 2
    assert new_res.ballot_count == 2
    assert new_res.approval_status == "pending"
    assert recount_req.resulting_result_id == new_res.id
    assert recount_req.status == RecountStatus.COMPLETED
    assert recount_req.reason == "Dispute regarding initial electronic tally verification"

    # Verify list_recounts
    recounts = await TallyService.list_recounts(test_election_session, election_id)
    assert len(recounts) == 1
    assert recounts[0].id == recount_req.id

    # Verify get_results returns latest (version 2)
    latest_results = await TallyService.get_results(test_election_session, election_id, can_view_unapproved=True)
    assert latest_results["result_version"] == 2


@pytest.mark.asyncio
async def test_recount_rejects_invalid_state(
    test_identity_session: AsyncSession,
    test_election_session: AsyncSession,
    test_ballot_session: AsyncSession,
):
    actor = User(
        id=uuid.uuid4(),
        email_normalized="auditor.invalid@institution.edu",
        password_hash="hash",
        display_name="Auditor",
        account_status="active",
    )
    org = Organization(id=uuid.uuid4(), name="Org", slug="org", status="active")
    test_identity_session.add_all([actor, org])
    await test_identity_session.flush()

    # Draft election
    draft_elec = Election(
        id=uuid.uuid4(),
        organization_id=org.id,
        title="Draft Election",
        status="draft",
        timezone="UTC",
        created_by=actor.id,
    )
    test_election_session.add(draft_elec)
    await test_election_session.commit()

    with pytest.raises(AppException) as exc_info:
        await TallyService.recount_election(
            ballot_session=test_ballot_session,
            election_session=test_election_session,
            election_id=draft_elec.id,
            actor=actor,
            reason="Invalid recount on draft election",
        )
    assert exc_info.value.status_code == 409
