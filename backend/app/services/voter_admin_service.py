import csv
import io
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.election import Election
from app.models.voter_auth import ElectionVoterAuthConfig, ElectionVoterRecord
from app.schemas.voter_auth import (
    VoterAuthConfigCreate,
    VoterAuthConfigUpdate,
    VoterRecordCreate,
)

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


class VoterAdminService:
    @staticmethod
    async def get_or_create_auth_config(
        session: AsyncSession, election_id: uuid.UUID
    ) -> ElectionVoterAuthConfig:
        query = select(ElectionVoterAuthConfig).where(
            ElectionVoterAuthConfig.election_id == election_id
        )
        res = await session.execute(query)
        config = res.scalar_one_or_none()
        if not config:
            config = ElectionVoterAuthConfig(
                election_id=election_id,
                identifier_type="institutional_email",
                identifier_label="Institutional Email",
            )
            session.add(config)
            await session.commit()
            await session.refresh(config)
        return config

    @staticmethod
    async def update_auth_config(
        session: AsyncSession,
        election_id: uuid.UUID,
        config_update: VoterAuthConfigUpdate,
    ) -> ElectionVoterAuthConfig:
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        if config.configuration_locked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "CONFIG_LOCKED", "message": "Voter authentication configuration is locked."},
            )

        update_data = config_update.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            if val is not None:
                setattr(config, key, val)

        await session.commit()
        await session.refresh(config)
        return config

    @staticmethod
    async def lock_auth_config(
        session: AsyncSession, election_id: uuid.UUID
    ) -> ElectionVoterAuthConfig:
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        if config.configuration_locked_at is None:
            config.configuration_locked_at = datetime.now(UTC)
            await session.commit()
            await session.refresh(config)
        return config

    @staticmethod
    def normalize_identifier(identifier: str, identifier_type: str) -> tuple[str, bool]:
        trimmed = identifier.strip()
        if not trimmed:
            return "", False
        if identifier_type == "institutional_email":
            normalized = trimmed.lower()
            is_valid = bool(EMAIL_REGEX.match(normalized))
            return normalized, is_valid
        else:
            return trimmed, True

    @staticmethod
    async def preview_csv_voters(
        session: AsyncSession, election_id: uuid.UUID, csv_content: bytes
    ) -> dict[str, Any]:
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        text_stream = io.StringIO(csv_content.decode("utf-8-sig", errors="replace"))
        reader = csv.DictReader(text_stream)

        # Retrieve existing normalized identifiers for this election
        res = await session.execute(
            select(ElectionVoterRecord.normalized_identifier).where(
                ElectionVoterRecord.election_id == election_id
            )
        )
        existing_identifiers = set(res.scalars().all())

        seen_in_batch = set()
        valid_records = []
        duplicate_count = 0
        invalid_count = 0
        errors = []

        for row_idx, row in enumerate(reader, start=2):
            raw_id = row.get("identifier") or row.get("email") or row.get("id") or ""
            voter_group = row.get("voter_group") or row.get("group") or None
            normalized, is_valid = VoterAdminService.normalize_identifier(
                raw_id, config.identifier_type
            )

            if not is_valid or not normalized:
                invalid_count += 1
                errors.append(f"Row {row_idx}: invalid format for '{raw_id}'")
                continue

            if normalized in existing_identifiers or normalized in seen_in_batch:
                duplicate_count += 1
                errors.append(f"Row {row_idx}: duplicate identifier '{normalized}'")
                continue

            seen_in_batch.add(normalized)
            valid_records.append(
                {
                    "identifier": normalized,
                    "voter_group": voter_group,
                    "eligibility_status": "eligible",
                }
            )

        return {
            "valid_count": len(valid_records),
            "duplicate_count": duplicate_count,
            "invalid_count": invalid_count,
            "sample_records": valid_records[:10],
            "errors": errors[:50],
        }

    @staticmethod
    async def import_csv_voters(
        session: AsyncSession, election_id: uuid.UUID, csv_content: bytes
    ) -> int:
        preview = await VoterAdminService.preview_csv_voters(session, election_id, csv_content)
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        text_stream = io.StringIO(csv_content.decode("utf-8-sig", errors="replace"))
        reader = csv.DictReader(text_stream)

        # Retrieve existing identifiers
        res = await session.execute(
            select(ElectionVoterRecord.normalized_identifier).where(
                ElectionVoterRecord.election_id == election_id
            )
        )
        existing_identifiers = set(res.scalars().all())

        seen_in_batch = set()
        to_insert = []

        for row in reader:
            raw_id = row.get("identifier") or row.get("email") or row.get("id") or ""
            voter_group = row.get("voter_group") or row.get("group") or None
            normalized, is_valid = VoterAdminService.normalize_identifier(
                raw_id, config.identifier_type
            )

            if not is_valid or not normalized:
                continue
            if normalized in existing_identifiers or normalized in seen_in_batch:
                continue

            seen_in_batch.add(normalized)
            to_insert.append(
                ElectionVoterRecord(
                    election_id=election_id,
                    identifier_type=config.identifier_type,
                    normalized_identifier=normalized,
                    voter_group=voter_group,
                    eligibility_status="eligible",
                    source="csv_import",
                )
            )

        if to_insert:
            session.add_all(to_insert)
            await session.commit()

        return len(to_insert)

    @staticmethod
    async def add_single_voter(
        session: AsyncSession, election_id: uuid.UUID, voter_in: VoterRecordCreate
    ) -> ElectionVoterRecord:
        config = await VoterAdminService.get_or_create_auth_config(session, election_id)
        normalized, is_valid = VoterAdminService.normalize_identifier(
            voter_in.identifier, config.identifier_type
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IDENTIFIER", "message": "Identifier format does not meet election requirements."},
            )

        # Check existing
        existing = await session.execute(
            select(ElectionVoterRecord).where(
                ElectionVoterRecord.election_id == election_id,
                ElectionVoterRecord.identifier_type == config.identifier_type,
                ElectionVoterRecord.normalized_identifier == normalized,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_VOTER", "message": "A voter record with this identifier already exists in this election."},
            )

        voter = ElectionVoterRecord(
            election_id=election_id,
            identifier_type=config.identifier_type,
            normalized_identifier=normalized,
            voter_group=voter_in.voter_group,
            eligibility_status=voter_in.eligibility_status,
            source="manual_entry",
        )
        session.add(voter)
        await session.commit()
        await session.refresh(voter)
        return voter

    @staticmethod
    async def list_voters(
        session: AsyncSession,
        election_id: uuid.UUID,
        page: int = 1,
        page_size: int = 50,
        query: str | None = None,
        eligibility_status: str | None = None,
    ) -> list[ElectionVoterRecord]:
        stmt = select(ElectionVoterRecord).where(
            ElectionVoterRecord.election_id == election_id
        )
        if eligibility_status:
            stmt = stmt.where(ElectionVoterRecord.eligibility_status == eligibility_status)
        if query:
            stmt = stmt.where(ElectionVoterRecord.normalized_identifier.ilike(f"%{query}%"))

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def delete_voter(
        session: AsyncSession, election_id: uuid.UUID, voter_id: uuid.UUID
    ) -> bool:
        voter = await session.get(ElectionVoterRecord, voter_id)
        if not voter or voter.election_id != election_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voter not found")
        await session.delete(voter)
        await session.commit()
        return True
