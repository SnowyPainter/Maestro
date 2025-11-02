from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable, Dict, Iterable, Optional, Sequence, Type

from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session, sessionmaker

from apps.backend.src.core.celery_app import celery_app
from apps.backend.src.core.config import settings
from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.playbooks.models import Playbook
from apps.backend.src.modules.reactive.models import ReactionRule
from apps.backend.src.modules.trends.models import Trend
from apps.backend.src.services.rag_sidecar.canonicalizers import (
    build_campaign_payload,
    build_draft_payload,
    build_insight_comment_payload,
    build_persona_payload,
    build_playbook_payload,
    build_publication_payload,
    build_reaction_rule_payload,
    build_trend_payload,
    build_variant_payload,
)
from apps.backend.src.services.rag_sidecar.graph_sync import SyncResult, sync_payload
from apps.backend.src.services.rag_sidecar.types import CanonicalPayload
from apps.backend.src.workers.RAG.metrics import EMBEDDING_FAILURES, NODE_PROCESSED, WATCH_DURATION

RAG_QUEUE = "graph_rag"
BATCH_SIZE = 200
SCAN_WINDOW_MINUTES = 15

_ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_ENGINE, autocommit=False, autoflush=False)

_CANONICALIZERS: Dict[str, Callable[[Session, int], Optional[CanonicalPayload]]] = {
    "persona": build_persona_payload,
    "campaign": build_campaign_payload,
    "playbook": build_playbook_payload,
    "draft": build_draft_payload,
    "draft_variant": build_variant_payload,
    "post_publication": build_publication_payload,
    "trend": build_trend_payload,
    "insight_comment": build_insight_comment_payload,
    "reaction_rule": build_reaction_rule_payload,
}


def _scan_entities(session: Session, model: Type, updated_attr: Optional[str]) -> Sequence[int]:
    stmt = session.query(model.id)
    filters = []
    filters.append(model.graph_node_id.is_(None))
    if updated_attr is not None and hasattr(model, updated_attr):
        window = datetime.utcnow() - timedelta(minutes=SCAN_WINDOW_MINUTES)
        filters.append(getattr(model, updated_attr) >= window)
    stmt = stmt.filter(or_(*filters)).order_by(model.id.asc()).limit(BATCH_SIZE)
    return [row[0] for row in stmt.all()]


def _enqueue(task: Callable[[int], None], ids: Iterable[int]) -> int:
    enqueued = 0
    for ident in ids:
        task(ident)
        enqueued += 1
    return enqueued


def _process_entity(kind: str, entity_id: int) -> SyncResult | None:
    builder = _CANONICALIZERS.get(kind)
    if not builder:
        raise ValueError(f"Unknown canonicalizer kind='{kind}'")

    with SessionLocal() as session:
        payload = builder(session, entity_id)
        if not payload:
            return None

        try:
            result = sync_payload(session, payload)
        except Exception:
            EMBEDDING_FAILURES(kind)
            raise

        status = "skipped" if result.skipped else "success"
        NODE_PROCESSED(kind, status)
        return result


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_personas", queue=RAG_QUEUE)
def watch_personas() -> dict:
    with WATCH_DURATION.labels("personas").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, Persona, "updated_at")
    return {"enqueued": _enqueue(canonicalize_persona.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_campaigns", queue=RAG_QUEUE)
def watch_campaigns() -> dict:
    with WATCH_DURATION.labels("campaigns").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, Campaign, "created_at")
    return {"enqueued": _enqueue(canonicalize_campaign.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_playbooks", queue=RAG_QUEUE)
def watch_playbooks() -> dict:
    with WATCH_DURATION.labels("playbooks").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, Playbook, "last_updated")
    return {"enqueued": _enqueue(canonicalize_playbook.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_drafts", queue=RAG_QUEUE)
def watch_drafts() -> dict:
    with WATCH_DURATION.labels("drafts").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, Draft, "updated_at")
    return {"enqueued": _enqueue(canonicalize_draft.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_draft_variants", queue=RAG_QUEUE)
def watch_draft_variants() -> dict:
    with WATCH_DURATION.labels("draft_variants").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, DraftVariant, "updated_at")
    return {"enqueued": _enqueue(canonicalize_variant.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_publications", queue=RAG_QUEUE)
def watch_publications() -> dict:
    with WATCH_DURATION.labels("post_publications").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, PostPublication, "updated_at")
    return {"enqueued": _enqueue(canonicalize_publication.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_trends", queue=RAG_QUEUE)
def watch_trends() -> dict:
    with WATCH_DURATION.labels("trends").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, Trend, "retrieved")
    return {"enqueued": _enqueue(canonicalize_trend.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_insights", queue=RAG_QUEUE)
def watch_insights() -> dict:
    with WATCH_DURATION.labels("insight_comments").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, InsightComment, "ingested_at")
    return {"enqueued": _enqueue(canonicalize_insight_comment.delay, ids)}


@celery_app.task(name="apps.backend.src.workers.RAG.tasks.watch_reaction_rules", queue=RAG_QUEUE)
def watch_reaction_rules() -> dict:
    with WATCH_DURATION.labels("reaction_rules").time():
        with SessionLocal() as session:
            ids = _scan_entities(session, ReactionRule, "updated_at")
    return {"enqueued": _enqueue(canonicalize_reaction_rule.delay, ids)}


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_persona",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_persona(self, persona_id: int):
    _process_entity("persona", persona_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_campaign",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_campaign(self, campaign_id: int):
    _process_entity("campaign", campaign_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_playbook",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_playbook(self, playbook_id: int):
    _process_entity("playbook", playbook_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_draft",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_draft(self, draft_id: int):
    _process_entity("draft", draft_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_variant",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_variant(self, variant_id: int):
    _process_entity("draft_variant", variant_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_publication",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_publication(self, publication_id: int):
    _process_entity("post_publication", publication_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_trend",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_trend(self, trend_id: int):
    _process_entity("trend", trend_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_insight_comment",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_insight_comment(self, insight_comment_id: int):
    _process_entity("insight_comment", insight_comment_id)


@celery_app.task(
    name="apps.backend.src.workers.RAG.tasks.canonicalize_reaction_rule",
    queue=RAG_QUEUE,
    acks_late=True,
    max_retries=3,
    bind=True,
)
def canonicalize_reaction_rule(self, reaction_rule_id: int):
    _process_entity("reaction_rule", reaction_rule_id)
