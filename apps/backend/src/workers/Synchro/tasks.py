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
from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.services.embeddings import embed_texts_sync
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

@shared_task(name="apps.backend.src.workers.Synchro.tasks.enqueue_trend_title_embedding",
             queue="synchro", bind=True, max_retries=3, acks_late=True)
def enqueue_trend_title_embedding(self, trend_id: int):
    with SessionLocal() as session:
        tr: Trend | None = session.get(Trend, trend_id)
        if not tr:
            return {"ok": False, "reason": "not_found"}

        if not tr.title:  # 방어
            return {"ok": False, "reason": "no_title"}

        emb = embed_texts_sync([tr.title])[0]
        
        if emb is None:
            return {"ok": False, "reason": "embed_failed"}

        tr.title_embedding = emb
        session.commit()
        return {"ok": True} 

@shared_task(name="apps.backend.src.workers.Synchro.tasks.find_similar_trends_for_persona",
             queue="synchro", bind=True, max_retries=3, acks_late=True)
def find_similar_trends_for_persona(self, persona_snapshot: Persona, country: str = "US", limit: int = 20) -> dict:
    """
    Persona와 유사한 최신 trends를 찾아서 필터링하여 반환합니다.

    Args:
        persona_snapshot: Persona 스냅샷
        country: 트렌드 국가 (기본값: "US")
        limit: 최대 반환 개수 (기본값: 20)

    Returns:
        TrendsListResponse 형태의 데이터
    """
    from apps.backend.src.services.embeddings import embed_texts_sync
    from apps.backend.src.modules.trends.repository import vector_search_trends
    from apps.backend.src.core.db import get_db
    import asyncio

    async def find_similar_trends():
        async with get_db() as db:
            persona = persona_snapshot
            # Persona의 이름과 설명을 결합해서 embedding 생성
            persona_text = f"{persona.name} {persona.bio or ''}"
            persona_embedding = embed_texts_sync([persona_text])[0]

            if persona_embedding is None:
                return {"rows": [], "total": 0, "error": "Failed to embed persona"}

            # 벡터 검색으로 유사한 트렌드 찾기
            similar_trends = await vector_search_trends(
                db,
                country=country,
                vec=persona_embedding,
                limit=limit * 2  # 여유있게 더 많이 가져와서 필터링
            )
            filtered_trends = similar_trends[:limit]

            return {
                "rows": filtered_trends,
                "total": len(filtered_trends),
                "persona_name": persona_snapshot.name,
                "country": country
            }

    try:
        return asyncio.run(find_similar_trends())

    except Exception as exc:
        # 실패 시 재시도
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)

        return {"rows": [], "total": 0, "error": str(exc)}