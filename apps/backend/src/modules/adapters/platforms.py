# apps/backend/src/modules/adapters/platforms.py
from __future__ import annotations

import copy
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from apps.backend.src.modules.common.enums import VariantStatus
from apps.backend.src.modules.adapters.schemas import (
    CompileResult,
    RenderedMediaItem,
    RenderedVariantBlocks,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _extract_blocks(ir: Dict[str, Any]) -> Tuple[str, List[RenderedMediaItem], List[str]]:
    warnings: List[str] = []
    texts: List[str] = []
    media: List[RenderedMediaItem] = []

    for block in ir.get("blocks", []) or []:
        btype = (block or {}).get("type")
        props = (block or {}).get("props") or {}
        if btype == "text":
            markdown = props.get("markdown", "")
            if isinstance(markdown, str):
                markdown = markdown.strip()
                if markdown:
                    texts.append(markdown)
            else:
                warnings.append("text block markdown must be a string")
        elif btype in {"image", "video"}:
            url = props.get("url")
            if not url:
                warnings.append(f"{btype} block missing url")
                continue
            media_item: RenderedMediaItem = {
                "type": btype,
                "url": url,
            }
            alt = props.get("alt")
            if alt:
                media_item["alt"] = alt
            caption = props.get("caption")
            if caption:
                media_item["caption"] = caption
            ratio = props.get("ratio") or props.get("crop")
            if ratio:
                media_item["ratio"] = ratio
            media.append(media_item)
        else:
            warnings.append(f"unknown block type: {btype}")

    caption_source = "\n\n".join(texts)
    return caption_source, media, warnings


def _apply_linebreak_rule(text: str, rule: Optional[str]) -> str:
    if not text or not rule:
        return text
    if rule == "single-to-double":
        return re.sub(r"(?:\r?\n){1}", "\n\n", text)
    return text


def _truncate(text: str, limit: Optional[int]) -> Tuple[str, Optional[str]]:
    if limit is None or len(text) <= limit:
        return text, None
    truncated = text[:limit]
    warning = f"Caption truncated to {limit} characters (original {len(text)})."
    return truncated, warning


def _limit_media(
    media: Sequence[RenderedMediaItem],
    max_count: Optional[int],
    allowed_types: Iterable[str],
) -> Tuple[List[RenderedMediaItem], List[str]]:
    warnings: List[str] = []
    allowed = tuple(allowed_types)

    filtered = [m for m in media if (m.get("type") in allowed) or not allowed]
    if allowed and len(filtered) < len(media):
        warnings.append(
            f"media filtered by type: allowed {allowed}, dropped {len(media) - len(filtered)} item(s)"
        )
    if max_count is not None and len(filtered) > max_count:
        warnings.append(f"media limited to {max_count} item(s) for platform policy")
        filtered = filtered[:max_count]
    return filtered, warnings


def _build_metrics(caption: str, media: List[RenderedMediaItem]) -> Dict[str, Any]:
    return {
        "char_count": len(caption or ""),
        "line_breaks": caption.count("\n") if caption else 0,
        "media_count": len(media),
    }


def _merge_options(*options: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for opt in options:
        if not isinstance(opt, dict):
            continue
        for key, value in opt.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = {**merged[key], **value}
            else:
                merged[key] = copy.deepcopy(value)
    return merged


def _check_banned_words(caption: str, banned_words: Iterable[str]) -> List[str]:
    if not caption:
        return []
    warnings: List[str] = []
    lowered = caption.lower()
    seen: set[str] = set()
    for word in banned_words:
        if not word:
            continue
        needle = word.lower()
        if needle in seen:
            continue
        seen.add(needle)
        if re.search(rf"\b{re.escape(needle)}\b", lowered):
            warnings.append(f"banned word detected: '{word}'")
    return warnings


def _mk_compile_result(
    *,
    status: VariantStatus,
    caption: Optional[str],
    blocks: Optional[RenderedVariantBlocks],
    warnings: List[str],
    errors: List[str],
    compiler_version: int,
    ir_revision: int,
) -> CompileResult:
    effective_status = status if not errors else VariantStatus.INVALID
    metrics = blocks.get("metrics") if blocks else None
    return CompileResult(
        status=effective_status,
        rendered_caption=caption,
        rendered_blocks=blocks,
        metrics=metrics,
        errors=errors,
        warnings=warnings,
        compiler_version=compiler_version,
        compiled_at=_utcnow(),
        ir_revision_compiled=ir_revision,
    )


__all__ = [
    "_mk_compile_result",
    "_extract_blocks",
    "_apply_linebreak_rule",
    "_truncate",
    "_limit_media",
    "_build_metrics",
    "_merge_options",
    "_check_banned_words",
]
