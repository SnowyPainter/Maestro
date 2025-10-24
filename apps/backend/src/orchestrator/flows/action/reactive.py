"""Action flows for managing reaction rules."""

from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.reactive.schemas import (
    ReactionRuleCreate,
    ReactionRuleOut,
    ReactionRulePublicationCreate,
    ReactionRulePublicationLink,
    ReactionRuleUpdate,
)
from apps.backend.src.modules.reactive.service import (
    create_reaction_rule,
    delete_reaction_rule,
    link_rule_to_publication,
    unlink_rule_from_publication,
    update_reaction_rule,
)
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class ReactionRuleCreateCommand(ReactionRuleCreate):
    pass


class ReactionRuleUpdateCommand(ReactionRuleUpdate):
    rule_id: int


class ReactionRuleDeleteCommand(BaseModel):
    rule_id: int


class ReactionRulePublicationCommand(ReactionRulePublicationCreate):
    rule_id: int


class ReactionRulePublicationDeleteCommand(BaseModel):
    link_id: int


class OperationResult(BaseModel):
    ok: bool


@operator(
    key="reactive.create_rule",
    title="Create reaction rule",
    side_effect="write",
)
async def op_create_reaction_rule(
    payload: ReactionRuleCreateCommand,
    ctx: TaskContext,
) -> ReactionRuleOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    rule = await create_reaction_rule(
        db,
        payload,
        owner_user_id=user.id,
    )
    await db.commit()
    return rule


@operator(
    key="reactive.update_rule",
    title="Update reaction rule",
    side_effect="write",
)
async def op_update_reaction_rule(
    payload: ReactionRuleUpdateCommand,
    ctx: TaskContext,
) -> ReactionRuleOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    update_payload = ReactionRuleUpdate(
        **payload.model_dump(
            exclude={"rule_id"},
            exclude_none=True,
        )
    )
    rule = await update_reaction_rule(
        db,
        rule_id=payload.rule_id,
        owner_user_id=user.id,
        payload=update_payload,
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Reaction rule not found")
    await db.commit()
    return rule


@operator(
    key="reactive.delete_rule",
    title="Delete reaction rule",
    side_effect="write",
)
async def op_delete_reaction_rule(
    payload: ReactionRuleDeleteCommand,
    ctx: TaskContext,
) -> OperationResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    ok = await delete_reaction_rule(
        db,
        rule_id=payload.rule_id,
        owner_user_id=user.id,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Reaction rule not found")
    await db.commit()
    return OperationResult(ok=True)


@operator(
    key="reactive.link_rule_publication",
    title="Link rule to publication",
    side_effect="write",
)
async def op_link_rule_publication(
    payload: ReactionRulePublicationCommand,
    ctx: TaskContext,
) -> ReactionRulePublicationLink:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    link = await link_rule_to_publication(
        db,
        rule_id=payload.rule_id,
        owner_user_id=user.id,
        payload=ReactionRulePublicationCreate(
            post_publication_id=payload.post_publication_id,
            priority=payload.priority,
            active_from=payload.active_from,
            active_until=payload.active_until,
            is_active=payload.is_active,
        ),
    )
    if not link:
        raise HTTPException(status_code=404, detail="Reaction rule not found")
    await db.commit()
    return link


@operator(
    key="reactive.unlink_rule_publication",
    title="Unlink rule publication",
    side_effect="write",
)
async def op_unlink_rule_publication(
    payload: ReactionRulePublicationDeleteCommand,
    ctx: TaskContext,
) -> OperationResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    ok = await unlink_rule_from_publication(
        db,
        link_id=payload.link_id,
        owner_user_id=user.id,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Rule publication link not found")
    await db.commit()
    return OperationResult(ok=True)


@FLOWS.flow(
    key="reactive.create_rule",
    title="Create Reaction Rule",
    description="Create a new reaction rule with keywords and actions",
    input_model=ReactionRuleCreateCommand,
    output_model=ReactionRuleOut,
    method="post",
    path="/reactive/rules",
    tags=("action", "reactive", "rules", "create"),
)
def _flow_reactive_create_rule(builder: FlowBuilder):
    task = builder.task("create_rule", "reactive.create_rule")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="reactive.update_rule",
    title="Update Reaction Rule",
    description="Update an existing reaction rule",
    input_model=ReactionRuleUpdateCommand,
    output_model=ReactionRuleOut,
    method="patch",
    path="/reactive/rules/{rule_id}",
    tags=("action", "reactive", "rules", "update"),
)
def _flow_reactive_update_rule(builder: FlowBuilder):
    task = builder.task("update_rule", "reactive.update_rule")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="reactive.delete_rule",
    title="Delete Reaction Rule",
    description="Delete a reaction rule",
    input_model=ReactionRuleDeleteCommand,
    output_model=OperationResult,
    method="delete",
    path="/reactive/rules/{rule_id}",
    tags=("action", "reactive", "rules", "delete"),
)
def _flow_reactive_delete_rule(builder: FlowBuilder):
    task = builder.task("delete_rule", "reactive.delete_rule")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="reactive.link_rule_publication",
    title="Attach Reaction Rule to Publication",
    description="Connect a reaction rule to a post publication",
    input_model=ReactionRulePublicationCommand,
    output_model=ReactionRulePublicationLink,
    method="post",
    path="/reactive/rules/{rule_id}/publications",
    tags=("action", "reactive", "rules", "publications", "link"),
)
def _flow_reactive_link_publication(builder: FlowBuilder):
    task = builder.task("link_rule_publication", "reactive.link_rule_publication")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="reactive.unlink_rule_publication",
    title="Remove Reaction Rule Publication Link",
    description="Detach a reaction rule from a publication",
    input_model=ReactionRulePublicationDeleteCommand,
    output_model=OperationResult,
    method="delete",
    path="/reactive/publications/{link_id}",
    tags=("action", "reactive", "rules", "publications", "unlink"),
)
def _flow_reactive_unlink_publication(builder: FlowBuilder):
    task = builder.task("unlink_rule_publication", "reactive.unlink_rule_publication")
    builder.expect_terminal(task)


__all__ = []
