"""
Platform compilers for DraftIR -> platform-ready payloads.

Contract (all compilers):
    compile_<platform>(ir: dict) -> tuple[capt ion: str, rendered_blocks: dict|None, metrics: dict, errors: list[str], warnings: list[str]]

Notes:
- These compilers are intentionally lightweight: they mostly concatenate text blocks
  and pass media blocks through as-is, while performing *non-destructive* validation.
- Validation emits warnings/errors but does not mutate the user's content.
- Keep platform rules conservative and easy to tweak.

Dependencies: standard library only.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Optional
import re

# -----------------------------
# Helpers
# -----------------------------

URL_RE = re.compile(r"https?://[\w\-._~:/?#\[\]@!$&'()*+,;=%]+", re.IGNORECASE)
HASHTAG_RE = re.compile(r"(?<!\w)#([\w\d_]+)")  # #tag with word boundary


def _join_caption(ir: Dict[str, Any]) -> str:
    blocks = ir.get("blocks", []) or []
    pieces: List[str] = []
    for b in blocks:
        if (b or {}).get("type") == "text":
            md = ((b.get("props") or {}).get("markdown") or "").strip()
            if md:
                pieces.append(md)
    return "\n\n".join(pieces)


def _extract_media(ir: Dict[str, Any]) -> List[Dict[str, Any]]:
    blocks = ir.get("blocks", []) or []
    out: List[Dict[str, Any]] = []
    for b in blocks:
        t = (b or {}).get("type")
        if t in ("image", "video"):
            props = (b.get("props") or {}).copy()
            # Normalize ratio/crop field name
            ratio = props.get("ratio") or props.get("crop")
            if ratio:
                props["ratio"] = ratio
            out.append(props)
    return out


def _count_line_breaks(text: str) -> int:
    if not text:
        return 0
    return text.count("\n") + 1


def _metrics(caption: str, media: List[Dict[str, Any]]) -> Dict[str, Any]:
    hashtags = HASHTAG_RE.findall(caption or "")
    urls = URL_RE.findall(caption or "")
    return {
        "char_count": len(caption or ""),
        "line_breaks": _count_line_breaks(caption),
        "hashtag_count": len(hashtags),
        "hashtags": hashtags,
        "url_count": len(urls),
        "media_count": len(media),
        "media_ratios": [m.get("ratio") for m in media if m.get("ratio")],
        "media_kinds": [m.get("kind") for m in media if m.get("kind")],
    }


# -----------------------------
# Generic validation
# -----------------------------

class Rule:
    def __init__(
        self,
        *,
        name: str,
        max_chars: Optional[int] = None,
        max_hashtags: Optional[int] = None,
        allow_links: bool = True,
        caption_linebreak_limit: Optional[int] = None,
        allowed_ratios: Optional[List[str]] = None,
        media_limit: Optional[int] = None,
    ) -> None:
        self.name = name
        self.max_chars = max_chars
        self.max_hashtags = max_hashtags
        self.allow_links = allow_links
        self.caption_linebreak_limit = caption_linebreak_limit
        self.allowed_ratios = allowed_ratios
        self.media_limit = media_limit


THREADS_RULE = Rule(
    name="threads",
    max_chars=500,            # recommended
    allow_links=True,
)

INSTAGRAM_RULE = Rule(
    name="instagram",
    max_chars=2200,
    max_hashtags=30,
    allow_links=False,        # links not clickable in caption
    caption_linebreak_limit=25,
    allowed_ratios=["1:1", "4:5", "9:16"],
    media_limit=10,           # carousel max (soft check)
)

X_RULE = Rule(
    name="x",
    max_chars=280,            # baseline; longer posts may exist for paid tiers
    allow_links=True,
    media_limit=4,
)

BLOG_RULE = Rule(
    name="blog",
    # No strict caps by default
    allow_links=True,
)


def _validate_against(rule: Rule, cap: str, media: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    if rule.max_chars is not None and len(cap) > rule.max_chars:
        # Prefer warning to avoid destructive truncation
        warnings.append(f"Caption length {len(cap)} exceeds {rule.max_chars} for {rule.name}.")

    if rule.max_hashtags is not None:
        count = len(HASHTAG_RE.findall(cap))
        if count > rule.max_hashtags:
            warnings.append(f"Hashtags {count} exceeds {rule.max_hashtags} for {rule.name}.")

    if not rule.allow_links:
        if URL_RE.search(cap or ""):
            warnings.append(f"Links in caption are not clickable on {rule.name}.")

    if rule.caption_linebreak_limit is not None:
        lb = _count_line_breaks(cap)
        if lb > rule.caption_linebreak_limit:
            warnings.append(
                f"Line breaks {lb} exceed {rule.caption_linebreak_limit} for {rule.name}."
            )

    if rule.allowed_ratios:
        bad = [m.get("ratio") for m in media if m.get("ratio") and m.get("ratio") not in rule.allowed_ratios]
        if bad:
            warnings.append(
                f"Unsupported media ratios for {rule.name}: {sorted(set(bad))}; allowed: {rule.allowed_ratios}."
            )

    if rule.media_limit is not None and len(media) > rule.media_limit:
        warnings.append(
            f"Media count {len(media)} exceeds {rule.media_limit} for {rule.name}."
        )

    return errors, warnings


# -----------------------------
# Compilers (non-destructive)
# -----------------------------

CompilerResult = Tuple[str, Optional[Dict[str, Any]], Dict[str, Any], List[str], List[str]]


def compile_threads(ir: Dict[str, Any]) -> CompilerResult:
    caption = _join_caption(ir)
    media = _extract_media(ir)
    metrics = _metrics(caption, media)
    errors, warnings = _validate_against(THREADS_RULE, caption, media)
    rendered = {"media": media} if media else None
    return caption, rendered, metrics, errors, warnings


def compile_instagram(ir: Dict[str, Any]) -> CompilerResult:
    caption = _join_caption(ir)
    media = _extract_media(ir)
    metrics = _metrics(caption, media)
    errors, warnings = _validate_against(INSTAGRAM_RULE, caption, media)
    rendered = {"media": media} if media else None
    return caption, rendered, metrics, errors, warnings


def compile_x(ir: Dict[str, Any]) -> CompilerResult:
    caption = _join_caption(ir)
    media = _extract_media(ir)
    metrics = _metrics(caption, media)
    errors, warnings = _validate_against(X_RULE, caption, media)
    # For X, we prefer single post; multi-image up to 4 allowed. No destructive change.
    rendered = {"media": media[: X_RULE.media_limit] if X_RULE.media_limit else media} if media else None
    if X_RULE.media_limit and len(media) > X_RULE.media_limit:
        warnings.append(f"Only first {X_RULE.media_limit} media will be used on X.")
    return caption, rendered, metrics, errors, warnings


def compile_blog(ir: Dict[str, Any]) -> CompilerResult:
    """
    Minimal blog compiler: keep markdown as-is.
    - Output rendered_blocks with body_markdown and attached media list.
    - No strict validations by default.
    """
    body = _join_caption(ir)  # treat as body markdown
    media = _extract_media(ir)
    metrics = _metrics(body, media)
    errors, warnings = _validate_against(BLOG_RULE, body, media)
    rendered = {"body_markdown": body, "media": media}  # consumers may render to HTML later
    return body, rendered, metrics, errors, warnings


# -----------------------------
# Dispatcher / Registry
# -----------------------------

REGISTRY = {
    "threads": compile_threads,
    "instagram": compile_instagram,
    "x": compile_x,
    "blog": compile_blog,
}


def compile_for_platform(ir: Dict[str, Any], platform: str) -> CompilerResult:
    fn = REGISTRY.get(platform.lower())
    if not fn:
        raise ValueError(f"Compiler not found for platform: {platform}")
    return fn(ir)


# -----------------------------
# Example usage (to be wired in service layer):
# -----------------------------
# from src.modules.drafts.compilers import compile_for_platform
# caption, rendered, metrics, errors, warnings = compile_for_platform(draft.ir, platform.value)
