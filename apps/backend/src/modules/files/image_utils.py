from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple
from urllib.parse import urlparse
from uuid import uuid4

from PIL import Image, ImageOps

from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import SYNC_FETCH
from apps.backend.src.services.storage import (
    fetch_object_bytes,
    resolve_object_from_public_url,
    store_bytes,
)

from apps.backend.src.core.logging import setup_logging
import logging

setup_logging()
logger = logging.getLogger(__name__)

_INSTAGRAM_MIN_RATIO = 4 / 5  # 0.8 portrait
_INSTAGRAM_MAX_RATIO = 1 / 1  # 1.0 square


def normalize_instagram_image(url: str) -> Tuple[str, List[str]]:
    return normalize_image_for_ratio(url, _INSTAGRAM_MIN_RATIO, _INSTAGRAM_MAX_RATIO)


def normalize_instagram_images(media: List[dict]) -> Tuple[List[dict], List[str]]:
    return normalize_images_for_ratio(media, _INSTAGRAM_MIN_RATIO, _INSTAGRAM_MAX_RATIO)


def normalize_images_for_ratio(
    media: List[dict],
    min_ratio: float,
    max_ratio: float,
) -> Tuple[List[dict], List[str]]:
    warnings: List[str] = []
    normalized: List[dict] = []
    for item in media:
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            warnings.append("adapter dropped media with missing url")
            continue
        normalized_url, extra = normalize_image_for_ratio(url.strip(), min_ratio, max_ratio)
        warnings.extend(extra)
        copy = dict(item)
        copy["url"] = normalized_url
        normalized.append(copy)
    return normalized, warnings


def normalize_image_for_ratio(url: str, min_ratio: float, max_ratio: float) -> Tuple[str, List[str]]:
    bucket_object = resolve_object_from_public_url(url)
    if bucket_object is None:
        stored = _download_and_store_external_image(url)
        if stored is None:
            return url, [f"unable to resolve media object for url: {url}"]
        bucket, object_name, url = stored
    else:
        bucket, object_name = bucket_object

    try:
        payload, _ = fetch_object_bytes(bucket, object_name)
    except Exception as exc:
        logger.warning("Failed to fetch media object", extra={"bucket": bucket, "object": object_name, "error": str(exc)})
        return url, [f"failed to load media object for url: {url}"]

    try:
        image = Image.open(BytesIO(payload))
        image = ImageOps.exif_transpose(image)
    except Exception as exc:
        logger.warning("Invalid image payload", extra={"bucket": bucket, "object": object_name, "error": str(exc)})
        return url, [f"invalid image payload for url: {url}"]

    warnings: List[str] = []
    original_format = image.format or "JPEG"
    width, height = image.size
    logger.debug("normalize_image_for_ratio original size=%sx%s ratio=%.4f url=%s", width, height, width / height if height else 0, url)

    if width == 0 or height == 0:
        return url, [f"image has invalid dimensions for url: {url}"]

    ratio = width / height
    if ratio < min_ratio:
        desired_ratio = min_ratio
    elif ratio > max_ratio:
        desired_ratio = max_ratio
    else:
        desired_ratio = ratio

    if min_ratio <= ratio <= max_ratio:
        return url, warnings

    if ratio < desired_ratio:
        new_height = max(1, round(width / desired_ratio))
        top = max((height - new_height) // 2, 0)
        bottom = min(top + new_height, height)
        left, right = 0, width
        warnings.append("image cropped vertically to match required aspect ratio")
    else:
        new_width = max(1, round(height * desired_ratio))
        left = max((width - new_width) // 2, 0)
        right = min(left + new_width, width)
        top, bottom = 0, height
        warnings.append("image cropped horizontally to match required aspect ratio")

    cropped = image.crop((left, top, right, bottom))
    logger.debug(
        "normalize_image_for_ratio cropped box=(%s,%s,%s,%s) new_size=%sx%s new_ratio=%.4f",
        left,
        top,
        right,
        bottom,
        cropped.width,
        cropped.height,
        cropped.width / cropped.height if cropped.height else 0,
    )

    final_ratio = cropped.width / cropped.height if cropped.height else desired_ratio
    if cropped.width > 1080:
        target_width = 1080
        target_height = max(1, round(target_width / final_ratio))
        cropped = cropped.resize((target_width, target_height), Image.LANCZOS)
        warnings.append("image resized to width 1080")
    elif cropped.height > 1350:
        target_height = 1350
        target_width = max(1, round(target_height * final_ratio))
        cropped = cropped.resize((target_width, target_height), Image.LANCZOS)
        warnings.append("image resized to height 1350")

    logger.debug(
        "normalize_image_for_ratio final size=%sx%s ratio=%.4f",
        cropped.width,
        cropped.height,
        cropped.width / cropped.height if cropped.height else 0,
    )

    buffer = BytesIO()
    save_format = original_format if original_format.upper() != "PNG" else "PNG"
    if save_format.upper() in {"JPEG", "JPG"}:
        cropped = cropped.convert("RGB")
    content_type = _guess_content_type(save_format)
    cropped.save(buffer, format=save_format, quality=95)

    stored = store_bytes(
        bucket,
        data=buffer.getvalue(),
        content_type=content_type,
        prefix="normalized",
    )

    logger.debug("normalized img: ", stored.url)
    
    return stored.url, warnings


def _guess_content_type(image_format: Optional[str]) -> str:
    fmt = (image_format or "JPEG").upper()
    if fmt in {"JPG", "JPEG"}:
        return "image/jpeg"
    if fmt == "PNG":
        return "image/png"
    if fmt == "WEBP":
        return "image/webp"
    if fmt == "GIF":
        return "image/gif"
    return "image/jpeg"


def _download_and_store_external_image(url: str) -> Optional[Tuple[str, str, str]]:
    try:
        response = SYNC_FETCH.get(url, timeout=10.0)
        response.raise_for_status()
    except Exception as exc:  # pragma: no cover - network issues
        logger.warning("Failed to download external image", extra={"url": url, "error": str(exc)})
        return None

    data = response.content
    if not data:
        logger.warning("External image download returned empty payload", extra={"url": url})
        return None

    content_type = response.headers.get("content-type")
    suffix = Path(urlparse(url).path).suffix or ".jpg"
    bucket = settings.SEAWEEDFS_BUCKET_DRAFT_MEDIA
    object_name = f"normalized/external/{uuid4().hex}{suffix}"
    stored = store_bytes(
        bucket,
        data=data,
        content_type=_clean_content_type_header(content_type, suffix),
        object_name=object_name,
    )
    logger.debug("downloaded external image stored bucket=%s object=%s url=%s", stored.bucket, stored.object_name, stored.url)
    return stored.bucket, stored.object_name, stored.url


def _clean_content_type_header(content_type: Optional[str], suffix: str) -> str:
    if content_type and content_type.strip():
        return content_type.split(";", 1)[0].strip()
    suffix = suffix.lower()
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".gif":
        return "image/gif"
    return "image/jpeg"


__all__ = [
    "normalize_instagram_image",
    "normalize_instagram_images",
    "normalize_images_for_ratio",
    "normalize_image_for_ratio",
]
