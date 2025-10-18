from __future__ import annotations

from typing import Any

import httpx

from apps.backend.src.services.http_clients import ASYNC_FETCH
from apps.backend.src.services.oauth.base import (
    BaseOAuthProvider,
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
