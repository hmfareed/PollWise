"""
Pollwise Realistic Seed Data Command
Populates multi-tenant organizations, users, and elections across lifecycle states.
Usage:
    python -m app.commands.seed
"""

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import (
    election_session_maker,
    identity_session_maker,
)
from app.models.election import (
    Candidate,
    Election,
    ElectionResult,
    ElectionStatus,
    Position,
)
from app.models.identity import (
    ElectionEligibility,
    Organization,
    OrganizationMembership,
    User,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


async def seed_data():
    logger.info("Starting Pollwise seed data population...")

    now = datetime.now(UTC)

    # 1. Populate Identity DB
    async with identity_session_maker() as session:
        # Check if already seeded
        existing_org = (
            await session.execute(
                select(Organization).where(Organization.slug == "northwestern-poly")
            )
        ).scalar_one_or_none()
        if existing_org:
            logger.info("Database already seeded with demo organization. Skipping.")
            return

        # Create Institution
        org = Organization(
            id=uuid.uuid4(),
            name="Northwestern Polytechnic University",
            slug="northwestern-poly",
            status="active",
        )
        session.add(org)

        # Platform Admin
        admin_user = User(
            id=uuid.uuid4(),
            email_normalized="admin@pollwise.local",
            password_hash=hash_password("PollwiseAdmin2026!"),
            display_name="Pollwise Root Admin",
            email_verified_at=now,
            account_status="active",
            is_platform_admin=True,
        )
        session.add(admin_user)

        # Election Manager
        manager_user = User(
            id=uuid.uuid4(),
            email_normalized="manager@polytechnic.edu",
            password_hash=hash_password("ManagerSecure123!"),
            display_name="Prof. Arthur Vance (Manager)",
            email_verified_at=now,
            account_status="active",
        )
        session.add(manager_user)

        # Auditor
        auditor_user = User(
            id=uuid.uuid4(),
            email_normalized="auditor@polytechnic.edu",
            password_hash=hash_password("AuditorSecure123!"),
            display_name="Helena Thorne (Electoral Auditor)",
            email_verified_at=now,
            account_status="active",
        )
        session.add(auditor_user)

        # Student Voters
        student_emails = [
            ("alice@polytechnic.edu", "Alice Walker"),
            ("bob@polytechnic.edu", "Bob Jenkins"),
            ("carol@polytechnic.edu", "Carol Danvers"),
            ("david@polytechnic.edu", "David Miller"),
            ("eva@polytechnic.edu", "Eva Green"),
        ]
        student_users = []
        for email, name in student_emails:
            stu = User(
                id=uuid.uuid4(),
                email_normalized=email,
                password_hash=hash_password("StudentVote2026!"),
                display_name=name,
                email_verified_at=now,
                account_status="active",
            )
            session.add(stu)
            student_users.append(stu)

        await session.flush()

        # Memberships
        session.add(
            OrganizationMembership(
                organization_id=org.id,
                user_id=manager_user.id,
                role="election_manager",
                status="active",
            )
        )
        session.add(
            OrganizationMembership(
                organization_id=org.id,
                user_id=auditor_user.id,
                role="auditor",
                status="active",
            )
        )
        for stu in student_users:
            session.add(
                OrganizationMembership(
                    organization_id=org.id,
                    user_id=stu.id,
                    role="member",
                    status="active",
                )
            )

        await session.commit()
        logger.info("Identity DB seeded successfully with 8 verified users.")

    # 2. Populate Election DB & Ballot DB
    async with election_session_maker() as elec_session:
        # Election 1: Live Open Election
        open_elec_id = uuid.uuid4()
        open_pos1_id = uuid.uuid4()
        open_pos2_id = uuid.uuid4()

        open_election = Election(
            id=open_elec_id,
            organization_id=org.id,
            title="2026 Student Union General Election",
            description="Official annual election for executive student governance and academic representation.",
            status=ElectionStatus.OPEN,
            opens_at=now - timedelta(days=1),
            closes_at=now + timedelta(days=6),
            timezone="UTC",
            voting_method="single_choice_per_position",
            configuration_version=1,
            configuration_hash="f" * 64,
            created_by=manager_user.id,
        )
        elec_session.add(open_election)

        # Positions
        pos_pres = Position(
            id=open_pos1_id,
            election_id=open_elec_id,
            title="Union President",
            description="Chief executive representing all undergraduate and graduate students.",
            min_selections=1,
            max_selections=1,
            display_order=0,
        )
        pos_vp = Position(
            id=open_pos2_id,
            election_id=open_elec_id,
            title="VP Academic Affairs",
            description="Advocates for curriculum development and library resources.",
            min_selections=1,
            max_selections=1,
            display_order=1,
        )
        elec_session.add_all([pos_pres, pos_vp])

        # Candidates for President
        cand_p1 = Candidate(
            position_id=open_pos1_id,
            name="Maya Patel",
            biography="Advocate for 24-hour campus study centers and mental health resources.",
            display_order=0,
            status="active",
        )
        cand_p2 = Candidate(
            position_id=open_pos1_id,
            name="Jordan Lee",
            biography="Focused on renewable energy campus initiatives and transit pass subsidies.",
            display_order=1,
            status="active",
        )

        # Candidates for VP Academic
        cand_vp1 = Candidate(
            position_id=open_pos2_id,
            name="Marcus Chen",
            biography="Expanding undergraduate research grants and textbook open-access.",
            display_order=0,
            status="active",
        )
        cand_vp2 = Candidate(
            position_id=open_pos2_id,
            name="Sarah Al-Mansoor",
            biography="Reforming academic grievance procedures and internship credit accreditation.",
            display_order=1,
            status="active",
        )
        elec_session.add_all([cand_p1, cand_p2, cand_vp1, cand_vp2])

        # Election 2: Published Historical Election
        pub_elec_id = uuid.uuid4()
        pub_pos_id = uuid.uuid4()
        pub_cand1_id = uuid.uuid4()
        pub_cand2_id = uuid.uuid4()

        pub_election = Election(
            id=pub_elec_id,
            organization_id=org.id,
            title="Alumni Advisory Board Election 2025",
            description="Certified election results for the Alumni Board of Trustees.",
            status=ElectionStatus.PUBLISHED,
            opens_at=now - timedelta(days=60),
            closes_at=now - timedelta(days=53),
            timezone="UTC",
            configuration_version=1,
            configuration_hash="9" * 64,
            created_by=manager_user.id,
        )
        pub_pos = Position(
            id=pub_pos_id,
            election_id=pub_elec_id,
            title="Alumni Trustee",
            min_selections=1,
            max_selections=1,
            display_order=0,
        )
        pub_c1 = Candidate(
            id=pub_cand1_id,
            position_id=pub_pos_id,
            name="Dr. Eleanor Vance",
            display_order=0,
            status="active",
        )
        pub_c2 = Candidate(
            id=pub_cand2_id,
            position_id=pub_pos_id,
            name="Richard Hayes",
            display_order=1,
            status="active",
        )
        elec_session.add_all([pub_election, pub_pos, pub_c1, pub_c2])

        # Published Results Data
        pub_result_data = {
            "election_id": str(pub_elec_id),
            "configuration_hash": "9" * 64,
            "total_ballots": 485,
            "positions": [
                {
                    "position_id": str(pub_pos_id),
                    "title": "Alumni Trustee",
                    "total_votes": 485,
                    "abstain_count": 12,
                    "candidates": [
                        {
                            "candidate_id": str(pub_cand1_id),
                            "name": "Dr. Eleanor Vance",
                            "votes": 310,
                            "percentage": 63.92,
                        },
                        {
                            "candidate_id": str(pub_cand2_id),
                            "name": "Richard Hayes",
                            "votes": 175,
                            "percentage": 36.08,
                        },
                    ],
                    "winner_ids": [str(pub_cand1_id)],
                }
            ],
        }

        pub_result = ElectionResult(
            id=uuid.uuid4(),
            election_id=pub_elec_id,
            result_version=1,
            configuration_hash="9" * 64,
            tally_algorithm_version="1.0",
            ballot_count=485,
            result_data=json.dumps(pub_result_data),
            computed_at=now - timedelta(days=52),
            computed_by=str(manager_user.id),
            approval_status="approved",
            published_at=now - timedelta(days=51),
        )
        elec_session.add(pub_result)

        # Election 3: Scheduled Election (opens next week)
        sched_elec = Election(
            id=uuid.uuid4(),
            organization_id=org.id,
            title="Faculty Senate Representative Election 2026",
            description="Election for academic departmental representatives.",
            status=ElectionStatus.SCHEDULED,
            opens_at=now + timedelta(days=5),
            closes_at=now + timedelta(days=12),
            timezone="UTC",
            configuration_version=1,
            configuration_hash="3" * 64,
            created_by=manager_user.id,
        )
        elec_session.add(sched_elec)

        # Election 4: Editable Draft
        draft_elec = Election(
            id=uuid.uuid4(),
            organization_id=org.id,
            title="Engineering Department Curriculum Committee 2026",
            description="Internal student-faculty curriculum review board.",
            status=ElectionStatus.DRAFT,
            opens_at=now + timedelta(days=20),
            closes_at=now + timedelta(days=27),
            timezone="UTC",
            created_by=manager_user.id,
        )
        elec_session.add(draft_elec)

        await elec_session.commit()
        logger.info("Election DB seeded with 4 elections (Open, Scheduled, Draft, Published).")

    # 3. Populate Voter Eligibility for Open Election in Identity DB
    async with identity_session_maker() as session:
        for stu in student_users:
            elig = ElectionEligibility(
                election_id=open_elec_id,
                user_id=stu.id,
                eligibility_status="eligible",
                entitlement_status="unused",
            )
            session.add(elig)
        await session.commit()
        logger.info(
            "Voter eligibility roll populated for 2026 Student Union General Election."
        )

    logger.info("Pollwise complete demo dataset seeded successfully!")
    logger.info("----------------------------------------------------------------")
    logger.info("Demo Credentials:")
    logger.info("  Platform Admin:    admin@pollwise.local     / PollwiseAdmin2026!")
    logger.info("  Election Manager:  manager@polytechnic.edu  / ManagerSecure123!")
    logger.info("  Auditor:           auditor@polytechnic.edu  / AuditorSecure123!")
    logger.info("  Student Voter:     alice@polytechnic.edu    / StudentVote2026!")
    logger.info("----------------------------------------------------------------")


if __name__ == "__main__":
    asyncio.run(seed_data())
