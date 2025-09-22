"""Chat entrypoint that leverages the NLP engine and planner."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError
from apps.backend.src.core.logging import setup_logging
setup_logging()

from .cards import card_type_for_model, serialize_payload
from .dispatch import ExecutionRuntime, orchestrate_flow, runtime_dependency
from .nlp import IntentCandidate, IntentResult
from .planner import ChatPlan, FlowMatch, flow_planner
from .registry import FLOWS

import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatQuery(BaseModel):
    message: str = Field(..., description="User utterance (English)")
    session_id: Optional[str] = Field(None, description="Conversation identifier")


class ChatCard(BaseModel):
    card_type: str
    data: Dict[str, Any]
    title: Optional[str] = None
    source_flow: Optional[str] = None


class FlowMatchSummary(BaseModel):
    key: str
    title: str
    score: float
    strategy: Literal["embedding", "keyword"]
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    intent: IntentResult
    match: Optional[FlowMatchSummary] = None
    alternative_matches: List[FlowMatchSummary] = Field(default_factory=list)
    plan_notes: Optional[str] = None
    cards: List[ChatCard] = Field(default_factory=list)
    messages: List[str] = Field(default_factory=list)


class FlowInfo(BaseModel):
    key: str
    title: str
    description: Optional[str] = None
    method: str
    path: str
    tags: List[str]


@router.post("/query", response_model=ChatResponse)
async def chat_query(
    payload: ChatQuery,
    runtime: ExecutionRuntime = Depends(runtime_dependency),
) -> ChatResponse:
    plan = await flow_planner.plan(payload.message)
    response = await _execute_plan(payload.message, plan, runtime)
    return response


@router.get("/flows", response_model=List[FlowInfo])
async def get_available_flows() -> List[FlowInfo]:
    """Get list of all available flows."""
    flows = FLOWS.all()
    return [
        FlowInfo(
            key=flow.key,
            title=flow.title,
            description=flow.description,
            method=flow.method,
            path=flow.api_path(),
            tags=list(flow.tags),
        )
        for flow in flows
    ]


async def _execute_plan(message: str, plan: ChatPlan, runtime: ExecutionRuntime) -> ChatResponse:
    intent = _intent_from_plan(message, plan)
    response = ChatResponse(intent=intent, plan_notes=plan.notes)
    if plan.primary_match:
        response.match = _summarize_match(plan.primary_match)
    if plan.alternatives:
        response.alternative_matches = [_summarize_match(match) for match in plan.alternatives]
    response.messages.extend(plan.messages)

    results_by_step: Dict[str, Any] = {}

    for step in plan.steps:
        step_label = step.title or step.flow_key or step.id or "dynamic"

        if step.depends_on:
            missing = [dep for dep in step.depends_on if dep not in results_by_step]
            if missing:
                response.messages.append(
                    f"Skipping step '{step_label}' because dependencies {missing} are unavailable."
                )
                continue

        try:
            if step.kind == "flow":
                assert step.flow_key is not None
                flow = FLOWS.get(step.flow_key)
            else:
                assert step.flow is not None
                flow = step.flow
            payload_data: Any = dict(step.payload)
            if step.payload_builder is not None:
                payload_data = step.payload_builder(results_by_step)
            if isinstance(payload_data, BaseModel):
                payload_data = payload_data.model_dump()
            payload_model = flow.input_model(**payload_data)
        except ValidationError as exc:
            response.messages.append(
                f"Unable to build request for step '{step_label}': {exc.errors()[0].get('msg', 'validation error')}"
            )
            continue
        except KeyError:
            response.messages.append(f"Flow '{step.flow_key}' is not available anymore.")
            continue
        except Exception as exc:
            response.messages.append(f"Failed to prepare payload for step '{step_label}': {exc}")
            continue

        try:
            result = await orchestrate_flow(flow, payload_model, runtime)
        except Exception as exc:  # pragma: no cover - runtime failure
            response.messages.append(f"Failed to execute {flow.key}: {exc}")
            continue

        results_by_step[step.id or flow.key] = result

        card_type = step.card_hint or card_type_for_model(flow.output_model)
        card_data = serialize_payload(result)

        if isinstance(card_data, list):
            card_data = {"items": card_data}
        
        response.cards.append(
            ChatCard(
                card_type=card_type,
                data=card_data,
                title=step.title,
                source_flow=flow.key,
            )
        )

    if not response.cards and not response.messages:
        response.messages.append("No actions were executed for this request.")

    return response


def _intent_from_plan(message: str, plan: ChatPlan) -> IntentResult:
    intent_key = plan.primary_match.flow.key if plan.primary_match else "unknown"
    confidence = plan.primary_match.score if plan.primary_match else 0.0
    candidates = [
        IntentCandidate(intent=match.flow.key, confidence=match.score)
        for match in plan.alternatives[:3]
    ]
    return IntentResult(
        intent=intent_key,
        confidence=confidence,
        candidates=candidates,
        slots=plan.slots,
        raw_text=message,
        keywords=[],
    )


def _summarize_match(match: FlowMatch) -> FlowMatchSummary:
    flow = match.flow
    return FlowMatchSummary(
        key=flow.key,
        title=flow.title,
        description=flow.description,
        tags=list(flow.tags),
        score=match.score,
        strategy=match.strategy,
    )


__all__ = ["router"]
