"""BFF flows for playbook resources."""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.playbooks.schemas import PlaybookOut
from apps.backend.src.modules.playbooks.service import list_playbooks, search_playbooks
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class PlaybookListPayload(BaseModel):
    persona_id: Optional[int] = Field(default=None, description="Filter by persona id")
    campaign_id: Optional[int] = Field(default=None, description="Filter by campaign id")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

class PlaybookSearchPayload(BaseModel):
    playbook_id: Optional[int] = Field(default=None, description="Filter by playbook id")
    campaign_id: Optional[int] = Field(default=None, description="Filter by campaign id")
    persona_id: Optional[int] = Field(default=None, description="Filter by persona id")
    last_event: Optional[str] = Field(default=None, description="Filter by last event")

class PlaybookSearchResponse(BaseModel):
    items: List[PlaybookOut]
    total: int

class PlaybookListResponse(BaseModel):
    items: List[PlaybookOut]
    total: int
    limit: int
    offset: int


@operator(
    key="bff.playbook.list_playbooks",
    title="List Playbooks",
    side_effect="read",
)
async def op_list_playbooks(
    payload: PlaybookListPayload,
    ctx: TaskContext,
) -> PlaybookListResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    if payload.persona_id is not None:
        persona = await get_persona(db, persona_id=payload.persona_id, owner_user_id=user.id)
        if persona is None:
            raise HTTPException(status_code=404, detail="Persona not found")

    rows, total = await list_playbooks(
        db,
        owner_user_id=user.id,
        persona_id=payload.persona_id,
        campaign_id=payload.campaign_id,
        limit=payload.limit,
        offset=payload.offset,
    )
    items = [PlaybookOut.model_validate(row) for row in rows]
    return PlaybookListResponse(
        items=items,
        total=total,
        limit=payload.limit,
        offset=payload.offset,
    )

@operator(
    key="bff.playbook.get_playbook",
    title="Get Playbook",
    side_effect="read",
)
async def op_get_playbook(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> PlaybookSearchResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    rows, total = await search_playbooks(db, **payload.model_dump())
    items = [PlaybookOut.model_validate(row) for row in rows]
    return PlaybookSearchResponse(items=items, total=total)

@FLOWS.flow(
    key="bff.playbook.list_playbooks",
    title="List Playbooks",
    description="List my playbooks with optional filtering.",
    input_model=PlaybookListPayload,
    output_model=PlaybookListResponse,
    method="get",
    path="/playbooks",
    tags=("bff", "playbooks", "read", "ui"),
)
def _flow_bff_list_playbooks(builder: FlowBuilder) -> None:
    task = builder.task("list_playbooks", "bff.playbook.list_playbooks")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.playbook.get_playbook",
    title="Get Playbook",
    description="Get a playbook by id",
    input_model=PlaybookGetPayload,
    output_model=PlaybookGetResponse,
    method="get",
    path="/playbooks/{playbook_id}",
    tags=("bff", "playbooks", "read", "ui"),
)
def _flow_bff_get_playbook(builder: FlowBuilder) -> None:
    task = builder.task("get_playbook", "bff.playbook.get_playbook")
    builder.expect_terminal(task)


__all__ = [
    "PlaybookListPayload",
    "PlaybookListResponse",
    "op_list_playbooks",
]
