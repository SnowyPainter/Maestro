"""BFF read flows for insights resources."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.modules.insights.schemas import InsightCommentList, InsightCommentOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.modules.users.models import User
from apps.backend.src.modules.insights.schemas import InsightCommentList, InsightCommentOut
from apps.backend.src.modules.insights.service import list_insight_comments
from apps.backend.src.modules.accounts.service import _load_platform_account
from apps.backend.src.modules.drafts.service import _load_post_publication

class InsightCommentListPayload(BaseModel):
    post_publication_id: int
    persona_account_id: Optional[int] = None
    limit: int = 20

@operator(
    key="bff.insights.comments.list",
    title="List Insight Comments",
    side_effect="read",
)
async def op_list_insight_comments(
    payload: InsightCommentListPayload,
    ctx: TaskContext,
) -> InsightCommentList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User | None = ctx.optional(User)

    publication = await _load_post_publication(
        db,
        post_publication_id=payload.post_publication_id,
        persona_account_id=payload.persona_account_id,
    )

    if user is not None:
        await _load_platform_account(
            db,
            persona_account_id=payload.persona_account_id,
            platform=publication.platform,
            owner_user_id=user.id,
        )

    comments = await list_insight_comments(
        db,
        post_publication_id=payload.post_publication_id,
        persona_account_id=payload.persona_account_id,
        limit=payload.limit,
    )
    return comments


@FLOWS.flow(
    key="bff.insights.comments.list",
    title="List Comments",
    description="List comments for a post publication.",
    input_model=InsightCommentListPayload,
    output_model=InsightCommentList,
    method="get",
    path="/insights/{post_publication_id}/comments",
    tags=("bff", "insights", "comments"),
)
def _flow_bff_list_comments(builder: FlowBuilder):
    task = builder.task("list_comments", "bff.insights.comments.list")
    builder.expect_terminal(task)

__all__ = [
    "InsightCommentListPayload",
]
