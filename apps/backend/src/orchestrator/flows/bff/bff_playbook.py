"""BFF flows for playbook resources."""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.campaigns.service import get_campaign
from apps.backend.src.modules.playbooks.schemas import PlaybookOut, PlaybookEnrichedOut
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
    items: List[PlaybookEnrichedOut]
    total: int

class PlaybookListResponse(BaseModel):
    items: List[PlaybookEnrichedOut]
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

    # Enrich playbooks with campaign and persona names
    enriched_items = []
    for row in rows:
        campaign = await get_campaign(db, campaign_id=row.campaign_id, owner_user_id=user.id)
        persona = await get_persona(db, persona_id=row.persona_id, owner_user_id=user.id)

        if campaign is None or persona is None:
            continue  # Skip if campaign or persona not found

        enriched = PlaybookEnrichedOut(
            **row.__dict__,
            campaign_name=campaign.name,
            campaign_description=campaign.description,
            persona_name=persona.name,
            persona_bio=persona.bio,
        )
        enriched_items.append(enriched)

    return PlaybookListResponse(
        items=enriched_items,
        total=total,
        limit=payload.limit,
        offset=payload.offset,
    )

@operator(
    key="bff.playbook.search_playbooks",
    title="Search Playbooks",
    side_effect="read",
)
async def op_search_playbooks(
    payload: PlaybookSearchPayload,
    ctx: TaskContext,
) -> PlaybookSearchResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    rows, total = await search_playbooks(db, **payload.model_dump())

    # Enrich playbooks with campaign and persona names
    enriched_items = []
    for row in rows:
        campaign = await get_campaign(db, campaign_id=row.campaign_id, owner_user_id=user.id)
        persona = await get_persona(db, persona_id=row.persona_id, owner_user_id=user.id)

        if campaign is None or persona is None:
            continue  # Skip if campaign or persona not found

        enriched = PlaybookEnrichedOut(
            **row.__dict__,
            campaign_name=campaign.name,
            campaign_description=campaign.description,
            persona_name=persona.name,
            persona_bio=persona.bio,
        )
        enriched_items.append(enriched)

    return PlaybookSearchResponse(items=enriched_items, total=total)

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
    key="bff.playbook.search_playbooks",
    title="Search Playbooks",
    description="Search playbooks with optional filtering.",
    input_model=PlaybookSearchPayload,
    output_model=PlaybookSearchResponse,
    method="get",
    path="/playbooks/search",
    tags=("bff", "playbooks", "search", "pagination", "ui", "frontend", "dashboard"),
)
def _flow_bff_search_playbooks(builder: FlowBuilder) -> None:
    task = builder.task("search_playbooks", "bff.playbook.search_playbooks")
    builder.expect_terminal(task)

__all__ = [
    "PlaybookListPayload",
    "PlaybookListResponse",
    "PlaybookSearchPayload",
    "PlaybookSearchResponse",
    "op_list_playbooks",
    "op_search_playbooks",
]
