from typing import Literal, Union, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, conlist, ConfigDict

class BlockText(BaseModel):
    type: Literal["text"]
    props: dict  # {"markdown": "...", "mentions":[...]} 등

class BlockImage(BaseModel):
    type: Literal["image"]
    props: dict  # {"asset_id": int, "alt": str|None, "crop": "1:1"|"4:5"|"9:16"}

class BlockVideo(BaseModel):
    type: Literal["video"]
    props: dict  # {"asset_id": int, "caption": str|None, "ratio": "9:16"}

Block = Union[BlockText, BlockImage, BlockVideo]

class DraftIR(BaseModel):
    blocks: conlist(Block, min_length=1)
    options: dict = Field(default_factory=dict)

class DraftSaveRequest(BaseModel):
    campaign_id: Optional[int] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    goal: Optional[str] = None
    ir: DraftIR

class DraftDeleteCommand(BaseModel):
    draft_id: Optional[int] = None

class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    campaign_id: Optional[int] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    goal: Optional[str] = None
    ir: DraftIR
    schema_version: int
    ir_revision: int
    state: str  # DraftState enum value
    monitoring_started_at: Optional[datetime] = None
    monitoring_ended_at: Optional[datetime] = None
    created_by: int
    created_at: datetime
    updated_at: datetime


class DraftVariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    draft_id: int
    platform: str  # PlatformKind enum value
    status: str  # VariantStatus enum value
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    rendered_caption: Optional[str] = None
    rendered_blocks: Optional[dict] = None
    metrics: Optional[dict] = None
    compiled_at: Optional[datetime] = None
    ir_revision_compiled: Optional[int] = None
    compiler_version: int
    created_at: datetime
    updated_at: datetime
