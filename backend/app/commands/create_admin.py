"""
Pollwise Admin Account Creation Command
Creates or updates a platform administrator account with full privileges across tenant institutions.

Usage:
    python -m app.commands.create_admin --email pwadmin@gmail.com --password pwadmin123 --name "PollWise Admin"
"""

import argparse
import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import identity_session_maker
from app.models.identity import (
    AccountStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    User,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("create_admin")


async def create_or_update_admin(email: str, password: str, display_name: str = "PollWise Admin"):
    normalized_email = email.strip().lower()
    now = datetime.now(UTC)
    hashed_pw = hash_password(password)

    async with identity_session_maker() as session:
        # Check if user already exists
        stmt = select(User).where(User.email_normalized == normalized_email)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            logger.info("User '%s' already exists. Updating credentials and administrative rights...", normalized_email)
            user.password_hash = hashed_pw
            user.display_name = display_name
            user.is_platform_admin = True
            user.account_status = AccountStatus.ACTIVE.value
            if not user.email_verified_at:
                user.email_verified_at = now
        else:
            logger.info("Creating new platform administrator account for '%s'...", normalized_email)
            user = User(
                id=uuid.uuid4(),
                email_normalized=normalized_email,
                password_hash=hashed_pw,
                display_name=display_name,
                email_verified_at=now,
                account_status=AccountStatus.ACTIVE.value,
                is_platform_admin=True,
            )
            session.add(user)
            await session.flush()

        # Ensure administrator has organization_admin role for all active organizations
        orgs_res = await session.execute(select(Organization).where(Organization.status == "active"))
        orgs = orgs_res.scalars().all()

        for org in orgs:
            mem_stmt = select(OrganizationMembership).where(
                OrganizationMembership.organization_id == org.id,
                OrganizationMembership.user_id == user.id,
            )
            mem_res = await session.execute(mem_stmt)
            mem = mem_res.scalar_one_or_none()

            if not mem:
                logger.info("Assigning organization_admin role to '%s' in '%s'...", normalized_email, org.name)
                session.add(
                    OrganizationMembership(
                        id=uuid.uuid4(),
                        organization_id=org.id,
                        user_id=user.id,
                        role=OrganizationRole.ORGANIZATION_ADMIN.value,
                        status="active",
                    )
                )
            else:
                mem.role = OrganizationRole.ORGANIZATION_ADMIN.value
                mem.status = "active"

        await session.commit()
        logger.info("Admin account '%s' successfully configured with full platform & organization privileges.", normalized_email)


def main():
    parser = argparse.ArgumentParser(description="Create or update Pollwise administrator")
    parser.add_argument("--email", default="pwadmin@gmail.com", help="Administrator email address")
    parser.add_argument("--password", default="pwadmin123", help="Administrator password")
    parser.add_argument("--name", default="PollWise Admin", help="Display name")
    args = parser.parse_args()

    asyncio.run(create_or_update_admin(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
