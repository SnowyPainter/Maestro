# apps/backend/src/bff/trends_router.py
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date
from apps.backend.src.core.db import get_db
from apps.backend.src.modules.trends.schemas import TrendsListResponse, TrendItem
from apps.backend.src.modules.trends.service import query_trends

router = APIRouter(prefix="/trends", tags=["trends"])

@router.get("", response_model=TrendsListResponse)
async def list_trends(
    country: str = Query("US"),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="검색 질의(벡터검색)"),
    on_date: Optional[date] = Query(None, description="YYYY-MM-DD (단일 일자)"),
    since: Optional[date] = Query(None, description="YYYY-MM-DD (이후/포함)"),
    until: Optional[date] = Query(None, description="YYYY-MM-DD (이전/포함)"),
    db: AsyncSession = Depends(get_db),
):
    # 유효성
    if on_date is None and (since and until and since > until):
        raise HTTPException(status_code=422, detail="since must be <= until")

    result = await query_trends(
        db,
        country=country,
        limit=limit,
        q=q,
        on_date=on_date,
        since=since,
        until=until,
    )
    items = [TrendItem.model_validate(obj) for obj in result["rows"]]
    return TrendsListResponse(
        country=country.upper(),
        query=q,
        items=items,
        source=result["source"],
    )
