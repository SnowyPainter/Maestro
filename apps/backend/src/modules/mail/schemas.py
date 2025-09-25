from typing import Dict
from pydantic import BaseModel
from apps.backend.src.modules.drafts.schemas import DraftIR

class EmailMetadata(BaseModel):
    title: str
    tags: list[str]
    pipeline_id: str
    settings: Dict[str, str]

class Email(BaseModel):
    metadata: EmailMetadata
    subject: str
    from_email: str
    body: DraftIR