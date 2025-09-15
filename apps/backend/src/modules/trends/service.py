import json, os, redis
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.services.embeddings import embed_texts
from .repository import vector_search_trends, latest_trends

REDIS_URL = os.getenv("REDIS_URL")
rds = redis.Redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None

async def query_trends(db: AsyncSession, *, country: str, limit: int, q: Optional[str]):
    country = country.upper()

    # 1) q 있으면: 벡터 검색
    if q:
        vec = await embed_texts([q])[0]  # 필요하면 비동기 래핑(run_in_executor)
        rows = await vector_search_trends(db, country=country, vec=vec, limit=limit)
        return {"source": "vector", "rows": rows}

    # 2) q 없으면: 캐시 → DB
    if rds:
        key = f"trends:latest:{country}"
        cached = rds.get(key)
        if cached:
            return {"source": "cache", "rows": json.loads(cached)[:limit]}

    rows = await latest_trends(db, country=country, limit=limit)
    return {"source": "db", "rows": rows}
