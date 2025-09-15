from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.deps import get_db, get_current_user
from apps.backend.src.modules.insights.service import ingest_insight_sample
from apps.backend.src.modules.insights.schemas import InsightIn, InsightOut
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="/insights", tags=["insights"])


@router.post("", response_model=InsightOut)
async def ingest_insight(
    payload: InsightIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """인사이트 샘플 수집"""
    payload.owner_user_id = user.id
    sample = await ingest_insight_sample(db, payload)
    return sample
