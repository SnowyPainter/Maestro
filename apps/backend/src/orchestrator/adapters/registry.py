"""Adapters that bridge outputs from one flow to the payload of another."""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, Optional, Union
from dataclasses import dataclass
import fnmatch


from .draft import trends_to_draft_adapter
from .comment import comments_to_draft_adapter, comments_to_reaction_message_template_adapter
from .timeline import timeline_result_adapter


PayloadAdapter = Callable[[Any, Dict[str, Any]], Any]
PatternLike = Union[str, re.Pattern[str], type, None]  # from_pattern은 type 허용
ToPatternLike = Union[str, re.Pattern[str], None]      # to_pattern은 flow_key만 취급

@dataclass(frozen=True)
class AdapterRule:
    from_pattern: PatternLike
    to_pattern: ToPatternLike
    adapter: PayloadAdapter
    priority: int = 0
    predicate: Optional[Callable[[Any, str, str], bool]] = None  # (source, from_key, to_key) -> bool

class AdapterRegistry:
    def __init__(self) -> None:
        self._rules: list[AdapterRule] = []

    def register(
        self,
        from_pattern: PatternLike,
        to_pattern: ToPatternLike,
        adapter: PayloadAdapter,
        *,
        priority: int = 0,
        predicate: Optional[Callable[[Any, str, str], bool]] = None,
    ) -> None:
        self._rules.append(AdapterRule(from_pattern, to_pattern, adapter, priority, predicate))

    def _match_score(self, pattern, value, source, is_to):
        # 0 불일치, 1 와일드카드/None, 2 정규식/타입/글로브, 3 정확 문자열
        if pattern is None or pattern == "*":
            return 1
        if isinstance(pattern, str):
            if any(ch in pattern for ch in "*?[]"):
                if value is None:
                    return 0
                return 2 if fnmatch.fnmatchcase(value, pattern) else 0
            return 3 if value == pattern else 0
        if isinstance(pattern, re.Pattern):
            if value is None:
                return 0
            return 2 if pattern.search(value) else 0
        if isinstance(pattern, type) and not is_to:
            return 2 if isinstance(source, pattern) else 0
        return 0


    def resolve(self, *, source: Any, from_key: Optional[str], to_key: Optional[str]) -> PayloadAdapter | None:
        best: tuple[int, int, PayloadAdapter] | None = None  # (score_sum, priority, adapter)
        for rule in self._rules:
            s_from = self._match_score(rule.from_pattern, from_key, source, is_to=False)
            if s_from == 0:
                continue
            s_to = self._match_score(rule.to_pattern, to_key, source, is_to=True)
            if s_to == 0:
                continue
            if rule.predicate and not rule.predicate(source, from_key or "", to_key or ""):
                continue
            score_sum = s_from + s_to
            cand = (score_sum, rule.priority, rule.adapter)
            if best is None or cand > best:
                best = cand
        return best[2] if best else None

    def maybe_applicable(self, *, from_key: Optional[str], to_key: Optional[str]) -> bool:
        """소스 타입을 모르는 시점에서 '패턴 상' 적용 가능성만 대략 확인(정확/정규식/와일드카드에 한해)."""
        for rule in self._rules:
            # 타입 패턴은 소스를 알아야 매칭되므로 여기선 건너뜀
            if isinstance(rule.from_pattern, type):
                continue
            s_from = self._match_score(rule.from_pattern, from_key, source=None, is_to=False)  # type: ignore[arg-type]
            if s_from == 0:
                continue
            s_to = self._match_score(rule.to_pattern, to_key, source=None, is_to=True)  # type: ignore[arg-type]
            if s_to == 0:
                continue
            return True
        return False

ADAPTERS = AdapterRegistry()

ADAPTERS.register("bff.trends.list_trends", "drafts.create", trends_to_draft_adapter, priority=10)
ADAPTERS.register("internal.insights.list_comments", "drafts.create", comments_to_draft_adapter, priority=10)
ADAPTERS.register("bff.insights.comments.list", "drafts.create", comments_to_draft_adapter, priority=7)
ADAPTERS.register("internal.insights.list_comments", "reactive.create_message_template", comments_to_reaction_message_template_adapter, priority=10)
ADAPTERS.register("bff.insights.comments.list", "reactive.create_message_template", comments_to_reaction_message_template_adapter, priority=7)
ADAPTERS.register("bff.insights.comments.search", "reactive.create_message_template", comments_to_reaction_message_template_adapter, priority=7)
ADAPTERS.register("bff.timeline.*", "bff.timeline.*", timeline_result_adapter, priority=5)


__all__ = [
    "ADAPTERS",
    "AdapterRegistry",
    "AdapterRule",
    "PayloadAdapter",
    "PatternLike",
    "ToPatternLike",
]
