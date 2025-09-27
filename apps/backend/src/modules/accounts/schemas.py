# apps/backend/src/modules/accounts/schemas.py
from __future__ import annotations
from typing import Any, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from apps.backend.src.modules.common.enums import PlatformKind, Permission

# ---------- PlatformAccount ----------
class PlatformAccountBase(BaseModel):
    owner_user_id: Optional[int] = None
    platform: PlatformKind
    handle: str = Field(max_length=128)
    external_id: Optional[str] = Field(None, max_length=256)
    avatar_url: Optional[str] = Field(None, max_length=512)
    bio: Optional[str] = Field(None, max_length=160)
    scopes: Optional[list[str]] = None
    is_active: Optional[bool] = True

class PlatformAccountCreate(PlatformAccountBase):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None

class PlatformAccountUpdate(BaseModel):
    handle: Optional[str] = None
    external_id: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    scopes: Optional[list[str]] = None
    is_active: Optional[bool] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None

class PlatformAccountOut(PlatformAccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_user_id: int
    last_checked_at: Optional[datetime] = None
    last_error: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool

# ---------- Persona ----------
class PersonaBase(BaseModel):
    name: str = Field(max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=512)
    bio: Optional[str] = Field(None, max_length=200)
    language: str = Field(default="en", max_length=10)
    tone: Optional[str] = Field(None, max_length=40)
    style_guide: Optional[str] = None
    pillars: Optional[list[str]] = None
    banned_words: Optional[list[str]] = None
    default_hashtags: Optional[list[str]] = None
    hashtag_rules: Optional[dict[str, Any]] = None
    link_policy: Optional[dict[str, Any]] = None
    media_prefs: Optional[dict[str, Any]] = None
    posting_windows: Optional[list[dict[str, Any]]] = None
    extras: Optional[dict[str, Any]] = None
    schema_version: int = 1
    is_active: Optional[bool] = True

    @field_validator("hashtag_rules")
    @classmethod
    def _validate_hashtag_rules(cls, v):
        if v is None:
            return v
        if "max_count" in v and (not isinstance(v["max_count"], int) or v["max_count"] <= 0):
            raise ValueError("hashtag_rules.max_count must be a positive integer")
        if "casing" in v and v["casing"] not in {"lower", "upper", "original"}:
            raise ValueError("hashtag_rules.casing must be one of: lower|upper|original")
        return v

class PersonaCreate(PersonaBase):
    owner_user_id: int

class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    language: Optional[str] = None
    tone: Optional[str] = None
    style_guide: Optional[str] = None
    pillars: Optional[list[str]] = None
    banned_words: Optional[list[str]] = None
    default_hashtags: Optional[list[str]] = None
    hashtag_rules: Optional[dict[str, Any]] = None
    link_policy: Optional[dict[str, Any]] = None
    media_prefs: Optional[dict[str, Any]] = None
    posting_windows: Optional[list[dict[str, Any]]] = None
    extras: Optional[dict[str, Any]] = None
    schema_version: Optional[int] = None

class PersonaOut(PersonaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
# ---------- PersonaAccount (link) ----------
class PersonaAccountLinkCreate(BaseModel):
    persona_id: int
    account_id: int
    can_permissions: Optional[list[Permission]] = Field(
        default=[Permission.READ, Permission.PUBLISH, Permission.WRITE]
    )
    is_verified_link: bool = False
    default_templates: Optional[dict[str, Any]] = None

class PersonaAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    persona_id: int
    account_id: int
    can_permissions: list[Permission]
    is_verified_link: bool
    default_templates: Optional[dict[str, Any]] = None
    created_at: datetime

class RichPersonaAccountOut(BaseModel):
    """Rich persona account with embedded persona and account details for UI display"""
    model_config = ConfigDict(from_attributes=True)
    id: int
    persona_id: int
    persona_name: str
    persona_avatar_url: Optional[str] = None
    persona_description: Optional[str] = None
    account_id: int
    account_handle: str
    account_platform: PlatformKind
    account_avatar_url: Optional[str] = None
    account_bio: Optional[str] = None
    is_active: bool = True
    can_permissions: list[Permission]
    is_verified_link: bool
    created_at: datetime
    last_updated_at: Optional[datetime] = None
