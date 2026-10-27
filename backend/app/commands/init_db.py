"""
Pollwise Database Initialization Command
Initializes tables across the three logically isolated engines.
Usage:
    python -m app.commands.init_db
"""

import asyncio
import logging

import app.models.ballot
import app.models.election
import app.models.identity  # noqa: F401
from app.db.base import BallotBase, ElectionBase, IdentityBase
from app.db.session import ballot_engine, election_engine, identity_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_db")


async def init_databases():
    logger.info("Initializing Pollwise multi-database tables...")

    # 1. Identity DB
    logger.info("Creating tables for identity_db...")
    async with identity_engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    logger.info("identity_db tables created successfully.")

    # 2. Election DB
    logger.info("Creating tables for election_db...")
    async with election_engine.begin() as conn:
        await conn.run_sync(ElectionBase.metadata.create_all)
    logger.info("election_db tables created successfully.")

    # 3. Ballot DB
    logger.info("Creating tables for ballot_db...")
    async with ballot_engine.begin() as conn:
        await conn.run_sync(BallotBase.metadata.create_all)
    logger.info("ballot_db tables created successfully.")

    logger.info("All isolated database tables successfully initialized.")


if __name__ == "__main__":
    asyncio.run(init_databases())
