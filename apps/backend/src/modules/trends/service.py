# apps/backend/src/modules/trends/service.py
import json, os, redis
from typing import Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.services.embeddings import embed_texts
from .repository import vector_search_trends, latest_trends, range_trends, date_trends
from apps.backend.src.core.config import settings

REDIS_URL = os.getenv("REDIS_URL", settings.CELERY_BROKER_URL)
rds = redis.Redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None

async def query_trends(
    db: AsyncSession,
    *,
    country: str,
    limit: int,
    q: Optional[str],
    on_date: Optional[date],
    since: Optional[date],
    until: Optional[date],
):
    country = country.upper()

    # 0) 날짜 정규화: on_date가 있으면 [on_date, on_date]
    if on_date is not None:
        since = on_date
        until = on_date

    # 1) q 있으면: 벡터 검색 (+ 날짜 범위 조건 동시 적용)
    if q:
        vecs = await embed_texts([q])        # <- await 결과에서 꺼내기
        vec = vecs[0]
        rows = await vector_search_trends(
            db,
            country=country,
            vec=vec,
            limit=limit,
            since=since,
            until=until,
        )
        return {"source": "vector", "rows": rows}

    # 2) q 없으면: 캐시/DB
    # 2-1) 날짜 필터 없음: 최신 N개 캐시 키
    if since is None and until is None:
        if rds:
            key = f"trends:latest:{country}"
            cached = rds.get(key)
            if cached:
                rows = json.loads(cached)[:limit]
                return {"source": "cache", "rows": rows}
        rows = await latest_trends(db, country=country, limit=limit)
        return {"source": "db", "rows": rows}

    # 2-2) 단일 일자
    if since is not None and until is not None and since == until:
        # 일자별 캐시 키(선택)
        if rds:
            dkey = f"trends:date:{country}:{since.isoformat()}"
            cached = rds.get(dkey)
            if cached:
                rows = json.loads(cached)[:limit]
                return {"source": "cache", "rows": rows}
        rows = await date_trends(db, country=country, d=since, limit=limit)
        return {"source": "db", "rows": rows}

    # 2-3) 범위 조회
    rows = await range_trends(
        db,
        country=country,
        since=since,
        until=until,
        limit=limit,
    )
    return {"source": "db", "rows": rows}
