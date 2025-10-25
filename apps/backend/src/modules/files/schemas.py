from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from apps.backend.src.modules.files.models import FileKind


class FileInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int
    draft_id: Optional[int] = None
    kind: FileKind
    url: str
    content_type: Optional[str] = None
    size: int
    original_filename: Optional[str] = None
    created_at: datetime
