"""Timeline BFF flows that emit normalized `TimelineEventCollection` payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from fastapi import HTTPException
from apps.backend.src.core.logging import setup_logging
setup_logging()
import logging

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field, ConfigDict, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.common.enums import PostStatus
from apps.backend.src.modules.drafts.schemas import PostPublicationOut
from apps.backend.src.modules.campaigns.service import list_kpi_results
from apps.backend.src.modules.trends.service import query_trends
from apps.backend.src.modules.accounts.models import PersonaAccount
from apps.backend.src.orchestrator.adapters.timeline import (
    compose_timeline_collections,
)
from apps.backend.src.orchestrator.adapters.utils import (
    safe_datetime_to_date,
    _utcnow,
    to_aware_utc,
)
from apps.backend.src.modules.drafts.service import (
    list_post_publications_by_account_persona,
)
from apps.backend.src.modules.playbooks.schemas import PlaybookLogOut
from apps.backend.src.modules.playbooks.service import list_logs_for_persona
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


def _filter_by_range(events: List[TimelineEvent], *, since: datetime | None, until: datetime | None) -> List[TimelineEvent]:
    s = to_aware_utc(since)
    u = to_aware_utc(until)
    out: List[TimelineEvent] = []
    for ev in events:
        ts = to_aware_utc(ev.timestamp)
        if s and ts < s:
            continue
        if u and ts > u:
            continue
        out.append(ev)
    return out


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


async def _resolve_persona_id_for_account(db: AsyncSession, persona_account_id: int) -> int:
    persona_account = await db.get(PersonaAccount, persona_account_id)
    if persona_account is None:
        raise HTTPException(status_code=404, detail="Persona account not found")
    return persona_account.persona_id


def _playbook_log_events(logs: Iterable[PlaybookLogOut], persona_account_id: int) -> List[TimelineEvent]:
    events: List[TimelineEvent] = []
    for log in logs:
        log_payload = log.model_dump()
        event = TimelineEvent(
            event_id=f"playbook_log:{log.id}",
            timestamp=log.timestamp,
            status=log.event,
            persona_account_id=persona_account_id,
            source="playbook",
            kind="playbook.event",
            payload={
                "phase_source": "playbook_log",
                "playbook_log": log_payload,
            },
            operators=("bff.timeline.playbooks",),
            correlation_keys={
                "playbook_id": str(log.playbook_id),
                "event": log.event,
            },
            origin_flow="bff.timeline.playbooks",
        )
        events.append(event)
    return events


def _campaign_kpi_events(kpi_result, account_persona_id: int) -> List[TimelineEvent]:
    """Generate timeline events for campaign KPI results."""
    base_payload = {
        "campaign_id": kpi_result.campaign_id,
        "as_of": kpi_result.as_of.isoformat(),
        "values": kpi_result.values,
    }
    base_kwargs: Dict[str, object] = {
        "persona_account_id": account_persona_id,
        "source": "campaign_kpi",
        "kind": "campaign.kpi_result",
        "payload": {
            "phase_source": "campaign_kpi",
            "kpi_result": base_payload,
        },
        "operators": ("bff.timeline.campaigns",),
        "correlation_keys": {
            "campaign_id": str(kpi_result.campaign_id),
        },
        "origin_flow": "bff.timeline.campaigns",
    }

    events: List[TimelineEvent] = []

    # Create event for KPI result recording
    event = TimelineEvent(
        event_id=f"campaign_kpi:{kpi_result.campaign_id}:{kpi_result.as_of.isoformat()}",
        timestamp=kpi_result.as_of,
        status="recorded",
        **base_kwargs,
    )
    event.payload["phase"] = "recorded"
    events.append(event)

    return events


def _trends_events(trends_data, account_persona_id: int, country: str) -> List[TimelineEvent]:
    """Generate timeline events for trends data."""
    events: List[TimelineEvent] = []

    base_kwargs: Dict[str, object] = {
        "persona_account_id": account_persona_id,
        "source": "trends",
        "kind": "trends.query_result",
        "payload": {
            "phase_source": "trends",
            "country": country,
            "source_type": trends_data.get("source"),
        },
        "operators": ("bff.timeline.trends",),
        "correlation_keys": {
            "country": country,
        },
        "origin_flow": "bff.timeline.trends",
    }

    # Create events for each trend item
    for row in trends_data.get("rows", []):
        pub_date_str = row.get("pub_date")
        if pub_date_str:
            try:
                timestamp = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                timestamp = _utcnow()
        else:
            timestamp = _utcnow()
        title = row.get('title', 'unknown').replace(" ", "_")[:10]
        event = TimelineEvent(
            event_id=f"trend:{country}:{title}:{timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp)}",
            timestamp=timestamp,
            status="queried",
            **base_kwargs,
        )
        event.payload["trend_data"] = row
        event.payload["phase"] = "queried"
        events.append(event)

    return events


@operator(
    key="bff.timeline.campaigns",
    title="Timeline Events for Campaign KPIs",
    side_effect="read",
)
async def op_timeline_campaigns(
    payload: TimelineQueryPayload,
    _ctx: TaskContext,
    db: AsyncSession,
) -> TimelineEventCollectionOut:
    # For now, get campaigns for the account_persona_id
    # This is a simplified version - in reality you might need to filter campaigns by owner
    from apps.backend.src.modules.campaigns.service import list_campaigns

    campaigns, _ = await list_campaigns(
        db,
        owner_user_id=payload.persona_account_id,  # Assuming persona_account_id maps to user_id
        limit=50
    )
    since_date = safe_datetime_to_date(payload.since)
    until_date = safe_datetime_to_date(payload.until)


    events: List[TimelineEvent] = []
    for campaign in campaigns:
        # Get KPI results for each campaign
        kpi_results = await list_kpi_results(
            db,
            campaign_id=campaign.id,
            start=to_aware_utc(since_date),
            end=to_aware_utc(until_date),
            limit=100
        )

        for kpi_result in kpi_results:
            events.extend(_campaign_kpi_events(kpi_result, payload.persona_account_id))

    filtered = _filter_by_range(events, since=payload.since, until=payload.until)
    combined = compose_timeline_collections([
        payload.events,
        TimelineEventCollection(source="campaigns", events=filtered),
    ])

    return TimelineEventCollectionOut(
        source=combined.source,
        payload=payload.model_dump(), #DO NOT exclude events
        events=combined.events,
    )


@operator(
    key="bff.timeline.trends",
    title="Timeline Events for Trends",
    side_effect="read",
)
async def op_timeline_trends(
    payload: TimelineQueryPayload,
    _ctx: TaskContext,
    db: AsyncSession,
) -> TimelineEventCollectionOut:
    since_date = safe_datetime_to_date(payload.since)
    until_date = safe_datetime_to_date(payload.until)

    logger.info(f"Search for trends from {to_aware_utc(since_date)} to {to_aware_utc(until_date)}")
    trends_data = await query_trends(
        db,
        country="US",  # Default country, could be from payload
        limit=payload.limit,
        q=None,
        on_date=None,
        since=to_aware_utc(since_date),
        until=to_aware_utc(until_date),
    )
    logger.info(f"Trends data: {len(trends_data['rows'])}, {trends_data['rows'][-1]['pub_date']}")
    logger.info("--------------------------------")
    events = _trends_events(trends_data, payload.persona_account_id, "US")

    logger.info(f"Events: {len(events)}")
    logger.info("--------------------------------")
    filtered = _filter_by_range(events, since=payload.since, until=payload.until)
    logger.info(f"Filtered: {len(filtered)}")
    logger.info("--------------------------------")

    combined = compose_timeline_collections([
        payload.events,
        TimelineEventCollection(source="trends", events=filtered),
    ])

    return TimelineEventCollectionOut(
        source=combined.source,
        payload=payload.model_dump(), #DO NOT exclude events
        events=combined.events,
    )

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
        payload=payload.model_dump(), #DO NOT exclude events
        events=combined.events,
    )


@operator(
    key="bff.timeline.playbooks",
    title="Timeline Events for Playbook Logs",
    side_effect="read",
)
async def op_timeline_playbooks(
    payload: TimelineQueryPayload,
    _ctx: TaskContext,
    db: AsyncSession,
) -> TimelineEventCollectionOut:
    persona_id = await _resolve_persona_id_for_account(db, payload.persona_account_id)
    rows, _ = await list_logs_for_persona(
        db,
        persona_id=persona_id,
        since=payload.since,
        until=payload.until,
        limit=payload.limit or 200,
        offset=0,
    )
    logs = [PlaybookLogOut.model_validate(row) for row in rows]
    events = _playbook_log_events(logs, payload.persona_account_id)
    filtered = _filter_by_range(events, since=payload.since, until=payload.until)
    combined = compose_timeline_collections([
        payload.events,
        TimelineEventCollection(source="playbooks", events=filtered),
    ])

    return TimelineEventCollectionOut(
        source=combined.source,
        payload=payload.model_dump(),
        events=combined.events,
    )

@FLOWS.flow(
    key="bff.timeline.post_publications",
    title="Get Post Publication Timeline",
    description="Get timeline events sourced from post publications",
    input_model=TimelineQueryPayload,
    output_model=TimelineEventCollectionOut,
    method="get",
    path="/timeline/post-publications",
    tags=("bff", "timeline", "post publications timeline", "time series", "schedules" ,"publishes" ,"read"),
)
def _flow_bff_post_publications(builder: FlowBuilder) -> None:
    post_publications = builder.task("post_publications", "bff.timeline.post_publications")
    builder.expect_terminal(post_publications)


@FLOWS.flow(
    key="bff.timeline.campaigns",
    title="Get Campaign KPI Timeline",
    description="Get timeline events sourced from campaign KPI results",
    input_model=TimelineQueryPayload,
    output_model=TimelineEventCollectionOut,
    method="get",
    path="/timeline/campaigns",
    tags=("bff", "timeline", "campaigns timeline", "time series", "kpis" ,"read"),
)
def _flow_bff_campaigns(builder: FlowBuilder) -> None:
    campaigns = builder.task("campaigns", "bff.timeline.campaigns")
    builder.expect_terminal(campaigns)


@FLOWS.flow(
    key="bff.timeline.playbooks",
    title="Get Playbook Timeline",
    description="Get timeline events sourced from playbook logs",
    input_model=TimelineQueryPayload,
    output_model=TimelineEventCollectionOut,
    method="get",
    path="/timeline/playbooks",
    tags=("bff", "timeline", "playbooks", "logs", "read"),
)
def _flow_bff_playbooks(builder: FlowBuilder) -> None:
    playbooks = builder.task("playbooks", "bff.timeline.playbooks")
    builder.expect_terminal(playbooks)


@FLOWS.flow(
    key="bff.timeline.trends",
    title="Get Trends Timeline",
    description="Get timeline events sourced from trends data",
    input_model=TimelineQueryPayload,
    output_model=TimelineEventCollectionOut,
    method="get",
    path="/timeline/trends",
    tags=("bff", "timeline", "trends timeline", "time series", "trends" ,"read"),
)
def _flow_bff_trends(builder: FlowBuilder) -> None:
    trends = builder.task("trends", "bff.timeline.trends")
    builder.expect_terminal(trends)


__all__ = [
    "op_timeline_post_publications",
    "op_timeline_campaigns",
    "op_timeline_trends",
    "op_timeline_playbooks",
]
