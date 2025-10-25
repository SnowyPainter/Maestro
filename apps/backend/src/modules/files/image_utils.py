from __future__ import annotations

from io import BytesIO
from typing import List, Optional, Tuple

from PIL import Image, ImageOps

from apps.backend.src.services.storage import (
    fetch_object_bytes,
    resolve_object_from_public_url,
    store_bytes,
)

_INSTAGRAM_MIN_RATIO = 4 / 5  # 0.8 (portrait)
_INSTAGRAM_MAX_RATIO = 1 / 1  # 1.0 (square)


def normalize_instagram_image(url: str) -> Tuple[str, List[str]]:
    return normalize_image_for_ratio(url, _INSTAGRAM_MIN_RATIO, _INSTAGRAM_MAX_RATIO)


def normalize_image_for_ratio(url: str, min_ratio: float, max_ratio: float) -> Tuple[str, List[str]]:
    """Ensure the image hosted at ``url`` satisfies the given aspect ratio bounds."""
    bucket_object = resolve_object_from_public_url(url)
    if bucket_object is None:
        return url, [f"unable to resolve media object for url: {url}"]
    bucket, object_name = bucket_object

    try:
        payload, content_type = fetch_object_bytes(bucket, object_name)
    except Exception:
        return url, [f"failed to load media object for url: {url}"]

    try:
        image = Image.open(BytesIO(payload))
        image = ImageOps.exif_transpose(image)
    except Exception:
        return url, [f"invalid image payload for url: {url}"]

    warnings: List[str] = []
    original_format = image.format or "JPEG"
    width, height = image.size
    if height == 0 or width == 0:
        return url, [f"image has invalid dimensions for url: {url}"]

    target_ratio = width / height
    if target_ratio < min_ratio:
        desired_ratio = min_ratio
    elif target_ratio > max_ratio:
        desired_ratio = max_ratio
    else:
        desired_ratio = target_ratio

    if min_ratio <= target_ratio <= max_ratio:
        return url, warnings

    if target_ratio < desired_ratio:
        new_height = max(1, round(width / desired_ratio))
        if new_height > height:
            new_height = height
        top = max((height - new_height) // 2, 0)
        bottom = min(top + new_height, height)
        left, right = 0, width
        warnings.append("image cropped vertically to match required aspect ratio")
    else:
        new_width = max(1, round(height * desired_ratio))
        if new_width > width:
            new_width = width
        left = max((width - new_width) // 2, 0)
        right = min(left + new_width, width)
        top, bottom = 0, height
        warnings.append("image cropped horizontally to match required aspect ratio")

    cropped = image.crop((left, top, right, bottom))
    ratio = cropped.width / cropped.height if cropped.height else desired_ratio

    if cropped.width > 1080:
        target_width = 1080
        target_height = max(1, round(target_width / ratio))
        cropped = cropped.resize((target_width, target_height), Image.LANCZOS)
        warnings.append("image resized to width 1080")
    elif cropped.height > 1350:
        target_height = 1350
        target_width = max(1, round(target_height * ratio))
        cropped = cropped.resize((target_width, target_height), Image.LANCZOS)
        warnings.append("image resized to height 1350")

    buffer = BytesIO()
    save_format = original_format if original_format.upper() != "PNG" else "PNG"
    cropped = cropped.convert("RGB") if save_format.upper() in {"JPEG", "JPG"} else cropped
    content_type = _guess_content_type(save_format)
    cropped.save(buffer, format=save_format, quality=95)

    stored = store_bytes(
        bucket,
        data=buffer.getvalue(),
        content_type=content_type,
        prefix="normalized",
    )
    normalized_url = stored.url
    return normalized_url, warnings


def normalize_instagram_images(media: List[dict]) -> Tuple[List[dict], List[str]]:
    return normalize_images_for_ratio(media, _INSTAGRAM_MIN_RATIO, _INSTAGRAM_MAX_RATIO)


def normalize_images_for_ratio(
    media: List[dict],
    min_ratio: float,
    max_ratio: float,
) -> Tuple[List[dict], List[str]]:
    warnings: List[str] = []
    normalized_items: List[dict] = []
    for item in media:
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            warnings.append("adapter dropped media with missing url")
            continue
        normalized_url, extra_warnings = normalize_image_for_ratio(url.strip(), min_ratio, max_ratio)
        warnings.extend(extra_warnings)
        item_copy = dict(item)
        item_copy["url"] = normalized_url
        normalized_items.append(item_copy)
    return normalized_items, warnings


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


__all__ = [
    "normalize_instagram_images",
    "normalize_images_for_ratio",
    "normalize_image_for_ratio",
]
