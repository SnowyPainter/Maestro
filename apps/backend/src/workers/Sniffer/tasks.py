from __future__ import annotations

from datetime import datetime

from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from apps.backend.src.core.config import settings

# 동기 엔진/세션 (Celery 워커는 sync 접근이 단순)
_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)

from apps.backend.src.modules.trends.models import Trend, NewsItem  # type: ignore

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
    except Exception as e:
        raise self.retry(exc=e, countdown=min(30 * (self.request.retries + 1), 120))

    return _process_trends_response(resp, source=f"reddit:{target}")
