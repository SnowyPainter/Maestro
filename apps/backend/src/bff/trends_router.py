from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from apps.backend.src.core.db import get_db
from apps.backend.src.modules.trends.schemas import TrendsListResponse, TrendItem
from apps.backend.src.modules.trends.service import query_trends

router = APIRouter(prefix="/trends", tags=["trends"])

@router.get("", response_model=TrendsListResponse)
async def list_trends(
    country: str = Query("KR"),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await query_trends(db, country=country, limit=limit, q=q)
    items = [TrendItem.model_validate(obj) for obj in result["rows"]]
    return TrendsListResponse(country=country.upper(), query=q, items=items, source=result["source"])