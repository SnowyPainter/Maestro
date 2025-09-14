from pydantic import BaseModel, EmailStr, Field
from typing import Union
# 요청 DTO
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: Union[str, None] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# 응답 DTO
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    display_name: Union[str, None] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse