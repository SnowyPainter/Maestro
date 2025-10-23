"""Action flows for orchestrating AB test lifecycle tasks."""

from __future__ import annotations

from typing import List

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.abtests.schemas import (
    ABTestComplete,
    ABTestCreate,
    ABTestOut,
    ABTestUpdate,
)
from apps.backend.src.modules.abtests.service import (
    create_abtest,
    get_abtest,
    complete_abtest,
    update_abtest,
    delete_abtest,
)
from apps.backend.src.modules.accounts.service import get_persona
from apps.backend.src.modules.campaigns.service import get_campaign
from apps.backend.src.modules.drafts.service import get_draft_for_user
from apps.backend.src.modules.playbooks.service import record_playbook_event
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class MessageOut(BaseModel):
    message: str


class ABTestCreateCommand(ABTestCreate):
    pass


class ABTestEvaluateReadyPayload(BaseModel):
    abtest_id: int
    persona_id: int
    campaign_id: int
    persona_account_id: int
    publish_schedule_id: int
    post_publication_ids: List[int]


class ABTestUpdateCommand(ABTestUpdate):
    abtest_id: int


class ABTestCompleteCommand(ABTestComplete):
    abtest_id: int


class ABTestDeletePayload(BaseModel):
    abtest_id: int


@operator(
    key="abtests.create",
    title="Create AB Test",
    side_effect="write",
)
async def op_create_abtest(payload: ABTestCreateCommand, ctx: TaskContext) -> ABTestOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    persona = await get_persona(db, persona_id=payload.persona_id, owner_user_id=user.id)
    if persona is None:
        raise HTTPException(status_code=404, detail="Persona not found")

    campaign = await get_campaign(db, payload.campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to use campaign")

    try:
        draft_a = await get_draft_for_user(
            db,
            draft_id=payload.variant_a_id,
            user_id=user.id,
        )
        draft_b = await get_draft_for_user(
            db,
            draft_id=payload.variant_b_id,
            user_id=user.id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if draft_a is None or draft_b is None:
        raise HTTPException(status_code=404, detail="Drafts for variants not found")

    if draft_a.campaign_id != payload.campaign_id or draft_b.campaign_id != payload.campaign_id:
        raise HTTPException(
            status_code=400,
            detail="Variant drafts must belong to the specified campaign",
        )

    try:
        created = await create_abtest(
            db,
            payload=payload,
            owner_user_id=user.id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ABTestOut.model_validate(created)


@operator(
    key="abtests.evaluate_ready",
    title="Mark AB Test Ready for Completion",
    side_effect="write",
)
async def op_abtest_evaluate_ready(
    payload: ABTestEvaluateReadyPayload,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)

    abtest = await get_abtest(db, payload.abtest_id)
    if abtest is None:
        raise HTTPException(status_code=404, detail="AB test not found")
    if abtest.finished_at is not None:
        return MessageOut(message="AB test already completed; skipping evaluation reminder")

    await record_playbook_event(
        db,
        event="abtest.completion_ready",
        schedule_id=payload.publish_schedule_id,
        schedule=None,
        persona_id=payload.persona_id,
        persona_account_id=payload.persona_account_id,
        campaign_id=payload.campaign_id,
        abtest_id=payload.abtest_id,
        meta={
            "post_publication_ids": payload.post_publication_ids,
            "publish_schedule_id": payload.publish_schedule_id,
        },
    )
    await db.commit()
    return MessageOut(message="AB test evaluation reminder recorded")


@operator(
    key="abtests.update",
    title="Update AB Test",
    side_effect="write",
)
async def op_update_abtest(payload: ABTestUpdateCommand, ctx: TaskContext) -> ABTestOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    abtest = await get_abtest(db, payload.abtest_id)
    if abtest is None:
        raise HTTPException(status_code=404, detail="AB test not found")

    persona = await get_persona(db, persona_id=abtest.persona_id, owner_user_id=user.id)
    if persona is None:
        raise HTTPException(status_code=403, detail="Not authorized to update AB test")

    updated = await update_abtest(
        db,
        abtest_id=payload.abtest_id,
        owner_user_id=user.id,
        variable=payload.variable,
        hypothesis=payload.hypothesis,
        notes=payload.notes,
        started_at=payload.started_at,
    )
    return ABTestOut.model_validate(updated)


@operator(
    key="abtests.complete",
    title="Complete AB Test",
    side_effect="write",
)
async def op_complete_abtest(
    payload: ABTestCompleteCommand,
    ctx: TaskContext,
) -> ABTestOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    abtest = await get_abtest(db, payload.abtest_id)
    if abtest is None:
        raise HTTPException(status_code=404, detail="AB test not found")

    persona = await get_persona(db, persona_id=abtest.persona_id, owner_user_id=user.id)
    if persona is None:
        raise HTTPException(status_code=403, detail="Not authorized to complete AB test")

    complete_payload = ABTestComplete.model_validate(
        payload.model_dump(exclude={"abtest_id"}, exclude_none=True)
    )
    completed = await complete_abtest(
        db,
        abtest_id=payload.abtest_id,
        payload=complete_payload,
    )
    return ABTestOut.model_validate(completed)


@operator(
    key="abtests.delete",
    title="Delete AB Test",
    side_effect="write",
)
async def op_delete_abtest(payload: ABTestDeletePayload, ctx: TaskContext) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    abtest = await get_abtest(db, payload.abtest_id)
    if abtest is None:
        raise HTTPException(status_code=404, detail="AB test not found")

    persona = await get_persona(db, persona_id=abtest.persona_id, owner_user_id=user.id)
    if persona is None:
        raise HTTPException(status_code=403, detail="Not authorized to delete AB test")

    await delete_abtest(db, abtest_id=payload.abtest_id, owner_user_id=user.id)
    return MessageOut(message="AB test deleted")


@FLOWS.flow(
    key="abtests.create_abtest",
    title="Create AB Test",
    description="Create a new AB test pairing two drafts under a persona and campaign",
    input_model=ABTestCreateCommand,
    output_model=ABTestOut,
    method="post",
    path="/abtests",
    tags=("action", "abtests", "create"),
)
def _flow_create_abtest(builder: FlowBuilder) -> None:
    task = builder.task("create_abtest", "abtests.create")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="abtests.evaluate_ready",
    title="Mark AB Test Ready for Completion",
    description="Mark an AB test as ready for completion",
    input_model=ABTestEvaluateReadyPayload,
    output_model=MessageOut,
    method="post",
    path="/abtests/{abtest_id}/evaluate-ready",
    tags=("action", "abtests", "evaluate ready"),
)
def _flow_evaluate_ready(builder: FlowBuilder) -> None:
    task = builder.task("evaluate_ready", "abtests.evaluate_ready")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="abtests.update_abtest",
    title="Update AB Test",
    description="Update AB test metadata such as hypothesis or notes",
    input_model=ABTestUpdateCommand,
    output_model=ABTestOut,
    method="patch",
    path="/abtests/{abtest_id}",
    tags=("action", "abtests", "update"),
)
def _flow_update_abtest(builder: FlowBuilder) -> None:
    task = builder.task("update_abtest", "abtests.update")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="abtests.complete_abtest",
    title="Complete AB Test",
    description="Manually complete an AB test and record the outcome",
    input_model=ABTestCompleteCommand,
    output_model=ABTestOut,
    method="post",
    path="/abtests/{abtest_id}/complete",
    tags=("action", "abtests", "complete"),
)
def _flow_complete_abtest(builder: FlowBuilder) -> None:
    task = builder.task("complete_abtest", "abtests.complete")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="abtests.delete_abtest",
    title="Delete AB Test",
    description="Delete an AB test",
    input_model=ABTestDeletePayload,
    output_model=MessageOut,
    method="delete",
    path="/abtests/{abtest_id}",
    tags=("action", "abtests", "delete"),
)
def _flow_delete_abtest(builder: FlowBuilder) -> None:
    task = builder.task("delete_abtest", "abtests.delete")
    builder.expect_terminal(task)

__all__ = [
    "ABTestCreateCommand",
    "ABTestEvaluateReadyPayload",
    "op_create_abtest",
    "op_abtest_evaluate_ready",
    "ABTestUpdateCommand",
    "ABTestCompleteCommand",
    "ABTestDeletePayload",
    "op_update_abtest",
    "op_complete_abtest",
    "op_delete_abtest",
]
