from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

from apps.backend.src.services.http_clients import ASYNC_FETCH


@dataclass
class OAuthAccessToken:
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: list[str]
    raw: dict[str, Any]


@dataclass
class OAuthProfile:
    id: str
    username: Optional[str]
    name: Optional[str]
    avatar_url: Optional[str]
    raw: dict[str, Any]


class ThreadsOAuthProvider:
    authorize_url = "https://www.threads.net/oauth/authorize"
    token_url = "https://graph.threads.net/oauth/access_token"
    profile_url = "https://graph.threads.net/me"
    default_scopes = ["threads_basic", "threads_content_publish", "threads_delete", "threads_manage_insights", "threads_manage_replies"]

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        if not client_id or not client_secret:
            raise RuntimeError("Threads OAuth credentials are not configured")
        self._client_id = client_id
        self._client_secret = client_secret
        self._http = http_client or ASYNC_FETCH

    def build_authorize_url(self, *, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": ",".join(self.default_scopes),
            "state": state,
        }
        return f"{self.authorize_url}?{urlencode(params)}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthAccessToken:
        data = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
            "grant_type": "authorization_code",
        }
        try:
            response = await self._http.post(self.token_url, data=data)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(
                f"threads token exchange failed: HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(f"threads token exchange failed: {exc}") from exc
        payload = response.json()

        access_token = payload.get("access_token")
        if not access_token:
            raise ValueError("threads oauth missing access_token")

        refresh_token = payload.get("refresh_token")
        expires_at: Optional[datetime] = None
        expires_in = payload.get("expires_in")
        if isinstance(expires_in, (int, float)):
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

        scopes = parse_scopes(payload.get("scope")) or self.default_scopes
        return OAuthAccessToken(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scopes=scopes,
            raw=payload,
        )

    async def fetch_profile(self, *, access_token: str) -> OAuthProfile:
        params = {
            "fields": "id,username,name,threads_profile_picture_url,is_verified",
            "access_token": access_token,
        }
        try:
            response = await self._http.get(self.profile_url, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(
                f"threads profile fetch failed: HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated to caller
            body = exc.response.text if exc.response is not None else ""
            raise ValueError(
                f"threads profile fetch failed: HTTP {exc.response.status_code} body={body[:500]}"
            ) from exc
        payload = response.json()

        profile_id = payload.get("id")
        if not profile_id:
            raise ValueError("threads profile response missing id")

        username = payload.get("username")
        name = payload.get("name")
        avatar = payload.get("threads_profile_picture_url")

        return OAuthProfile(
            id=str(profile_id),
            username=username,
            name=name,
            avatar_url=avatar,
            raw=payload,
        )


def parse_scopes(raw_scope: Any) -> list[str]:
    if not raw_scope:
        return []
    if isinstance(raw_scope, str):
        items = raw_scope.replace(",", " ").split()
        return [scope.strip() for scope in items if scope.strip()]
    if isinstance(raw_scope, list):
        return [str(scope) for scope in raw_scope if scope]
    return []
