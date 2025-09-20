# src/modules/insights/service.py
from __future__ import annotations
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.insights.models import InsightSample
from apps.backend.src.modules.insights.schemas import InsightIn

async def ingest_insight_sample(db: AsyncSession, payload: InsightIn) -> InsightSample:
    # 1) ingest_key 우선 멱등화
    if payload.ingest_key:
        exist = (await db.execute(
            select(InsightSample).where(InsightSample.ingest_key == payload.ingest_key)
        )).scalar_one_or_none()
        if exist:
            # 기존 metrics에 새 키만 갱신(덮어쓰기)
            exist.metrics = {**(exist.metrics or {}), **payload.metrics}
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
            await db.flush(); await db.commit()
            return exist

    row = InsightSample(
        owner_user_id=payload.owner_user_id,
        post_publication_id=payload.post_publication_id,
        platform=payload.platform,
        platform_post_id=payload.platform_post_id,
        account_persona_id=payload.account_persona_id,
        ts=payload.ts,
        metrics=payload.metrics,
        ingest_key=payload.ingest_key,
        source=payload.source,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    return row
