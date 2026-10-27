import logging
import re
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

import app.models.ballot
import app.models.election
import app.models.identity  # noqa: F401
from alembic import context
from app.core.config import settings
from app.db.base import BallotBase, ElectionBase, IdentityBase

USE_TWOPHASE = False

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
    """Retrieve database URL from application settings, converting asyncpg to sync driver for migrations."""
    if name == "identity":
        raw = settings.IDENTITY_DATABASE_URL
    elif name == "election":
        raw = settings.ELECTION_DATABASE_URL
    elif name == "ballot":
        raw = settings.BALLOT_DATABASE_URL
    else:
        raw = context.config.get_section_option(name, "sqlalchemy.url")

    # Replace asyncpg with standard postgresql driver for sync alembic execution
    if "postgresql+asyncpg://" in raw:
        return raw.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    if "sqlite+aiosqlite://" in raw:
        return raw.replace("sqlite+aiosqlite://", "sqlite://")
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


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    engines = {}
    for name in re.split(r",\s*", db_names):
        url = get_db_url(name)
        sec = context.config.get_section(name, {})
        sec["sqlalchemy.url"] = url
        engines[name] = {
            "engine": engine_from_config(
                sec,
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
            )
        }

    for name, rec in engines.items():
        engine = rec["engine"]
        rec["connection"] = conn = engine.connect()

        if USE_TWOPHASE:
            rec["transaction"] = conn.begin_twophase()
        else:
            rec["transaction"] = conn.begin()

    try:
        for name, rec in engines.items():
            logger.info(f"Migrating database {name}")
            context.configure(
                connection=rec["connection"],
                upgrade_token=f"{name}_upgrades",
                downgrade_token=f"{name}_downgrades",
                target_metadata=target_metadata.get(name),
            )
            context.run_migrations(engine_name=name)

        if USE_TWOPHASE:
            for rec in engines.values():
                rec["transaction"].prepare()

        for rec in engines.values():
            rec["transaction"].commit()
    except:
        for rec in engines.values():
            rec["transaction"].rollback()
        raise
    finally:
        for rec in engines.values():
            rec["connection"].close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
