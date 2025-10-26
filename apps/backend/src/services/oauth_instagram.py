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


INSTAGRAM_OAUTH_CONFIG = OAuthProviderConfig(
    authorize_url="https://www.instagram.com/oauth/authorize",
    token_url="https://api.instagram.com/oauth/access_token",
    profile_url="https://graph.instagram.com/v23.0/me",
    default_scopes=[
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
        "instagram_business_manage_insights",
    ],
)


class InstagramOAuthProvider(BaseOAuthProvider):
    provider_name = "instagram"

    _LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/v23.0/access_token"
    _LONG_LIVED_REFRESH_URL = "https://graph.instagram.com/v23.0/refresh_access_token"
    _LONG_LIVED_EXCHANGE_GRANT = "ig_exchange_token"
    _LONG_LIVED_REFRESH_GRANT = "ig_refresh_token"

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        super().__init__(
            config=INSTAGRAM_OAUTH_CONFIG,
            client_id=client_id,
            client_secret=client_secret,
            http_client=http_client or ASYNC_FETCH,
        )

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthAccessToken:
        short_lived = await super().exchange_code(code=code, redirect_uri=redirect_uri)
        return await self._exchange_long_lived_token(short_lived)

    async def refresh_access_token(self, *, refresh_token: str) -> OAuthAccessToken:
        token_input = (refresh_token or "").strip()
        if not token_input:
            raise ValueError("instagram refresh requires a long-lived access token")
        payload = await self._request_long_lived_token(
            url=self._LONG_LIVED_REFRESH_URL,
            params={
                "grant_type": self._LONG_LIVED_REFRESH_GRANT,
                "access_token": token_input,
            },
            error_context="long-lived token refresh",
        )
        refreshed = self._parse_access_token_payload(payload)
        token_value = refreshed.access_token
        return OAuthAccessToken(
            access_token=refreshed.access_token,
            refresh_token=token_value,
            expires_at=refreshed.expires_at,
            scopes=refreshed.scopes,
            raw={"long_lived_refresh": payload},
        )

    def _profile_params(self, access_token: str) -> dict[str, Any]:
        return {
            "fields": "id,username,account_type",
            "access_token": access_token,
        }

    def _parse_profile_payload(self, payload: dict[str, Any]) -> OAuthProfile:
        profile_id = payload.get("id")
        if not profile_id:
            raise ValueError("instagram profile response missing id")

        username = payload.get("username")
        account_type = payload.get("account_type")

        return OAuthProfile(
            id=str(profile_id),
            username=username,
            name=account_type,
            avatar_url=None,
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
        token_value = long_lived.access_token
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
            except Exception:  # pragma: no cover - diagnostics only
                if exc.response is not None and exc.response.text:
                    detail = exc.response.text[:500].strip()
            raise ValueError(
                f"{self.provider_name} {error_context} failed: HTTP {exc.response.status_code}"
                + (f" detail={detail}" if detail else "")
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated upstream
            raise ValueError(f"{self.provider_name} {error_context} failed: {exc}") from exc

        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"{self.provider_name} {error_context} failed: invalid token payload")
        return payload


__all__ = ["InstagramOAuthProvider", "INSTAGRAM_OAUTH_CONFIG"]
