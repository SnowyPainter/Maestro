from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx


@dataclass
class OAuthAccessToken:
    access_token: str
    refresh_token: Optional[str]
    expires_at: Optional[datetime]
    scopes: List[str]
    raw: Dict[str, Any]


@dataclass
class OAuthProfile:
    id: str
    username: Optional[str]
    name: Optional[str]
    avatar_url: Optional[str]
    raw: Dict[str, Any]


@dataclass(frozen=True)
class OAuthProviderConfig:
    authorize_url: str
    token_url: str
    profile_url: str
    default_scopes: List[str]


def parse_scopes(raw_scope: Any) -> List[str]:
    if not raw_scope:
        return []
    if isinstance(raw_scope, str):
        items = raw_scope.replace(",", " ").split()
        return [scope.strip() for scope in items if scope.strip()]
    if isinstance(raw_scope, list):
        return [str(scope) for scope in raw_scope if scope]
    return []


class BaseOAuthProvider(abc.ABC):
    provider_name = "oauth"

    def __init__(
        self,
        *,
        config: OAuthProviderConfig,
        client_id: str,
        client_secret: str,
        http_client: httpx.AsyncClient,
    ) -> None:
        if not client_id or not client_secret:
            raise RuntimeError(f"{self.provider_name} OAuth credentials are not configured")
        self.config = config
        self._client_id = client_id
        self._client_secret = client_secret
        self._http = http_client

    def build_authorize_url(
        self,
        *,
        redirect_uri: str,
        state: str,
        scopes: Optional[List[str]] = None,
    ) -> str:
        scope_list = scopes or self.config.default_scopes
        params = {
            "client_id": self._client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": ",".join(scope_list),
            "state": state,
        }
        return f"{self.config.authorize_url}?{urlencode(params)}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthAccessToken:
        data = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
            "grant_type": "authorization_code",
        }
        try:
            response = await self._http.post(self.config.token_url, data=data)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(
                f"{self.provider_name} token exchange failed: HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(f"{self.provider_name} token exchange failed: {exc}") from exc
        payload = response.json()

        access_token = payload.get("access_token")
        if not access_token:
            raise ValueError(f"{self.provider_name} oauth missing access_token")

        refresh_token = payload.get("refresh_token")
        expires_at: Optional[datetime] = None
        expires_in = payload.get("expires_in")
        if isinstance(expires_in, (int, float)):
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

        scopes = parse_scopes(payload.get("scope")) or self.config.default_scopes
        return OAuthAccessToken(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scopes=scopes,
            raw=payload,
        )

    async def fetch_profile(self, *, access_token: str) -> OAuthProfile:
        params = self._profile_params(access_token)
        try:
            response = await self._http.get(self.config.profile_url, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - propagated to caller
            raise ValueError(
                f"{self.provider_name} profile fetch failed: HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - propagated to caller
            body = exc.response.text if exc.response is not None else ""
            raise ValueError(
                f"{self.provider_name} profile fetch failed: HTTP {exc.response.status_code} body={body[:500]}"
            ) from exc
        payload = response.json()
        return self._parse_profile_payload(payload)

    def _profile_params(self, access_token: str) -> Dict[str, Any]:
        return {"access_token": access_token}

    @abc.abstractmethod
    def _parse_profile_payload(self, payload: Dict[str, Any]) -> OAuthProfile:
        raise NotImplementedError


__all__ = [
    "OAuthAccessToken",
    "OAuthProfile",
    "OAuthProviderConfig",
    "parse_scopes",
    "BaseOAuthProvider",
]
