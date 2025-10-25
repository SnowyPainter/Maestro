from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, MutableMapping, Optional, Tuple

import httpx

from apps.backend.src.modules.adapters.core.adapter import CapabilityAdapter
from apps.backend.src.modules.adapters.core.capabilities import (
    CommentCreateCapability,
    CommentDeleteCapability,
    CommentReadCapability,
    DeletionCapability,
    MessageSendCapability,
    MetricsCapability,
    PublishingCapability,
)
from apps.backend.src.modules.adapters.core.compiler import SpecCompiler
from apps.backend.src.modules.adapters.core.types import (
    Comment,
    CommentCreateResult,
    CommentListResult,
    DeleteResult,
    InstagramCredentials,
    MessageSendResult,
    MetricsResult,
    PublishResult,
    RenderedVariantBlocks,
)
from apps.backend.src.modules.adapters.http.graph import (
    GraphAPIError,
    GraphAPIJSONClient,
    GraphAPITransport,
)
from apps.backend.src.modules.common.enums import ContentKind, MetricsScope, PlatformKind
from apps.backend.src.services.http_clients import ASYNC_FETCH
from apps.backend.src.services.storage import ensure_public_media_url
from apps.backend.src.modules.files.image_utils import normalize_instagram_images


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InstagramAdapter(CapabilityAdapter[SpecCompiler]):
    platform = PlatformKind.INSTAGRAM

    def __init__(
        self,
        *,
        http_client: httpx.AsyncClient | None = None,
        base_url: str = "https://graph.instagram.com/v24.0",
    ) -> None:
        http = http_client or ASYNC_FETCH
        context = InstagramContext(http=http, base_url=base_url)
        credentials = InstagramCredentialResolver()
        compiler = SpecCompiler(platform=self.platform, version=1)
        publisher = InstagramPublishingCapability(context=context, credentials=credentials)
        deleter = InstagramDeletionCapability()
        metrics = InstagramMetricsCapability(context=context, credentials=credentials)
        comment_creator = InstagramCommentCreateCapability(context=context, credentials=credentials)
        comment_deleter = InstagramCommentDeleteCapability(context=context, credentials=credentials)
        comment_reader = InstagramCommentReadCapability(context=context, credentials=credentials)
        message_sender = InstagramMessageSendCapability(context=context, credentials=credentials)
        super().__init__(
            platform=self.platform,
            compiler=compiler,
            publisher=publisher,
            deleter=deleter,
            metrics=metrics,
            comment_creator=comment_creator,
            comment_deleter=comment_deleter,
            comment_reader=comment_reader,
            message_sender=message_sender,
        )


# Context & credentials -------------------------------------------------------------------------
@dataclass
class InstagramContext:
    http: httpx.AsyncClient
    base_url: str

    def graph_client(self, *, access_token: str) -> "InstagramAPI":
        return InstagramAPI(
            transport=GraphAPITransport(
                http=self.http,
                base_url=self.base_url,
                default_params={"access_token": access_token},
            )
        )


class InstagramCredentialResolver:
    def resolve(
        self,
        credentials: InstagramCredentials | Dict[str, Any] | None,
        *,
        require_user_id: bool = True,
    ) -> tuple[Optional[InstagramCredentials], List[str]]:
        if isinstance(credentials, InstagramCredentials):
            missing: List[str] = []
            if not credentials.access_token:
                missing.append("access_token")
            if require_user_id and not credentials.user_id:
                missing.append("instagram user id")
            if missing:
                return None, missing
            return credentials, []

        resolved, missing = InstagramCredentials.from_mapping(
            credentials,
            require_user_id=require_user_id,
        )
        return resolved, missing


class InstagramCapabilityBase:
    def __init__(
        self,
        *,
        context: InstagramContext,
        credentials: InstagramCredentialResolver,
    ) -> None:
        self._context = context
        self._credentials = credentials

    def _client(self, *, access_token: str) -> "InstagramAPI":
        return self._context.graph_client(access_token=access_token)

    def _resolve_credentials(
        self,
        credentials: InstagramCredentials | Dict[str, Any] | None,
        *,
        require_user_id: bool = True,
    ) -> tuple[Optional[InstagramCredentials], List[str]]:
        return self._credentials.resolve(credentials, require_user_id=require_user_id)


# Publish ---------------------------------------------------------------------------------------
class InstagramPublishingCapability(InstagramCapabilityBase, PublishingCapability):
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
                permalink=None,
                errors=["missing credentials: " + ", ".join(missing_fields or ["access_token", "instagram user id"])],
                warnings=[],
            )

        user_id = resolved_credentials.user_id
        if not user_id:
            return PublishResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=["instagram publish requires instagram user id"],
                warnings=[],
            )

        blocks_media = (rendered_blocks or {}).get("media") or []
        media_mode, media_items, media_warnings = prepare_instagram_media_payload(blocks_media)
        warnings.extend(media_warnings)

        if not media_mode or not media_items:
            return PublishResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=["instagram publish requires at least one supported media item"],
                warnings=warnings,
            )

        client = self._client(access_token=resolved_credentials.access_token)

        text = (caption or "").strip()
        extra = extract_publish_options(options)

        media_kind: Optional[str] = None
        try:
            if media_mode == "carousel":
                creation_id, carousel_warnings = await _create_carousel_container(
                    client=client,
                    user_id=user_id,
                    items=media_items,
                    caption=text,
                    extra_options=extra,
                )
                warnings.extend(carousel_warnings)
                media_kind = "CAROUSEL_ALBUM"
            else:
                creation_payload = build_single_media_payload(media_mode, media_items[0])
                if text:
                    creation_payload["caption"] = text
                if extra:
                    creation_payload.update(extra)
                creation = await client.create_media(user_id=user_id, payload=creation_payload)
                creation_id = extract_creation_id(creation)
                if not creation_id:
                    return PublishResult(
                        ok=False,
                        external_id=None,
                        permalink=None,
                        errors=["instagram API response missing media creation id"],
                        warnings=warnings,
                    )
                media_kind = "VIDEO" if media_mode == "video" else "IMAGE"
        except InstagramAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        try:
            published = await client.publish_media(user_id=user_id, creation_id=creation_id)
        except InstagramAPIError as exc:
            return PublishResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        media_id = extract_creation_id(published) or creation_id

        permalink: Optional[str] = None
        details: Dict[str, Any] = {}
        try:
            details = await client.fetch_media(media_id=media_id, fields="id,permalink,media_type")
            permalink = details.get("permalink") if isinstance(details.get("permalink"), str) else None
        except InstagramAPIError as exc:
            warnings.append(f"failed to fetch instagram permalink: {exc.as_message()}")

        if media_kind and details.get("media_type") and media_kind != details.get("media_type"):
            warnings.append("instagram adapter media type mismatch detected")

        return PublishResult(
            ok=True,
            external_id=media_id,
            permalink=permalink,
            errors=[],
            warnings=warnings,
        )


# Delete ----------------------------------------------------------------------------------------
class InstagramDeletionCapability(DeletionCapability):
    async def delete(self, external_id: str, *, credentials: dict) -> DeleteResult:
        return DeleteResult(
            ok=False,
            errors=["instagram delete not supported by Graph API"],
        )


# Metrics ---------------------------------------------------------------------------------------
class InstagramMetricsCapability(InstagramCapabilityBase, MetricsCapability):
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
                mapping_version=1,
                collected_at=_utcnow(),
                raw={},
                warnings=[],
                errors=["missing credentials: " + ", ".join(missing_fields or ["access_token"])],
            )

        client = self._client(access_token=resolved_credentials.access_token)

        try:
            media_details = await client.fetch_media(
                media_id=external_id,
                fields="id,media_type,permalink,like_count,comments_count",
            )
        except InstagramAPIError as exc:
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

        media_type = media_details.get("media_type")
        metrics_list = determine_metrics_for_media(media_type)

        insights: Dict[str, Any] = {}
        warnings: List[str] = []

        if metrics_list:
            try:
                insights = await client.fetch_metrics(media_id=external_id, metrics=metrics_list)
            except InstagramAPIError as exc:
                warnings.append(exc.as_message())

        metrics = parse_instagram_metrics(insights, media_details)
        content_kind = map_media_type_to_content_kind(media_type)

        return MetricsResult(
            ok=True,
            metrics=metrics,
            scope=MetricsScope.SINCE_PUBLISH,
            content_kind=content_kind,
            mapping_version=2,
            collected_at=_utcnow(),
            raw={"insights": insights, "media": media_details},
            warnings=warnings,
            errors=[],
        )


# Comment ---------------------------------------------------------------------------------------
class InstagramCommentCreateCapability(InstagramCapabilityBase, CommentCreateCapability):
    async def create_comment(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> CommentCreateResult:
        resolved_credentials, missing_fields = self._resolve_credentials(credentials)
        if missing_fields or not resolved_credentials:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=["missing credentials: " + ", ".join(missing_fields or ["access_token", "instagram user id"])],
                warnings=[],
            )

        body = (text or "").strip()
        if not body:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=["instagram comment requires text"],
                warnings=[],
            )

        client = self._client(access_token=resolved_credentials.access_token)

        payload: Dict[str, Any] = {"message": body}
        if isinstance(options, dict):
            if options.get("hide") is True:
                payload["hide"] = "true"

        try:
            response = await client.create_comment(media_id=parent_external_id, payload=payload)
        except InstagramAPIError as exc:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=[exc.as_message()],
                warnings=[],
            )

        comment_id = extract_creation_id(response)
        if not comment_id:
            return CommentCreateResult(
                ok=False,
                external_id=None,
                permalink=None,
                errors=["instagram API response missing comment id"],
                warnings=[],
            )

        permalink: Optional[str] = None
        try:
            details = await client.fetch_comment(comment_id=comment_id)
            permalink = details.get("permalink") if isinstance(details.get("permalink"), str) else None
        except InstagramAPIError:
            pass

        return CommentCreateResult(
            ok=True,
            external_id=comment_id,
            permalink=permalink,
            errors=[],
            warnings=[],
        )


class InstagramCommentDeleteCapability(InstagramCapabilityBase, CommentDeleteCapability):
    async def delete_comment(self, comment_external_id: str, *, credentials: dict) -> DeleteResult:
        resolved_credentials, missing_fields = self._resolve_credentials(
            credentials,
            require_user_id=False,
        )
        if missing_fields or not resolved_credentials:
            return DeleteResult(
                ok=False,
                errors=["missing credentials: " + ", ".join(missing_fields or ["access_token"])],
            )

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            await client.delete_comment(comment_id=comment_external_id)
        except InstagramAPIError as exc:
            return DeleteResult(ok=False, errors=[exc.as_message()])

        return DeleteResult(ok=True, errors=[])


class InstagramCommentReadCapability(InstagramCapabilityBase, CommentReadCapability):
    async def list_comments(
        self,
        parent_external_id: str,
        *,
        credentials: dict,
        options: dict | None = None,
    ) -> CommentListResult:
        warnings: List[str] = []
        resolved_credentials, missing_fields = self._resolve_credentials(
            credentials,
            require_user_id=False,
        )

        if missing_fields or not resolved_credentials:
            return CommentListResult(
                ok=False,
                comments=[],
                next_cursor=None,
                errors=["missing credentials: " + ", ".join(missing_fields or ["access_token"])],
                warnings=[],
            )

        limit = None
        cursor = None
        if isinstance(options, dict):
            raw_limit = options.get("limit")
            if raw_limit is not None:
                try:
                    limit = int(raw_limit)
                    if limit <= 0:
                        limit = None
                except (TypeError, ValueError):
                    warnings.append("instagram comment list ignored invalid limit option")
            raw_cursor = options.get("after") or options.get("cursor")
            if isinstance(raw_cursor, str) and raw_cursor.strip():
                cursor = raw_cursor.strip()

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            payload = await client.list_comments(
                media_id=parent_external_id,
                limit=limit,
                cursor=cursor,
            )
        except InstagramAPIError as exc:
            return CommentListResult(
                ok=False,
                comments=[],
                next_cursor=None,
                errors=[exc.as_message()],
                warnings=warnings,
            )

        comments, parse_warnings = parse_comment_nodes(payload, parent_id=parent_external_id)
        warnings.extend(parse_warnings)
        next_cursor = extract_next_cursor(payload)

        return CommentListResult(
            ok=True,
            comments=comments,
            next_cursor=next_cursor,
            errors=[],
            warnings=warnings,
        )

class InstagramMessageSendCapability(InstagramCapabilityBase, MessageSendCapability):
    async def send_message(
        self,
        *,
        recipient_external_id: str,
        credentials: dict,
        text: str,
        options: dict | None = None,
    ) -> MessageSendResult:
        resolved_credentials, missing = self._resolve_credentials(credentials, require_user_id=True)
        if missing or not resolved_credentials:
            return MessageSendResult(
                ok=False,
                errors=["missing credentials: " + ", ".join(missing or ["access_token", "instagram user id"])],
                reason="missing_credentials",
            )

        user_id = resolved_credentials.user_id
        if not user_id:
            return MessageSendResult(
                ok=False,
                errors=["instagram direct message requires instagram user id"],
                reason="missing_instagram_user_id",
            )

        message_payload: Dict[str, Any] = {}
        body = (text or "").strip()
        if body:
            message_payload["text"] = body

        if isinstance(options, dict):
            attachment = options.get("attachment")
            if isinstance(attachment, dict):
                message_payload.update({k: v for k, v in attachment.items() if v is not None})

        if not message_payload:
            return MessageSendResult(
                ok=False,
                errors=["instagram direct message requires text or attachment"],
                reason="missing_message_payload",
            )

        client = self._client(access_token=resolved_credentials.access_token)
        try:
            response = await client.send_message(
                user_id=user_id,
                recipient_id=recipient_external_id,
                message=message_payload,
            )
        except InstagramAPIError as exc:
            return MessageSendResult(
                ok=False,
                errors=[exc.as_message()],
                reason="dm_send_failed",
            )

        return MessageSendResult(
            ok=True,
            recipient_id=response.get("recipient_id"),
            message_id=response.get("message_id") or response.get("id"),
            raw=response,
        )

# API wrapper -----------------------------------------------------------------------------------
class InstagramAPI:
    def __init__(self, *, transport: GraphAPITransport) -> None:
        self._client = GraphAPIJSONClient(transport)

    async def create_media(self, user_id: str, payload: MutableMapping[str, Any]) -> Dict[str, Any]:
        try:
            return await self._client.post_json(f"{user_id}/media", data=payload)
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def publish_media(self, user_id: str, creation_id: str) -> Dict[str, Any]:
        try:
            return await self._client.post_json(
                f"{user_id}/media_publish",
                data={"creation_id": creation_id},
            )
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def fetch_media(self, *, media_id: str, fields: str) -> Dict[str, Any]:
        try:
            return await self._client.get_json(
                str(media_id),
                params={"fields": fields},
            )
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def fetch_metrics(self, *, media_id: str, metrics: str) -> Dict[str, Any]:
        try:
            return await self._client.get_json(
                f"{media_id}/insights",
                params={"metric": metrics},
            )
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def create_comment(self, *, media_id: str, payload: MutableMapping[str, Any]) -> Dict[str, Any]:
        try:
            return await self._client.post_json(f"{media_id}/comments", data=payload)
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def delete_comment(self, *, comment_id: str) -> None:
        try:
            await self._client.delete(str(comment_id))
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def fetch_comment(self, *, comment_id: str) -> Dict[str, Any]:
        try:
            return await self._client.get_json(
                str(comment_id),
                params={"fields": "id,text,timestamp,username,permalink,like_count"},
            )
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def list_comments(
        self,
        *,
        media_id: str,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "fields": "id,text,timestamp,username,permalink,like_count,replies.limit(25){id,text,timestamp,username,permalink,like_count}",
        }
        if limit is not None:
            params["limit"] = str(limit)
        if cursor:
            params["after"] = cursor
        try:
            return await self._client.get_json(f"{media_id}/comments", params=params)
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc

    async def send_message(
        self,
        *,
        user_id: str,
        recipient_id: str,
        message: Dict[str, Any],
    ) -> Dict[str, Any]:
        data = {
            "recipient": json.dumps({"id": recipient_id}),
            "message": json.dumps(message),
        }
        try:
            return await self._client.post_json(f"{user_id}/messages", data=data)
        except GraphAPIError as exc:
            raise InstagramAPIError.from_graph_error(exc) from exc


class InstagramAPIError(GraphAPIError):
    @classmethod
    def from_graph_error(cls, exc: GraphAPIError) -> "InstagramAPIError":
        return cls(exc.message, status_code=exc.status_code, payload=exc.payload)

    def as_message(self) -> str:
        return self.message


# Helpers ---------------------------------------------------------------------------------------
def prepare_instagram_media_payload(
    media_items: Iterable[Dict[str, Any]],
) -> Tuple[Optional[str], List[Dict[str, Any]], List[str]]:
    items = list(media_items)
    if not items:
        return None, [], []

    warnings: List[str] = []
    image_items: List[Dict[str, Any]] = []
    video_items: List[Dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            warnings.append("instagram adapter dropped unsupported media item")
            continue
        kind = (item.get("type") or "").lower()
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            warnings.append("instagram adapter dropped media item missing url")
            continue
        normalized_url = ensure_public_media_url(url.strip())
        if not normalized_url:
            warnings.append("instagram adapter dropped media item with invalid url")
            continue
        if kind == "image":
            image_copy = dict(item)
            image_copy["url"] = normalized_url
            image_items.append(image_copy)
        elif kind == "video":
            video_copy = dict(item)
            video_copy["url"] = normalized_url
            video_items.append(video_copy)
        else:
            warnings.append(f"instagram adapter dropped unsupported media kind '{kind}'")

    carousel_candidates = [
        {"type": "image", "url": item["url"], "alt": item.get("alt")}
        for item in image_items
    ] + [
        {"type": "video", "url": item["url"]}
        for item in video_items
    ]

    if not carousel_candidates:
        return None, [], warnings

    if len(carousel_candidates) == 1:
        item = carousel_candidates[0]
        mode = "video" if item["type"] == "video" else "image"
        if mode == "image":
            normalized_single, extra_warnings = normalize_instagram_images([item])
            warnings.extend(extra_warnings)
            return mode, normalized_single, warnings
        return mode, [item], warnings

    if len(carousel_candidates) > 10:
        warnings.append("instagram carousel supports up to 10 media items; extra items were dropped")
        carousel_candidates = carousel_candidates[:10]

    normalized_images, extra_warnings = normalize_instagram_images(carousel_candidates)
    warnings.extend(extra_warnings)
    return "carousel", normalized_images, warnings


async def _create_carousel_container(
    *,
    client: "InstagramAPI",
    user_id: str,
    items: List[Dict[str, Any]],
    caption: str | None,
    extra_options: Dict[str, Any],
) -> Tuple[str, List[str]]:
    warnings: List[str] = []
    child_ids: List[str] = []

    for item in items:
        payload = build_carousel_child_payload(item)
        try:
            creation = await client.create_media(user_id=user_id, payload=payload)
        except InstagramAPIError as exc:
            raise exc
        child_id = extract_creation_id(creation)
        if not child_id:
            raise InstagramAPIError("instagram API response missing carousel child id")
        child_ids.append(child_id)

    parent_payload: Dict[str, Any] = {
        "media_type": "CAROUSEL",
        "children": json.dumps(child_ids),
    }
    if caption:
        parent_payload["caption"] = caption
    if extra_options:
        parent_payload.update(extra_options)

    creation = await client.create_media(user_id=user_id, payload=parent_payload)
    creation_id = extract_creation_id(creation)
    if not creation_id:
        raise InstagramAPIError("instagram API response missing carousel parent id")

    return creation_id, warnings


def build_single_media_payload(mode: str, item: Dict[str, Any]) -> Dict[str, Any]:
    if mode == "video":
        return {
            "video_url": item["url"],
            "media_type": "VIDEO",
        }
    return {
        "image_url": item["url"],
    }


def build_carousel_child_payload(item: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "is_carousel_item": "true",
    }
    if item["type"] == "video":
        payload["video_url"] = item["url"]
        payload["media_type"] = "VIDEO"
    else:
        payload["image_url"] = item["url"]
    return payload


def extract_publish_options(options: dict | None) -> Dict[str, Any]:
    if not isinstance(options, dict):
        return {}
    allowed_keys = {
        "share_to_feed": "share_to_feed",
        "location_id": "location_id",
        "user_tags": "user_tags",
    }
    extracted: Dict[str, Any] = {}
    for source_key, target_key in allowed_keys.items():
        value = options.get(source_key)
        if value is None:
            continue
        extracted[target_key] = value
    return extracted


def extract_creation_id(payload: Dict[str, Any] | None) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    candidate = payload.get("id") or payload.get("creation_id")
    if isinstance(candidate, str) and candidate.strip():
        return candidate.strip()
    return None


def determine_metrics_for_media(media_type: Any) -> str:
    kind = (media_type or "").upper()
    if kind in {"IMAGE", "CAROUSEL_ALBUM"}:
        return "impressions,reach,engagement,saved"
    if kind in {"VIDEO", "REEL", "IGTV"}:
        return "impressions,reach,engagement,saved,video_views"
    return "impressions,reach,engagement,saved"


def parse_instagram_metrics(
    insights_payload: Dict[str, Any] | None,
    media_payload: Dict[str, Any] | None,
) -> Dict[str, float]:
    metrics: Dict[str, float] = {}

    if isinstance(insights_payload, dict):
        data = insights_payload.get("data")
        if isinstance(data, list):
            for entry in data:
                if not isinstance(entry, dict):
                    continue
                name = entry.get("name")
                values = entry.get("values")
                if not isinstance(values, list) or not values:
                    continue
                value_entry = values[0]
                if not isinstance(value_entry, dict):
                    continue
                value = value_entry.get("value")
                try:
                    metrics[str(name)] = float(value)
                except (TypeError, ValueError):
                    continue

    if isinstance(media_payload, dict):
        like_count = media_payload.get("like_count")
        if isinstance(like_count, (int, float)):
            metrics.setdefault("likes", float(like_count))
        comments_count = media_payload.get("comments_count")
        if isinstance(comments_count, (int, float)):
            metrics.setdefault("comments", float(comments_count))

    return metrics


def map_media_type_to_content_kind(media_type: Any) -> ContentKind:
    if not isinstance(media_type, str):
        return ContentKind.POST
    kind = media_type.upper()
    if kind in {"IMAGE", "PHOTO"}:
        return ContentKind.POST
    if kind in {"VIDEO", "REEL", "IGTV"}:
        return ContentKind.VIDEO
    if kind == "CAROUSEL_ALBUM":
        return ContentKind.CAROUSEL
    return ContentKind.POST


def parse_comment_nodes(payload: Dict[str, Any] | None, *, parent_id: str) -> Tuple[List[Comment], List[str]]:
    comments: List[Comment] = []
    warnings: List[str] = []

    if not isinstance(payload, dict):
        return comments, warnings

    data = payload.get("data")
    if not isinstance(data, list):
        return comments, warnings

    for item in data:
        parsed, node_warnings = _parse_comment_node(item, parent_id=parent_id)
        warnings.extend(node_warnings)
        comments.extend(parsed)

    return comments, warnings


def _parse_comment_node(node: Dict[str, Any], *, parent_id: str) -> Tuple[List[Comment], List[str]]:
    comments: List[Comment] = []
    warnings: List[str] = []

    if not isinstance(node, dict):
        warnings.append("instagram comment payload contained invalid node")
        return comments, warnings

    comment = _build_comment(node, parent_id=parent_id, warnings=warnings)
    if comment:
        comments.append(comment)
        replies = node.get("replies")
        if isinstance(replies, dict):
            reply_data = replies.get("data")
            if isinstance(reply_data, list):
                for reply_node in reply_data:
                    reply_comment = _build_comment(reply_node, parent_id=comment.external_id, warnings=warnings)
                    if reply_comment:
                        comments.append(reply_comment)
    else:
        warnings.append("instagram comment missing id")

    return comments, warnings


def _build_comment(node: Dict[str, Any], *, parent_id: str, warnings: List[str]) -> Optional[Comment]:
    if not isinstance(node, dict):
        warnings.append("instagram comment payload contained invalid node")
        return None

    comment_id = node.get("id")
    if not isinstance(comment_id, str) or not comment_id.strip():
        warnings.append("instagram comment missing id")
        return None

    text = node.get("text") if isinstance(node.get("text"), str) else None
    created_at = parse_iso_datetime(node.get("timestamp"))
    username = node.get("username") if isinstance(node.get("username"), str) else None
    permalink = node.get("permalink") if isinstance(node.get("permalink"), str) else None

    metrics: Dict[str, float] = {}
    like_count = node.get("like_count")
    if isinstance(like_count, (int, float)):
        try:
            metrics["likes"] = float(like_count)
        except (TypeError, ValueError):
            pass

    return Comment(
        external_id=comment_id.strip(),
        parent_external_id=parent_id,
        author_id=None,
        author_username=username,
        text=text,
        created_at=created_at,
        permalink=permalink,
        raw=node,
        metrics=metrics,
        is_owned_by_me=None,
    )


def extract_next_cursor(payload: Dict[str, Any] | None) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    paging = payload.get("paging")
    if not isinstance(paging, dict):
        return None
    cursors = paging.get("cursors")
    if not isinstance(cursors, dict):
        return None
    after = cursors.get("after")
    if isinstance(after, str) and after.strip():
        return after.strip()
    return None


def parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    elif len(text) > 5 and text[-5] in {"+", "-"} and text[-3] != ":":
        # Convert offsets like +0000 to +00:00
        text = text[:-2] + ":" + text[-2:]
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


__all__ = ["InstagramAdapter"]
