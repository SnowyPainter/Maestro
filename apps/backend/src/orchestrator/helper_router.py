"""Helper endpoints powering chat-level UX features."""

from __future__ import annotations

import asyncio
from typing import List, Optional

from celery.exceptions import TimeoutError
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .slot_mentions import SlotHint, filter_slot_hints
from apps.backend.src.workers.CoWorker import generate_contextual_text


router = APIRouter(prefix="/helpers", tags=["helpers"])


class SlotHintItem(BaseModel):
    name: str
    label: str
    description: str = ""
    value_type: str = "string"
    choices: List[str] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)
    flows: List[str] = Field(default_factory=list)

    @classmethod
    def from_hint(cls, hint: SlotHint) -> "SlotHintItem":
        return cls(
            name=hint.name,
            label=hint.label,
            description=hint.description,
            value_type=hint.value_type,
            choices=list(hint.choices),
            synonyms=list(hint.synonyms),
            flows=list(hint.flows),
        )


@router.get("/slot-hints", response_model=List[SlotHintItem])
async def list_slot_hints(
    query: Optional[str] = Query(default=None, description="Filter hints by name or label"),
    flow: Optional[str] = Query(default=None, description="Filter hints relevant to a specific flow key"),
    limit: int = Query(default=10, ge=1, le=50, description="Maximum number of hints to return"),
) -> List[SlotHintItem]:
    hints = filter_slot_hints(query=query, flow=flow, limit=limit)
    return [SlotHintItem.from_hint(hint) for hint in hints]


class GenerateTextRequest(BaseModel):
    text: str = Field(..., description="User prompt to transform into brand-aware copy")
    timeout: int = Field(60, ge=5, le=300, description="Seconds to wait for the generation result")


class GenerateTextResponse(BaseModel):
    task_id: str
    text: str


@router.post("/coworker/generate-text", response_model=GenerateTextResponse)
async def coworker_generate_text(payload: GenerateTextRequest) -> GenerateTextResponse:
    print(f"DEBUG: Received generate-text request with payload: {payload}")
    print(f"DEBUG: payload.text = {payload.text!r}")
    print(f"DEBUG: payload.timeout = {payload.timeout}")

    task = generate_contextual_text.delay(payload.text)
    print(f"DEBUG: Created Celery task with ID: {task.id}")

    loop = asyncio.get_running_loop()
    try:
        print(f"DEBUG: Waiting for task completion with timeout {payload.timeout}s...")
        text: str = await loop.run_in_executor(
            None, lambda: task.get(timeout=payload.timeout)
        )
        print(f"DEBUG: Task completed successfully, generated text length: {len(text)}")
    except TimeoutError as exc:
        print(f"DEBUG: Task timed out after {payload.timeout}s")
        raise HTTPException(status_code=504, detail="Generation timed out") from exc
    except Exception as exc:  # pragma: no cover
        print(f"DEBUG: Task failed with exception: {exc}")
        raise HTTPException(status_code=500, detail="Generation failed") from exc

    return GenerateTextResponse(task_id=task.id, text=text)


__all__ = ["router"]
