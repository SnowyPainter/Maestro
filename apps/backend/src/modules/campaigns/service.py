from __future__ import annotations
from datetime import datetime
from typing import Iterable, Optional, Dict, List, Tuple

from sqlalchemy import select, func, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.campaigns.models import (
    Campaign, CampaignKPIDef, CampaignKPIResult
)
from apps.backend.src.modules.campaigns.schemas import (
    CampaignCreate, CampaignUpdate,
    CampaignKPIDefUpsert
)
from apps.backend.src.modules.common.enums import KPIKey, Aggregation, PlatformKind


# ------------------------------
# Campaign CRUD
# ------------------------------

async def create_campaign(
    db: AsyncSession, *,
    owner_user_id: int,
    payload: CampaignCreate,
) -> Campaign:
    camp = Campaign(
        owner_user_id=owner_user_id,
        name=payload.name,
        description=payload.description,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    db.add(camp)
    await db.flush()
    await db.commit()
    return camp


async def update_campaign(
    db: AsyncSession, *,
    campaign_id: int,
    payload: CampaignUpdate,
) -> Campaign:
    camp = await db.get(Campaign, campaign_id)
    if not camp:
        raise ValueError("campaign not found")

    if payload.name is not None:
        camp.name = payload.name
    if payload.description is not None:
        camp.description = payload.description
    if payload.start_at is not None:
        camp.start_at = payload.start_at
    if payload.end_at is not None:
        camp.end_at = payload.end_at

    await db.flush()
    await db.commit()
    return camp


async def get_campaign(db: AsyncSession, campaign_id: int) -> Optional[Campaign]:
    return await db.get(Campaign, campaign_id)


async def list_campaigns(
    db: AsyncSession, *,
    owner_user_id: int,
    q: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Campaign], int]:
    stmt = select(Campaign).where(Campaign.owner_user_id == owner_user_id)
    if q:
        stmt = stmt.where(Campaign.name.ilike(f"%{q}%"))
    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()
    rows = (await db.execute(
        stmt.order_by(Campaign.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return rows, total


async def delete_campaign(db: AsyncSession, campaign_id: int) -> None:
    await db.execute(delete(Campaign).where(Campaign.id == campaign_id))
    await db.commit()


# ------------------------------
# KPI Defs (upsert full-set semantics)
# ------------------------------

async def upsert_kpi_defs(
    db: AsyncSession, *,
    campaign_id: int,
    defs: List[CampaignKPIDefUpsert],
) -> List[CampaignKPIDef]:
    """
    단순화: 기존 정의 전부 삭제 후 새로 삽입(원자적 교체).
    (행 수가 적은 테이블이므로 성능 문제 없음)
    """
    await db.execute(delete(CampaignKPIDef).where(CampaignKPIDef.campaign_id == campaign_id))
    await db.flush()

    out: List[CampaignKPIDef] = []
    for d in defs:
        row = CampaignKPIDef(
            campaign_id=campaign_id,
            key=d.key,
            aggregation=d.aggregation,
            target_value=d.target_value,
            weight=d.weight,
        )
        db.add(row)
        out.append(row)

    await db.flush()
    await db.commit()
    return out


async def list_kpi_defs(db: AsyncSession, campaign_id: int) -> List[CampaignKPIDef]:
    rows = (await db.execute(
        select(CampaignKPIDef).where(CampaignKPIDef.campaign_id == campaign_id)
    )).scalars().all()
    return rows


# ------------------------------
# KPI Results (write + read)
# ------------------------------

async def record_kpi_result(
    db: AsyncSession, *,
    campaign_id: int,
    as_of: datetime,
    values: Dict[str, float],
) -> CampaignKPIResult:
    row = CampaignKPIResult(
        campaign_id=campaign_id,
        as_of=as_of,
        values=values,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    return row


async def list_kpi_results(
    db: AsyncSession, *,
    campaign_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = 200,
) -> List[CampaignKPIResult]:
    stmt = select(CampaignKPIResult).where(CampaignKPIResult.campaign_id == campaign_id)
    if start:
        stmt = stmt.where(CampaignKPIResult.as_of >= start)
    if end:
        stmt = stmt.where(CampaignKPIResult.as_of < end)
    stmt = stmt.order_by(CampaignKPIResult.as_of.asc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


# ------------------------------
# Aggregation from InsightSample
# ------------------------------
# ---- 유틸: 캠페인에 속한 드래프트 id 목록
async def _campaign_draft_ids(db: AsyncSession, campaign_id: int) -> List[int]:
    rows = await db.execute(
        text("SELECT id FROM drafts WHERE campaign_id = :cid"),
        {"cid": campaign_id},
    )
    return list(rows.scalars().all())

# ---- 유틸: 드래프트별 최신 샘플(metrics) 스냅샷 {draft_id: (ts, metrics)}
async def _latest_metrics_per_draft(
    db: AsyncSession, draft_ids: List[int], as_of: datetime
) -> Dict[int, Tuple[datetime, Dict[str, float]]]:
    if not draft_ids:
        return {}
    rows = await db.execute(
        text("""
            WITH latest AS (
              SELECT draft_id, MAX(ts) AS ts
              FROM insight_samples
              WHERE draft_id = ANY(:dids) AND ts <= :as_of
              GROUP BY draft_id
            )
            SELECT s.draft_id, s.ts, s.metrics
            FROM insight_samples s
            JOIN latest l
              ON s.draft_id = l.draft_id AND s.ts = l.ts
        """),
        {"dids": draft_ids, "as_of": as_of},
    )
    snap: Dict[int, Tuple[datetime, Dict[str, float]]] = {}
    for r in rows.mappings():
        snap[int(r["draft_id"])] = (r["ts"], r["metrics"] or {})
    return snap

# ---- 메인: Aggregation을 존중하는 집계
async def aggregate_campaign_kpis_respecting_defs(
    db: AsyncSession, *, campaign_id: int, as_of: Optional[datetime] = None
) -> CampaignKPIResult:
    as_of = as_of or datetime.utcnow()

    # 1) KPI 정의 로드
    defs = (await db.execute(
        select(CampaignKPIDef).where(CampaignKPIDef.campaign_id == campaign_id)
    )).scalars().all()
    if not defs:
        # 정의가 없으면 빈 결과라도 기록
        row = CampaignKPIResult(campaign_id=campaign_id, as_of=as_of, values={})
        db.add(row); await db.flush(); await db.commit()
        return row

    # 2) 스냅샷 구축(드래프트별 최신 샘플)
    dids = await _campaign_draft_ids(db, campaign_id)
    snap = await _latest_metrics_per_draft(db, dids, as_of)

    # 3) Aggregation별 계산
    values: Dict[str, float] = {}

    # 캠페인 합계(파생지표 재계산 용)
    totals_for_derived = {
        KPIKey.IMPRESSIONS.value: 0.0,
        KPIKey.LINK_CLICKS.value: 0.0,
        KPIKey.LIKES.value: 0.0,
        KPIKey.COMMENTS.value: 0.0,
        KPIKey.SHARES.value: 0.0,
        KPIKey.SAVES.value: 0.0,
    }

    # LAST 계산을 위해 캠페인에서 가장 최신(ts)도 추적
    global_latest_ts: Optional[datetime] = None
    global_latest_metrics: Dict[str, float] = {}
    for _did, (ts, met) in snap.items():
        if global_latest_ts is None or ts > global_latest_ts:
            global_latest_ts = ts
            global_latest_metrics = met or {}

    for d in defs:
        key = d.key.value
        agg = d.aggregation

        # per-draft 최신 값 모으기
        series: List[float] = []
        for _did, (_ts, met) in snap.items():
            val = met.get(key)
            if val is not None:
                try:
                    series.append(float(val))
                except Exception:
                    pass

        if agg == Aggregation.SUM:
            values[key] = float(sum(series)) if series else 0.0
        elif agg == Aggregation.AVG:
            values[key] = float(sum(series) / len(series)) if series else 0.0
        elif agg == Aggregation.LAST:
            # 캠페인 전역에서 '가장 최신 샘플'의 단일 값
            v = global_latest_metrics.get(key) if global_latest_metrics else None
            values[key] = float(v) if v is not None else 0.0
        else:
            values[key] = 0.0

        # 파생지표용 합계 누적
        if key in totals_for_derived and agg in (Aggregation.SUM, Aggregation.AVG, Aggregation.LAST):
            # 합계는 SUM/LAST/AVG와 무관하게 '캠페인 스냅샷 합계'로 모아두고,
            # 아래에서 CTR/ER만 별도로 재계산한다.
            totals_for_derived[key] += float(sum(series)) if series else 0.0

    # 4) 파생지표(옵션): 정의에 포함되어 있으면 합계기반 재계산
    def _get(k: KPIKey) -> bool:
        return any(dd.key == k for dd in defs)

    impressions = totals_for_derived[KPIKey.IMPRESSIONS.value]
    if _get(KPIKey.CTR):
        link_clicks = totals_for_derived[KPIKey.LINK_CLICKS.value]
        values[KPIKey.CTR.value] = (link_clicks / impressions) if impressions else 0.0

    if _get(KPIKey.ER):
        likes = totals_for_derived[KPIKey.LIKES.value]
        comments = totals_for_derived[KPIKey.COMMENTS.value]
        shares = totals_for_derived[KPIKey.SHARES.value]
        saves = totals_for_derived[KPIKey.SAVES.value]
        values[KPIKey.ER.value] = ((likes + comments + shares + saves) / impressions) if impressions else 0.0

    # 5) 저장
    row = CampaignKPIResult(campaign_id=campaign_id, as_of=as_of, values=values)
    db.add(row)
    await db.flush()
    await db.commit()
    return row