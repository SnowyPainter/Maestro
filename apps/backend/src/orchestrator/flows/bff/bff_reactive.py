"""BFF flows for reaction rules and automation configuration."""

from __future__ import annotations

from typing import List

from fastapi import HTTPException
from pydantic import BaseModel, RootModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.common.enums import (
    ReactionActionStatus,
    ReactionActionType,
)
from apps.backend.src.modules.reactive.schemas import (
    ReactionActionLogListResult,
    ReactionRuleOut,
    ReactionRulePublicationLink,
)
from apps.backend.src.modules.reactive.service import (
    get_reaction_rule,
    list_action_logs,
    list_publication_links,
    list_reaction_rules,
)
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class EmptyPayload(BaseModel):
    pass


class ReactionRuleListResult(BaseModel):
    rules: List[ReactionRuleOut]


class ReactionRuleReadPayload(BaseModel):
    rule_id: int


class ReactionRuleLinksPayload(BaseModel):
    rule_id: int


class ReactionRuleLinksResult(RootModel[List[ReactionRulePublicationLink]]):
    pass


class ReactionActionLogQueryPayload(BaseModel):
    status: ReactionActionStatus | None = None
    action_type: ReactionActionType | None = None
    tag_key: str | None = None
    limit: int = 50
    offset: int = 0


@operator(
    key="bff.reactive.list_rules",
    title="List reaction rules",
    side_effect="read",
)
async def op_list_reaction_rules(
    payload: EmptyPayload,
    ctx: TaskContext,
) -> ReactionRuleListResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    rules = await list_reaction_rules(db, owner_user_id=user.id)
    return ReactionRuleListResult(rules=rules)


@operator(
    key="bff.reactive.read_rule",
    title="Read reaction rule",
    side_effect="read",
)
async def op_read_reaction_rule(
    payload: ReactionRuleReadPayload,
    ctx: TaskContext,
) -> ReactionRuleOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    rule = await get_reaction_rule(
        db,
        rule_id=payload.rule_id,
        owner_user_id=user.id,
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Reaction rule not found")
    return rule


@operator(
    key="bff.reactive.list_rule_links",
    title="List rule publication links",
    side_effect="read",
)
async def op_list_rule_links(
    payload: ReactionRuleLinksPayload,
    ctx: TaskContext,
) -> ReactionRuleLinksResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    links = await list_publication_links(
        db,
        rule_id=payload.rule_id,
        owner_user_id=user.id,
    )
    return ReactionRuleLinksResult(root=links)


@operator(
    key="bff.reactive.list_action_logs",
    title="List reactive action logs",
    side_effect="read",
)
async def op_list_reaction_logs(
    payload: ReactionActionLogQueryPayload,
    ctx: TaskContext,
) -> ReactionActionLogListResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    result = await list_action_logs(
        db,
        owner_user_id=user.id,
        status=payload.status,
        action_type=payload.action_type,
        tag_key=payload.tag_key,
        limit=payload.limit,
        offset=payload.offset,
    )
    return result


@FLOWS.flow(
    key="bff.reactive.list_rules",
    title="List Reaction Rules",
    description="Retrieve all reaction rules for the current user",
    input_model=EmptyPayload,
    output_model=ReactionRuleListResult,
    method="get",
    path="/reactive/rules",
    tags=("bff", "reactive", "rules", "list"),
)
def _flow_bff_list_reaction_rules(builder: FlowBuilder):
    task = builder.task("list_reaction_rules", "bff.reactive.list_rules")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.reactive.read_rule",
    title="Read Reaction Rule",
    description="Retrieve a single reaction rule with keywords and actions",
    input_model=ReactionRuleReadPayload,
    output_model=ReactionRuleOut,
    method="get",
    path="/reactive/rules/{rule_id}",
    tags=("bff", "reactive", "rules", "detail"),
)
def _flow_bff_read_reaction_rule(builder: FlowBuilder):
    task = builder.task("read_reaction_rule", "bff.reactive.read_rule")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.reactive.list_rule_links",
    title="List Reaction Rule Publication Links",
    description="Retrieve publications attached to a reaction rule",
    input_model=ReactionRuleLinksPayload,
    output_model=ReactionRuleLinksResult,
    method="get",
    path="/reactive/rules/{rule_id}/publications",
    tags=("bff", "reactive", "rules", "publications"),
)
def _flow_bff_list_rule_links(builder: FlowBuilder):
    task = builder.task("list_rule_links", "bff.reactive.list_rule_links")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.reactive.list_action_logs",
    title="List Reactive Action Logs",
    description="Retrieve recent reactive automation action logs",
    input_model=ReactionActionLogQueryPayload,
    output_model=ReactionActionLogListResult,
    method="get",
    path="/reactive/action-logs",
    tags=("bff", "reactive", "activity", "logs"),
)
def _flow_bff_list_action_logs(builder: FlowBuilder):
    task = builder.task("list_action_logs", "bff.reactive.list_action_logs")
    builder.expect_terminal(task)


__all__ = []
