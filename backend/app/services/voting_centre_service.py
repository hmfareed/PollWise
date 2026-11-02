import hashlib
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.voter_auth import VotingCentre, VotingSession, VotingTerminal


class VotingCentreService:
    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    async def create_centre(
        session: AsyncSession,
        institution_id: uuid.UUID,
        name: str,
        location_description: str | None = None,
    ) -> VotingCentre:
        centre = VotingCentre(
            institution_id=institution_id,
            name=name,
            location_description=location_description,
            status="active",
        )
        session.add(centre)
        await session.commit()
        await session.refresh(centre)
        return centre

    @staticmethod
    async def list_centres(
        session: AsyncSession, institution_id: uuid.UUID
    ) -> list[VotingCentre]:
        query = (
            select(VotingCentre)
            .where(VotingCentre.institution_id == institution_id)
            .order_by(VotingCentre.name)
        )
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def register_terminal(
        session: AsyncSession,
        centre_id: uuid.UUID,
        terminal_name: str,
        authorized_election_id: uuid.UUID | None = None,
    ) -> tuple[VotingTerminal, str]:
        centre = await session.get(VotingCentre, centre_id)
        if not centre:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Voting centre not found",
            )

        raw_token = secrets.token_hex(32)
        token_hash = VotingCentreService.hash_token(raw_token)

        terminal = VotingTerminal(
            voting_centre_id=centre_id,
            institution_id=centre.institution_id,
            terminal_name=terminal_name,
            authorized_election_id=authorized_election_id,
            terminal_status="idle",
            auth_token_hash=token_hash,
            last_seen_at=datetime.now(UTC),
        )
        session.add(terminal)
        await session.commit()
        await session.refresh(terminal)
        return terminal, raw_token

    @staticmethod
    async def list_terminals_in_centre(
        session: AsyncSession, centre_id: uuid.UUID
    ) -> list[VotingTerminal]:
        query = (
            select(VotingTerminal)
            .where(VotingTerminal.voting_centre_id == centre_id)
            .order_by(VotingTerminal.terminal_name)
        )
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def heartbeat(
        session: AsyncSession,
        terminal_id: uuid.UUID,
        terminal_token: str,
        current_status: str,
    ) -> dict[str, Any]:
        terminal = await session.get(VotingTerminal, terminal_id)
        if not terminal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Terminal not found",
            )

        token_hash = VotingCentreService.hash_token(terminal_token)
        if not secrets.compare_digest(terminal.auth_token_hash, token_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid terminal authorization token",
            )

        now = datetime.now(UTC)
        terminal.last_seen_at = now

        command = "none"
        if terminal.terminal_status == "resetting":
            if current_status == "idle":
                # Kiosk has completed reset
                terminal.terminal_status = "idle"
            else:
                command = "reset"
        else:
            terminal.terminal_status = current_status

        await session.commit()
        return {
            "command": command,
            "server_time": now,
        }

    @staticmethod
    async def supervisor_reset(
        session: AsyncSession, terminal_id: uuid.UUID
    ) -> bool:
        terminal = await session.get(VotingTerminal, terminal_id)
        if not terminal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Terminal not found",
            )

        terminal.terminal_status = "resetting"

        # Invalidate any active voting session associated with this terminal
        sess_query = select(VotingSession).where(
            VotingSession.terminal_id == terminal_id,
            VotingSession.session_status == "active",
        )
        sess_res = await session.execute(sess_query)
        for s in sess_res.scalars().all():
            s.session_status = "invalidated"

        await session.commit()
        return True
