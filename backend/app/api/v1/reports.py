"""
PollWise Election Reports & Export API Router
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    get_current_user,
    get_current_user_optional,
    verify_user_organization_role,
)
from app.core.errors import AppException, ErrorCode
from app.db.session import get_election_session, get_identity_session
from app.models.election import ElectionStatus
from app.models.identity import User
from app.schemas.reports import (
    GenerateReportRequest,
    GenerateReportResponse,
    ReportExportItem,
    ReportExportListResponse,
)
from app.services.election_service import ElectionService
from app.services.notification_service import NotificationService
from app.services.report_service import ReportService

router = APIRouter(tags=["Reports & Exports"])


@router.post(
    "/elections/{election_id}/reports/generate",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def generate_report(
    election_id: uuid.UUID,
    payload: GenerateReportRequest,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an official certified report, calculate SHA-256 integrity checksum,
    record ReportExport, and log an AuditEvent.
    """
    election = await ElectionService.get_election(election_session, election_id)

    # Permission check: requires org role
    await verify_user_organization_role(
        identity_session,
        current_user,
        election.organization_id,
        ["organization_admin", "election_manager", "auditor"],
    )

    # Secrecy check: if results not published, verify user is permitted
    if payload.report_type == "certified_results" and election.status != ElectionStatus.PUBLISHED:
        # Verified role above is sufficient
        pass

    report_export, content_str = await ReportService.create_and_log_report(
        election_session=election_session,
        election_id=election_id,
        report_type=payload.report_type,
        file_format=payload.file_format,
        actor=current_user,
    )

    await NotificationService.create_notification(
        session=identity_session,
        user_id=current_user.id,
        title=f"Report Generated: {payload.report_type.replace('_', ' ').title()}",
        message=f"Official {payload.file_format.upper()} report generated for '{election.title}'.",
        notification_type="report_certified",
        action_url=f"/elections/{election_id}",
    )

    download_url = f"/api/v1/elections/{election_id}/reports/export?report_type={payload.report_type}&format={payload.file_format}"

    return {
        "data": GenerateReportResponse(
            report=ReportExportItem.model_validate(report_export),
            download_url=download_url,
            content_preview=content_str[:500] if len(content_str) > 500 else content_str,
        ).model_dump(),
        "error": None,
    }


@router.get(
    "/elections/{election_id}/reports",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def list_reports(
    election_id: uuid.UUID,
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User = Depends(get_current_user),
):
    """List previously generated report export records for an election."""
    election = await ElectionService.get_election(election_session, election_id)
    await verify_user_organization_role(
        identity_session,
        current_user,
        election.organization_id,
        ["organization_admin", "election_manager", "auditor"],
    )

    reports = await ReportService.list_reports(election_session, election_id)
    return {
        "data": ReportExportListResponse(
            items=[ReportExportItem.model_validate(r) for r in reports],
            total_count=len(reports),
        ).model_dump(),
        "error": None,
    }


@router.get(
    "/elections/{election_id}/reports/export",
    status_code=status.HTTP_200_OK,
)
async def export_report_file(
    election_id: uuid.UUID,
    report_type: Literal["certified_results", "turnout", "summary", "audit_trail"] = Query("certified_results"),
    format: Literal["csv", "json"] = Query("csv"),
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Directly generate and stream an election report file.
    """
    election = await ElectionService.get_election(election_session, election_id)

    # If results report requested for unpublished election, restrict to authorized roles
    if report_type == "certified_results" and election.status != ElectionStatus.PUBLISHED:
        if not current_user:
            raise AppException(ErrorCode.RESULTS_NOT_PUBLISHED, "Results are not published yet", status_code=403)
        await verify_user_organization_role(
            identity_session,
            current_user,
            election.organization_id,
            ["organization_admin", "election_manager", "auditor"],
        )

    # Actor for audit
    actor = current_user or User(id=uuid.uuid4(), email_normalized="anonymous@pollwise.local", display_name="Public Visitor")

    report_export, content_str = await ReportService.create_and_log_report(
        election_session=election_session,
        election_id=election_id,
        report_type=report_type,
        file_format=format,
        actor=actor,
    )

    media_type = "text/csv; charset=utf-8" if format == "csv" else "application/json; charset=utf-8"
    headers = {
        "Content-Disposition": f'attachment; filename="{report_export.file_name}"',
        "X-Report-Checksum": report_export.checksum or "",
    }
    return Response(content=content_str, media_type=media_type, headers=headers)


@router.get(
    "/elections/{election_id}/results/export",
    status_code=status.HTTP_200_OK,
)
async def export_results_shortcut(
    election_id: uuid.UUID,
    format: Literal["csv", "json"] = Query("csv"),
    election_session: AsyncSession = Depends(get_election_session),
    identity_session: AsyncSession = Depends(get_identity_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    One-click shortcut to export certified election results.
    """
    return await export_report_file(
        election_id=election_id,
        report_type="certified_results",
        format=format,
        election_session=election_session,
        identity_session=identity_session,
        current_user=current_user,
    )
