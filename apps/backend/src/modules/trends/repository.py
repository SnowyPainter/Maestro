from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Mapping, Optional

async def vector_search_trends(db: AsyncSession, *, country: str, vec: list[float], limit: int):
    sql = text("""
      SELECT id, country, rank, retrieved, title, approx_traffic, link, pub_date, picture, picture_source,
             (title_embedding <-> (:vec)::vector) AS distance
      FROM trends
      WHERE country = :country AND title_embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT :limit
    """)
    rows = (await db.execute(sql, {"vec": vec, "country": country, "limit": limit})).mappings().all()
    return [dict(r) for r in rows]

async def latest_trends(db: AsyncSession, *, country: str, limit: int):
    sql = text("""
      SELECT id, country, rank, retrieved, title, approx_traffic, link, pub_date, picture, picture_source
      FROM trends
      WHERE country = :country
      ORDER BY retrieved DESC, rank ASC
      LIMIT :limit
    """)
    rows = (await db.execute(sql, {"country": country, "limit": limit})).mappings().all()
    return [dict(r) for r in rows]
