from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from apps.backend.src.modules.accounts.schemas import PersonaBase

from .context import Injector, InjectorContext


class PersonaInjector(Injector):
    name = "persona"

    def apply(self, context: InjectorContext) -> None:
        if not context.persona:
            return
        persona_dict = _persona_to_dict(context.persona)
        directives = _persona_directives(persona_dict)
        if not directives:
            return
        context.persona_directives.update(directives)

        existing = context.options.get("persona")
        merged = dict(existing) if isinstance(existing, dict) else {}
        merged.update(directives)
        context.options["persona"] = merged


def _persona_to_dict(persona: Any) -> Dict[str, Any]:
    if isinstance(persona, PersonaBase):
        return persona.model_dump(exclude_none=True)
    if isinstance(persona, dict):
        source = persona
    elif hasattr(persona, "model_dump"):
        source = persona.model_dump()
    else:
        source = {
            field: getattr(persona, field, None)
            for field in PersonaBase.model_fields.keys()
        }
    try:
        validated = PersonaBase.model_validate(source)
        return validated.model_dump(exclude_none=True)
    except ValidationError:
        return {k: v for k, v in source.items() if v not in (None, "", [], {})}


def _persona_directives(persona: Dict[str, Any]) -> Dict[str, Any]:
    directives: Dict[str, Any] = {}
    for field in (
        "language",
        "tone",
        "style_guide",
        "pillars",
        "default_hashtags",
        "hashtag_rules",
        "link_policy",
        "media_prefs",
        "posting_windows",
        "extras",
        "schema_version",
        "banned_words",
    ):
        value = persona.get(field)
        if value not in (None, "", [], {}):
            directives[field] = value
    if persona.get("name") and "name" not in directives:
        directives["name"] = persona["name"]
    return directives


__all__ = [
    "PersonaInjector",
]
