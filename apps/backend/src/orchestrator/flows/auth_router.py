from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.core.db import get_db
from apps.backend.src.modules.users.schemas import SignupRequest, LoginRequest, TokenResponse, UserResponse
from apps.backend.src.modules.users.service import create_user, authenticate

router = APIRouter(
    prefix="/auth",
    tags=["auth", "authentication", "security", "login", "signup"]
)

@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, payload.email, payload.password, payload.display_name)
    return user

@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, token = await authenticate(db, payload.email, payload.password)
    return TokenResponse(access_token=token, user=user)  # pydantic from_attributes 활용