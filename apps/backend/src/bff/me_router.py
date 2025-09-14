from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from apps.backend.src.core.context import get_user_id
from apps.backend.src.modules.users.schemas import UserResponse
from apps.backend.src.core.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.backend.src.modules.users.models import User

router = APIRouter(prefix="", tags=["me"])

@router.get("/me", response_model=UserResponse)
async def me(db: AsyncSession = Depends(get_db)):
    uid = get_user_id()
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    res = await db.execute(select(User).where(User.id == int(uid)))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
