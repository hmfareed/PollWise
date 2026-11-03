import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_election_session
from app.models.identity import User
from app.schemas.common import ApiResponse
from app.schemas.voter_auth import (
    AccessCodeItem,
    AccessCodeListResponse,
    GenerateAccessCodesRequest,
    VoterAuthConfigResponse,
    VoterAuthConfigUpdate,
    VoterCSVPreviewReport,
    VoterRecordCreate,
    VoterRecordResponse,
)
from app.services.voter_admin_service import VoterAdminService

router = APIRouter(tags=["Election Voter Authentication & Roll Management"])


@router.get(
    "/elections/{election_id}/voter-auth-config",
    response_model=ApiResponse[VoterAuthConfigResponse],
)
async def get_voter_auth_config(
    election_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    config = await VoterAdminService.get_or_create_auth_config(session, election_id)
    return ApiResponse(
        status="success",
        data=VoterAuthConfigResponse.model_validate(config),
    )


@router.put(
    "/elections/{election_id}/voter-auth-config",
    response_model=ApiResponse[VoterAuthConfigResponse],
)
async def update_voter_auth_config(
    election_id: uuid.UUID,
    config_in: VoterAuthConfigUpdate,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    config = await VoterAdminService.update_auth_config(session, election_id, config_in)
    return ApiResponse(
        status="success",
        data=VoterAuthConfigResponse.model_validate(config),
    )


@router.post(
    "/elections/{election_id}/voter-auth-config/lock",
    response_model=ApiResponse[VoterAuthConfigResponse],
)
async def lock_voter_auth_config(
    election_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    config = await VoterAdminService.lock_auth_config(session, election_id)
    return ApiResponse(
        status="success",
        data=VoterAuthConfigResponse.model_validate(config),
    )


@router.post(
    "/elections/{election_id}/voters/preview",
    response_model=ApiResponse[VoterCSVPreviewReport],
)
async def preview_voters_csv(
    election_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    report = await VoterAdminService.preview_csv_voters(session, election_id, content)
    return ApiResponse(
        status="success",
        data=VoterCSVPreviewReport(**report),
    )


@router.post(
    "/elections/{election_id}/voters/import",
    response_model=ApiResponse[dict[str, Any]],
)
async def import_voters_csv(
    election_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    imported_count = await VoterAdminService.import_csv_voters(session, election_id, content)
    return ApiResponse(
        status="success",
        data={"imported_count": imported_count},
    )


@router.get(
    "/elections/{election_id}/voters",
    response_model=ApiResponse[list[VoterRecordResponse]],
)
async def list_voters(
    election_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    query: str | None = None,
    eligibility_status: str | None = None,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    voters = await VoterAdminService.list_voters(
        session, election_id, page=page, page_size=page_size, query=query, eligibility_status=eligibility_status
    )
    return ApiResponse(
        status="success",
        data=[VoterRecordResponse.model_validate(v) for v in voters],
    )


@router.post(
    "/elections/{election_id}/voters",
    response_model=ApiResponse[VoterRecordResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_single_voter(
    election_id: uuid.UUID,
    voter_in: VoterRecordCreate,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    voter = await VoterAdminService.add_single_voter(session, election_id, voter_in)
    return ApiResponse(
        status="success",
        data=VoterRecordResponse.model_validate(voter),
    )


@router.delete(
    "/elections/{election_id}/voters/{voter_id}",
    response_model=ApiResponse[dict[str, Any]],
)
async def delete_voter(
    election_id: uuid.UUID,
    voter_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    await VoterAdminService.delete_voter(session, election_id, voter_id)
    return ApiResponse(
        status="success",
        data={"deleted": True},
    )


@router.post(
    "/elections/{election_id}/access-codes/generate",
    response_model=ApiResponse[AccessCodeListResponse],
)
async def generate_access_codes(
    election_id: uuid.UUID,
    payload: GenerateAccessCodesRequest,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    result = await VoterAdminService.generate_access_codes(
        session, election_id, count=payload.count
    )
    return ApiResponse(
        status="success",
        data=AccessCodeListResponse(
            items=[AccessCodeItem.model_validate(it) for it in result["items"]],
            total_count=result["total_count"],
            unused_count=result["unused_count"],
            used_count=result["used_count"],
        ),
    )


@router.get(
    "/elections/{election_id}/access-codes",
    response_model=ApiResponse[AccessCodeListResponse],
)
async def list_access_codes(
    election_id: uuid.UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    result = await VoterAdminService.list_access_codes(
        session, election_id, status_filter=status_filter
    )
    return ApiResponse(
        status="success",
        data=AccessCodeListResponse(
            items=[AccessCodeItem.model_validate(it) for it in result["items"]],
            total_count=result["total_count"],
            unused_count=result["unused_count"],
            used_count=result["used_count"],
        ),
    )


@router.get(
    "/elections/{election_id}/access-codes/export",
)
async def export_access_codes(
    election_id: uuid.UUID,
    session: AsyncSession = Depends(get_election_session),
    current_user: User = Depends(get_current_user),
):
    csv_content = await VoterAdminService.export_access_codes_csv(session, election_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="election-{election_id}-access-codes.csv"'},
    )

