"""Celery task that scans recent insight comments and triggers reactive automation."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_, select

from apps.backend.src.core.celery_app import celery_app
from apps.backend.src.core.db import SessionLocal
from apps.backend.src.modules.common.enums import (
    ReactionActionStatus,
    ReactionActionType,
)
from apps.backend.src.modules.reactive.schemas import ReactionEvaluationAction
from apps.backend.src.modules.insights.models import InsightComment
from apps.backend.src.modules.reactive.models import ReactionMessageTemplate
from apps.backend.src.modules.reactive.service import (
    create_alert,
    ensure_action_log,
    evaluate_comment,
    mark_action_log_status,
)
from apps.backend.src.workers.Adapter.tasks import (
    reactive_reply_to_comment,
    reactive_send_dm,
)

import logging
from apps.backend.src.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


async def _load_recent_comments(
    session,
    *,
    cutoff: datetime,
    limit: int,
) -> List[InsightComment]:

    logger.info(f"Loading recent comments from {cutoff} to {datetime.now(timezone.utc)}")
    logger.info(f"Limit: {limit}")

    stmt = (
        select(InsightComment)
        .where(
            InsightComment.ingested_at >= cutoff,
            or_(
                InsightComment.is_owned_by_me.is_(False),
                InsightComment.is_owned_by_me.is_(None),
            ),
            InsightComment.text.is_not(None),
        )
        .order_by(InsightComment.ingested_at.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.scalars().all()


async def _load_template(
    session,
    template_id: Optional[int],
    *,
    persona_account_id: Optional[int],
    allow_cross_persona: bool = True,
) -> Optional[ReactionMessageTemplate]:
    if not template_id:
        return None
    template = await session.get(ReactionMessageTemplate, template_id)
    if template is None:
        logger.warning(
            "Reaction template %s not found (persona_account_id=%s)",
            template_id,
            persona_account_id,
        )
        return None
    if not template.is_active:
        logger.warning(
            "Reaction template %s inactive (persona_account_id=%s, template_persona_id=%s)",
            template_id,
            persona_account_id,
            template.persona_account_id,
        )
        return None
    if not allow_cross_persona:
        if (
            template.persona_account_id
            and persona_account_id
            and template.persona_account_id != persona_account_id
        ):
            logger.warning(
                "Reaction template %s persona mismatch (expected=%s, got=%s)",
                template_id,
                template.persona_account_id,
                persona_account_id,
            )
            return None
    return template


async def _ensure_log(
    session,
    *,
    insight_comment_id: int,
    rule_id: Optional[int],
    tag_key: str,
    action_type: ReactionActionType,
    status: ReactionActionStatus,
    payload: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> Optional[int]:
    return await ensure_action_log(
        session,
        insight_comment_id=insight_comment_id,
        reaction_rule_id=rule_id,
        tag_key=tag_key,
        action_type=action_type,
        status=status,
        payload=payload,
        error=error,
    )


async def _process_action(
    session,
    comment: InsightComment,
    *,
    action: ReactionEvaluationAction,
    dispatch_queue: List[Tuple[str, Dict[str, Any]]],
) -> Tuple[int, int]:
    dispatch_count = 0
    alert_count = 0

    logger.info(f"Processing action: {action.reaction_rule_id}, {action.tag_key}, Reply Template ID: {action.reply_template_id}, DM Template ID: {action.dm_template_id}, Alert Enabled: {action.alert_enabled}")
    logger.info(f"Comment: {comment}, Account Persona ID: {comment.account_persona_id}, Comment External ID: {comment.comment_external_id}, Author ID: {comment.author_id}")

    # Reply automation
    if action.reply_template_id and comment.comment_external_id and comment.account_persona_id:
        logger.info(f"Processing reply action for comment {comment.id}")
        template = await _load_template(
            session,
            action.reply_template_id,
            persona_account_id=comment.account_persona_id,
        )
        if template is None:
            await _ensure_log(
                session,
                insight_comment_id=comment.id,
                rule_id=action.reaction_rule_id,
                tag_key=action.tag_key,
                action_type=ReactionActionType.REPLY,
                status=ReactionActionStatus.SKIPPED,
                payload={"template_id": action.reply_template_id},
                error="reply_template_unavailable",
            )
        else:
            payload = {
                "template_id": template.id,
                "template_title": template.title,
                "mode": action.llm_mode.value,
                "metadata": action.metadata,
            }
            log_id = await _ensure_log(
                session,
                insight_comment_id=comment.id,
                rule_id=action.reaction_rule_id,
                tag_key=action.tag_key,
                action_type=ReactionActionType.REPLY,
                status=ReactionActionStatus.PENDING,
                payload=payload,
            )
            if log_id is not None:
                dispatch_queue.append(
                    (
                        "reply",
                        {
                            "insight_comment_id": comment.id,
                            "persona_account_id": comment.account_persona_id,
                            "reaction_rule_id": action.reaction_rule_id,
                            "tag_key": action.tag_key,
                            "message": template.body,
                            "metadata": action.metadata or {},
                        },
                    )
                )
                dispatch_count += 1

    # DM automation
    if action.dm_template_id and comment.account_persona_id and comment.author_id:
        template = await _load_template(
            session,
            action.dm_template_id,
            persona_account_id=comment.account_persona_id,
        )
        if template is None:
            await _ensure_log(
                session,
                insight_comment_id=comment.id,
                rule_id=action.reaction_rule_id,
                tag_key=action.tag_key,
                action_type=ReactionActionType.DM,
                status=ReactionActionStatus.SKIPPED,
                payload={"template_id": action.dm_template_id},
                error="dm_template_unavailable",
            )
        else:
            payload = {
                "template_id": template.id,
                "template_title": template.title,
                "mode": action.llm_mode.value,
                "metadata": action.metadata,
            }
            log_id = await _ensure_log(
                session,
                insight_comment_id=comment.id,
                rule_id=action.reaction_rule_id,
                tag_key=action.tag_key,
                action_type=ReactionActionType.DM,
                status=ReactionActionStatus.PENDING,
                payload=payload,
            )
            if log_id is not None:
                dispatch_queue.append(
                    (
                        "dm",
                        {
                            "platform": comment.platform.value,
                            "persona_account_id": comment.account_persona_id,
                            "reaction_rule_id": action.reaction_rule_id,
                            "tag_key": action.tag_key,
                            "insight_comment_id": comment.id,
                            "recipient_external_id": comment.author_id,
                            "message": template.body,
                            "metadata": action.metadata or {},
                        },
                    )
                )
                dispatch_count += 1

    # Alert creation
    if action.alert_enabled:
        log_id = await _ensure_log(
            session,
            insight_comment_id=comment.id,
            rule_id=action.reaction_rule_id,
            tag_key=action.tag_key,
            action_type=ReactionActionType.ALERT,
            status=ReactionActionStatus.PENDING,
            payload={"metadata": action.metadata},
        )
        if log_id is not None:
            alert = await create_alert(
                session,
                reaction_rule_id=action.reaction_rule_id,
                insight_comment_id=comment.id,
                tag_key=action.tag_key,
                severity=action.alert_severity,
                assignee_user_id=action.alert_assignee_user_id,
                metadata=action.metadata,
            )
            await mark_action_log_status(
                session,
                log_id=log_id,
                status=ReactionActionStatus.SUCCESS,
                payload={"alert_id": alert.id},
            )
            alert_count += 1

    return dispatch_count, alert_count


async def _process_comment(session, comment: InsightComment) -> Dict[str, int]:
    stats = {"actions": 0, "dispatches": 0}
    if not comment.owner_user_id:
        return stats
    logger.info(f"Processing comment {comment.id} with owner_user_id: {comment.owner_user_id}")
    evaluation = await evaluate_comment(
        session,
        comment=comment,
        owner_user_id=comment.owner_user_id,
    )

    logger.info(f"Evaluation: {evaluation}")
    logger.info(f"Evaluation actions: {len(evaluation.actions)}")
    logger.info(f"Evaluation matched tags: {evaluation.matched_tags}")
    logger.info(f"Evaluation comment id: {evaluation.comment_id}")
    logger.info(f"Evaluation actions: {evaluation.actions}")
    logger.info(f"Evaluation matched tags: {evaluation.matched_tags}")
    logger.info(f"Evaluation comment id: {evaluation.comment_id}")
    logger.info(f"Evaluation actions: {evaluation.actions}")
    logger.info(f"Evaluation matched tags: {evaluation.matched_tags}")
    logger.info(f"Evaluation comment id: {evaluation.comment_id}")
    
    if not evaluation.actions:
        return stats
    logger.info(f"Evaluation actions: {len(evaluation.actions)}")
    dispatch_queue: List[Tuple[str, Dict[str, Any]]] = []
    total_dispatches = 0
    total_alerts = 0
    for action in evaluation.actions:
        dispatched, alerts = await _process_action(
            session,
            comment,
            action=action,
            dispatch_queue=dispatch_queue,
        )
        total_dispatches += dispatched
        total_alerts += alerts
    logger.info(f"Total dispatches: {total_dispatches}, Total alerts: {total_alerts}")
    if dispatch_queue or total_alerts:
        await session.commit()
        logger.info(f"Committed session for comment {comment.id}")
        stats["actions"] = total_dispatches + total_alerts
        for action_type, payload in dispatch_queue:
            if action_type == "reply":
                reactive_reply_to_comment.delay(**payload)
            elif action_type == "dm":
                reactive_send_dm.delay(**payload)
        stats["dispatches"] = total_dispatches
    else:
        await session.commit()
    return stats


async def _ingest(window_minutes: int, limit: int) -> Dict[str, int]:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes + 60*24*3) # 임시
    summary = {"comments": 0, "dispatches": 0, "actions": 0}
    async with SessionLocal() as session:
        comments = await _load_recent_comments(session, cutoff=cutoff, limit=limit)
        logger.info(f"Found {len(comments)} comments to process")
        for comment in comments:
            try:
                stats = await _process_comment(session, comment)
                logger.info(f"Processed comment {comment.id} with stats: {stats}")
                summary["comments"] += 1
                summary["actions"] += stats["actions"]
                summary["dispatches"] += stats["dispatches"]
            except Exception as exc:  # pragma: no cover - defensive safeguard
                await session.rollback()
                logger.exception(
                    "Reactive comment processing failed",
                    extra={"comment_id": comment.id, "error": str(exc)},
                )
    return summary


@celery_app.task(
    name="apps.backend.src.workers.CoWorker.ingest_comments.ingest_reactive_comments",
    queue="coworker",
    bind=True,
    max_retries=0,
)
def ingest_reactive_comments(self, *, window_minutes: int = 10, limit: int = 200) -> Dict[str, int]:
    """Entry point for Celery beat to evaluate recent insight comments."""
    try:
        # Celery가 제공하는 이벤트 루프에서 직접 실행
        loop = asyncio.get_running_loop()
        result = loop.run_until_complete(_ingest(window_minutes=window_minutes, limit=limit))
    except RuntimeError:
        # 이벤트 루프가 실행 중이 아닌 경우 asyncio.run 사용
        result = asyncio.run(_ingest(window_minutes=window_minutes, limit=limit))

    logger.info(
        "Reactive comment ingest complete",
        extra={"window_minutes": window_minutes, "limit": limit, **result},
    )
    return result
