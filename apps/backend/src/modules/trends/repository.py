# apps/backend/src/modules/trends/repository.py
from datetime import date
from typing import Optional, Sequence
from sqlalchemy import select, desc, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from pgvector.sqlalchemy import Vector
from .models import Trend

# 최신
async def latest_trends(db: AsyncSession, *, country: str, limit: int):
    stmt = (
        select(
            Trend.id, Trend.country, Trend.rank, Trend.retrieved, Trend.title,
            Trend.approx_traffic, Trend.link, Trend.pub_date, Trend.picture, Trend.picture_source
        )
        .where(Trend.country == country)
        .order_by(Trend.retrieved.desc(), Trend.rank.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]

# 벡터 + (선택) 날짜 필터
async def vector_search_trends(
    db: AsyncSession,
    *,
    country: str,
    vec: Sequence[float],
    limit: int,
    since: Optional[date] = None,
    until: Optional[date] = None,
):
    conds = [Trend.country == country, Trend.title_embedding.is_not(None)]
    if since is not None:
        conds.append(cast(Trend.pub_date, Date) >= since)
    if until is not None:
        conds.append(cast(Trend.pub_date, Date) <= until)

    # 거리식: cosine / l2 / inner_product 중 택1 (DB 인덱스 전략에 맞춰 선택)
    distance = Trend.title_embedding.cosine_distance(vec)  # == SQL '<=>'

    stmt = (
        select(
            Trend.id, Trend.country, Trend.rank, Trend.retrieved, Trend.title,
            Trend.approx_traffic, Trend.link, Trend.pub_date, Trend.picture, Trend.picture_source,
            distance.label("distance"),
        )
        .where(and_(*conds))
        .order_by(distance.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]

# 단일 일자
async def date_trends(db: AsyncSession, *, country: str, d: date, limit: int):
    stmt = (
        select(
            Trend.id, Trend.country, Trend.rank, Trend.retrieved, Trend.title,
            Trend.approx_traffic, Trend.link, Trend.pub_date, Trend.picture, Trend.picture_source
        )
        .where(and_(Trend.country == country, cast(Trend.pub_date, Date) == d))
        .order_by(Trend.popularity.desc().nullslast(), Trend.created_at.desc().nullslast())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]

# 범위
async def range_trends(
    db: AsyncSession,
    *,
    country: str,
    since: Optional[date],
    until: Optional[date],
    limit: int,
):
    conds = [Trend.country == country]
    if since is not None:
        conds.append(cast(Trend.pub_date, Date) >= since)
    if until is not None:
        conds.append(cast(Trend.pub_date, Date) <= until)

    stmt = (
        select(
            Trend.id, Trend.country, Trend.rank, Trend.retrieved, Trend.title,
            Trend.approx_traffic, Trend.link, Trend.pub_date, Trend.picture, Trend.picture_source
        )
        .where(and_(*conds))
        .order_by(Trend.pub_date.desc(), Trend.rank.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]
