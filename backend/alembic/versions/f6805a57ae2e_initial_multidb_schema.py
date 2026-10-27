"""initial_multidb_schema

Revision ID: f6805a57ae2e
Revises: 
Create Date: 2026-10-27 01:27:12.670801

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f6805a57ae2e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade(engine_name: str) -> None:
    """Upgrade schema."""
    globals()[f"upgrade_{engine_name}"]()


def downgrade(engine_name: str) -> None:
    """Downgrade schema."""
    globals()[f"downgrade_{engine_name}"]()


# ==========================================
# IDENTITY_DB SCHEMA MIGRATION
# ==========================================

def upgrade_identity() -> None:
    """Upgrade identity schema."""
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('email_normalized', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('account_status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('is_platform_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 2. user_sessions
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_hash', sa.String(length=64), nullable=True),
        sa.Column('user_agent_hash', sa.String(length=64), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 3. email_verification_tokens
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 4. password_reset_tokens
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 5. organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False, unique=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 6. organization_memberships
    op.create_table(
        'organization_memberships',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('organization_id', sa.UUID(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_member'),
    )

    # 7. election_eligibility
    op.create_table(
        'election_eligibility',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), nullable=False, index=True),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('eligibility_status', sa.String(length=50), nullable=False, server_default='eligible'),
        sa.Column('entitlement_status', sa.String(length=50), nullable=False, server_default='unused'),
        sa.Column('eligible_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('eligible_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('election_id', 'user_id', name='uq_election_voter'),
    )

    # 8. voting_credentials
    op.create_table(
        'voting_credentials',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), nullable=False, index=True),
        sa.Column('eligibility_id', sa.UUID(), sa.ForeignKey('election_eligibility.id', ondelete='CASCADE'), nullable=False),
        sa.Column('credential_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='issued'),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade_identity() -> None:
    """Downgrade identity schema."""
    op.drop_table('voting_credentials')
    op.drop_table('election_eligibility')
    op.drop_table('organization_memberships')
    op.drop_table('organizations')
    op.drop_table('password_reset_tokens')
    op.drop_table('email_verification_tokens')
    op.drop_table('user_sessions')
    op.drop_table('users')


# ==========================================
# ELECTION_DB SCHEMA MIGRATION
# ==========================================

def upgrade_election() -> None:
    """Upgrade election schema."""
    # 1. elections
    op.create_table(
        'elections',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('organization_id', sa.UUID(), nullable=False, index=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='draft', index=True),
        sa.Column('opens_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closes_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
        sa.Column('voting_method', sa.String(length=50), nullable=False, server_default='single_choice_per_position'),
        sa.Column('configuration_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('configuration_hash', sa.String(length=64), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 2. positions
    op.create_table(
        'positions',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), sa.ForeignKey('elections.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('max_selections', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('min_selections', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
    )

    # 3. candidates
    op.create_table(
        'candidates',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('position_id', sa.UUID(), sa.ForeignKey('positions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('biography', sa.Text(), nullable=True),
        sa.Column('photo_url', sa.String(length=512), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
    )

    # 4. election_approvals
    op.create_table(
        'election_approvals',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), sa.ForeignKey('elections.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('approval_type', sa.String(length=50), nullable=False),
        sa.Column('approver_actor_id', sa.UUID(), nullable=False),
        sa.Column('decision', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # 5. election_results
    op.create_table(
        'election_results',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), nullable=False, index=True),
        sa.Column('result_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('configuration_hash', sa.String(length=64), nullable=False),
        sa.Column('tally_algorithm_version', sa.String(length=50), nullable=False, server_default='1.0'),
        sa.Column('ballot_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('result_data', sa.Text(), nullable=False),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('computed_by', sa.String(length=255), nullable=False),
        sa.Column('approval_status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 6. audit_events
    op.create_table(
        'audit_events',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('organization_id', sa.UUID(), nullable=True, index=True),
        sa.Column('election_id', sa.UUID(), nullable=True, index=True),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False, index=True),
        sa.Column('outcome', sa.String(length=50), nullable=False, server_default='success'),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade_election() -> None:
    """Downgrade election schema."""
    op.drop_table('audit_events')
    op.drop_table('election_results')
    op.drop_table('election_approvals')
    op.drop_table('candidates')
    op.drop_table('positions')
    op.drop_table('elections')


# ==========================================
# BALLOT_DB SCHEMA MIGRATION
# ==========================================

def upgrade_ballot() -> None:
    """Upgrade ballot schema."""
    # 1. ballot_credential_redemptions
    op.create_table(
        'ballot_credential_redemptions',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), nullable=False, index=True),
        sa.Column('credential_hash', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('redeemed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='accepted'),
        sa.UniqueConstraint('election_id', 'credential_hash', name='uq_redemption_election_hash'),
    )

    # 2. ballots
    op.create_table(
        'ballots',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('election_id', sa.UUID(), nullable=False, index=True),
        sa.Column('configuration_hash', sa.String(length=64), nullable=False),
        sa.Column('ballot_payload', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('integrity_metadata', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=True),
    )

    # 3. ballot_choices
    op.create_table(
        'ballot_choices',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('ballot_id', sa.UUID(), sa.ForeignKey('ballots.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('position_id', sa.UUID(), nullable=False, index=True),
        sa.Column('candidate_id', sa.UUID(), nullable=True, index=True),
        sa.Column('is_abstain', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_ballot_choices_tally', 'ballot_choices', ['position_id', 'candidate_id'])


def downgrade_ballot() -> None:
    """Downgrade ballot schema."""
    op.drop_index('ix_ballot_choices_tally', table_name='ballot_choices')
    op.drop_table('ballot_choices')
    op.drop_table('ballots')
    op.drop_table('ballot_credential_redemptions')
