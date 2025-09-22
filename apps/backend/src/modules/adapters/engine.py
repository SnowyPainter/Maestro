from __future__ import annotations

import logging
import re
import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from apps.backend.src.modules.adapters.platforms import (
    _apply_linebreak_rule,
    _build_metrics,
    _check_banned_words,
    _extract_blocks,
    _limit_media,
    _merge_options,
    _mk_compile_result,
    _truncate,
)
from apps.backend.src.modules.adapters.core.types import CompileResult, RenderedVariantBlocks
from apps.backend.src.modules.common.enums import PlatformKind, VariantStatus
from apps.backend.src.modules.injectors.base import InjectedContent
from apps.backend.src.modules.injectors.platform_policy import ComposePolicy, PLATFORM_POLICIES
from apps.backend.src.services.embeddings import embed_texts, embed_texts_sync

logger = logging.getLogger(__name__)


@dataclass
class StyleScoringConfig:
    enabled: bool = True
    warn_below: float = 0.6
    metric_key: str = "style_alignment"
    option_key: str = "style_alignment"


class CompileState:
    """Mutable container shared across hook phases."""

    def __init__(
        self,
        *,
        payload: InjectedContent,
        policy: Dict[str, Any],
        persona_directives: Dict[str, Any],
        caption_source: str,
        caption: str,
        media: List[Dict[str, Any]],
        warnings: List[str],
        errors: List[str],
        metrics: Dict[str, Any],
        options: Dict[str, Any],
        applied_persona: Dict[str, Any],
    ) -> None:
        self.payload = payload
        self.policy = policy
        self.persona_directives = persona_directives
        self.caption_source = caption_source
        self.caption = caption
        self.media = media
        self.warnings = warnings
        self.errors = errors
        self.metrics = metrics
        self.options = options
        self.applied_persona = applied_persona

    def merge_options(self, extra: Optional[Dict[str, Any]]) -> None:
        if not extra:
            return
        self.options = _merge_options(self.options, extra)


CompileHook = Callable[[CompileState], None]


@dataclass(frozen=True)
class CompileSpec:
    platform: PlatformKind
    compiler_version: int
    policy: ComposePolicy
    hooks: Sequence[CompileHook] = field(default_factory=tuple)
    style_scoring: Optional[StyleScoringConfig] = StyleScoringConfig()


async def compile_with_spec(payload: InjectedContent, spec: CompileSpec) -> CompileResult:
    policy_dict = spec.policy.as_dict()
    policy: Dict[str, Any] = {
        **policy_dict,
        **(payload.policy or {}),
    }
    allowed_media_cfg = policy.get("allowed_media") or ()
    if isinstance(allowed_media_cfg, (list, tuple)):
        allowed_media = tuple(allowed_media_cfg)
        policy["allowed_media"] = list(allowed_media)
    else:
        allowed_media = (allowed_media_cfg,) if allowed_media_cfg else ()
        if allowed_media:
            policy["allowed_media"] = list(allowed_media)
    max_media = policy.get("max_media")
    char_limit = policy.get("char_limit")
    linebreak_rule = policy.get("linebreak_rule")

    warnings: List[str] = list(payload.warnings)
    errors: List[str] = list(payload.errors)

    caption_source, media_source, block_warnings = _extract_blocks(payload.ir)
    if block_warnings:
        warnings.extend(block_warnings)

    caption = _apply_linebreak_rule(caption_source, linebreak_rule)

    persona_directives = dict(payload.persona_directives or {})
    caption, applied_persona, persona_warnings = _apply_persona_rules(
        caption,
        persona_directives,
    )
    if persona_warnings:
        warnings.extend(persona_warnings)

    caption, trunc_warning = _truncate(caption, char_limit)
    if trunc_warning:
        warnings.append(trunc_warning)

    media_final, media_warnings = _limit_media(media_source, max_media, allowed_media)
    if media_warnings:
        warnings.extend(media_warnings)

    banned_words = persona_directives.get("banned_words") or []
    if banned_words:
        warnings.extend(_check_banned_words(caption, banned_words))

    metrics = _build_metrics(caption, media_final)
    options = _merge_options(payload.options, {"policy": policy})

    if applied_persona:
        options = _merge_options(options, {"compile": {"persona": applied_persona}})

    state = CompileState(
        payload=payload,
        policy=policy,
        persona_directives=persona_directives,
        caption_source=caption_source,
        caption=caption,
        media=media_final,
        warnings=warnings,
        errors=errors,
        metrics=metrics,
        options=options,
        applied_persona=applied_persona,
    )

    for hook in spec.hooks:
        try:
            hook(state)
        except Exception:  # noqa: BLE001
            logger.exception("Compile hook failed for %s", spec.platform)
            state.warnings.append("internal compile hook failure")

    await _maybe_score_style(state, spec.style_scoring)

    rendered_blocks: RenderedVariantBlocks = {
        "media": state.media,
        "options": state.options,
        "metrics": state.metrics,
    }

    status = VariantStatus.INVALID if state.errors else VariantStatus.VALID

    return _mk_compile_result(
        status=status,
        caption=state.caption,
        blocks=rendered_blocks,
        warnings=state.warnings,
        errors=state.errors,
        compiler_version=spec.compiler_version,
        ir_revision=payload.ir_revision,
    )


def _apply_persona_rules(
    caption: str,
    directives: Dict[str, Any],
) -> Tuple[str, Dict[str, Any], List[str]]:
    warnings: List[str] = []
    applied: Dict[str, Any] = {}

    caption, replace_applied, replace_warnings = _apply_replace_map(caption, directives)
    if replace_warnings:
        warnings.extend(replace_warnings)
    if replace_applied:
        applied["replace_map"] = replace_applied

    media_prefs = directives.get("media_prefs")
    if isinstance(media_prefs, dict) and media_prefs:
        applied["media_prefs"] = {
            key: value
            for key, value in media_prefs.items()
            if value not in (None, "")
        }

    caption, link_policy_summary, link_policy_warnings = _apply_link_policy(
        caption,
        directives.get("link_policy"),
    )
    if link_policy_summary:
        applied["link_policy"] = link_policy_summary
    if link_policy_warnings:
        warnings.extend(link_policy_warnings)

    hashtag_info = _apply_hashtag_rules(caption, directives)
    caption = hashtag_info.caption
    if hashtag_info.applied or hashtag_info.skipped:
        applied["hashtags"] = {
            "appended": hashtag_info.applied,
            "skipped": hashtag_info.skipped,
        }
    if hashtag_info.skipped:
        warnings.append(
            "default hashtags skipped due to persona rules: "
            + ", ".join(sorted(hashtag_info.skipped))
        )
    if hashtag_info.warnings:
        warnings.extend(hashtag_info.warnings)

    return caption, applied, warnings


@dataclass
class _HashtagResult:
    caption: str
    applied: List[str]
    skipped: List[str]
    warnings: List[str]


_HASHTAG_PATTERN = re.compile(r"#(?P<tag>[A-Za-z0-9_]+)")
_URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)


def _apply_replace_map(
    caption: str,
    directives: Dict[str, Any],
) -> Tuple[str, Dict[str, Any], List[str]]:
    extras = directives.get("extras")
    if not isinstance(extras, dict):
        return caption, {}, []

    replace_map = extras.get("replace_map")
    if not isinstance(replace_map, dict):
        return caption, {}, []

    applied_pairs: List[Dict[str, str]] = []
    skipped: List[str] = []
    warnings: List[str] = []

    text = caption or ""
    for raw_key, raw_value in replace_map.items():
        if not isinstance(raw_key, str) or not raw_key:
            warnings.append("replace_map keys must be non-empty strings")
            continue
        replacement = "" if raw_value is None else str(raw_value)
        if raw_key in text:
            text = text.replace(raw_key, replacement)
            applied_pairs.append({"source": raw_key, "target": replacement})
        else:
            skipped.append(raw_key)

    result: Dict[str, Any] = {}
    if applied_pairs:
        result["applied"] = applied_pairs
    if skipped:
        result["skipped"] = skipped

    return text, result, warnings


def _apply_hashtag_rules(caption: str, directives: Dict[str, Any]) -> _HashtagResult:
    rules = directives.get("hashtag_rules") or {}
    default_tags = directives.get("default_hashtags") or []
    if not default_tags and not rules.get("pinned"):
        return _HashtagResult(caption=caption, applied=[], skipped=[], warnings=[])

    casing = rules.get("casing", "original")
    max_count = rules.get("max_count")
    pinned = rules.get("pinned") or []

    existing = {
        match.group(0).lower()
        for match in _HASHTAG_PATTERN.finditer(caption or "")
    }

    applied: List[str] = []
    skipped: List[str] = []
    warnings: List[str] = []

    def _normalize(tag: str) -> Optional[str]:
        tag = (tag or "").strip()
        if not tag:
            return None
        if not tag.startswith("#"):
            tag = f"#{tag}"
        if casing == "lower":
            tag = tag.lower()
        elif casing == "upper":
            tag = tag.upper()
        return tag

    def _append(tag: str) -> None:
        normalized = _normalize(tag)
        if not normalized:
            return
        key = normalized.lower()
        nonlocal max_count
        if key in existing or normalized in applied:
            return
        if isinstance(max_count, int):
            current = len(existing) + len(applied)
            if current >= max_count:
                skipped.append(normalized)
                return
        applied.append(normalized)

    for tag in pinned:
        _append(tag)
    for tag in default_tags:
        _append(tag)

    if applied:
        caption = _append_hashtags_to_caption(caption, applied)

    return _HashtagResult(caption=caption, applied=applied, skipped=skipped, warnings=warnings)


def _append_hashtags_to_caption(caption: str, tags: Iterable[str]) -> str:
    snippet = " ".join(tag for tag in tags if tag)
    if not snippet:
        return caption
    caption = caption.rstrip()
    if caption:
        if not caption.endswith("\n\n"):
            if caption.endswith("\n"):
                caption += "\n"
            else:
                caption += "\n\n"
        caption += snippet
    else:
        caption = snippet
    return caption


async def _maybe_score_style(state: CompileState, config: Optional[StyleScoringConfig]) -> None:
    if not config or not config.enabled:
        return
    caption = state.caption or ""
    directives = state.persona_directives
    style_ref = directives.get("style_guide")
    tone = directives.get("tone")
    if not caption or not (style_ref or tone):
        return

    references: List[str] = []
    if style_ref:
        references.append(style_ref)
    if tone:
        references.append(f"Tone: {tone}")

    try:
        vectors = await _fetch_style_embeddings([caption, *references])
    except Exception:  # noqa: BLE001
        logger.exception("Style scoring failed for platform %s", state.payload.platform)
        state.warnings.append("style scoring unavailable (embedding error)")
        return

    if len(vectors) < 2:
        return

    caption_vec = vectors[0]
    ref_vecs = vectors[1:]

    scores = [_dot(caption_vec, ref_vec) for ref_vec in ref_vecs]
    if not scores:
        return
    score = float(sum(scores) / len(scores))
    state.metrics[config.metric_key] = score
    state.merge_options({
        "compile": {config.option_key: score},
    })
    if score < config.warn_below:
        state.warnings.append(
            f"style alignment score {score:.2f} below threshold {config.warn_below:.2f}"
        )


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b):
        raise ValueError("Embedding vectors must have same length")
    return float(sum(x * y for x, y in zip(a, b)))


async def _fetch_style_embeddings(texts: List[str]) -> List[List[float]]:
    try:
        return await embed_texts(texts)
    except RuntimeError as exc:
        if "Event loop is closed" not in str(exc):
            raise
        return await asyncio.to_thread(embed_texts_sync, texts)


def _apply_link_policy(
    caption: str,
    link_policy: Any,
) -> Tuple[str, Dict[str, Any], List[str]]:
    if not isinstance(link_policy, dict) or not link_policy:
        return caption, {}, []

    summary: Dict[str, Any] = {}
    warnings: List[str] = []

    link_in_bio = link_policy.get("link_in_bio")
    if isinstance(link_in_bio, str) and link_in_bio.strip():
        summary["link_in_bio"] = link_in_bio.strip()

    utm = link_policy.get("utm")
    if isinstance(utm, dict):
        clean_utm = {
            str(key): str(value)
            for key, value in utm.items()
            if key not in (None, "") and value not in (None, "")
        }
        if clean_utm:
            summary["utm"] = clean_utm

    inline_cfg = link_policy.get("inline_link")
    strategy = None
    replacement_text = None
    if isinstance(inline_cfg, dict):
        raw_strategy = inline_cfg.get("strategy")
        if raw_strategy in {"keep", "remove", "replace"}:
            strategy = raw_strategy
        replacement = inline_cfg.get("replacement_text")
        if isinstance(replacement, str):
            replacement_text = replacement

    text = caption or ""
    urls = _URL_PATTERN.findall(text)
    processed_urls: List[str] = []

    if strategy in {"remove", "replace"} and urls:
        for url in urls:
            if strategy == "replace":
                replacement = replacement_text or ""
                if not replacement:
                    warnings.append("inline link strategy 'replace' missing replacement text; removing URLs instead")
                    text = text.replace(url, "")
                else:
                    text = text.replace(url, replacement)
            else:
                text = text.replace(url, "")
            processed_urls.append(url)

        # cleanup leftover spaces without collapsing intentional line breaks
        text = re.sub(r"[ \t]{2,}", " ", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = text.strip()

    if summary.get("link_in_bio") and urls and strategy in (None, "keep"):
        warnings.append(
            "link policy requests link-in-bio, but caption still contains direct URL"
        )

    inline_summary: Dict[str, Any] = {}
    if strategy:
        inline_summary["strategy"] = strategy
        if strategy == "replace" and replacement_text:
            inline_summary["replacement_text"] = replacement_text
    if processed_urls:
        inline_summary["processed_urls"] = processed_urls
    if inline_summary:
        summary["inline_link"] = inline_summary

    return text, summary, warnings


def get_compile_spec(platform: PlatformKind, compiler_version: int, hooks: Sequence[CompileHook] | None = None) -> CompileSpec:
    policy = PLATFORM_POLICIES.get(platform)
    if not policy:
        raise KeyError(f"No compose policy registered for platform {platform}")
    return CompileSpec(
        platform=platform,
        compiler_version=compiler_version,
        policy=policy,
        hooks=tuple(hooks or ()),
    )


__all__ = [
    "CompileSpec",
    "CompileHook",
    "CompileState",
    "StyleScoringConfig",
    "compile_with_spec",
    "get_compile_spec",
]
