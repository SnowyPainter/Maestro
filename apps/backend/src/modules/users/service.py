from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import User
from apps.backend.src.core.security import hash_password, verify_password, create_access_token
from fastapi import HTTPException, status

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email))
    return res.scalar_one_or_none()

async def create_user(db: AsyncSession, email: str, password: str, display_name: str | None) -> User:
    exists = await get_user_by_email(db, email)
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(email=email, hashed_password=hash_password(password), display_name=display_name,
                is_active=True, role="user")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def authenticate(db: AsyncSession, email: str, password: str) -> tuple[User, str]:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return user, token