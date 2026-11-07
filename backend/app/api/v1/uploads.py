import os
import uuid
from pathlib import Path

import anyio
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.dependencies import get_current_user
from app.core.errors import AppException, ErrorCode
from app.models.identity import User
from app.schemas.common import ApiResponse

router = APIRouter(tags=["Uploads & Media Management"])

ALLOWED_EXTENSIONS = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Persistent uploads directory
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "static" / "uploads" / "candidates"
ELECTION_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "static" / "uploads" / "elections"


@router.post(
    "/uploads/candidate-photo",
    response_model=ApiResponse[dict[str, str]],
    status_code=status.HTTP_201_CREATED,
)
async def upload_candidate_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[dict[str, str]]:
    """Securely upload and store a candidate profile photo."""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"Invalid image format '{ext}'. Allowed formats: PNG, JPEG, WebP, GIF",
        )

    # Validate Content-Type if provided
    content_type = file.content_type
    if content_type and not content_type.startswith("image/"):
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"Only image files are permitted. Received content-type: {content_type}",
        )

    content = await file.read()
    if not content:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            "Uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    # Ensure upload directory exists asynchronously
    await anyio.Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Generate cryptographically random secure filename
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = UPLOAD_DIR / safe_filename

    # Save to disk asynchronously
    await anyio.Path(target_path).write_bytes(content)

    photo_url = f"/static/uploads/candidates/{safe_filename}"
    return ApiResponse(
        data={"photo_url": photo_url},
        error=None,
    )



@router.post(
    "/uploads/election-photo",
    response_model=ApiResponse[dict[str, str]],
    status_code=status.HTTP_201_CREATED,
)
async def upload_election_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[dict[str, str]]:
    """Securely upload and store an election profile photo / logo."""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"Invalid image format '{ext}'. Allowed formats: PNG, JPEG, WebP, GIF",
        )

    # Validate Content-Type if provided
    content_type = file.content_type
    if content_type and not content_type.startswith("image/"):
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"Only image files are permitted. Received content-type: {content_type}",
        )

    content = await file.read()
    if not content:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            "Uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            ErrorCode.MALFORMED_REQUEST,
            f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    # Ensure upload directory exists asynchronously
    await anyio.Path(ELECTION_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Generate cryptographically random secure filename
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = ELECTION_UPLOAD_DIR / safe_filename

    # Save to disk asynchronously
    await anyio.Path(target_path).write_bytes(content)

    photo_url = f"/static/uploads/elections/{safe_filename}"
    return ApiResponse(
        data={"photo_url": photo_url},
        error=None,
    )
