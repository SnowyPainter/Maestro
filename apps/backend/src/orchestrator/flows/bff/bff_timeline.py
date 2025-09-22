"""Timeline BFF flows that emit normalized `TimelineEventCollection` payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field, ConfigDict, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.common.enums import PostStatus
from apps.backend.src.modules.drafts.schemas import PostPublicationOut
from apps.backend.src.orchestrator.adapters.timeline import (
    compose_timeline_collections,
)
from apps.backend.src.modules.drafts.service import (
    list_post_publications_by_account_persona,
)
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.timeline.schemas import (
    TimelineEvent,
    TimelineEventCollection,
    TimelineQueryPayload,
    TimelineEventCollectionOut,
)

"""
Adapter(TimelineQueryPayload, TimelineEventCollectionOut) -> TimelineQueryPayload
TimelineQueryPayload(...ctx) -> PostPublication Timeline -> Adapter(TimelineQueryPayload, TimelineEventCollectionOut)
    -> Campaign KPI Results Timeline -> Adapter(TimelineQueryPayload, TimelineEventCollectionOut)
    -> Trends Timeline -> BFF List
"""


def _filter_by_range(
    events: Iterable[TimelineEvent],
    *,
    since: Optional[datetime],
    until: Optional[datetime],
) -> List[TimelineEvent]:
    filtered: List[TimelineEvent] = []
    for event in events:
        if since and event.timestamp < since:
            continue
        if until and event.timestamp > until:
            continue
        filtered.append(event)
    return filtered


def _post_publication_events(publication: PostPublicationOut) -> List[TimelineEvent]:
    base_payload = publication.model_dump()
    base_kwargs: Dict[str, object] = {
        "persona_account_id": publication.account_persona_id,
        "source": "post_publication",
        "kind": "post_publication.lifecycle",
        "payload": {
            "phase_source": "post_publication",
            "post_publication": base_payload,
        },
        "operators": ("bff.timeline.post_publications",),
        "correlation_keys": {
            "post_publication_id": str(publication.id),
            "variant_id": str(publication.variant_id),
            "platform": publication.platform,
        },
        "origin_flow": "bff.timeline.post_publications",
    }

    events: List[TimelineEvent] = []

    def _add(label: str, timestamp: Optional[datetime], *, status: Optional[str] = None) -> None:
        if timestamp is None:
            return
        event = TimelineEvent(
            event_id=f"post_publication:{publication.id}:{label}",
            timestamp=timestamp,
            status=status or label,
            **base_kwargs,
        )
        event.payload["phase"] = label
        event.payload["status"] = publication.status
        events.append(event)

    _add("created", publication.created_at, status=PostStatus.PENDING.value)
    _add("scheduled", publication.scheduled_at, status=PostStatus.SCHEDULED.value)
    _add("published", publication.published_at, status=PostStatus.PUBLISHED.value)
    _add("monitoring_started", publication.monitoring_started_at, status=PostStatus.MONITORING.value)
    _add("monitoring_ended", publication.monitoring_ended_at, status=PostStatus.MONITORING.value)
    _add("deleted", publication.deleted_at, status=PostStatus.DELETED.value)

    terminal_status = publication.status.lower()
    if terminal_status in {PostStatus.CANCELLED.value, PostStatus.FAILED.value}:
        _add(terminal_status, publication.updated_at, status=terminal_status)

    return events


@operator(
    key="bff.timeline.post_publications",
    title="Timeline Events for Post Publications",
    side_effect="read",
)
async def op_timeline_post_publications(
    payload: TimelineQueryPayload,
    _ctx: TaskContext,
    db: AsyncSession,
) -> TimelineEventCollectionOut:
    records = await list_post_publications_by_account_persona(
        db,
        account_persona_id=payload.persona_account_id,
    )

    events: List[TimelineEvent] = []
    for record in records:
        model = PostPublicationOut.model_validate(record)
        events.extend(_post_publication_events(model))

    filtered = _filter_by_range(events, since=payload.since, until=payload.until)
    combined = compose_timeline_collections([
        payload.events,
        TimelineEventCollection(source="post_publications", events=filtered),
    ])

    return TimelineEventCollectionOut(
        source=combined.source,
        events=combined.events,
    )

@FLOWS.flow(
    key="bff.timeline.post_publications",
    title="Get Post Publication Timeline",
    description="Retrieve timeline events sourced from post publications",
    input_model=TimelineQueryPayload,
    output_model=TimelineEventCollectionOut,
    method="get",
    path="/timeline/post-publications",
    tags=("bff", "timeline", "ui", "frontend", "read"),
)
def _flow_bff_post_publications(builder: FlowBuilder) -> None:
    post_publications = builder.task("post_publications", "bff.timeline.post_publications")
    builder.expect_terminal(post_publications)


__all__ = []
