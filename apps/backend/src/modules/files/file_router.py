from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import get_db
from apps.backend.src.core.deps import get_current_user
from apps.backend.src.modules.files.models import MediaAsset, FileKind
from apps.backend.src.modules.files.schemas import FileInfo
from apps.backend.src.modules.files.service import register_media
from apps.backend.src.modules.users.models import User
from apps.backend.src.services.storage import store_bytes

router = APIRouter(prefix="/files", tags=["files"])

_IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_VIDEO_MAX_BYTES = 200 * 1024 * 1024  # 200 MB


def _guess_kind(content_type: Optional[str]) -> FileKind:
    if not content_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing content type")
    if content_type.startswith("image/"):
        return FileKind.IMAGE
    if content_type.startswith("video/"):
        return FileKind.VIDEO
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media type")


@router.post(
    "",
    response_model=FileInfo,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a media file",
)
async def upload_file(
    *,
    file: UploadFile = File(..., description="Image or video file"),
    draft_id: Optional[int] = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileInfo:
    kind = _guess_kind(file.content_type)
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File payload is empty")

    limit = _IMAGE_MAX_BYTES if kind is FileKind.IMAGE else _VIDEO_MAX_BYTES
    if len(payload) > limit:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds allowed size")

    prefix = f"drafts/{draft_id}" if draft_id else f"users/{user.id}"
    stored = store_bytes(
        settings.SEAWEEDFS_BUCKET_DRAFT_MEDIA,
        data=payload,
        content_type=file.content_type,
        prefix=prefix,
    )
    media = await register_media(
        db,
        owner_user_id=user.id,
        draft_id=draft_id,
        stored_object=stored,
        kind=kind,
        original_filename=file.filename,
    )
    return FileInfo.model_validate(media)


@router.get(
    "/{file_id}",
    response_model=FileInfo,
    summary="Retrieve metadata for a media file",
)
async def get_file_info(
    file_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileInfo:
    media = await db.get(MediaAsset, file_id)
    if media is None or media.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileInfo.model_validate(media)


__all__ = ["router"]
