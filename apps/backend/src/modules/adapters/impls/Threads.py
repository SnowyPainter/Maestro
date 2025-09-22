# apps/backend/src/modules/adapters/impls/Threads.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, MutableMapping, Optional
from urllib.parse import urlparse

import httpx

from apps.backend.src.modules.adapters.core.capabilities import (
    CommentCreateCapability,
    CommentDeleteCapability,
    DeletionCapability,
    MetricsCapability,
    PublishingCapability,
)
from apps.backend.src.modules.adapters.core.compiler import SpecCompiler
from apps.backend.src.modules.adapters.engine import CompileState
from apps.backend.src.modules.adapters.http.graph import (
    GraphAPIError,
    GraphAPIJSONClient,
    GraphAPITransport,
)
from apps.backend.src.modules.adapters.core.adapter import CapabilityAdapter
from apps.backend.src.modules.adapters.core.types import (
    CommentCreateResult,
    DeleteResult,
    MetricsResult,
    PublishResult,
    RenderedVariantBlocks,
    ThreadsCredentials,
)
from apps.backend.src.modules.common.enums import (
    KPIKey,
    ContentKind,
    MetricsScope,
    PlatformKind,
)
from apps.backend.src.services.http_clients import ASYNC_FETCH


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ThreadsAdapter(CapabilityAdapter[SpecCompiler]):
    platform = PlatformKind.THREADS

    def __init__(
        self,
        *,
        http_client: httpx.AsyncClient | None = None,
        base_url: str = "https://graph.threads.net/v1.0",
    ) -> None:
        http = http_client or ASYNC_FETCH
        context = ThreadsContext(http=http, base_url=base_url)
        credentials = ThreadsCredentialResolver()
        compiler = SpecCompiler(
            platform=self.platform,
            version=1,
            hooks=(
                _threads_metric_hook,
            ),
        )
        publisher = ThreadsPublishingCapability(context=context, credentials=credentials)
        deleter = ThreadsDeletionCapability(context=context, credentials=credentials)
        metrics = ThreadsMetricsCapability(context=context, credentials=credentials)
        comment_creator = ThreadsCommentCreateCapability(context=context, credentials=credentials)
        comment_deleter = ThreadsCommentDeleteCapability(context=context, credentials=credentials)
        super().__init__(
            platform=self.platform,
            compiler=compiler,
            publisher=publisher,
            deleter=deleter,
            metrics=metrics,
            comment_creator=comment_creator,
            comment_deleter=comment_deleter,
        )


# Compile ----------------------------------------------------------------------------------------
def _threads_metric_hook(state: CompileState) -> None:
    caption = state.caption or ""
    if caption:
        state.metrics["thread_length"] = caption.count("\n\n") + 1
    else:
        state.metrics["thread_length"] = 0


# Context & credentials -------------------------------------------------------------------------
@dataclass
class ThreadsContext:
    http: httpx.AsyncClient
    base_url: str

    def graph_client(self, *, access_token: str) -> "ThreadsAPI":
        return ThreadsAPI(
            transport=GraphAPITransport(
                http=self.http,
                base_url=self.base_url,
                default_params={"access_token": access_token},
            )
        )


class ThreadsCredentialResolver:
    def resolve(
        self,
        credentials: ThreadsCredentials | Dict[str, Any] | None,
        *,
        require_user_id: bool = True,
    ) -> tuple[Optional[ThreadsCredentials], List[str]]:
        if isinstance(credentials, ThreadsCredentials):
            missing: List[str] = []
            if not credentials.access_token:
                missing.append("access_token")
            if require_user_id and not credentials.user_id:
                missing.append("threads user id")
            if missing:
                return None, missing
            return credentials, []

        resolved, missing = ThreadsCredentials.from_mapping(
            credentials,
            require_user_id=require_user_id,
        )
        return resolved, missing


class ThreadsCapabilityBase:
    def __init__(
        self,
        *,
        context: ThreadsContext,
        credentials: ThreadsCredentialResolver,
    ) -> None:
        self._context = context
        self._credentials = credentials

    def _client(self, *, access_token: str) -> "ThreadsAPI":
        return self._context.graph_client(access_token=access_token)

    def _resolve_credentials(
        self,
        credentials: ThreadsCredentials | Dict[str, Any] | None,
        *,
        require_user_id: bool = True,
    ) -> tuple[Optional[ThreadsCredentials], List[str]]:
        return self._credentials.resolve(credentials, require_user_id=require_user_id)


# Publish ---------------------------------------------------------------------------------------
class ThreadsPublishingCapability(ThreadsCapabilityBase, PublishingCapability):
    async def publish(
        self,
        rendered_blocks: RenderedVariantBlocks | None,
        caption: str | None,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> PublishResult:
        warnings: List[str] = []
        resolved_credentials, missing_fields = self._resolve_credentials(credentials)
        if missing_fields or not resolved_credentials:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[
                    "missing credentials: "
                    + ", ".join(missing_fields or ["access_token", "threads user id"]),
                ],
                warnings=[],
            )

        blocks_media = (rendered_blocks or {}).get("media") or []
        media_payload, media_warnings = prepare_media_payload(blocks_media)
        warnings.extend(media_warnings)

        text = (caption or "").strip()
        if not text and not media_payload:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=["threads publish requires caption text or at least one supported image"],
                warnings=warnings,
            )

        payload: Dict[str, Any] = {}
        if text:
            payload["text"] = text
        if media_payload:
            payload.update(media_payload)
        payload.update(extract_publish_options(options))

        client = self._client(access_token=resolved_credentials.access_token)

        try:
            creation = await client.create_thread(resolved_credentials.user_id or "", payload)
        except ThreadsAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        creation_id = resolve_creation_id(creation)
        if not creation_id:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=["threads API response missing creation id"],
                warnings=warnings,
            )

        try:
            published = await client.publish_thread(resolved_credentials.user_id or "", creation_id)
        except ThreadsAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        published_id = resolve_creation_id(published) or creation_id
        if published_id == creation_id:
            warnings.append("threads publish response missing post id; using creation id")

        external_id: Optional[str] = published_id
        try:
            details = await client.fetch_thread(published_id)
        except ThreadsAPIError as exc:
            warnings.append(f"failed to fetch thread permalink: {exc.as_message()}")
        else:
            permalink = (details or {}).get("permalink")
            if permalink:
                external_id = permalink

        return PublishResult(ok=True, external_id=external_id, errors=[], warnings=warnings)


# Delete ----------------------------------------------------------------------------------------
class ThreadsDeletionCapability(ThreadsCapabilityBase, DeletionCapability):
    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        resolved_credentials, missing_fields = self._resolve_credentials(
            credentials,
            require_user_id=False,
        )
        if missing_fields or not resolved_credentials:
            return DeleteResult(
                ok=False,
                errors=["missing credentials: access_token"],
            )

        target_id = normalize_thread_id(external_id)
        if not target_id:
            return DeleteResult(
                ok=False,
                errors=["threads delete requires valid external id"],
            )

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            await client.delete_content(target_id)
        except ThreadsAPIError as exc:
            return DeleteResult(ok=False, errors=[exc.as_message()])
        return DeleteResult(ok=True, errors=[])


# Metrics ---------------------------------------------------------------------------------------
class ThreadsMetricsCapability(ThreadsCapabilityBase, MetricsCapability):
    async def fetch_metrics(self, external_id: str, *, credentials: dict) -> MetricsResult:
        resolved_credentials, missing_fields = self._resolve_credentials(
            credentials,
            require_user_id=False,
        )
        if missing_fields or not resolved_credentials:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=2,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=["missing credentials: access_token"],
            )

        target_id = normalize_thread_id(external_id)
        if not target_id:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=2,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=["threads metrics requires valid external id"],
            )

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            insights = await client.fetch_metrics(target_id)
        except ThreadsAPIError as exc:
            return MetricsResult(
                ok=False,
                metrics={},
                scope=MetricsScope.SINCE_PUBLISH,
                content_kind=ContentKind.POST,
                mapping_version=2,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=[exc.as_message()],
            )

        metrics = parse_metrics(insights)
        return MetricsResult(
            ok=True,
            metrics=metrics,
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=ContentKind.POST,
            mapping_version=2,
            collected_at=_utcnow(),
            raw=insights or {},
            warnings=[],
            errors=[],
        )


# Comment ---------------------------------------------------------------------------------------
class ThreadsCommentCreateCapability(ThreadsCapabilityBase, CommentCreateCapability):
    async def create_comment(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> CommentCreateResult:
        warnings: List[str] = []
        resolved_credentials, missing_fields = self._resolve_credentials(credentials)
        if missing_fields or not resolved_credentials:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=[
                    "missing credentials: "
                    + ", ".join(missing_fields or ["access_token", "threads user id"]),
                ],
                warnings=[],
            )

        user_id = resolved_credentials.user_id
        if not user_id:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=["threads comment requires threads user id"],
                warnings=[],
            )

        parent_id = normalize_thread_id(parent_external_id)
        if not parent_id:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=["threads comment requires valid parent id"],
                warnings=[],
            )

        body = (text or "").strip()
        if not body:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=["threads comment requires text"],
                warnings=[],
            )

        payload: Dict[str, Any] = {"text": body, "reply_to_id": parent_id}
        if isinstance(options, dict):
            extra = extract_comment_options(options)
            if extra:
                payload.update(extra)

        client = self._client(access_token=resolved_credentials.access_token)

        try:
            creation = await client.create_thread(user_id, payload)
        except ThreadsAPIError as exc:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=[],
            )

        creation_id = resolve_creation_id(creation)
        if not creation_id:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=["threads API response missing comment creation id"],
                warnings=[],
            )

        try:
            published = await client.publish_thread(user_id, creation_id)
        except ThreadsAPIError as exc:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                errors=[exc.as_message()],
                warnings=[],
            )

        comment_id = resolve_creation_id(published) or creation_id
        external_id: Optional[str] = comment_id
        try:
            details = await client.fetch_thread(comment_id)
        except ThreadsAPIError as exc:
            warnings.append(f"failed to fetch comment permalink: {exc.as_message()}")
        else:
            permalink = (details or {}).get("permalink")
            if permalink:
                external_id = permalink

        return CommentCreateResult(
            ok=True,
            external_id=external_id,
            errors=[],
            warnings=warnings,
        )


class ThreadsCommentDeleteCapability(ThreadsCapabilityBase, CommentDeleteCapability):
    async def delete_comment(self, comment_external_id: str, *, credentials: dict) -> DeleteResult:
        resolved_credentials, missing_fields = self._resolve_credentials(
            credentials,
            require_user_id=False,
        )
        if missing_fields or not resolved_credentials:
            return DeleteResult(
                ok=False,
                errors=["missing credentials: access_token"],
            )

        comment_id = normalize_thread_id(comment_external_id)
        if not comment_id:
            return DeleteResult(
                ok=False,
                errors=["threads comment delete requires valid comment id"],
            )

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            await client.delete_content(comment_id)
        except ThreadsAPIError as exc:
            return DeleteResult(ok=False, errors=[exc.as_message()])
        return DeleteResult(ok=True, errors=[])


# API wrapper -----------------------------------------------------------------------------------
class ThreadsAPI:
    def __init__(self, *, transport: GraphAPITransport) -> None:
        self._client = GraphAPIJSONClient(transport)

    async def create_thread(self, user_id: str, payload: MutableMapping[str, Any]) -> Dict[str, Any]:
        try:
            return await self._client.post_json(f"{user_id}/threads", data=payload)
        except GraphAPIError as exc:
            raise ThreadsAPIError.from_graph_error(exc) from exc

    async def publish_thread(self, user_id: str, creation_id: str) -> Dict[str, Any]:
        try:
            return await self._client.post_json(
                f"{user_id}/threads_publish",
                data={"creation_id": creation_id},
            )
        except GraphAPIError as exc:
            raise ThreadsAPIError.from_graph_error(exc) from exc

    async def fetch_thread(self, thread_id: str) -> Dict[str, Any]:
        try:
            return await self._client.get_json(
                str(thread_id),
                params={"fields": "id,permalink"},
            )
        except GraphAPIError as exc:
            raise ThreadsAPIError.from_graph_error(exc) from exc

    async def delete_content(self, external_id: str) -> None:
        try:
            await self._client.delete(str(external_id))
        except GraphAPIError as exc:
            raise ThreadsAPIError.from_graph_error(exc) from exc

    async def fetch_metrics(self, external_id: str) -> Dict[str, Any]:
        try:
            return await self._client.get_json(
                f"{external_id}/insights",
                params={"metric": "likes,replies,reposts,quotes"},
            )
        except GraphAPIError as exc:
            raise ThreadsAPIError.from_graph_error(exc) from exc


class ThreadsAPIError(GraphAPIError):
    @classmethod
    def from_graph_error(cls, exc: GraphAPIError) -> "ThreadsAPIError":
        return cls(exc.message, status_code=exc.status_code, payload=exc.payload)

    def as_message(self) -> str:
        return self.message


# Helpers ---------------------------------------------------------------------------------------
def extract_publish_options(options: dict | None) -> Dict[str, Any]:
    if not isinstance(options, dict):
        return {}
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


def prepare_media_payload(
    media_items: Iterable[Dict[str, Any]],
) -> tuple[Dict[str, Any], List[str]]:
    media_list = list(media_items)
    if not media_list:
        return {}, []

    warnings: List[str] = []
    image_items: List[Dict[str, Any]] = []
    invalid_count = 0
    video_count = 0

    for item in media_list:
        if not isinstance(item, dict):
            invalid_count += 1
            continue

        kind = item.get("type")
        if kind == "image":
            url = item.get("url")
            if isinstance(url, str) and url.strip():
                image_items.append(item)
            else:
                invalid_count += 1
        elif kind == "video":
            video_count += 1
        else:
            invalid_count += 1

    if video_count:
        warnings.append(
            f"threads adapter dropped {video_count} video media item(s); video media is not yet supported",
        )
    if invalid_count:
        warnings.append(
            f"threads adapter dropped {invalid_count} unsupported media item(s)",
        )

    if not image_items:
        return {}, warnings

    if len(image_items) > 1:
        warnings.append(
            f"threads adapter only supports the first image; dropped {len(image_items) - 1} additional image(s)",
        )

    image = image_items[0]
    url = image.get("url")
    if not isinstance(url, str):
        warnings.append("threads adapter image missing url; dropped selected image")
        return {}, warnings

    payload: Dict[str, Any] = {
        "media_type": "IMAGE",
        "image_url": url.strip(),
    }

    alt_text_raw = image.get("alt") or image.get("caption")
    if isinstance(alt_text_raw, str):
        alt_text = alt_text_raw.strip()
        if alt_text:
            payload["image_alt_text"] = alt_text

    return payload, warnings


def resolve_creation_id(payload: Dict[str, Any] | None) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    for key in ("id", "post_id", "creation_id"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def parse_metrics(payload: Dict[str, Any] | None) -> Dict[str, float]:
    if not isinstance(payload, dict):
        return {}
    data = payload.get("data")
    if not isinstance(data, list):
        return {}
    metrics: Dict[str, float] = {}
    metric_name_map = {
        "likes": KPIKey.LIKES.value,
        "replies": KPIKey.COMMENTS.value,
        "reposts": KPIKey.SHARES.value,
    }
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
                mapped = metric_name_map.get(name)
                if mapped:
                    metrics[mapped] = float(value)
    return metrics


def extract_comment_options(options: dict | None) -> Dict[str, Any]:
    if not isinstance(options, dict):
        return {}
    allowed_keys = {
        "quote_post_id": "quote_post_id",
        "url_sharing_enabled": "url_sharing_enabled",
    }
    extracted: Dict[str, Any] = {}
    for source_key, target_key in allowed_keys.items():
        value = options.get(source_key)
        if value is None:
            continue
        if isinstance(value, bool):
            extracted[target_key] = str(value).lower()
        else:
            extracted[target_key] = str(value)
    return extracted


def normalize_thread_id(external_id: str | None) -> str:
    if not external_id:
        return ""
    candidate = external_id.strip()
    if not candidate:
        return ""
    if candidate.startswith("http://") or candidate.startswith("https://"):
        parsed = urlparse(candidate)
        path = (parsed.path or "").rstrip("/")
        if path:
            candidate = path.split("/")[-1]
        else:
            candidate = ""
    if not candidate:
        return ""
    if "?" in candidate:
        candidate = candidate.split("?", 1)[0]
    return candidate
