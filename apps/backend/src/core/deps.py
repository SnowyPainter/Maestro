from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.backend.src.core.db import get_db
from apps.backend.src.core.context import get_user_id
from apps.backend.src.modules.users.models import User

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    uid = get_user_id()
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if getattr(request.state, "user", None) is not None:
        return request.state.user
    
    res = await db.execute(select(User).where(User.id == int(uid)))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    request.state.user = user
    return user

def require_active(user: User = Depends(get_current_user)) -> User:
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user

def require_roles(*allowed_roles: str):
    async def _dep(user: User = Depends(get_current_user)) -> User:
        role = getattr(user, "role", None)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _dep
