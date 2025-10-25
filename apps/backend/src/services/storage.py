from __future__ import annotations

import io
import logging
import mimetypes
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import SYNC_FETCH

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class StoredObject:
    bucket: str
    object_name: str
    url: str
    raw_url: str
    content_type: Optional[str]
    size: int


@lru_cache(maxsize=1)
def get_object_storage_client() -> Minio:
    return Minio(
        settings.SEAWEEDFS_ENDPOINT,
        access_key=settings.SEAWEEDFS_ACCESS_KEY,
        secret_key=settings.SEAWEEDFS_SECRET_KEY,
        secure=settings.SEAWEEDFS_SECURE,
        region=settings.SEAWEEDFS_REGION or None,
    )


@lru_cache(maxsize=None)
def _ensure_bucket_once(bucket: str) -> bool:
    client = get_object_storage_client()
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
    except S3Error as exc:
        # BucketAlreadyOwnedByYou/BucketAlreadyExists are safe to ignore in concurrent scenarios
        if exc.code not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
            raise
    return True


def ensure_bucket(bucket: str) -> None:
    _ensure_bucket_once(bucket)


def object_url(bucket: str, object_name: str) -> str:
    base = settings.SEAWEEDFS_PUBLIC_BASE.rstrip("/")
    bucket_part = bucket.strip("/")
    object_part = object_name.lstrip("/")
    return f"{base}/{bucket_part}/{object_part}"


def public_media_url(bucket: str, object_name: str) -> str:
    base = settings.MEDIA_PUBLIC_BASE.rstrip("/")
    bucket_part = bucket.strip("/")
    object_part = object_name.lstrip("/")
    return f"{base}/api/media/{bucket_part}/{object_part}"


def resolve_object_from_public_url(url: str) -> Optional[Tuple[str, str]]:
    if not url:
        return None
    normalized = url.strip()
    media_base = settings.MEDIA_PUBLIC_BASE.rstrip("/")
    api_base = settings.API_PUBLIC_BASE.rstrip("/")

    path: Optional[str] = None
    if media_base and normalized.startswith(media_base + "/"):
        path = normalized[len(media_base) + 1 :]
    elif api_base and normalized.startswith(api_base + "/api/media/"):
        path = normalized[len(api_base) + len("/api/media/") :]
    else:
        parsed = urlparse(normalized)
        if parsed.path.startswith("/api/media/"):
            path = parsed.path[len("/api/media/") :]

    if not path:
        return None

    parts = path.split("/", 1)
    if len(parts) != 2:
        return None
    bucket, object_name = parts[0], parts[1]
    return bucket, object_name


def ensure_public_media_url(url: str | None) -> str | None:
    if not url:
        return url
    try:
        parsed = urlparse(url)
    except ValueError:
        return url
    if not parsed.scheme or not parsed.netloc:
        return url

    seaweed_base = settings.SEAWEEDFS_PUBLIC_BASE.rstrip("/")
    if seaweed_base and url.startswith(seaweed_base + "/"):
        remainder = url[len(seaweed_base) + 1 :]
        parts = remainder.split("/", 1)
        if len(parts) == 2:
            bucket, object_name = parts
            return public_media_url(bucket, object_name)
    return url


def store_bytes(
    bucket: str,
    *,
    data: bytes,
    content_type: Optional[str] = None,
    prefix: Optional[str] = None,
    object_name: Optional[str] = None,
) -> StoredObject:
    ensure_bucket(bucket)
    client = get_object_storage_client()
    clean_content_type = _clean_content_type(content_type)
    key = object_name or _generate_object_name(prefix=prefix, content_type=clean_content_type)

    client.put_object(
        bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=clean_content_type,
    )
    return StoredObject(
        bucket=bucket,
        object_name=key,
        url=public_media_url(bucket, key),
        raw_url=object_url(bucket, key),
        content_type=clean_content_type,
        size=len(data),
    )


def fetch_object_bytes(bucket: str, object_name: str) -> Tuple[bytes, Optional[str]]:
    client = get_object_storage_client()
    response = client.get_object(bucket, object_name)
    try:
        data = response.read()
        content_type = response.headers.get("Content-Type") if hasattr(response, "headers") else None
    finally:
        response.close()
        response.release_conn()
    return data, content_type


def store_remote_asset(
    url: str,
    *,
    bucket: str,
    prefix: Optional[str] = None,
    timeout: float | None = None,
) -> Optional[str]:
    if not url:
        return None
    try:
        resp = SYNC_FETCH.get(url, timeout=timeout)
        resp.raise_for_status()
    except Exception as exc:  # pragma: no cover - network issues
        logger.warning("Failed to fetch remote asset", exc_info=False, extra={"url": url, "error": str(exc)})
        return None

    payload = resp.content
    if not payload:
        logger.debug("Remote asset had no payload", extra={"url": url})
        return None

    content_type = resp.headers.get("content-type")
    source_ext = Path(urlparse(url).path).suffix
    object_name = _generate_object_name(
        prefix=prefix,
        content_type=_clean_content_type(content_type),
        source_suffix=source_ext,
    )
    try:
        stored = store_bytes(
            bucket,
            data=payload,
            content_type=content_type,
            object_name=object_name,
        )
        return stored.url
    except Exception as exc:  # pragma: no cover - IO issues
        logger.warning("Failed to store remote asset", exc_info=True, extra={"url": url, "error": str(exc)})
        return None


def _clean_content_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    base = value.split(";", 1)[0].strip()
    return base or None


def _generate_object_name(
    *,
    prefix: Optional[str],
    content_type: Optional[str] = None,
    source_suffix: Optional[str] = None,
) -> str:
    suffix = _guess_suffix(content_type, source_suffix)
    key = uuid4().hex
    if suffix:
        key = f"{key}{suffix}"
    if prefix:
        return f"{prefix.strip('/')}/{key}"
    return key


def _guess_suffix(content_type: Optional[str], source_suffix: Optional[str]) -> Optional[str]:
    if content_type:
        guessed = mimetypes.guess_extension(content_type, strict=False)
        if guessed:
            return guessed
    if source_suffix:
        return source_suffix if source_suffix.startswith('.') else f".{source_suffix}"
    return None


__all__ = [
    "StoredObject",
    "get_object_storage_client",
    "ensure_bucket",
    "object_url",
    "public_media_url",
    "ensure_public_media_url",
    "resolve_object_from_public_url",
    "fetch_object_bytes",
    "store_bytes",
    "store_remote_asset",
]
