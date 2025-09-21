# apps/backend/src/modules/adapters/impls/Threads.py
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from apps.backend.src.modules.adapters.engine import (
    CompileState,
    compile_with_spec,
    get_compile_spec,
)
from apps.backend.src.modules.adapters.schemas import (
    Adapter,
    CompileResult,
    DeleteResult,
    MetricsResult,
    PublishResult,
)
from apps.backend.src.modules.common.enums import (
    ContentKind,
    MetricsScope,
    PlatformKind,
)
from apps.backend.src.modules.injectors.base import InjectedContent
from apps.backend.src.services.http_clients import ASYNC_FETCH

def _utcnow():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


class ThreadsAdapter(Adapter):
    platform = PlatformKind.THREADS
    compiler_version = 1

    def __init__(
        self,
        *,
        http_client: httpx.AsyncClient | None = None,
        base_url: str = "https://graph.threads.net/v1.0",
    ) -> None:
        self._http = http_client or ASYNC_FETCH
        self._base_url = base_url.rstrip("/")

    async def compile(self, payload: InjectedContent, *, locale: Optional[str] = None) -> CompileResult:
        return await compile_with_spec(payload, SPEC)

    async def publish(
        self,
        rendered_blocks: dict | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        warnings: list[str] = []
        access_token, user_id = self._resolve_credentials(credentials)
        missing_fields: list[str] = []
        if not access_token:
            missing_fields.append("access_token")
        if not user_id:
            missing_fields.append("threads user id")
        if missing_fields:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[
                    "missing credentials: " + ", ".join(missing_fields),
                ],
                warnings=[],
            )

        blocks_media = (rendered_blocks or {}).get("media") or []
        if blocks_media:
            warnings.append(
                f"threads adapter currently posts caption only; dropped {len(blocks_media)} media item(s)"
            )

        text = (caption or "").strip()
        if not text:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=["threads publish requires non-empty caption text"],
                warnings=warnings,
            )

        payload: Dict[str, Any] = {"text": text}
        payload.update(self._extract_publish_options(options))

        client = ThreadsGraphClient(
            access_token=access_token,
            http=self._http,
            base_url=self._base_url,
        )

        try:
            creation = await client.post_json(f"{user_id}/threads", data=payload)
        except ThreadsAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        creation_id = _resolve_creation_id(creation)
        if not creation_id:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=["threads API response missing creation id"],
                warnings=warnings,
            )

        try:
            published = await client.post_json(
                f"{user_id}/threads_publish",
                data={"creation_id": creation_id},
            )
        except ThreadsAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        published_id = _resolve_creation_id(published)
        if not published_id:
            published_id = creation_id
            warnings.append("threads publish response missing post id; using creation id")

        external_id: Optional[str] = published_id
        try:
            details = await client.get_json(
                str(published_id),
                params={"fields": "id,permalink"},
            )
        except ThreadsAPIError as exc:
            warnings.append(f"failed to fetch thread permalink: {exc.as_message()}")
        else:
            permalink = (details or {}).get("permalink")
            if permalink:
                external_id = permalink

        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=warnings)

    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        access_token, _ = self._resolve_credentials(credentials)
        if not access_token:
            return DeleteResult(ok=False, errors=["missing credentials: access_token"])

        client = ThreadsGraphClient(
            access_token=access_token,
            http=self._http,
            base_url=self._base_url,
        )

        try:
            await client.delete(str(external_id))
        except ThreadsAPIError as exc:
            return DeleteResult(ok=False, errors=[exc.as_message()])
        return DeleteResult(ok=True, errors=[])

    async def sync_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        access_token, _ = self._resolve_credentials(credentials)
        if not access_token:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=1,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=["missing credentials: access_token"],
            )

        client = ThreadsGraphClient(
            access_token=access_token,
            http=self._http,
            base_url=self._base_url,
        )

        try:
            insights = await client.get_json(
                f"{external_id}/insights",
                params={"metric": "likes,replies,reposts,quotes"},
            )
        except ThreadsAPIError as exc:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=1,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=[exc.as_message()],
            )

        metrics = _parse_metrics(insights)
        return MetricsResult(
            ok=True,
            metrics=metrics,
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=1,
            collected_at=_utcnow(),
            raw=insights or {},
            warnings=[],
            errors=[],
        )

    @staticmethod
    def _resolve_credentials(credentials: dict | None) -> tuple[Optional[str], Optional[str]]:
        if not isinstance(credentials, dict):
            return None, None
        access_token = credentials.get("access_token") or credentials.get("token")
        user_id = (
            credentials.get("threads_user_id")
            or credentials.get("user_id")
            or credentials.get("profile_id")
            or credentials.get("external_id")
        )
        if isinstance(access_token, str):
            access_token = access_token.strip() or None
        else:
            access_token = None
        if isinstance(user_id, str):
            user_id = user_id.strip() or None
        else:
            user_id = None
        return access_token, user_id

    @staticmethod
    def _extract_publish_options(options: dict | None) -> Dict[str, Any]:
        if not isinstance(options, dict):
            return {}
        # allow both top-level options and nested threads-specific options
        raw = dict(options)
        if isinstance(options.get("threads"), dict):
            raw.update(options.get("threads"))

        allowed_keys = {
            "reply_to_id": "reply_to_id",
            "quote_post_id": "quote_post_id",
            "scheduled_publish_time": "scheduled_publish_time",
            "url_sharing_enabled": "url_sharing_enabled",
        }

        extracted: Dict[str, Any] = {}
        for source_key, target_key in allowed_keys.items():
            value = raw.get(source_key)
            if value is None:
                continue
            if isinstance(value, bool):
                extracted[target_key] = str(value).lower()
            else:
                extracted[target_key] = str(value)
        return extracted


def _threads_metric_hook(state: CompileState) -> None:
    caption = state.caption or ""
    if caption:
        state.metrics["thread_length"] = caption.count("\n\n") + 1
    else:
        state.metrics["thread_length"] = 0


SPEC = get_compile_spec(
    PlatformKind.THREADS,
    ThreadsAdapter.compiler_version,
    hooks=(
        _threads_metric_hook,
    ),
)


class ThreadsAPIError(Exception):
    """Raised when the Threads Graph API returns an error."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}

    def as_message(self) -> str:
        return str(self)


class ThreadsGraphClient:
    """Thin wrapper over httpx.AsyncClient for Threads Graph API calls."""

    def __init__(
        self,
        *,
        access_token: str,
        http: httpx.AsyncClient,
        base_url: str,
    ) -> None:
        self._access_token = access_token
        self._http = http
        self._base_url = base_url.rstrip("/")

    async def post_json(self, path: str, *, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
        response = await self._request("POST", path, data=data)
        return _ensure_json(response)

    async def get_json(
        self,
        path: str,
        *,
        params: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        response = await self._request("GET", path, params=params)
        return _ensure_json(response)

    async def delete(self, path: str) -> None:
        await self._request("DELETE", path)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Dict[str, Any] | None = None,
        data: Dict[str, Any] | None = None,
    ) -> httpx.Response:
        url = f"{self._base_url}/{path.lstrip('/')}"
        query: Dict[str, Any] = {"access_token": self._access_token}
        if params:
            query.update({k: v for k, v in params.items() if v is not None})

        try:
            response = await self._http.request(method, url, params=query, data=data)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            payload = _safe_json(exc.response)
            message = _format_graph_error(exc.response, fallback=str(exc))
            raise ThreadsAPIError(message, status_code=exc.response.status_code, payload=payload) from exc
        except httpx.HTTPError as exc:
            raise ThreadsAPIError(f"threads api request failed: {exc}") from exc
        return response


def _resolve_creation_id(payload: Dict[str, Any] | None) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    for key in ("id", "post_id", "creation_id"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _ensure_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        data = response.json()
    except ValueError as exc:
        raise ThreadsAPIError(
            "threads api returned invalid json",
            status_code=response.status_code,
        ) from exc
    if isinstance(data, dict):
        return data
    raise ThreadsAPIError("threads api response must be a json object", status_code=response.status_code)


def _safe_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        data = response.json()
        if isinstance(data, dict):
            return data
    except ValueError:
        pass
    return {"text": response.text[:500]}


def _format_graph_error(response: httpx.Response, *, fallback: str) -> str:
    payload = _safe_json(response)
    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message") or "threads api request failed"
        details = []
        if error.get("type"):
            details.append(f"type={error['type']}")
        if error.get("code") is not None:
            details.append(f"code={error['code']}")
        if error.get("error_subcode") is not None:
            details.append(f"subcode={error['error_subcode']}")
        if error.get("fbtrace_id"):
            details.append(f"trace={error['fbtrace_id']}")
        if details:
            return f"{message} ({', '.join(details)})"
        return message
    snippet = payload.get("text") or ""
    snippet = snippet.replace("\n", " ").strip()
    if snippet:
        snippet = snippet[:160]
        return f"threads api request failed with status {response.status_code}: {snippet}"
    return fallback


def _parse_metrics(payload: Dict[str, Any] | None) -> Dict[str, float]:
    if not isinstance(payload, dict):
        return {}
    data = payload.get("data")
    if not isinstance(data, list):
        return {}
    metrics: Dict[str, float] = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        values = item.get("values")
        if not isinstance(name, str) or not isinstance(values, list) or not values:
            continue
        first = values[0]
        if isinstance(first, dict):
            value = first.get("value")
            if isinstance(value, (int, float)):
                metrics[name] = float(value)
    return metrics
