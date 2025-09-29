from __future__ import annotations

import asyncio
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from apps.backend.src.core.deps import get_current_user
from apps.backend.src.modules.scheduler.events import stream_schedule_events
from apps.backend.src.modules.users.models import User


router = APIRouter(prefix="/schedules", tags=["schedules", "stream"])

@router.get("/events", name="scheduler:sse", response_class=EventSourceResponse)
async def schedule_events_stream(
    user: User = Depends(get_current_user),
) -> EventSourceResponse:
    channel = "schedule.events"

    async def event_iterator() -> AsyncIterator[dict[str, str]]:
        async with stream_schedule_events(channel=channel) as events:
            try:
                async for message in events:
                    yield {"event": "schedule", "data": message}
            except asyncio.CancelledError:
                raise

    return EventSourceResponse(event_iterator(), ping=15.0)


__all__ = ["router"]
