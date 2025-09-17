"""Chat entrypoint that leverages the NLP engine and planner."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError

from .cards import card_type_for_model, serialize_payload
from .dispatch import ExecutionRuntime, orchestrate_flow, runtime_dependency
from .nlp import IntentResult, nlp_engine
from .planner import ChatPlan, flow_planner
from .registry import FLOWS, FlowDefinition


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatQuery(BaseModel):
    message: str = Field(..., description="User utterance (English)")
    session_id: Optional[str] = Field(None, description="Conversation identifier")


class ChatCard(BaseModel):
    card_type: str
    data: Dict[str, Any]
    title: Optional[str] = None
    source_flow: Optional[str] = None


class ChatResponse(BaseModel):
    intent: IntentResult
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
    intent = nlp_engine.parse(payload.message)
    plan = await flow_planner.plan(payload.message, intent)
    response = await _execute_plan(plan, runtime)
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


async def _execute_plan(plan: ChatPlan, runtime: ExecutionRuntime) -> ChatResponse:
    response = ChatResponse(intent=plan.intent, plan_notes=plan.notes)
    response.messages.extend(plan.messages)

    for step in plan.steps:
        try:
            if step.kind == "flow":
                assert step.flow_key is not None
                flow = FLOWS.get(step.flow_key)
            else:
                assert step.flow is not None
                flow = step.flow

            payload_model = flow.input_model(**step.payload)
        except ValidationError as exc:
            response.messages.append(
                f"Unable to build request for step '{step.title or step.flow_key or 'dynamic'}': {exc.errors()[0].get('msg', 'validation error')}"
            )
            continue
        except KeyError:
            response.messages.append(f"Flow '{step.flow_key}' is not available anymore.")
            continue

        try:
            result = await orchestrate_flow(flow, payload_model, runtime)
        except Exception as exc:  # pragma: no cover - runtime failure
            response.messages.append(f"Failed to execute {flow.key}: {exc}")
            continue

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


__all__ = ["router"]
