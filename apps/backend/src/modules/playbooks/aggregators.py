from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict, Iterable, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.playbooks.models import Playbook
from apps.backend.src.modules.playbooks.schemas import PlaybookAggregatePatch, PlaybookLogCreate

Aggregator = Callable[[AsyncSession, Playbook, PlaybookLogCreate], Awaitable[Optional[PlaybookAggregatePatch]]]


async def _aggregate_from_metrics(
    _db: AsyncSession,
    playbook: Playbook,
    payload: PlaybookLogCreate,
) -> Optional[PlaybookAggregatePatch]:
    """
    KPI 메트릭 데이터를 playbook.aggregate_kpi에 누적 집계.

    sync.metrics 이벤트에서 호출되며, 소셜 미디어 메트릭(좋아요, 댓글, 공유 수 등)을
    playbook의 aggregate_kpi 필드에 지속적으로 업데이트함.

    예: {"likes": 245, "comments": 12, "shares": 8} → aggregate_kpi 누적
    """
    snapshot = payload.kpi_snapshot or {}
    if not isinstance(snapshot, dict) or not snapshot:
        return None

    merged: Dict[str, float] = dict(playbook.aggregate_kpi or {})
    for key, value in snapshot.items():
        if not isinstance(key, str):
            continue
        try:
            merged[key] = float(value)
        except (TypeError, ValueError):
            continue

    return PlaybookAggregatePatch(aggregate_kpi=merged)


async def _aggregate_from_abtest(
    db: AsyncSession,
    playbook: Playbook,
    payload: PlaybookLogCreate,
) -> Optional[PlaybookAggregatePatch]:
    """
    A/B 테스트 완료시 승자의 KPI 데이터를 집계.

    abtest.completed 이벤트에서 호출되며, 테스트 승자의 성과 메트릭을
    playbook의 aggregate_kpi에 반영함. 내부적으로 _aggregate_from_metrics를 재사용.

    예: A/B 테스트 승자의 engagement_rate, conversion_rate 등
    """
    # Reuse KPI aggregator; ensures winner KPI가 반영됨
    return await _aggregate_from_metrics(db, playbook, payload)


async def _aggregate_from_publication(
    _db: AsyncSession,
    _playbook: Playbook,
    payload: PlaybookLogCreate,
) -> Optional[PlaybookAggregatePatch]:
    """
    게시물 게시 시간을 분석하여 최적 게시 시간 창을 업데이트.

    post.published 이벤트에서 호출되며, 게시 성공 시간을 분석하여
    "Mon 14:00" 형식으로 best_time_window를 업데이트함.

    예: 오후 2시에 게시 성공 → "Mon 14:00"
    """
    ts = payload.timestamp or datetime.utcnow()
    try:
        aware = ts.astimezone()
    except ValueError:
        aware = datetime.fromtimestamp(ts.timestamp())
    label = aware.strftime("%a %H:00")
    return PlaybookAggregatePatch(best_time_window=label)


async def _aggregate_from_schedule(
    _db: AsyncSession,
    _playbook: Playbook,
    payload: PlaybookLogCreate,
) -> Optional[PlaybookAggregatePatch]:
    """
    스케줄 생성 시간을 분석하여 최적 게시 시간 창을 업데이트.

    schedule.created* 이벤트에서 호출되며, 스케줄링된 시간을 분석하여
    "Mon 14:00" 형식으로 best_time_window를 업데이트함.

    meta 필드에서 scheduled_for, plan_local_due, due_at_utc 등을 우선 확인하고,
    없으면 payload.timestamp를 사용함.

    예: 월요일 오후 2시 스케줄 → "Mon 14:00"
    """
    meta = payload.meta if isinstance(payload.meta, dict) else {}
    candidates = (
        meta.get("scheduled_for"),
        meta.get("plan_local_due"),
        meta.get("due_at_utc"),
        meta.get("run_at"),
        payload.timestamp,
    )
    dt: Optional[datetime] = None
    for candidate in candidates:
        dt = _coerce_datetime(candidate)
        if dt is not None:
            break
    if dt is None:
        return None
    label = dt.strftime("%a %H:00")
    return PlaybookAggregatePatch(best_time_window=label)


async def _aggregate_from_llm(
    _db: AsyncSession,
    playbook: Playbook,
    payload: PlaybookLogCreate,
) -> Optional[PlaybookAggregatePatch]:
    """
    LLM 생성 텍스트에서 해시태그를 추출하여 top_hashtags를 업데이트.

    coworker.generated_text 이벤트에서 호출되며, CoWorker가 생성한 콘텐츠에서
    #hashtag 패턴을 찾아서 playbook의 top_hashtags에 누적함.

    최대 10개의 해시태그를 유지하며, 빈도순으로 정렬됨.

    예: "Check out #AI #HR solutions!" → ["#AI", "#HR"] 추가
    """
    output = payload.llm_output
    if not isinstance(output, dict):
        return None
    text = output.get("text")
    if not isinstance(text, str) or not text:
        return None

    hashtags = _extract_hashtags(text)
    if not hashtags:
        return None

    existing: Sequence[str] = playbook.top_hashtags or []
    merged = _merge_hashtags(existing, hashtags, limit=10)
    if list(existing) == merged:
        return None
    return PlaybookAggregatePatch(top_hashtags=merged)


def _extract_hashtags(text: str) -> list[str]:
    pattern = re.compile(r"#(\w+)")
    found = pattern.findall(text)
    return [f"#{tag}" for tag in found]


def _merge_hashtags(existing: Sequence[str], new_items: Iterable[str], *, limit: int) -> list[str]:
    seen = set()
    merged: list[str] = []

    def _push(items: Iterable[str]) -> None:
        for item in items:
            normalized = item.strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            merged.append(normalized)
            if len(merged) >= limit:
                return

    _push(existing)
    if len(merged) < limit:
        _push(new_items)
    return merged[:limit]


def _coerce_datetime(value: object) -> Optional[datetime]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    return None


# 실제로 사용되는 이벤트들 (record_playbook_event 호출 추적 결과):
# ✅ "coworker.generated_text" - CoWorker 텍스트 생성시 (LLM 출력에서 해시태그 추출)
# ✅ "sync.metrics" - 메트릭 동기화시 (KPI 데이터 집계)
# ✅ "post.published" - 게시물 게시시 (게시 시간으로 best_time_window 업데이트)
# ✅ "schedule.created*" - 스케줄 생성시 (스케줄 시간으로 best_time_window 업데이트)
# ✅ "abtest.completed" - A/B 테스트 완료시 (승자 KPI 데이터 집계)
#
# 실제로는 기록되지만 aggregator가 없는 이벤트들:
# ❌ "abtest.winner_determined" - A/B 테스트 승자 결정시
# ❌ "abtest.scheduled" - A/B 테스트 스케줄링시
# ❌ "abtest.completion_scheduled" - A/B 테스트 완료 스케줄링시
# ❌ "schedule.cancelled" - 스케줄 취소시
# ❌ "post.deleted" - 게시물 삭제시
# ❌ "email.replied" - 이메일 답장시

AGGREGATORS: Dict[str, Aggregator] = {
    "sync.metrics": _aggregate_from_metrics,           # KPI 메트릭 집계
    "abtest.completed": _aggregate_from_abtest,         # 승자 KPI 데이터 집계
    "post.published": _aggregate_from_publication,      # 게시 시간 → best_time_window
    "schedule.created": _aggregate_from_schedule,       # 스케줄 시간 → best_time_window
    "coworker.generated_text": _aggregate_from_llm,     # LLM 출력 → 해시태그 추출
}


async def run_aggregators(
    db: AsyncSession,
    playbook: Playbook,
    payload: PlaybookLogCreate,
) -> list[PlaybookAggregatePatch]:
    patches: list[PlaybookAggregatePatch] = []
    event = payload.event or ""
    for prefix, func in AGGREGATORS.items():
        if event == prefix or event.startswith(f"{prefix}."):
            patch = await func(db, playbook, payload)
            if patch is not None:
                patches.append(patch)
    return patches


__all__ = [
    "run_aggregators",
    "AGGREGATORS",
]
