from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import get_db
from apps.backend.src.core.context import get_persona_account_id
from apps.backend.src.core.deps import get_current_user
from apps.backend.src.modules.accounts.models import PlatformAccount, PersonaAccount
from apps.backend.src.modules.accounts.schemas import PlatformAccountUpdate
from apps.backend.src.modules.accounts.service import (
    update_platform_account,
    get_persona_account,
    get_platform_account,
    get_persona,
)
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.users.models import User
from apps.backend.src.modules.users.schemas import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from apps.backend.src.modules.users.service import authenticate, create_user, get_user_by_id
from apps.backend.src.services.oauth.base import OAuthAccessToken, OAuthProfile
from apps.backend.src.services.oauth_threads import ThreadsOAuthProvider
from pydantic import BaseModel


router = APIRouter(
    prefix="/auth",
    tags=["auth", "authentication", "security", "login", "signup"],
)


# ---------------------------------------------------------------------------
# User login & signup (legacy)
# ---------------------------------------------------------------------------


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, payload.email, payload.password, payload.display_name)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, token = await authenticate(db, payload.email, payload.password)
    return TokenResponse(access_token=token, user=user)  # pydantic from_attributes 활용


# ---------------------------------------------------------------------------
# Threads OAuth flow (extendable to additional platforms)
# ---------------------------------------------------------------------------


STATE_TTL_SECONDS = 600
STATE_KEY = settings.JWT_SECRET.encode("utf-8")


def _get_oauth_provider(platform: PlatformKind) -> ThreadsOAuthProvider:
    if platform is not PlatformKind.THREADS:
        raise HTTPException(status_code=404, detail=f"Unsupported OAuth platform: {platform.value}")
    try:
        return ThreadsOAuthProvider(
            client_id=settings.THREADS_CLIENT_ID,
            client_secret=settings.THREADS_CLIENT_SECRET,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class OAuthStartResponse(BaseModel):
    authorize_url: str
    state: str
    callback_url: str


def _serialize_state(data: Dict[str, Any]) -> str:
    payload_bytes = json.dumps(data, separators=(",", ":"), sort_keys=True).encode()
    signature = hmac.new(STATE_KEY, payload_bytes, hashlib.sha256).digest()
    return _urlsafe_b64(payload_bytes) + "." + _urlsafe_b64(signature)


def _deserialize_state(state: str) -> Dict[str, Any]:
    try:
        payload_enc, signature_enc = state.split(".", 1)
    except ValueError as exc:  # noqa: B904
        raise HTTPException(status_code=400, detail="invalid oauth state") from exc

    payload_bytes = _urlsafe_b64decode(payload_enc)
    signature = _urlsafe_b64decode(signature_enc)
    expected = hmac.new(STATE_KEY, payload_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=400, detail="invalid oauth state signature")

    data = json.loads(payload_bytes)
    issued = data.get("ts")
    if not isinstance(issued, (int, float)):
        raise HTTPException(status_code=400, detail="invalid oauth state timestamp")
    if issued + STATE_TTL_SECONDS < time.time():
        raise HTTPException(status_code=400, detail="oauth state expired")
    return data


def _urlsafe_b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _append_query_params(url: str, params: Dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update({k: v for k, v in params.items() if v is not None})
    new_query = urlencode(query)
    return urlunparse(parsed._replace(query=new_query))


def _default_return_url() -> str:
    return settings.PRD_DOMAIN+"/chat" or "https://localhost:5173/chat"

def _get_redirect_uri(platform: PlatformKind) -> str:
    return settings.TEST_DOMAIN + f"/api/orchestrator/auth/oauth/{platform.value}/callback"


def _resolve_persona_account_id() -> int:
    raw = get_persona_account_id()
    if raw is None:
        raise HTTPException(status_code=400, detail="persona account context required")
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid persona account context") from exc
    if value <= 0:
        raise HTTPException(status_code=400, detail="invalid persona account context")
    return value


async def _resolve_persona_link(
    db: AsyncSession,
    *,
    persona_account_id: int,
    user_id: int,
    expected_platform: PlatformKind,
) -> tuple[PersonaAccount, PlatformAccount]:
    persona_account = await get_persona_account(db, persona_account_id=persona_account_id)
    if not persona_account:
        raise HTTPException(status_code=404, detail="persona account not found")

    persona = await get_persona(db, persona_id=persona_account.persona_id)
    if not persona or persona.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="persona account not owned by current user")

    account = await get_platform_account(db, account_id=persona_account.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="platform account not found")
    if account.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="platform account not owned by current user")
    if account.platform != expected_platform:
        raise HTTPException(status_code=400, detail="persona account linked to different platform")

    return persona_account, account

@router.get("/oauth/{platform}/start", response_model=OAuthStartResponse)
async def oauth_start(
    platform: PlatformKind,
    request: Request,
    return_url: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OAuthStartResponse:
    """Initiate OAuth by returning the provider authorize URL."""

    provider = _get_oauth_provider(platform)

    persona_account_id = _resolve_persona_account_id()
    _, account = await _resolve_persona_link(
        db,
        persona_account_id=persona_account_id,
        user_id=user.id,
        expected_platform=platform,
    )

    callback_url = _get_redirect_uri(platform)

    state_payload = {
        "ts": int(time.time()),
        "nonce": secrets.token_urlsafe(8),
        "platform": platform.value,
        "user_id": user.id,
        "persona_account_id": persona_account_id,
        "account_id": account.id,
        "return_url": return_url or _default_return_url(),
    }
    state = _serialize_state(state_payload)
    authorize_url = provider.build_authorize_url(redirect_uri=callback_url, state=state)

    return OAuthStartResponse(
        authorize_url=authorize_url,
        state=state,
        callback_url=callback_url,
    )


@router.get("/oauth/{platform}/callback", name="auth_oauth_callback")
async def oauth_callback(
    platform: PlatformKind,
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback for Threads (and future platforms)."""

    provider = _get_oauth_provider(platform)

    if error:
        target = _append_query_params(
            _default_return_url(),
            {
                "status": "error",
                "platform": platform.value,
                "error": error,
                "error_description": error_description or "",
            },
        )
        return RedirectResponse(target)

    if not code or not state:
        raise HTTPException(status_code=400, detail="missing oauth code/state")

    state_data = _deserialize_state(state)
    if state_data.get("platform") != platform.value:
        raise HTTPException(status_code=400, detail="oauth platform mismatch")

    user_id = state_data.get("user_id")
    persona_account_id = state_data.get("persona_account_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="oauth user context missing")
    if persona_account_id is None:
        raise HTTPException(status_code=400, detail="oauth persona account context missing")

    try:
        persona_account_id_int = int(persona_account_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid persona account context") from exc

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    _persona_account, account = await _resolve_persona_link(
        db,
        persona_account_id=persona_account_id_int,
        user_id=user.id,
        expected_platform=platform,
    )

    account_id_from_state = state_data.get("account_id")
    if account_id_from_state is not None:
        try:
            account_id_expected = int(account_id_from_state)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=403, detail="persona account mismatch") from exc
        if account.id != account_id_expected:
            raise HTTPException(status_code=403, detail="persona account mismatch")

    callback_url = _get_redirect_uri(platform)
    try:
        token = await provider.exchange_code(code=code, redirect_uri=callback_url)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        profile = await provider.fetch_profile(access_token=token.access_token)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    account = await _update_platform_account(
        db,
        account=account,
        profile=profile,
        token=token,
    )

    return_url = state_data.get("return_url") or _default_return_url()
    target = _append_query_params(
        return_url,
        {
            "status": "connected",
            "platform": platform.value,
            "account_id": str(account.id),
            "external_id": account.external_id or "",
        },
    )
    return RedirectResponse(target)

async def _update_platform_account(
    db: AsyncSession,
    *,
    account: PlatformAccount,
    profile: OAuthProfile,
    token: OAuthAccessToken,
) -> PlatformAccount:
    update_payload = PlatformAccountUpdate(
        handle=profile.username or profile.name or profile.id,
        avatar_url=profile.avatar_url,
        access_token=token.access_token,
        refresh_token=token.refresh_token,
        token_expires_at=token.expires_at,
        scopes=token.scopes,
        is_active=True,
    )
    return await update_platform_account(db, account=account, data=update_payload)


@router.post("/oauth/{platform}/delete-app", name="auth_oauth_delete_app")
async def oauth_delete_app(
    platform: PlatformKind,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete OAuth app for a platform."""
    provider = _get_oauth_provider(platform)
    
    return RedirectResponse(_default_return_url())

@router.post("/oauth/{platform}/remove-data", name="auth_oauth_remove_data")
async def oauth_remove_data(
    platform: PlatformKind,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove data for a platform."""
    provider = _get_oauth_provider(platform)
    
    return RedirectResponse(_default_return_url())
