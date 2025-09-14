from __future__ import annotations

import json
import os
from datetime import timedelta

import redis
from celery import shared_task
from sqlalchemy import create_engine, select, desc, text
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings
from apps.backend.src.modules.trends.models import Trend  # type: ignore

REDIS_URL = os.getenv("REDIS_URL", settings.CELERY_BROKER_URL)
rds = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# 동기 엔진/세션
_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

@shared_task(name="apps.backend.src.workers.Synchro.tasks.refresh_cache", queue="synchro")
def refresh_cache():
    """
    최근 수집본을 Redis에 캐싱 (BFF 빠른 응답용)
    키: trends:latest:{country}
    """
    with SessionLocal() as session:
        countries = session.execute(select(Trend.country).distinct()).scalars().all()
        for c in countries:
            rows = (
                session.query(Trend)
                .filter(Trend.country == c)
                .order_by(desc(Trend.retrieved), Trend.rank)
                .limit(100)
                .all()
            )
            payload = []
            for t in rows:
                payload.append(
                    {
                        "id": t.id,
                        "country": t.country,
                        "rank": t.rank,
                        "retrieved": t.retrieved.isoformat(),
                        "title": t.title,
                        "approx_traffic": t.approx_traffic,
                        "link": t.link,
                        "pub_date": t.pub_date,
                        "picture": t.picture,
                        "picture_source": t.picture_source,
                    }
                )
            rds.setex(f"trends:latest:{c}", timedelta(minutes=60), json.dumps(payload))

    return {"status": "ok", "countries": countries}

@shared_task(queue="synchro")
def refresh_embeddings(country: str = "KR", limit: int = 500):
    from apps.backend.src.services.embeddings import upsert_trend_embeddings
    import asyncio
    async def run():
        async with SessionLocal() as db:
            rows = (await db.execute(
                text("""
                SELECT id, title
                FROM trends
                WHERE country = :c
                  AND (title_embedding IS NULL OR retrieved > now() - interval '7 days')
                ORDER BY retrieved DESC
                LIMIT :n
                """),
                {"c": country, "n": limit}
            )).all()
            await upsert_trend_embeddings(db, rows)
    asyncio.run(run())