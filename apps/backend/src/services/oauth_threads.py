from __future__ import annotations

from typing import Any

import httpx

from apps.backend.src.services.http_clients import ASYNC_FETCH
from apps.backend.src.services.oauth.base import (
    BaseOAuthProvider,
    OAuthAccessToken,
    OAuthProfile,
    OAuthProviderConfig,
)


THREADS_OAUTH_CONFIG = OAuthProviderConfig(
    authorize_url="https://www.threads.net/oauth/authorize",
    token_url="https://graph.threads.net/oauth/access_token",
    profile_url="https://graph.threads.net/me",
    default_scopes=[
        "threads_basic",
        "threads_read_replies",
        "threads_content_publish",
        "threads_delete",
        "threads_manage_insights",
        "threads_manage_replies",
    ],
)


class ThreadsOAuthProvider(BaseOAuthProvider):
    provider_name = "threads"
    _LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token"
    _LONG_LIVED_REFRESH_URL = "https://graph.threads.net/refresh_access_token"
    _LONG_LIVED_EXCHANGE_GRANT = "th_exchange_token"
    _LONG_LIVED_REFRESH_GRANT = "th_refresh_token"

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        super().__init__(
            config=THREADS_OAUTH_CONFIG,
            client_id=client_id,
            client_secret=client_secret,
            http_client=http_client or ASYNC_FETCH,
        )

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthAccessToken:
        short_lived_token = await super().exchange_code(code=code, redirect_uri=redirect_uri)
        return await self._exchange_long_lived_token(short_lived_token)

    async def refresh_access_token(self, *, refresh_token: str) -> OAuthAccessToken:
        if not (refresh_token or "").strip():
            raise ValueError("threads refresh requires a long-lived access token")
        payload = await self._request_long_lived_token(
            url=self._LONG_LIVED_REFRESH_URL,
            params={
                "grant_type": self._LONG_LIVED_REFRESH_GRANT,
                "access_token": refresh_token,
                "client_secret": self._client_secret,
            },
            error_context="long-lived token refresh",
        )
        refreshed = self._parse_access_token_payload(payload)
        token_value = (
            refreshed.refresh_token or refreshed.access_token
        )  # Threads reuses the long-lived token as its own refresh handle
        return OAuthAccessToken(
            access_token=refreshed.access_token,
            refresh_token=token_value,
            expires_at=refreshed.expires_at,
            scopes=refreshed.scopes,
            raw={"long_lived_refresh": payload},
        )

    def _profile_params(self, access_token: str) -> dict[str, Any]:
        return {
            "fields": "id,username,name,threads_profile_picture_url,is_verified",
            "access_token": access_token,
        }

    def _parse_profile_payload(self, payload: dict[str, Any]) -> OAuthProfile:
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

    async def _exchange_long_lived_token(self, short_lived: OAuthAccessToken) -> OAuthAccessToken:
        payload = await self._request_long_lived_token(
            url=self._LONG_LIVED_TOKEN_URL,
            params={
                "grant_type": self._LONG_LIVED_EXCHANGE_GRANT,
                "client_secret": self._client_secret,
                "access_token": short_lived.access_token,
            },
            error_context="long-lived token exchange",
        )
        long_lived = self._parse_access_token_payload(payload)
        token_value = (
            long_lived.refresh_token or long_lived.access_token
        )  # Threads long-lived token doubles as refresh token input
        scopes = short_lived.scopes or long_lived.scopes
        return OAuthAccessToken(
            access_token=long_lived.access_token,
            refresh_token=token_value,
            expires_at=long_lived.expires_at,
            scopes=scopes,
            raw={"short_lived": short_lived.raw, "long_lived": payload},
        )

    async def _request_long_lived_token(
        self,
        *,
        url: str,
        params: dict[str, Any],
        error_context: str,
    ) -> dict[str, Any]:
        try:
            response = await self._http.get(url, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = ""
            try:
                body_json = exc.response.json()
                if isinstance(body_json, dict):
                    message = body_json.get("error", {}).get("message") or body_json.get("message")
                    if message:
                        detail = message.strip()
                if not detail and exc.response.text:
                    detail = exc.response.text[:500].strip()
            except Exception:  # pragma: no cover - best-effort diagnostics
                if exc.response is not None and exc.response.text:
                    detail = exc.response.text[:500].strip()
            raise ValueError(
                f"{self.provider_name} {error_context} failed: HTTP {exc.response.status_code}"
                + (f" detail={detail}" if detail else "")
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(f"{self.provider_name} {error_context} failed: {exc}") from exc
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"{self.provider_name} {error_context} failed: invalid token payload")
        return payload
