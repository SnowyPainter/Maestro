from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.files.models import MediaAsset, FileKind
from apps.backend.src.services.storage import StoredObject


async def register_media(
    db: AsyncSession,
    *,
    owner_user_id: int,
    stored_object: StoredObject,
    kind: FileKind,
    draft_id: int | None = None,
    original_filename: str | None = None,
) -> MediaAsset:
    media = MediaAsset(
        owner_user_id=owner_user_id,
        draft_id=draft_id,
        kind=kind,
        bucket=stored_object.bucket,
        object_name=stored_object.object_name,
        url=stored_object.url,
        content_type=stored_object.content_type,
        size=stored_object.size,
        original_filename=original_filename,
    )
    db.add(media)
    await db.flush()
    await db.commit()
    await db.refresh(media)
    return media


__all__ = ["register_media"]
