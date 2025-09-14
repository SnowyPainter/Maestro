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
from apps.backend.src.modules.trends import trends_google
from apps.backend.src.services.embeddings import embed_texts_sync

def _save_one(session, country: str, ti: TrendItem):
    trend = Trend(
        country=country,
        rank=ti.rank,
        retrieved=datetime.fromisoformat(ti.retrieved),
        title=ti.title,
        approx_traffic=ti.approx_traffic,
        link=ti.link,
        pub_date=ti.pubDate,
        picture=ti.picture,
        picture_source=ti.picture_source,
        news_item_raw=ti.news_item or None,
        title_embedding=embed_texts_sync([ti.title]),
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

@shared_task(name="apps.backend.src.workers.Sniffer.tasks.sniff_google_trends", queue="sniffer", bind=True, max_retries=3)
def sniff_google_trends(self, country: str = "KR"):
    """
    1) Google Trends 수집
    2) DB 저장(중복 - UniqueConstraint 충돌 시 스킵)
    3) 캐시 리프레시 트리거
    """
    try:
        max_items = settings.TRENDS_MAX_ITEMS
        resp = trends_google.get_daily_trends(country=country, max_items=max_items)
    except Exception as e:
        raise self.retry(exc=e, countdown=min(30 * (self.request.retries + 1), 120))

    saved = 0
    with SessionLocal() as session:
        for ti in resp.trends:
            try:
                _save_one(session, resp.country, ti)
                session.commit()
                saved += 1
            except IntegrityError:
                session.rollback()  # 중복일 가능성 큼: 스킵
            except Exception:
                session.rollback()
                raise

    # 캐시 리프레시
    try:
        from apps.backend.src.workers.Synchro.tasks import refresh_cache
        refresh_cache.delay()
    except Exception:
        pass

    return {"country": country, "fetched": len(resp.trends), "saved": saved}
