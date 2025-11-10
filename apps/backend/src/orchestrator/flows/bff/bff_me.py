"""BFF read flow for current user."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.config import settings
from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.drafts.models import Draft, DraftVariant
from apps.backend.src.modules.link_tracking.models import TrackingLink
from apps.backend.src.modules.users.models import User
from apps.backend.src.modules.users.schemas import UserResponse
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class MeRequest(BaseModel):
    pass


class TrackingLinkListRequest(BaseModel):
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)
    search_url: Optional[str] = Field(None, description="Filter links that contain the substring in target URL")
    search_post: Optional[str] = Field(None, description="Filter links by associated draft title or identifier")


class TrackingLinkItem(BaseModel):
    id: int
    token: str
    target_url: str
    public_url: str
    visit_count: int
    last_visited_at: Optional[datetime]
    created_at: datetime
    persona_id: int
    persona_name: Optional[str] = None
    draft_id: Optional[int] = None
    draft_title: Optional[str] = None
    variant_id: Optional[int] = None
    platform: Optional[str] = None

class TrackingLinkListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[TrackingLinkItem]


@operator(
    key="bff.me.read_me",
    title="BFF Read Current User",
    side_effect="read",
)
async def op_read_me(payload: MeRequest, ctx: TaskContext) -> UserResponse:
    user: User = ctx.require(User)
    return UserResponse.model_validate(user)


@operator(
    key="bff.me.list_tracking_links",
    title="List tracking links for current user",
    side_effect="read",
)
async def op_list_tracking_links(
    payload: TrackingLinkListRequest,
    ctx: TaskContext,
) -> TrackingLinkListResponse:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    base_stmt = (
        select(
            TrackingLink,
            Persona.name.label("persona_name"),
            Draft.title.label("draft_title"),
            DraftVariant.platform.label("platform"),
            DraftVariant.draft_id.label("variant_draft_id"),
        )
        .join(Persona, TrackingLink.persona_id == Persona.id)
        .outerjoin(DraftVariant, TrackingLink.variant_id == DraftVariant.id)
        .outerjoin(
            Draft,
            or_(
                TrackingLink.draft_id == Draft.id,
                DraftVariant.draft_id == Draft.id,
            ),
        )
        .where(TrackingLink.owner_user_id == user.id)
    )

    if payload.search_url:
        pattern = f"%{payload.search_url}%"
        base_stmt = base_stmt.where(TrackingLink.target_url.ilike(pattern))

    if payload.search_post:
        pattern = f"%{payload.search_post}%"
        base_stmt = base_stmt.where(
            or_(
                Draft.title.ilike(pattern),
                TrackingLink.token.ilike(pattern),
                TrackingLink.id.cast(String).ilike(pattern),
            )
        )

    count_stmt = select(func.count()).select_from(base_stmt.order_by(None).subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    query = (
        base_stmt.order_by(TrackingLink.created_at.desc())
        .offset(payload.offset)
        .limit(payload.limit)
    )
    rows = (await db.execute(query)).all()

    public_base = (settings.LINK_TRACKING_PUBLIC_BASE or settings.API_PUBLIC_BASE).rstrip("/")

    items: list[TrackingLinkItem] = []
    for link, persona_name, draft_title, platform, variant_draft_id in rows:
        draft_id = link.draft_id or variant_draft_id
        items.append(
            TrackingLinkItem(
                id=link.id,
                token=link.token,
                target_url=link.target_url,
                public_url=f"{public_base}/l/{link.token}",
                visit_count=link.visit_count or 0,
                last_visited_at=link.last_visited_at,
                platform=platform,
                created_at=link.created_at,
                persona_id=link.persona_id,
                persona_name=persona_name,
                draft_id=draft_id,
                draft_title=draft_title,
                variant_id=link.variant_id,
            )
        )

    return TrackingLinkListResponse(
        total=total,
        limit=payload.limit,
        offset=payload.offset,
        items=items,
    )


@FLOWS.flow(
    key="bff.me.read_me",
    title="Get Current User Profile",
    description="Retrieve authenticated user profile information for user interface and settings",
    input_model=MeRequest,
    output_model=UserResponse,
    method="get",
    path="/me",
    tags=("bff", "me", "user", "profile", "read", "ui", "frontend", "authentication"),
)
def _flow_bff_read_me(builder: FlowBuilder):
    task = builder.task("read_me", "bff.me.read_me")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.me.list_tracking_links",
    title="List Tracking Links",
    description="List tracking links owned by the current user with pagination and optional search filters",
    input_model=TrackingLinkListRequest,
    output_model=TrackingLinkListResponse,
    method="get",
    path="/me/links",
    tags=("bff", "me", "links", "tracking", "pagination", "search"),
)
def _flow_bff_list_tracking_links(builder: FlowBuilder):
    task = builder.task("list_links", "bff.me.list_tracking_links")
    builder.expect_terminal(task)


__all__ = []
