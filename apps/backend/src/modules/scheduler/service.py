# apps/backend/src/modules/scheduler/service.py
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.scheduler.schemas import (
    ScheduleStreamQuery,
    ScheduleStreamResponse,
    ScheduleStreamWindow,
    ScheduleStreamLane,
    ScheduleStreamItem,
    ScheduleStreamBucket,
)
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.accounts.models import (
    PersonaAccount, Persona, PlatformAccount,
)

# 줌별 버킷 초 단위
_BUCKET_SECONDS = {
    "5m": 5 * 60,
    "15m": 15 * 60,
    "1h": 60 * 60,
    "3h": 3 * 60 * 60,
    "1d": 24 * 60 * 60,
    "1w": 7 * 24 * 60 * 60,
}

def bucket_seconds(zoom: str) -> int:
    return _BUCKET_SECONDS.get(zoom, 3600)

def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

# ---------- label/template 추출 (context 기반) ----------
def _extract_label_from_context(s: Schedule) -> Optional[str]:
    # 모델의 derived_timeline_label: context.template > context.plan_title
    return s.derived_timeline_label

def _extract_template_from_context(s: Schedule) -> Optional[str]:
    ctx = s.context if isinstance(s.context, dict) else None
    if not ctx:
        return None
    t = ctx.get("template")
    return t if isinstance(t, str) else None

# ---------- DB 조회 ----------
async def fetch_schedules(
    session: AsyncSession,
    q: ScheduleStreamQuery,
) -> List[Tuple[Schedule, PersonaAccount, Persona, PlatformAccount]]:
    """
    start~end 윈도우 스케줄을 페이징해서 가져온다.
    JOIN 경로:
      schedules.persona_account_id -> persona_accounts.id
      persona_accounts.persona_id  -> personas.id
      persona_accounts.account_id  -> platform_accounts.id
    """
    start_utc = to_utc(q.start)
    end_utc = to_utc(q.end)

    S = Schedule
    PA = PersonaAccount
    P = Persona
    A = PlatformAccount

    where = [
        S.due_at >= start_utc,
        S.due_at < end_utc,
    ]
    if q.statuses:
        where.append(S.status.in_(list(q.statuses)))

    stmt = (
        select(S, PA, P, A)
        .join(PA, PA.id == S.persona_account_id)
        .join(P, P.id == PA.persona_id)
        .join(A, A.id == PA.account_id)
        .where(and_(*where))
        .order_by(S.due_at.asc(), S.id.asc())
        .limit(q.limit)
        .offset((q.page - 1) * q.limit)
    )

    # owner_user_id: Persona 소유자 기준(필요시 A.owner_user_id도 추가 필터 가능)
    if q.owner_user_id is not None:
        stmt = stmt.where(P.owner_user_id == q.owner_user_id)

    if q.persona_account_ids:
        stmt = stmt.where(S.persona_account_id.in_(list(q.persona_account_ids)))

    # 가벼운 텍스트 검색: context/queue/persona.name/account.handle/platform
    if q.q:
        like = f"%{q.q}%"
        stmt = stmt.where(
            or_(
                func.coalesce(func.cast(S.context, str), "").ilike(like),
                func.coalesce(S.queue, "").ilike(like),
                func.coalesce(P.name, "").ilike(like),
                func.coalesce(A.handle, "").ilike(like),
                func.coalesce(func.cast(A.platform, str), "").ilike(like),
            )
        )

    rows = (await session.execute(stmt)).all()
    return [(r[0], r[1], r[2], r[3]) for r in rows]

# ---------- lane 키/메타 ----------
def lane_key_and_meta(
    group_by: str,
    s: Schedule,
    pa: PersonaAccount,
    p: Persona,
    a: PlatformAccount,
) -> Tuple[str, str, Dict[str, Any], Optional[str]]:
    """
    lane key, label, meta, avatar_url 계산
    - persona_account: "{persona.name} / @{account.handle} ({platform})"
    - persona: "{persona.name}"
    - template: context.template
    - label: context.template|plan_title
    - queue: schedule.queue
    avatar_url: persona.avatar_url 우선, 없으면 account.avatar_url 사용
    """
    # 공통 아바타 선택
    avatar = p.avatar_url or a.avatar_url

    if group_by == "persona_account":
        plat = getattr(a.platform, "value", str(a.platform))  # Enum → str
        handle = a.handle or "account"
        label = f"{p.name} / @{handle} ({plat})"
        key = f"persona_account:{s.persona_account_id}"
        meta = {
            "group_by": "persona_account",
            "persona_id": p.id,
            "account_id": a.id,
            "platform": plat,
            "handle": handle,
        }
        return key, label, meta, avatar

    if group_by == "persona":
        key = f"persona:{p.id}"
        label = p.name
        meta = {"group_by": "persona", "persona_id": p.id}
        return key, label, meta, avatar

    if group_by == "template":
        template = _extract_template_from_context(s) or "unknown"
        key = f"template:{template}"
        meta = {"group_by": "template", "template": template}
        return key, template, meta, avatar

    if group_by == "label":
        label = _extract_label_from_context(s) or "—"
        key = f"label:{label}"
        meta = {"group_by": "label"}
        return key, label, meta, avatar

    if group_by == "queue":
        qname = s.queue or "default"
        key = f"queue:{qname}"
        meta = {"group_by": "queue"}
        return key, qname, meta, avatar

    # fallback: persona_account
    plat = getattr(a.platform, "value", str(a.platform))
    handle = a.handle or "account"
    label = f"{p.name} / @{handle} ({plat})"
    key = f"persona_account:{s.persona_account_id}"
    meta = {
        "group_by": "persona_account",
        "persona_id": p.id,
        "account_id": a.id,
        "platform": plat,
        "handle": handle,
    }
    return key, label, meta, avatar

# ---------- DTO ----------
def to_item(s: Schedule, pa: PersonaAccount, p: Persona, a: PlatformAccount) -> ScheduleStreamItem:
    return ScheduleStreamItem(
        id=s.id,
        t0=to_utc(s.due_at),
        t1=None,
        status=s.status,
        label=_extract_label_from_context(s),
        template=_extract_template_from_context(s),
        queue=s.queue,
        persona_account_id=s.persona_account_id,
        persona_id=p.id,
        context=s.context if isinstance(s.context, dict) else None,
    )

# ---------- 버킷 ----------
def build_buckets(
    items: Iterable[ScheduleStreamItem],
    window_start: datetime,
    zoom: str,
) -> List[ScheduleStreamBucket]:
    bsec = bucket_seconds(zoom)
    start_epoch = int(window_start.timestamp())
    acc: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for it in items:
        epoch = int(it.t0.timestamp())
        bidx = (epoch - start_epoch) // bsec
        anchor = start_epoch + bidx * bsec
        acc[anchor]["__count__"] += 1
        acc[anchor][it.status] += 1

    out: List[ScheduleStreamBucket] = []
    for anchor in sorted(acc.keys()):
        stat = acc[anchor]
        out.append(
            ScheduleStreamBucket(
                ts=datetime.fromtimestamp(anchor, tz=timezone.utc),
                count=stat["__count__"],
                by_status={k: v for k, v in stat.items() if k != "__count__"},
            )
        )
    return out

# ---------- 서비스 엔트리 ----------
async def get_schedule_stream(
    session: AsyncSession,
    query: ScheduleStreamQuery,
) -> ScheduleStreamResponse:
    rows = await fetch_schedules(session, query)

    lanes: Dict[str, ScheduleStreamLane] = {}
    for s, pa, p, a in rows:
        key, label, meta, avatar = lane_key_and_meta(query.group_by, s, pa, p, a)
        lane = lanes.get(key)
        if lane is None:
            lane = ScheduleStreamLane(key=key, label=label, avatar_url=avatar, meta=meta, items=[])
            lanes[key] = lane
        lane.items.append(to_item(s, pa, p, a))

    # lanes 정렬: label → 첫 아이템 시간
    sorted_lanes = sorted(
        lanes.values(),
        key=lambda ln: (ln.label.lower(), ln.items[0].t0 if ln.items else datetime.max.replace(tzinfo=timezone.utc)),
    )

    # 요청 시에만 서버 버킷 계산
    if query.with_buckets:
        start_utc = to_utc(query.start)
        for ln in sorted_lanes:
            ln.buckets = build_buckets(ln.items, start_utc, query.zoom)

    return ScheduleStreamResponse(
        window=ScheduleStreamWindow(
            start=to_utc(query.start),
            end=to_utc(query.end),
            zoom=query.zoom,
        ),
        lanes=sorted_lanes,
        next_page=None,  # 필요 시 커서 기반 페이지로 교체
    )