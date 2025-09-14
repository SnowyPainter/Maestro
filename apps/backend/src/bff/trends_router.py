# apps/backend/src/bff/trends_router.py

from __future__ import annotations

import json
import os
from typing import Optional, List

import redis
from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import get_db
from apps.backend.src.modules.trends.schemas import TrendsListResponse, TrendItem
from apps.backend.src.services.embeddings import embed_texts_sync

router = APIRouter(prefix="/trends", tags=["trends"])

# Redis (캐시 조회용) - Celery Broker URL이 redis이면 그대로 재사용 가능
REDIS_URL = os.getenv("REDIS_URL", settings.CELERY_BROKER_URL)
rds = redis.Redis.from_url(REDIS_URL, decode_responses=True)


@router.get("", response_model=TrendsListResponse)
async def list_trends(
    country: str = Query("KR", description="국가 코드"),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="키워드(있으면 벡터 유사검색)"),
    db: AsyncSession = Depends(get_db),
):
    """
    q 없으면: Redis 캐시 → DB fallback
    q 있으면: pgvector 유사도 검색(<-> 연산자)
    """
    country = country.upper()

    # 1) 벡터 검색
    if q:
        v = embed_texts_sync([q])[0]
        # NOTE: asyncpg + pgvector 사용 시, 텍스트 쿼리에서는 (:vec)::vector 로 캐스팅을 명시하는 편이 안전
        sql = text(
            """
            SELECT id, country, rank, retrieved, title, approx_traffic, link, pub_date, picture, picture_source,
                   (title_embedding <-> (:vec)::vector) AS distance
            FROM trends
            WHERE country = :country AND title_embedding IS NOT NULL
            ORDER BY distance ASC
            LIMIT :limit
            """
        )
        rows = (await db.execute(sql, {"vec": v, "country": country, "limit": limit})).mappings().all()
        items: List[TrendItem] = [TrendItem.model_validate(dict(r)) for r in rows]
        return TrendsListResponse(country=country, query=q, items=items, source="vector")
    
    key = f"trends:latest:{country}"
    cached = rds.get(key)
    if cached:
        raw = json.loads(cached)
        # 캐시에 distance가 없을 수 있음 → Pydantic이 Optional 처리
        items: List[TrendItem] = [TrendItem.model_validate(obj) for obj in raw[:limit]]
        return TrendsListResponse(country=country, items=items, source="cache")

    # 3) DB fallback (최근 수집일 desc, 같은 수집일 내 rank asc)
    sql = text(
        """
        SELECT id, country, rank, retrieved, title, approx_traffic, link, pub_date, picture, picture_source
        FROM trends
        WHERE country = :country
        ORDER BY retrieved DESC, rank ASC
        LIMIT :limit
        """
    )
    rows = (await db.execute(sql, {"country": country, "limit": limit})).mappings().all()
    items: List[TrendItem] = [TrendItem.model_validate(dict(r)) for r in rows]
    return TrendsListResponse(country=country, items=items, source="db")
