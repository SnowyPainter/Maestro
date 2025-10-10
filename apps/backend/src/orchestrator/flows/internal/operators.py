"""Reusable internal mail operators shared across flows."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Any, Iterable, List, Optional

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import operator
from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.trends.repository import vector_search_trends
from apps.backend.src.modules.trends.schemas import TrendItem, TrendsListResponse
from apps.backend.src.orchestrator.flows.bff.bff_trends import TrendsQueryPayload
from apps.backend.src.orchestrator.adapters.draft import trends_to_draft_adapter
from apps.backend.src.core.resource import render_email_trends
from apps.backend.src.services.embeddings import embed_texts_sync
from apps.backend.src.services.mailer import get_mailer, new_pipeline_id
from apps.backend.src.workers.CoWorker.runtime import request_reschedule

logger = logging.getLogger(__name__)


class ComposeTrendsEmailPayload(BaseModel):
    persona_id: int
    email_to: EmailStr
    country: str = "US"
    limit: int = 20
    pipeline_id: str | None = None
    subject: str | None = None


class ComposeTrendsEmailResult(BaseModel):
    ok: bool
    sent: bool
    total: int
    persona_name: str | None = None
    pipeline_id: str | None = None
    subject: str | None = None
    reason: str | None = None


class PersonaProfile(BaseModel):
    persona_id: int
    persona_name: str | None = None
    persona_bio: str | None = None
    ok: bool = True
    reason: str | None = None


class PersonaEmbeddingResult(PersonaProfile):
    embedding: Optional[List[float]] = None


class FetchSimilarTrendsPayload(PersonaEmbeddingResult):
    country: str = "US"
    limit: int = 20


class SimilarTrendsResult(BaseModel):
    ok: bool
    persona_id: int
    persona_name: str | None = None
    country: str
    items: List[TrendItem] = Field(default_factory=list)
    total: int = 0
    reason: str | None = None


class PrepareTrendsEmailPayload(BaseModel):
    email_to: EmailStr
    subject: str | None = None
    pipeline_id: str | None = None
    persona_id: int
    persona_name: str | None = None
    country: str
    items: List[TrendItem] = Field(default_factory=list)
    total: int = 0
    ok: bool = True
    reason: str | None = None


class PreparedTrendsEmail(BaseModel):
    ok: bool
    should_send: bool
    total: int
    persona_name: str | None = None
    pipeline_id: str | None = None
    subject: str | None = None
    email_to: EmailStr | None = None
    html_body: str | None = None
    reason: str | None = None


class AwaitReplyPayload(BaseModel):
    pipeline_id: str | None = None
    timeout_s: int | None = None
    should_wait: bool = True
    reason: str | None = None


def _merge_trend_items(items: Iterable[TrendItem]) -> List[TrendItem]:
    return [TrendItem.model_validate(item) if not isinstance(item, TrendItem) else item for item in items]


@operator(
    key="internal.mail.load_persona_profile",
    title="Load Persona Profile",
    side_effect="read",
)
async def op_load_persona_profile(
    payload: ComposeTrendsEmailPayload,
    ctx: TaskContext,
) -> PersonaProfile:
    db: AsyncSession = ctx.require(AsyncSession)
    persona: Persona | None = await db.get(Persona, payload.persona_id)
    if persona is None:
        return PersonaProfile(
            persona_id=payload.persona_id,
            ok=False,
            reason=f"persona:{payload.persona_id} not found",
        )
    return PersonaProfile(
        persona_id=persona.id,
        persona_name=persona.name,
        persona_bio=persona.bio,
    )


@operator(
    key="internal.mail.embed_persona_profile",
    title="Embed Persona Profile",
    side_effect="read",
)
async def op_embed_persona_profile(
    payload: PersonaProfile,
    ctx: TaskContext,
) -> PersonaEmbeddingResult:
    if not payload.ok:
        return PersonaEmbeddingResult(**payload.model_dump(), embedding=None)

    persona_text = f"{payload.persona_name or ''} {payload.persona_bio or ''}".strip()
    if not persona_text:
        persona_text = payload.persona_name or ""

    embeddings = await asyncio.to_thread(embed_texts_sync, [persona_text])
    vector = embeddings[0] if embeddings else None
    if vector is None:
        return PersonaEmbeddingResult(
            **payload.model_dump(),
            ok=False,
            reason="persona_embedding_failed",
            embedding=None,
        )
    return PersonaEmbeddingResult(
        **payload.model_dump(),
        embedding=vector,
    )


@operator(
    key="internal.mail.fetch_similar_trends",
    title="Fetch Similar Trends",
    side_effect="read",
)
async def op_fetch_similar_trends(
    payload: FetchSimilarTrendsPayload,
    ctx: TaskContext,
) -> SimilarTrendsResult:
    if not payload.ok:
        return SimilarTrendsResult(
            ok=False,
            persona_id=payload.persona_id,
            persona_name=payload.persona_name,
            country=payload.country,
            items=[],
            total=0,
            reason=payload.reason or "persona_unavailable",
        )

    if not payload.embedding:
        return SimilarTrendsResult(
            ok=False,
            persona_id=payload.persona_id,
            persona_name=payload.persona_name,
            country=payload.country,
            items=[],
            total=0,
            reason="persona_embedding_missing",
        )

    db: AsyncSession = ctx.require(AsyncSession)
    rows = await vector_search_trends(
        db,
        country=payload.country,
        vec=payload.embedding,
        limit=max(payload.limit * 2, payload.limit),
    )
    items = [TrendItem.model_validate(row) for row in rows[: payload.limit]]
    if not items:
        return SimilarTrendsResult(
            ok=True,
            persona_id=payload.persona_id,
            persona_name=payload.persona_name,
            country=payload.country,
            items=[],
            total=0,
            reason="no_similar_trends",
        )
    return SimilarTrendsResult(
        ok=True,
        persona_id=payload.persona_id,
        persona_name=payload.persona_name,
        country=payload.country,
        items=items,
        total=len(items),
    )


@operator(
    key="internal.mail.prepare_trends_email",
    title="Prepare Trends Email",
    side_effect="read",
)
async def op_prepare_trends_email(
    payload: PrepareTrendsEmailPayload,
    ctx: TaskContext,
) -> PreparedTrendsEmail:
    schedule_context = ctx.optional(dict, name="schedule_context") or {}
    idempotency_key = ctx.optional(str, name="idempotency_key")
    pipeline_id = (
        payload.pipeline_id
        or schedule_context.get("pipeline_id")
        or idempotency_key
        or new_pipeline_id()
    )

    if not payload.ok:
        return PreparedTrendsEmail(
            ok=False,
            should_send=False,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=pipeline_id,
            subject=payload.subject,
            email_to=payload.email_to,
            reason=payload.reason,
        )

    items = _merge_trend_items(payload.items)
    if not items:
        return PreparedTrendsEmail(
            ok=True,
            should_send=False,
            total=0,
            persona_name=payload.persona_name,
            pipeline_id=pipeline_id,
            subject=payload.subject,
            email_to=payload.email_to,
            reason="no_similar_trends",
        )

    trends_response = TrendsListResponse(
        country=payload.country,
        source="vector",
        query=None,
        items=items,
    )
    query_payload = TrendsQueryPayload(country=payload.country, limit=len(items))
    draft_payload = trends_to_draft_adapter(
        trends_response,
        query_payload.model_dump() if hasattr(query_payload, "model_dump") else query_payload.dict(),
    )
    draft_ir: Any = draft_payload["ir"] if isinstance(draft_payload, dict) else draft_payload.ir  # type: ignore[attr-defined]

    subject = payload.subject or f"Here's new trends for {payload.persona_name or 'you'}"
    html_body = render_email_trends(
        draft_ir,
        pipeline_id=pipeline_id,
        name=payload.persona_name or "",
    )

    return PreparedTrendsEmail(
        ok=True,
        should_send=True,
        total=len(items),
        persona_name=payload.persona_name,
        pipeline_id=pipeline_id,
        subject=subject,
        email_to=payload.email_to,
        html_body=html_body,
    )


@operator(
    key="internal.mail.send_trends_email",
    title="Send Trends Email",
    side_effect="write",
)
async def op_send_trends_email(
    payload: PreparedTrendsEmail,
    ctx: TaskContext,
) -> ComposeTrendsEmailResult:
    schedule_context = ctx.optional(dict, name="schedule_context") or {}
    # Idempotency guard: if we've already sent for this pipeline_id within this schedule, skip re-send
    already_sent_for = set(schedule_context.get("mail_sent_for_pipelines", []) or [])
    pid = payload.pipeline_id or schedule_context.get("pipeline_id")
    if pid and pid in already_sent_for:
        return ComposeTrendsEmailResult(
            ok=True,
            sent=False,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=payload.pipeline_id,
            subject=payload.subject,
            reason="already_sent",
        )
    if payload.pipeline_id:
        schedule_context["pipeline_id"] = payload.pipeline_id

    if not payload.ok:
        return ComposeTrendsEmailResult(
            ok=False,
            sent=False,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=payload.pipeline_id,
            subject=payload.subject,
            reason=payload.reason,
        )

    if not payload.should_send:
        return ComposeTrendsEmailResult(
            ok=True,
            sent=False,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=payload.pipeline_id,
            subject=payload.subject,
            reason=payload.reason,
        )

    mailer = get_mailer()
    try:
        await asyncio.to_thread(
            mailer.send_html,
            to_email=payload.email_to or "",
            subject=payload.subject or "",
            html_body=payload.html_body or "",
        )
        # mark as sent to prevent duplicates on resume/retry
        if pid:
            already_sent_for.add(pid)
            schedule_context["mail_sent_for_pipelines"] = sorted(already_sent_for)
        return ComposeTrendsEmailResult(
            ok=True,
            sent=True,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=payload.pipeline_id,
            subject=payload.subject,
        )
    except Exception as exc:  # pragma: no cover - email transport failures shouldn't crash flow
        logger.warning("Failed to send trends email: %s", exc)
        return ComposeTrendsEmailResult(
            ok=False,
            sent=False,
            total=payload.total,
            persona_name=payload.persona_name,
            pipeline_id=payload.pipeline_id,
            subject=payload.subject,
            reason="send_failed",
        )


DEFAULT_WAIT_SECONDS = 300


@operator(
    key="internal.mail.await_reply",
    title="Await Mail Reply",
    side_effect="write",
)
async def op_await_mail_reply(
    payload: AwaitReplyPayload,
    ctx: TaskContext,
) -> AwaitReplyPayload:
    schedule_context = ctx.optional(dict, name="schedule_context") or {}
    pipeline_id = payload.pipeline_id or schedule_context.get("pipeline_id")

    should_wait = payload.should_wait or (payload.reason == "already_sent")
    if payload.reason == "no_similar_trends":
        should_wait = False

    if not should_wait:
        dag_state = schedule_context.setdefault("_dag", {})
        skip_nodes = set()
        existing = dag_state.get("skip_nodes")
        if isinstance(existing, list):
            skip_nodes.update(str(node_id) for node_id in existing)
        skip_nodes.update(str(node_id) for node_id in ctx.task.downstream)
        dag_state["skip_nodes"] = sorted(skip_nodes)
        # preserve pipeline identifier if already available for downstream diagnostics
        if pipeline_id:
            schedule_context["pipeline_id"] = pipeline_id
        dag_state.pop("waiting_node", None)
        dag_state.pop("resume_next", None)
        dag_state.pop("wait_started_at", None)
        return AwaitReplyPayload(
            pipeline_id=pipeline_id,
            timeout_s=payload.timeout_s,
            should_wait=False,
            reason=payload.reason,
        )

    if not pipeline_id:
        raise RuntimeError("Missing pipeline_id; cannot await reply")

    timeout = payload.timeout_s or DEFAULT_WAIT_SECONDS
    delay = timedelta(seconds=timeout)

    schedule_id = ctx.require(int, name="schedule_id")
    schedule_context.update(
        {
            "pipeline_id": pipeline_id,
            "schedule_id": schedule_id,
            "wait_state": "mail_reply",
        }
    )

    raise request_reschedule(
        delay=delay,
        context=schedule_context,
        status="running",
    )


@operator(
    key="internal.mail.compose_trends_email",
    title="Compose & Send Persona Trends Email",
    side_effect="write",
)
async def op_compose_trends_email(
    payload: ComposeTrendsEmailPayload,
    ctx: TaskContext,
) -> ComposeTrendsEmailResult:
    profile = await op_load_persona_profile(payload, ctx)
    embedding = await op_embed_persona_profile(profile, ctx)

    fetch_payload = FetchSimilarTrendsPayload(
        **embedding.model_dump(),
        country=payload.country,
        limit=payload.limit,
    )
    trends = await op_fetch_similar_trends(fetch_payload, ctx)

    prepare_payload = PrepareTrendsEmailPayload(
        email_to=payload.email_to,
        subject=payload.subject,
        pipeline_id=payload.pipeline_id,
        persona_id=trends.persona_id,
        persona_name=trends.persona_name,
        country=payload.country,
        items=trends.items,
        total=trends.total,
        ok=trends.ok,
        reason=trends.reason,
    )
    prepared = await op_prepare_trends_email(prepare_payload, ctx)
    return await op_send_trends_email(prepared, ctx)


__all__ = [
    "ComposeTrendsEmailPayload",
    "ComposeTrendsEmailResult",
    "PersonaProfile",
    "PersonaEmbeddingResult",
    "FetchSimilarTrendsPayload",
    "SimilarTrendsResult",
    "PrepareTrendsEmailPayload",
    "PreparedTrendsEmail",
    "AwaitReplyPayload",
    "op_load_persona_profile",
    "op_embed_persona_profile",
    "op_fetch_similar_trends",
    "op_prepare_trends_email",
    "op_send_trends_email",
    "op_await_mail_reply",
    "op_compose_trends_email",
    "DEFAULT_WAIT_SECONDS",
]
