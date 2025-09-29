from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.modules.insights.schemas import InsightOut
from apps.backend.src.modules.insights.service import ingest_insight_sample
from apps.backend.src.modules.users.models import User
from apps.backend.src.workers.Adapter.tasks import sync_metrics_with_adapter
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.accounts.service import _load_platform_account
from apps.backend.src.modules.drafts.service import _load_post_publication
from apps.backend.src.orchestrator.flows.internal.drafts import _build_adapter_credentials
from apps.backend.src.modules.adapters.core.types import MetricsResult
from apps.backend.src.modules.insights.schemas import InsightIn, InsightSource
import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel


"""
ingest 하는 것은 이미 있으므로 external_id 기준으로 조회해서 ingest 넘기기
"""

class SyncMetricsParams(BaseModel):
    persona_account_id: int
    post_publication_id: int
    platform: PlatformKind

@operator(
    key="internal.insights.sync_metrics",
    title="Sync Metrics",
    side_effect="write",
)
async def op_sync_metrics(
    payload: SyncMetricsParams,
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
    credentials = _build_adapter_credentials(platform_account)
    post_publication = await _load_post_publication(db, post_publication_id=payload.post_publication_id, persona_account_id=payload.persona_account_id)

    external_id = post_publication.external_id
    if external_id is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    if payload.platform != post_publication.platform:
        raise HTTPException(status_code=404, detail="Publication not found")

    metrics: MetricsResult = await sync_metrics_with_adapter(platform=payload.platform, external_id=external_id, credentials=credentials)
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
        raw=metrics.raw,
        warnings=metrics.warnings,
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
    input_model=SyncMetricsParams,
    output_model=InsightOut,
)
def _build_sync_metrics(builder: FlowBuilder):
    task = builder.task("sync_metrics", "internal.insights.sync_metrics")
    builder.expect_terminal(task)