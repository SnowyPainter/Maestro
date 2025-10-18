from pydantic import BaseModel, Field

from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.modules.insights.schemas import InsightCommentIn, InsightOut, InsightCommentList
from apps.backend.src.modules.insights.service import ingest_insight_sample, list_insight_comments, upsert_insight_comments
from apps.backend.src.modules.users.models import User
from apps.backend.src.workers.Adapter.tasks import sync_metrics_with_adapter
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.accounts.service import (
    _load_platform_account,
    ensure_platform_account_credentials,
)
from apps.backend.src.modules.drafts.service import _load_post_publication
from apps.backend.src.orchestrator.flows.internal.drafts import _build_adapter_credentials
from apps.backend.src.modules.adapters.core.types import MetricsResult
from apps.backend.src.modules.insights.schemas import InsightIn, InsightSource
import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.scheduler.schemas import SyncMetricsTemplateParams


"""
ingest 하는 것은 이미 있으므로 external_id 기준으로 조회해서 ingest 넘기기
"""

@operator(
    key="internal.insights.sync_metrics",
    title="Sync Metrics",
    side_effect="write",
)
async def op_sync_metrics(
    payload: SyncMetricsTemplateParams,
    ctx: TaskContext,
) -> InsightOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User | None = ctx.optional(User)

    platform_account = await _load_platform_account(
        db,
        persona_account_id=payload.persona_account_id,
        platform=payload.platform,
        owner_user_id=user.id if user else None,
    )
    platform_account = await ensure_platform_account_credentials(db, account=platform_account)
    credentials = _build_adapter_credentials(platform_account)
    post_publication = await _load_post_publication(db, post_publication_id=payload.post_publication_id, persona_account_id=payload.persona_account_id)

    external_id = post_publication.external_id
    if external_id is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    if payload.platform != post_publication.platform:
        raise HTTPException(status_code=404, detail="Publication not found")

    metrics: MetricsResult = await sync_metrics_with_adapter(
        platform=payload.platform,
        external_id=external_id,
        credentials=credentials,
    )

    comment_payloads: list[InsightCommentIn] = []
    if metrics.comments:
        for comment in metrics.comments:
            comment_payloads.append(
                InsightCommentIn(
                    owner_user_id=user.id if user else None,
                    post_publication_id=payload.post_publication_id,
                    platform=payload.platform,
                    platform_post_id=external_id,
                    account_persona_id=payload.persona_account_id,
                    comment_external_id=comment.external_id,
                    parent_external_id=comment.parent_external_id,
                    author_id=comment.author_id,
                    author_username=comment.author_username,
                    text=comment.text,
                    permalink=comment.permalink,
                    comment_created_at=comment.created_at,
                    metrics=comment.metrics,
                    raw=comment.raw or {},
                )
            )
        await upsert_insight_comments(db, comment_payloads)

    combined_warnings = list(metrics.warnings or [])
    if metrics.comment_warnings:
        combined_warnings.extend(metrics.comment_warnings)
    if metrics.comment_errors:
        combined_warnings.extend([f"comment_error:{msg}" for msg in metrics.comment_errors])

    raw_payload = dict(metrics.raw or {})
    if metrics.comments_next_cursor:
        raw_payload["_comment_next_cursor"] = metrics.comments_next_cursor

    insight_in = InsightIn(
        owner_user_id=user.id if user else None,
        post_publication_id=payload.post_publication_id,
        platform_post_id=external_id,
        account_persona_id=payload.persona_account_id,
        ts=post_publication.published_at,
        platform=payload.platform,
        metrics=metrics.metrics,
        scope=metrics.scope,
        content_kind=metrics.content_kind,
        mapping_version=metrics.mapping_version,
        raw=raw_payload,
        warnings=combined_warnings,
        source=InsightSource.POLL,
        ingest_key=str(uuid.uuid4().hex),
    )
    insight_sample = await ingest_insight_sample(db, insight_in)
    return InsightOut(
        id=insight_sample.id,
        ingested_at=insight_sample.ingested_at,
        owner_user_id=insight_sample.owner_user_id,
        post_publication_id=insight_sample.post_publication_id,
        platform=insight_sample.platform,
        platform_post_id=insight_sample.platform_post_id,
        account_persona_id=insight_sample.account_persona_id,
        ts=insight_sample.ts,
        metrics=insight_sample.metrics or {},
        scope=insight_sample.scope,
        content_kind=insight_sample.content_kind,
        mapping_version=insight_in.mapping_version,
        raw=insight_in.raw,
        warnings=insight_in.warnings,
        source=insight_sample.source,
        ingest_key=insight_sample.ingest_key,
    )

@FLOWS.flow(
    key="internal.insights.sync_metrics",
    title="Sync Metrics",
    input_model=SyncMetricsTemplateParams,
    output_model=InsightOut,
)
def _build_sync_metrics(builder: FlowBuilder):
    task = builder.task("sync_metrics", "internal.insights.sync_metrics")
    builder.expect_terminal(task)


class InsightCommentQuery(BaseModel):
    post_publication_id: int
    persona_account_id: int
    limit: int = Field(10, ge=1, le=50)


@operator(
    key="internal.insights.list_comments",
    title="List Insight Comments",
    side_effect="read",
)
async def op_list_insight_comments(
    payload: InsightCommentQuery,
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
    key="internal.insights.list_comments",
    title="List Insight Comments",
    description="Fetch stored comments for a publication with hotness ordering",
    input_model=InsightCommentQuery,
    output_model=InsightCommentList,
    method="get",
    path="/internal/insights/{post_publication_id}/comments",
    tags=("internal", "insights", "comments"),
)
def _flow_list_insight_comments(builder: FlowBuilder):
    task = builder.task("list_comments", "internal.insights.list_comments")
    builder.expect_terminal(task)
