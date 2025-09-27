from __future__ import annotations

from datetime import datetime
import asyncio

from celery import shared_task
import httpx
import logging
logger = logging.getLogger(__name__)

from sqlalchemy import String, cast, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings

# 동기 엔진/세션 (Celery 워커는 sync 접근이 단순)
_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

from apps.backend.src.modules.trends.models import Trend, NewsItem  # type: ignore
from apps.backend.src.modules.mail.service import poll_mailbox
from apps.backend.src.modules.scheduler.models import Schedule, ScheduleStatus

# Pydantic 스키마 & 수집 함수
from apps.backend.src.modules.trends.schemas import TrendItem
from apps.backend.src.modules.trends import trends_google, trends_external

def _save_one(session, country: str, ti: TrendItem):
    trend = Trend(
         country=country,
         rank=ti.rank,
         retrieved=datetime.fromisoformat(ti.retrieved),
         title=ti.title,
         approx_traffic=ti.approx_traffic,
         link=ti.link,
         pub_date=ti.pub_date,
         picture=ti.picture,
         picture_source=ti.picture_source,
         news_item_raw=ti.news_item or None,
         title_embedding=None,  # 임베딩은 비동기로 처리
     )
    if ti.news_items:
        for ni in ti.news_items:
            trend.news_items.append(
                NewsItem(
                    title=ni.news_item_title,
                    url=ni.news_item_url,
                    picture=ni.news_item_picture,
                    source=ni.news_item_source,
                )
            )
    session.add(trend)
    session.flush()
    return trend.id

def _process_trends_response(resp, *, source: str, country_override: str | None = None):
    """공통 TrendResponse 처리 로직"""
    saved = 0
    trend_ids: list[int] = []
    country = country_override or resp.country

    with SessionLocal() as session:
        for ti in resp.trends:
            try:
                trend_id = _save_one(session, country, ti)
                session.commit()
                saved += 1
                trend_ids.append(trend_id)
            except IntegrityError:
                session.rollback()  # 중복일 가능성 큼: 스킵
            except Exception:
                session.rollback()
                raise

    if trend_ids:
        from apps.backend.src.workers.Synchro.tasks import enqueue_trend_title_embedding

        for trend_id in trend_ids:
            enqueue_trend_title_embedding.delay(trend_id)

    try:
        from apps.backend.src.workers.Synchro.tasks import refresh_cache

        refresh_cache.delay()
    except Exception:
        pass

    return {
        "source": source,
        "country": country,
        "fetched": len(resp.trends),
        "saved": saved,
    }


@shared_task(name="apps.backend.src.workers.Sniffer.tasks.sniff_google_trends", queue="sniffer", bind=True, max_retries=3)
def sniff_google_trends(self, country: str = "KR"):
    """Google Trends 수집 및 저장"""
    try:
        max_items = settings.TRENDS_MAX_ITEMS
        resp = trends_google.get_daily_trends(country=country, max_items=max_items)
    except Exception as e:
        raise self.retry(exc=e, countdown=min(30 * (self.request.retries + 1), 120))

    return _process_trends_response(resp, source=f"google:{country.upper()}")


@shared_task(name="apps.backend.src.workers.Sniffer.tasks.sniff_hn_frontpage", queue="sniffer", bind=True, max_retries=3)
def sniff_hn_frontpage(self, max_items: int | None = None):
    """Hacker News 프론트페이지 RSS 수집"""
    try:
        resp = trends_external.get_hn_frontpage(max_items=max_items or settings.TRENDS_MAX_ITEMS)
    except Exception as e:
        raise self.retry(exc=e, countdown=min(30 * (self.request.retries + 1), 120))

    return _process_trends_response(resp, source="hacker_news")


@shared_task(name="apps.backend.src.workers.Sniffer.tasks.sniff_reddit_trends", queue="sniffer", bind=True, max_retries=3)
def sniff_reddit_trends(self, subreddit: str = "all", max_items: int | None = None):
    """Reddit 서브레딧 RSS 수집"""
    target = (subreddit or "all").strip() or "all"
    try:
        resp = trends_external.get_reddit(subreddit=target, max_items=max_items or settings.TRENDS_MAX_ITEMS)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else None
        if status in (429,):
            countdown = min(30 * (self.request.retries + 1), 300)
            raise self.retry(exc=e, countdown=countdown)
        if status in (401, 403):
            if self.request.retries < 1:
                raise self.retry(exc=e, countdown=60)
            return {"ok": False, "reason": f"blocked status {status}"}
        raise self.retry(exc=e, countdown=min(15 * (self.request.retries + 1), 120))
    except (httpx.HTTPError, ConnectionError) as e:
        raise self.retry(exc=e, countdown=min(15 * (self.request.retries + 1), 120))
    except Exception as e:
        return {"ok": False, "reason": "unexpected_error"}

    return _process_trends_response(resp, source=f"reddit:{target}")

@shared_task(name="apps.backend.src.workers.Sniffer.tasks.sniff_mailbox", queue="sniffer", bind=True, max_retries=3)
def sniff_mailbox(self):
    """Mailbox 수집"""
    try:
        messages = asyncio.run(poll_mailbox())
    except Exception as exc:
        logger.exception("Mailbox poll failed")
        raise self.retry(exc=exc, countdown=min(60 * (self.request.retries + 1), 600))

    if not messages:
        return {"ok": True, "processed": 0}

    processed = 0
    with SessionLocal() as session:
        for item in messages:
            pipeline_id = item.get("pipeline_id")
            event_payload = item.get("event")
            if not pipeline_id or not event_payload:
                logger.debug("No pipeline_id or event_payload")
                continue

            # Cross-dialect safe lookup: fetch RUNNING schedules and match pipeline_id in Python
            candidates = (
                session.execute(
                    select(Schedule).where(Schedule.status == ScheduleStatus.RUNNING.value)
                ).scalars().all()
            )
            schedule: Schedule | None = None
            for s in candidates:
                ctx = s.context or {}
                if isinstance(ctx, dict) and ctx.get("pipeline_id") == pipeline_id:
                    schedule = s
                    break
            if not schedule:
                logger.debug("No schedule awaiting pipeline %s", pipeline_id)
                continue

            context = dict(schedule.context or {})
            resume_bucket = context.get("_resume") or {}
            resume_bucket["event"] = event_payload
            context["_resume"] = resume_bucket
            context["pipeline_id"] = pipeline_id
            context["reply_received"] = True
            # Clear stale waiting markers so executor/UI doesn't display wait state after resume
            dag_ctx = context.get("_dag") or {}
            if isinstance(dag_ctx, dict):
                dag_ctx.pop("waiting_node", None)
                dag_ctx.pop("wait_started_at", None)
                context["_dag"] = dag_ctx
            if item.get("metadata"):
                context["reply_metadata"] = item["metadata"]

            schedule.context = context
            schedule.status = ScheduleStatus.RUNNING.value
            schedule.due_at = datetime.utcnow()
            schedule.last_error = None
            schedule.errors = None
            session.add(schedule)
            processed += 1

        session.commit()

    return {"ok": True, "processed": processed}
