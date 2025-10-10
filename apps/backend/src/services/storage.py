from __future__ import annotations

import io
import logging
import mimetypes
from functools import lru_cache
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import SYNC_FETCH

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_minio_client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
        region=settings.MINIO_REGION or None,
    )


@lru_cache(maxsize=None)
def _ensure_bucket_once(bucket: str) -> bool:
    client = get_minio_client()
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
    base = settings.MINIO_PUBLIC_BASE.rstrip("/")
    bucket_part = bucket.strip("/")
    object_part = object_name.lstrip("/")
    return f"{base}/{bucket_part}/{object_part}"


def store_bytes(
    bucket: str,
    *,
    data: bytes,
    content_type: Optional[str] = None,
    prefix: Optional[str] = None,
    object_name: Optional[str] = None,
) -> str:
    ensure_bucket(bucket)
    client = get_minio_client()
    clean_content_type = _clean_content_type(content_type)
    key = object_name or _generate_object_name(prefix=prefix, content_type=clean_content_type)

    client.put_object(
        bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=clean_content_type,
    )
    return object_url(bucket, key)


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
        return store_bytes(
            bucket,
            data=payload,
            content_type=content_type,
            object_name=object_name,
        )
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
    "get_minio_client",
    "ensure_bucket",
    "object_url",
    "store_bytes",
    "store_remote_asset",
]
