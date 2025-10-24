# apps/backend/src/modules/reactive/service.py
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterable, Optional, Sequence

from sqlalchemy import Select, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.backend.src.modules.common.enums import (
    ReactionActionStatus,
    ReactionActionType,
    ReactionMatchType,
    ReactionRuleStatus,
)
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.reactive.models import (
    ReactionActionLog,
    ReactionAlert,
    ReactionRule,
    ReactionRuleAction,
    ReactionRuleKeyword,
    ReactionRulePublication,
)
from apps.backend.src.modules.reactive.schemas import (
    ReactionActionLogOut,
    ReactionActionLogListResult,
    ReactionEvaluationAction,
    ReactionEvaluationResult,
    ReactionRuleActionConfig,
    ReactionRuleActionOut,
    ReactionRuleCreate,
    ReactionRuleKeywordConfig,
    ReactionRuleKeywordOut,
    ReactionRuleOut,
    ReactionRulePublicationCreate,
    ReactionRulePublicationLink,
    ReactionRuleUpdate,
)


def _serialize_keyword(model: ReactionRuleKeyword) -> ReactionRuleKeywordOut:
    return ReactionRuleKeywordOut(
        id=model.id,
        tag_key=model.tag_key,
        match_type=model.match_type,
        keyword=model.keyword,
        language=model.language,
        is_active=model.is_active,
        priority=model.priority,
    )


def _serialize_action(model: ReactionRuleAction) -> ReactionRuleActionOut:
    return ReactionRuleActionOut(
        id=model.id,
        tag_key=model.tag_key,
        dm_template_id=model.dm_template_id,
        reply_template_id=model.reply_template_id,
        alert_enabled=model.alert_enabled,
        alert_severity=model.alert_severity,
        alert_assignee_user_id=model.alert_assignee_user_id,
        llm_mode=model.llm_mode,
        metadata=model.metadata,
    )


def _serialize_rule(model: ReactionRule) -> ReactionRuleOut:
    return ReactionRuleOut(
        id=model.id,
        owner_user_id=model.owner_user_id,
        name=model.name,
        description=model.description,
        status=model.status,
        priority=model.priority,
        created_at=model.created_at,
        updated_at=model.updated_at,
        keywords=[_serialize_keyword(k) for k in model.keywords],
        actions=[_serialize_action(a) for a in model.actions],
    )


def _serialize_publication(model: ReactionRulePublication) -> ReactionRulePublicationLink:
    return ReactionRulePublicationLink(
        id=model.id,
        reaction_rule_id=model.reaction_rule_id,
        post_publication_id=model.post_publication_id,
        priority=model.priority,
        active_from=model.active_from,
        active_until=model.active_until,
        is_active=model.is_active,
    )


def _serialize_action_log(model: ReactionActionLog) -> ReactionActionLogOut:
    return ReactionActionLogOut(
        id=model.id,
        insight_comment_id=model.insight_comment_id,
        reaction_rule_id=model.reaction_rule_id,
        tag_key=model.tag_key,
        action_type=model.action_type,
        status=model.status,
        payload=model.payload,
        error=model.error,
        executed_at=model.executed_at,
        created_at=model.created_at,
    )


async def list_reaction_rules(db: AsyncSession, *, owner_user_id: int) -> list[ReactionRuleOut]:
    stmt: Select[ReactionRule] = (
        select(ReactionRule)
        .where(ReactionRule.owner_user_id == owner_user_id)
        .options(
            selectinload(ReactionRule.keywords),
            selectinload(ReactionRule.actions),
        )
        .order_by(ReactionRule.priority.asc(), ReactionRule.id.asc())
    )
    result = await db.execute(stmt)
    rules = result.scalars().unique().all()
    return [_serialize_rule(rule) for rule in rules]


async def get_reaction_rule(
    db: AsyncSession,
    *,
    rule_id: int,
    owner_user_id: int,
) -> Optional[ReactionRuleOut]:
    stmt = (
        select(ReactionRule)
        .where(
            ReactionRule.id == rule_id,
            ReactionRule.owner_user_id == owner_user_id,
        )
        .options(
            selectinload(ReactionRule.keywords),
            selectinload(ReactionRule.actions),
        )
    )
    result = await db.execute(stmt)
    rule = result.scalars().unique().one_or_none()
    if not rule:
        return None
    return _serialize_rule(rule)


async def create_reaction_rule(
    db: AsyncSession,
    payload: ReactionRuleCreate,
    *,
    owner_user_id: int,
) -> ReactionRuleOut:
    rule = ReactionRule(
        owner_user_id=owner_user_id,
        name=payload.name,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
    )

    for keyword in payload.keywords:
        rule.keywords.append(_build_keyword(rule, keyword))

    for action in payload.actions:
        rule.actions.append(_build_action(rule, action))

    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return _serialize_rule(rule)


async def update_reaction_rule(
    db: AsyncSession,
    *,
    rule_id: int,
    owner_user_id: int,
    payload: ReactionRuleUpdate,
) -> Optional[ReactionRuleOut]:
    stmt = (
        select(ReactionRule)
        .where(
            ReactionRule.id == rule_id,
            ReactionRule.owner_user_id == owner_user_id,
        )
        .options(
            selectinload(ReactionRule.keywords),
            selectinload(ReactionRule.actions),
        )
    )
    result = await db.execute(stmt)
    rule = result.scalars().unique().one_or_none()
    if not rule:
        return None

    if payload.name is not None:
        rule.name = payload.name
    if payload.description is not None:
        rule.description = payload.description
    if payload.status is not None:
        rule.status = payload.status
    if payload.priority is not None:
        rule.priority = payload.priority

    if payload.keywords is not None:
        rule.keywords.clear()
        for item in payload.keywords:
            rule.keywords.append(_build_keyword(rule, item))

    if payload.actions is not None:
        rule.actions.clear()
        for item in payload.actions:
            rule.actions.append(_build_action(rule, item))

    await db.flush()
    await db.refresh(rule)
    return _serialize_rule(rule)


def _build_keyword(
    rule: ReactionRule,
    config: ReactionRuleKeywordConfig,
) -> ReactionRuleKeyword:
    return ReactionRuleKeyword(
        rule=rule,
        tag_key=config.tag_key,
        match_type=config.match_type,
        keyword=config.keyword,
        language=config.language,
        is_active=config.is_active,
        priority=config.priority,
    )


def _build_action(
    rule: ReactionRule,
    config: ReactionRuleActionConfig,
) -> ReactionRuleAction:
    return ReactionRuleAction(
        rule=rule,
        tag_key=config.tag_key,
        dm_template_id=config.dm_template_id,
        reply_template_id=config.reply_template_id,
        alert_enabled=config.alert_enabled,
        alert_severity=config.alert_severity,
        alert_assignee_user_id=config.alert_assignee_user_id,
        llm_mode=config.llm_mode,
        metadata=config.metadata,
    )


async def delete_reaction_rule(
    db: AsyncSession,
    *,
    rule_id: int,
    owner_user_id: int,
) -> bool:
    stmt = select(ReactionRule).where(
        ReactionRule.id == rule_id,
        ReactionRule.owner_user_id == owner_user_id,
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def link_rule_to_publication(
    db: AsyncSession,
    *,
    rule_id: int,
    owner_user_id: int,
    payload: ReactionRulePublicationCreate,
) -> Optional[ReactionRulePublicationLink]:
    rule_stmt = select(ReactionRule).where(
        ReactionRule.id == rule_id,
        ReactionRule.owner_user_id == owner_user_id,
    )
    rule_result = await db.execute(rule_stmt)
    rule = rule_result.scalar_one_or_none()
    if not rule:
        return None

    existing_stmt = select(ReactionRulePublication).where(
        ReactionRulePublication.reaction_rule_id == rule_id,
        ReactionRulePublication.post_publication_id == payload.post_publication_id,
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return _serialize_publication(existing)

    link = ReactionRulePublication(
        rule=rule,
        post_publication_id=payload.post_publication_id,
        priority=payload.priority,
        active_from=payload.active_from,
        active_until=payload.active_until,
        is_active=payload.is_active,
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return _serialize_publication(link)


async def unlink_rule_from_publication(
    db: AsyncSession,
    *,
    link_id: int,
    owner_user_id: int,
) -> bool:
    stmt = (
        select(ReactionRulePublication)
        .join(ReactionRule, ReactionRule.id == ReactionRulePublication.reaction_rule_id)
        .where(
            ReactionRulePublication.id == link_id,
            ReactionRule.owner_user_id == owner_user_id,
        )
    )
    result = await db.execute(stmt)
    link = result.scalar_one_or_none()
    if not link:
        return False
    await db.delete(link)
    await db.flush()
    return True


async def list_publication_links(
    db: AsyncSession,
    *,
    rule_id: int,
    owner_user_id: int,
) -> list[ReactionRulePublicationLink]:
    stmt = (
        select(ReactionRulePublication)
        .join(ReactionRule, ReactionRule.id == ReactionRulePublication.reaction_rule_id)
        .where(
            ReactionRulePublication.reaction_rule_id == rule_id,
            ReactionRule.owner_user_id == owner_user_id,
        )
        .order_by(ReactionRulePublication.priority.asc(), ReactionRulePublication.id.asc())
    )
    result = await db.execute(stmt)
    links = result.scalars().all()
    return [_serialize_publication(link) for link in links]


async def record_action_log(
    db: AsyncSession,
    *,
    insight_comment_id: int,
    reaction_rule_id: Optional[int],
    tag_key: str,
    action_type: ReactionActionType,
    status: ReactionActionStatus,
    payload: Optional[dict] = None,
    error: Optional[str] = None,
    executed_at: Optional[datetime] = None,
) -> ReactionActionLogOut:
    executed_at = executed_at or datetime.now(timezone.utc)
    log = ReactionActionLog(
        insight_comment_id=insight_comment_id,
        reaction_rule_id=reaction_rule_id,
        tag_key=tag_key,
        action_type=action_type,
        status=status,
        payload=payload,
        error=error,
        executed_at=executed_at,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return _serialize_action_log(log)


async def mark_action_log_status(
    db: AsyncSession,
    *,
    log_id: int,
    status: ReactionActionStatus,
    payload: Optional[dict] = None,
    error: Optional[str] = None,
) -> Optional[ReactionActionLogOut]:
    stmt = select(ReactionActionLog).where(ReactionActionLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log:
        return None
    log.status = status
    log.payload = payload
    log.error = error
    log.executed_at = datetime.now(timezone.utc)
    await db.flush()
    return _serialize_action_log(log)


async def has_executed_action(
    db: AsyncSession,
    *,
    insight_comment_id: int,
    tag_key: str,
    action_type: ReactionActionType,
) -> bool:
    stmt = select(ReactionActionLog).where(
        ReactionActionLog.insight_comment_id == insight_comment_id,
        ReactionActionLog.tag_key == tag_key,
        ReactionActionLog.action_type == action_type,
        ReactionActionLog.status == ReactionActionStatus.SUCCESS,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def action_log_exists(
    db: AsyncSession,
    *,
    insight_comment_id: int,
    tag_key: str,
    action_type: ReactionActionType,
) -> bool:
    stmt = select(ReactionActionLog.id).where(
        ReactionActionLog.insight_comment_id == insight_comment_id,
        ReactionActionLog.tag_key == tag_key,
        ReactionActionLog.action_type == action_type,
    ).limit(1)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def evaluate_comment(
    db: AsyncSession,
    *,
    comment: InsightComment,
    owner_user_id: int,
    when: Optional[datetime] = None,
) -> ReactionEvaluationResult:
    when = when or datetime.now(timezone.utc)
    matched_tags: set[str] = set()
    actions: list[ReactionEvaluationAction] = []

    if not comment.post_publication_id:
        return ReactionEvaluationResult(
            comment_id=comment.id,
            matched_tags=[],
            actions=[],
        )

    rule_stmt = (
        select(ReactionRule)
        .join(ReactionRulePublication, ReactionRulePublication.reaction_rule_id == ReactionRule.id)
        .where(
            ReactionRule.owner_user_id == owner_user_id,
            ReactionRule.status == ReactionRuleStatus.ACTIVE,
            ReactionRulePublication.post_publication_id == comment.post_publication_id,
            ReactionRulePublication.is_active.is_(True),
            ReactionRulePublication.priority >= 0,
        )
        .options(
            selectinload(ReactionRule.keywords),
            selectinload(ReactionRule.actions),
        )
        .order_by(ReactionRule.priority.asc(), ReactionRulePublication.priority.asc())
    )
    result = await db.execute(rule_stmt)
    rules = result.scalars().unique().all()

    text = (comment.text or "").strip()
    normalized = text.lower()

    for rule in rules:
        tag_to_action = {action.tag_key: action for action in rule.actions}
        rule_matches = _match_tags_from_keywords(text, normalized, rule.keywords)
        for tag in rule_matches:
            matched_tags.add(tag)
            action = tag_to_action.get(tag)
            if action:
                actions.append(
                    ReactionEvaluationAction(
                        reaction_rule_id=rule.id,
                        rule_priority=rule.priority,
                        tag_key=action.tag_key,
                        dm_template_id=action.dm_template_id,
                        reply_template_id=action.reply_template_id,
                        alert_enabled=action.alert_enabled,
                        alert_severity=action.alert_severity,
                        alert_assignee_user_id=action.alert_assignee_user_id,
                        llm_mode=action.llm_mode,
                        metadata=action.metadata,
                    )
                )
            elif tag_to_action.get(tag) is None:
                # no action specified, still record tag
                continue

    return ReactionEvaluationResult(
        comment_id=comment.id,
        matched_tags=sorted(matched_tags),
        actions=actions,
    )


def _match_tags_from_keywords(
    original_text: str,
    normalized_text: str,
    keywords: Sequence[ReactionRuleKeyword],
) -> set[str]:
    matched: set[str] = set()
    for keyword in keywords:
        if not keyword.is_active:
            continue
        if not keyword.keyword:
            continue
        target = keyword.keyword
        if keyword.match_type == ReactionMatchType.CONTAINS:
            if target.lower() in normalized_text:
                matched.add(keyword.tag_key)
        elif keyword.match_type == ReactionMatchType.EXACT:
            if original_text.strip().lower() == target.strip().lower():
                matched.add(keyword.tag_key)
        elif keyword.match_type == ReactionMatchType.REGEX:
            try:
                if re.search(target, original_text):
                    matched.add(keyword.tag_key)
            except re.error:
                continue
    return matched


async def create_alert(
    db: AsyncSession,
    *,
    reaction_rule_id: Optional[int],
    insight_comment_id: int,
    tag_key: str,
    severity: Optional[str],
    assignee_user_id: Optional[int],
    metadata: Optional[dict] = None,
) -> ReactionAlert:
    alert = ReactionAlert(
        reaction_rule_id=reaction_rule_id,
        insight_comment_id=insight_comment_id,
        tag_key=tag_key,
        severity=severity,
        assignee_user_id=assignee_user_id,
        metadata=metadata,
        status=ReactionActionStatus.PENDING,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


async def list_action_logs(
    db: AsyncSession,
    *,
    owner_user_id: int,
    status: Optional[ReactionActionStatus] = None,
    action_type: Optional[ReactionActionType] = None,
    tag_key: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> ReactionActionLogListResult:
    base_stmt = (
        select(ReactionActionLog)
        .join(InsightComment, InsightComment.id == ReactionActionLog.insight_comment_id)
        .where(InsightComment.owner_user_id == owner_user_id)
    )
    if status is not None:
        base_stmt = base_stmt.where(ReactionActionLog.status == status)
    if action_type is not None:
        base_stmt = base_stmt.where(ReactionActionLog.action_type == action_type)
    if tag_key:
        base_stmt = base_stmt.where(ReactionActionLog.tag_key == tag_key)

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = (
        base_stmt.order_by(ReactionActionLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(rows_stmt)).scalars().all()
    return ReactionActionLogListResult(
        total=total,
        items=[_serialize_action_log(row) for row in rows],
    )


async def find_existing_reply_comment(
    db: AsyncSession,
    *,
    parent_comment: InsightComment,
) -> Optional[InsightComment]:
    """Return an existing reply by us for the given comment, if any."""
    if not parent_comment.comment_external_id or not parent_comment.platform_post_id:
        return None

    stmt = select(InsightComment).where(
        InsightComment.platform == parent_comment.platform,
        InsightComment.parent_external_id == parent_comment.comment_external_id,
        InsightComment.is_owned_by_me.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalars().first()
