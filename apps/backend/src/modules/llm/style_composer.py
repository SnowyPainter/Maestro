from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import yaml

from apps.backend.src.modules.accounts.models import Persona
from apps.backend.src.modules.common.enums import PlatformKind


logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).resolve().parent / "config" / "style_layers.yaml"


@lru_cache(maxsize=1)
def _load_style_config() -> Dict[str, Any]:
    if not _CONFIG_PATH.exists():
        logger.warning("Style composer config missing: %s", _CONFIG_PATH)
        return {}
    try:
        with _CONFIG_PATH.open("r", encoding="utf-8") as handle:
            raw = yaml.safe_load(handle) or {}
    except yaml.YAMLError as exc:
        logger.error("Failed to parse style composer config: %s", exc)
        return {}
    except OSError as exc:
        logger.error("Failed to read style composer config: %s", exc)
        return {}
    return raw


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = dict(base)
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


class StyleComposer:
    """Compose style-conditioned prompts from Persona and platform context."""

    def __init__(
        self,
        persona: Optional[Persona],
        platform: Optional[PlatformKind] = None,
        *,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.persona = persona
        self.platform = platform or PlatformKind.THREADS
        self._config = config or _load_style_config()
        self._language_code = self._infer_language_code()
        self._language_key = self._resolve_language_key(self._language_code)
        self._language_config = self._resolve_language_config()
        self._language_label = self._resolve_language_label()

    def compose(self, base_prompt: str) -> str:
        if not self._config:
            return self._fallback_compose(base_prompt)

        sections: List[str] = []
        platform_layer = self._platform_layer()
        if platform_layer:
            sections.append(platform_layer.strip())

        persona_layer = self._persona_layer()
        if persona_layer:
            sections.append(persona_layer.strip())

        sections.append(base_prompt.strip())
        return "\n\n".join(filter(None, sections))

    # --------------------------------------------------------------------- #
    # Helpers using structured config
    # --------------------------------------------------------------------- #

    def _platform_layer(self) -> str:
        platforms = self._config.get("platforms", {})
        if not isinstance(platforms, dict):
            return ""

        platform_key = self.platform.value if isinstance(self.platform, PlatformKind) else str(self.platform or "")
        platform_key = (platform_key or "default").lower()

        layer = ""
        if platform_key in platforms:
            layer = self._select_language_variant(platforms[platform_key])
        if not layer:
            default_mapping = platforms.get("default")
            layer = self._select_language_variant(default_mapping)
        return layer.strip()

    def _persona_layer(self) -> str:
        lines: List[str] = []
        language_instruction = self._language_config.get("language_instruction")
        if language_instruction:
            formatted = language_instruction.format(language_label=self._language_label)
            lines.append(formatted.strip())

        if not self.persona:
            instruction = self._language_config.get("no_persona")
            if instruction:
                lines.insert(0, instruction.strip())
            lines.extend(self._few_shot_lines())
            return "\n".join(filter(None, lines)).strip()

        display_name = (self.persona.name or "").strip() or "the persona"
        intro = self._language_config.get("persona_intro")
        if intro:
            lines.insert(0, intro.format(display_name=display_name).strip())

        tone_instruction = self._compose_tone_instruction()
        if tone_instruction:
            lines.append(tone_instruction.strip())

        name_overrides = self._compose_name_overrides()
        lines.extend(name_overrides)

        persona_field_lines = self._compose_persona_fields()
        lines.extend(persona_field_lines)

        lines.extend(self._few_shot_lines())

        return "\n".join(filter(None, lines)).strip()

    def _few_shot_lines(self) -> List[str]:
        samples = self._resolve_few_shots()
        if not samples:
            return []
        header = f"Example outputs in {self._language_label}:"
        bullets = [f"- {sample}" for sample in samples]
        return [header, *bullets]

    def _resolve_few_shots(self) -> List[str]:
        config = self._config.get("few_shots")
        if not isinstance(config, dict):
            return []

        platform_key = self.platform.value if isinstance(self.platform, PlatformKind) else str(self.platform or "")
        platform_key = (platform_key or "default").lower()

        platform_candidates: List[str] = []
        for candidate in (platform_key, "default"):
            if candidate and candidate not in platform_candidates:
                platform_candidates.append(candidate)

        language_candidates: List[str] = []
        for candidate in (self._language_code, self._language_key, "default"):
            if candidate and candidate not in language_candidates:
                language_candidates.append(candidate)

        for plat_candidate in platform_candidates:
            bucket = config.get(plat_candidate)
            if not isinstance(bucket, dict):
                continue
            for lang_candidate in language_candidates:
                variant = bucket.get(lang_candidate)
                samples = self._normalize_few_shots(variant)
                if samples:
                    return samples
        return []

    def _normalize_few_shots(self, raw: Any) -> List[str]:
        if raw is None:
            return []
        if isinstance(raw, str):
            snippet = raw.strip()
            return [snippet] if snippet else []
        if isinstance(raw, Iterable):
            samples: List[str] = []
            for item in raw:
                if isinstance(item, str):
                    snippet = item.strip()
                else:
                    snippet = str(item).strip()
                if snippet:
                    samples.append(snippet)
            return samples
        snippet = str(raw).strip()
        return [snippet] if snippet else []

    def _compose_tone_instruction(self) -> str:
        tone_value = (self.persona.tone or "").strip()
        aliases = self._language_config.get("tone_aliases", {})
        alias_map = {str(key).casefold(): str(value).strip().lower() for key, value in (aliases or {}).items()}

        tone_key = alias_map.get(tone_value.casefold(), tone_value.lower()) if tone_value else ""
        tone_label = tone_key or tone_value or self._language_config.get("unknown_tone_label", "balanced tone")

        tone_overrides = self._language_config.get("tone_overrides", {}) or {}
        if tone_key and tone_key in tone_overrides:
            return str(tone_overrides[tone_key])

        fallback = self._language_config.get("fallback_tone")
        if fallback:
            return fallback.format(tone_label=tone_label)
        return ""

    def _compose_name_overrides(self) -> List[str]:
        if not self.persona or not self.persona.name:
            return []
        name_lower = self.persona.name.lower()
        overrides = self._language_config.get("name_based_overrides", {}) or {}
        collected: List[str] = []
        for override in overrides.values():
            keywords = override.get("keywords")
            if not keywords:
                continue
            try:
                matches = any(str(keyword).lower() in name_lower for keyword in keywords)
            except Exception:  # pragma: no cover - defensive
                matches = False
            if matches:
                instruction = override.get("instruction")
                if instruction:
                    collected.append(str(instruction).strip())
        return collected

    def _compose_persona_fields(self) -> List[str]:
        if not self.persona:
            return []
        field_config = self._language_config.get("persona_fields", {}) or {}
        lines: List[str] = []
        for field, config in field_config.items():
            template = config.get("template")
            if not template:
                continue
            preserve = bool(config.get("preserve_newlines"))
            joiner = config.get("joiner")
            value = getattr(self.persona, field, None)
            formatted = self._stringify_value(value, joiner=joiner, preserve_newlines=preserve)
            if not formatted:
                continue
            try:
                rendered = template.format(value=formatted)
            except Exception:  # pragma: no cover - defensive
                logger.debug("Failed to format persona field '%s' with value '%s'", field, formatted)
                continue
            lines.append(rendered.strip())
        return lines

    def _select_language_variant(self, mapping: Any) -> str:
        if isinstance(mapping, str):
            return mapping
        if not isinstance(mapping, dict):
            return ""
        variant = mapping.get(self._language_key)
        if isinstance(variant, str):
            return variant
        default_variant = mapping.get("default")
        return default_variant if isinstance(default_variant, str) else ""

    def _resolve_language_config(self) -> Dict[str, Any]:
        languages = self._config.get("languages", {}) or {}
        default_config = languages.get("default", {})
        target_config = languages.get(self._language_key, {})
        if isinstance(default_config, dict) and isinstance(target_config, dict):
            merged = _deep_merge(default_config, target_config)
        elif isinstance(target_config, dict):
            merged = target_config
        elif isinstance(default_config, dict):
            merged = default_config
        else:
            merged = {}
        return merged

    def _resolve_language_key(self, code: str) -> str:
        aliases = self._config.get("language_aliases", {}) or {}
        alias_map = {str(k).lower(): str(v).strip().lower() for k, v in aliases.items()}
        lowered = code.lower()
        if lowered in alias_map:
            return alias_map[lowered]
        return alias_map.get("default", "default")

    def _resolve_language_label(self) -> str:
        names = self._language_config.get("language_names", {}) or {}
        if isinstance(names, dict):
            label = names.get(self._language_code) or names.get(self._language_key) or names.get("default")
            if isinstance(label, str) and label.strip():
                return label.strip()
        return self._language_code

    def _infer_language_code(self) -> str:
        if self.persona and getattr(self.persona, "language", None):
            return str(self.persona.language).lower()
        return "en"

    def _stringify_value(
        self,
        value: Any,
        *,
        joiner: Optional[str] = None,
        preserve_newlines: bool = False,
    ) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                return None
            if preserve_newlines:
                return cleaned
            return " ".join(cleaned.split())
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, dict):
            dumped = yaml.safe_dump(value, allow_unicode=True, sort_keys=False).strip()
            return dumped or None
        if isinstance(value, (list, tuple, set)):
            parts: List[str] = []
            for item in value:
                sub = self._stringify_value(item, preserve_newlines=preserve_newlines)
                if sub:
                    parts.append(sub)
            if not parts:
                return None
            return (joiner or ", ").join(parts)
        return str(value).strip() or None

    # --------------------------------------------------------------------- #
    # Legacy fallbacks (no config available)
    # --------------------------------------------------------------------- #

    def _fallback_compose(self, base_prompt: str) -> str:
        persona_layer = self._fallback_persona_layer()
        platform_layer = self._fallback_platform_layer()
        return "\n\n".join(filter(None, [platform_layer, persona_layer, base_prompt.strip()]))

    def _fallback_persona_layer(self) -> str:
        if not self.persona:
            return "You write in a neutral professional tone."

        tone = (self.persona.tone or "").lower()
        name = (self.persona.name or "").lower()

        if "prof" in name or tone == "formal":
            return (
                "You are a university professor. Speak logically and politely. "
                "Use examples and end sentences with 'It seems...' or 'In my opinion...'"
            )
        if "engineer" in name or tone == "technical":
            return (
                "You are a technical engineer. Use concise and factual English. "
                "Describe mechanisms and use analogies, like 'This is like wiring a PCB...'"
            )
        if "teacher" in name or tone == "educational":
            return "You are a kind teacher. Explain clearly, with warm and encouraging tone."
        if "founder" in name or tone == "motivational":
            return (
                "You are a startup founder. Speak confidently and persuasively. "
                "Short sentences, strong verbs, motivational phrases."
            )
        return (
            f"You write in a {tone or 'balanced'} tone, "
            "fitting the persona's style guide if provided."
        )

    def _fallback_platform_layer(self) -> str:
        if self.platform == PlatformKind.THREADS:
            return (
                "You are writing for Threads. "
                "Use short, conversational sentences with casual expressions and emojis "
                "like 'lol', 'can't believe this 🤣', or 'tbh'."
            )
        if self.platform == PlatformKind.INSTAGRAM:
            return (
                "You are writing for Instagram. "
                "Use complete, positive sentences and end with friendly emojis or hashtags "
                "like #motivation #dailywork."
            )
        return "You are writing for a social media post in a friendly, approachable tone."
