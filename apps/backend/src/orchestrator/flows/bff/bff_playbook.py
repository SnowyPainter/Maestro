"""BFF flows for playbook resources."""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.playbooks.schemas import PlaybookOut
from apps.backend.src.modules.playbooks.service import list_playbooks
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class PlaybookListPayload(BaseModel):
    persona_id: Optional[int] = Field(default=None, description="Filter by persona id")
    campaign_id: Optional[int] = Field(default=None, description="Filter by campaign id")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


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


__all__ = [
    "PlaybookListPayload",
    "PlaybookListResponse",
    "op_list_playbooks",
]
