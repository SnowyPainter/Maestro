# src/modules/insights/service.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.insights.models import InsightComment, InsightSample
from apps.backend.src.modules.insights.schemas import InsightCommentIn, InsightIn, InsightCommentList, InsightCommentOut
from apps.backend.src.modules.common.enums import PlatformKind

async def ingest_insight_sample(db: AsyncSession, payload: InsightIn) -> InsightSample:
    # 1) ingest_key 우선 멱등화
    if payload.ingest_key:
        exist = (await db.execute(
            select(InsightSample).where(InsightSample.ingest_key == payload.ingest_key)
        )).scalar_one_or_none()
        if exist:
            # 기존 metrics에 새 키만 갱신(덮어쓰기)
            exist.metrics = {**(exist.metrics or {}), **payload.metrics}
            exist.scope = payload.scope
            exist.content_kind = payload.content_kind
            exist.account_persona_id = payload.account_persona_id
            exist.platform_post_id = payload.platform_post_id
            exist.source = payload.source
            if payload.ingest_key:
                exist.ingest_key = payload.ingest_key
            await db.flush(); await db.commit()
            return exist

    # 2) (platform, platform_post_id, ts) 유니크 멱등화
    if payload.platform_post_id:
        exist = (await db.execute(
            select(InsightSample).where(
                InsightSample.platform == payload.platform,
                InsightSample.platform_post_id == payload.platform_post_id,
                InsightSample.ts == payload.ts,
            )
        )).scalar_one_or_none()
        if exist:
            exist.metrics = {**(exist.metrics or {}), **payload.metrics}
            exist.scope = payload.scope
            exist.content_kind = payload.content_kind
            exist.account_persona_id = payload.account_persona_id
            exist.source = payload.source
            await db.flush(); await db.commit()
            return exist

    row = InsightSample(
        owner_user_id=payload.owner_user_id,
        post_publication_id=payload.post_publication_id,
        platform=payload.platform,
        platform_post_id=payload.platform_post_id,
        account_persona_id=payload.account_persona_id,
        ts=payload.ts,
        scope=payload.scope,
        content_kind=payload.content_kind,
        metrics=payload.metrics,
        ingest_key=payload.ingest_key,
        source=payload.source,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    return row


async def upsert_insight_comments(db: AsyncSession, items: List[InsightCommentIn]) -> List[InsightComment]:
    """인사이트 댓글 다건 업서트."""

    def _normalize_metrics(raw_metrics: Dict[str, Any] | None) -> Dict[str, float]:
        normalized: Dict[str, float] = {}
        if not isinstance(raw_metrics, dict):
            return normalized
        for key, value in raw_metrics.items():
            if not isinstance(key, str) or not key:
                continue
            try:
                normalized[key] = float(value)
            except (TypeError, ValueError):
                continue
        return normalized

    # 입력값 정규화 및 유효성 체크
    normalized: List[InsightCommentIn] = []
    for item in items or []:
        comment_id = (item.comment_external_id or "").strip()
        if not comment_id:
            continue
        normalized.append(
            InsightCommentIn(
                owner_user_id=item.owner_user_id,
                post_publication_id=item.post_publication_id,
                platform=item.platform,
                platform_post_id=item.platform_post_id,
                account_persona_id=item.account_persona_id,
                comment_external_id=comment_id,
                parent_external_id=item.parent_external_id,
                author_id=item.author_id,
                author_username=item.author_username,
                text=item.text,
                permalink=item.permalink,
                comment_created_at=item.comment_created_at,
                metrics=_normalize_metrics(item.metrics),
                raw=item.raw or {},
            )
        )

    if not normalized:
        return []

    # 기존 행 조회
    grouped_ids: Dict[PlatformKind, List[str]] = {}
    for payload in normalized:
        key = payload.platform
        grouped_ids.setdefault(key, []).append(payload.comment_external_id)

    existing_by_key: Dict[Tuple[PlatformKind, str], InsightComment] = {}
    for platform_value, comment_ids in grouped_ids.items():
        if not comment_ids:
            continue
        stmt = select(InsightComment).where(
            InsightComment.platform == platform_value,
            InsightComment.comment_external_id.in_(comment_ids),
        )
        result = await db.execute(stmt)
        for row in result.scalars().all():
            existing_by_key[(row.platform, row.comment_external_id)] = row

    now = datetime.utcnow()
    stored: List[InsightComment] = []

    for payload in normalized:
        map_key = (payload.platform, payload.comment_external_id)
        row = existing_by_key.get(map_key)
        if row is None:
            row = InsightComment(
                owner_user_id=payload.owner_user_id,
                post_publication_id=payload.post_publication_id,
                platform=payload.platform,
                platform_post_id=payload.platform_post_id,
                account_persona_id=payload.account_persona_id,
                comment_external_id=payload.comment_external_id,
                parent_external_id=payload.parent_external_id,
                author_id=payload.author_id,
                author_username=payload.author_username,
                text=payload.text,
                permalink=payload.permalink,
                comment_created_at=payload.comment_created_at,
                metrics=payload.metrics,
                raw=payload.raw,
            )
            db.add(row)
            existing_by_key[map_key] = row
        else:
            row.owner_user_id = payload.owner_user_id
            row.post_publication_id = payload.post_publication_id
            row.platform_post_id = payload.platform_post_id
            row.account_persona_id = payload.account_persona_id
            row.parent_external_id = payload.parent_external_id
            row.author_id = payload.author_id
            row.author_username = payload.author_username
            row.text = payload.text
            row.permalink = payload.permalink
            row.comment_created_at = payload.comment_created_at
            row.metrics = payload.metrics
            row.raw = payload.raw

        row.ingested_at = now
        stored.append(row)

    await db.flush()
    await db.commit()
    return stored


def _comment_hotness(comment: InsightComment, *, now: datetime | None = None) -> float:
    metrics = comment.metrics or {}

    def _as_float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    likes = _as_float(
        metrics.get("likes")
        or metrics.get("like_count")
        or metrics.get("favorite_count")
    )
    replies = _as_float(
        metrics.get("replies")
        or metrics.get("reply_count")
        or metrics.get("comments")
        or metrics.get("comments_count")
    )

    current = now or datetime.now(timezone.utc)
    created_at = comment.comment_created_at
    recency_bonus = 0.0
    if created_at is not None:
        aware_created = created_at
        if aware_created.tzinfo is None:
            aware_created = aware_created.replace(tzinfo=timezone.utc)
        age_hours = max((current - aware_created).total_seconds() / 3600.0, 0.0)
        # Newer comments get up to +1.0 bonus (decays over 48 hours)
        if age_hours < 48:
            recency_bonus = (48.0 - age_hours) / 48.0

    # Likes weigh moderately, replies weigh higher as indicator of conversation.
    return likes * 1.0 + replies * 2.0 + recency_bonus


async def list_insight_comments(
    db: AsyncSession,
    *,
    post_publication_id: int,
    persona_account_id: int | None = None,
    limit: int = 10,
) -> InsightCommentList:
    if limit <= 0:
        raise ValueError("limit must be positive")

    stmt = (
        select(InsightComment)
        .where(InsightComment.post_publication_id == post_publication_id)
        .order_by(
            InsightComment.comment_created_at.desc().nullslast(),
            InsightComment.ingested_at.desc(),
        )
        .limit(max(limit * 5, limit))
    )
    if persona_account_id is not None:
        stmt = stmt.where(InsightComment.account_persona_id == persona_account_id)

    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    if not rows:
        return InsightCommentList(comments=[], total=0, has_more=False)

    now = datetime.now(timezone.utc)
    scored = sorted(
        rows,
        key=lambda row: (
            _comment_hotness(row, now=now),
            row.comment_created_at or row.ingested_at,
        ),
        reverse=True,
    )

    top_rows = scored[:limit]
    comments = [InsightCommentOut.model_validate(row) for row in top_rows]
    return InsightCommentList(
        comments=comments,
        total=len(comments),
        has_more=len(scored) > len(comments),
    )
