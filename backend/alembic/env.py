import asyncio
import logging
import re
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.models.ballot
import app.models.election
import app.models.identity  # noqa: F401
from alembic import context
from app.core.config import settings
from app.db.base import BallotBase, ElectionBase, IdentityBase

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")

db_names = config.get_main_option("databases", "identity, election, ballot")

target_metadata = {
    "identity": IdentityBase.metadata,
    "election": ElectionBase.metadata,
    "ballot": BallotBase.metadata,
}


def get_db_url(name: str) -> str:
    """Retrieve database URL from application settings, ensuring async driver for migrations."""
    if name == "identity":
        raw = settings.IDENTITY_DATABASE_URL
    elif name == "election":
        raw = settings.ELECTION_DATABASE_URL
    elif name == "ballot":
        raw = settings.BALLOT_DATABASE_URL
    else:
        raw = context.config.get_section_option(name, "sqlalchemy.url")

    # Ensure async driver for asyncpg
    if raw.startswith(("postgresql://", "postgresql+psycopg2://")):
        return re.sub(r"^postgresql(\+psycopg2)?://", "postgresql+asyncpg://", raw)
    if raw.startswith("sqlite://"):
        return raw.replace("sqlite://", "sqlite+aiosqlite://")
    return raw


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    engines = {}
    for name in re.split(r",\s*", db_names):
        engines[name] = {"url": get_db_url(name)}

    for name, rec in engines.items():
        logger.info(f"Migrating database {name}")
        file_ = f"{name}.sql"
        logger.info(f"Writing output to {file_}")
        with open(file_, "w") as buffer:
            context.configure(
                url=rec["url"],
                output_buffer=buffer,
                target_metadata=target_metadata.get(name),
                literal_binds=True,
                dialect_opts={"paramstyle": "named"},
            )
            with context.begin_transaction():
                context.run_migrations(engine_name=name)


def do_run_migrations(connection: Connection, name: str) -> None:
    """Run migrations synchronously inside connection.run_sync."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata.get(name),
        upgrade_token=f"{name}_upgrades",
        downgrade_token=f"{name}_downgrades",
    )
    with context.begin_transaction():
        context.run_migrations(engine_name=name)


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode across all isolated databases using async engines."""
    for name in re.split(r",\s*", db_names):
        url = get_db_url(name)
        sec = context.config.get_section(name, {})
        sec["sqlalchemy.url"] = url
        connectable = async_engine_from_config(
            sec,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        async with connectable.connect() as connection:
            logger.info(f"Migrating database {name}")
            await connection.run_sync(do_run_migrations, name)
        await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
