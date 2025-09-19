# apps/backend/src/modules/trends/trends_google.py
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from .schemas import TrendsResponse, TrendItem, NewsItem
from apps.backend.src.services.http_clients import SYNC_FETCH, ASYNC_FETCH

_NS = {"ht": "https://trends.google.com/trending/rss"}  # namespace

def get_daily_trends(country: str, max_items: int = 10) -> TrendsResponse:
    url = f"https://trends.google.com/trending/rss?geo={country.upper()}"
    # httpx 재사용 클라이언트 사용
    resp = SYNC_FETCH.get(url)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("채널 정보를 찾을 수 없습니다.")

    trends = []
    for rank, item in enumerate(channel.findall("item")[:max_items], start=1):
        item_data = {
            "rank": rank,
            "retrieved": datetime.now().isoformat(timespec="seconds"),
        }
        # 평문 태그 수집
        for child in item:
            tag = child.tag.split('}')[-1]
            if child.text:
                item_data[tag] = child.text.strip()

        # 뉴스 아이템 수집 (네임스페이스 사용)
        news_items = []
        for news in item.findall(".//ht:news_item", _NS):
            news_data = {}
            for ch in news:
                ntag = ch.tag.split('}')[-1]
                if ch.text:
                    news_data[ntag] = ch.text.strip()
            if news_data:
                news_items.append(NewsItem(**news_data))
        if news_items:
            item_data["news_items"] = news_items

        # pubDate → UTC ISO8601
        if item_data.get("pubDate"):
            dt = parsedate_to_datetime(item_data["pubDate"]).astimezone(timezone.utc)
            item_data["pubDate"] = dt.isoformat(timespec="seconds")

        trends.append(TrendItem(**item_data))

    return TrendsResponse(
        country=country,
        max_items=max_items,
        retrieved_at=datetime.now().isoformat(timespec="seconds"),
        trends=trends,
        total_count=len(trends),
    )

# 선택: 비동기 버전 (원하면 워커/라우터에서 await로 사용)
async def aget_daily_trends(country: str, max_items: int = 10) -> TrendsResponse:
    url = f"https://trends.google.com/trending/rss?geo={country.upper()}"
    resp = await ASYNC_FETCH.get(url)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("채널 정보를 찾을 수 없습니다.")

    trends = []
    for rank, item in enumerate(channel.findall("item")[:max_items], start=1):
        item_data = {
            "rank": rank,
            "retrieved": datetime.now().isoformat(timespec="seconds"),
        }
        for child in item:
            tag = child.tag.split('}')[-1]
            if child.text:
                item_data[tag] = child.text.strip()

        news_items = []
        for news in item.findall(".//ht:news_item", _NS):
            news_data = {}
            for ch in news:
                ntag = ch.tag.split('}')[-1]
                if ch.text:
                    news_data[ntag] = ch.text.strip()
            if news_data:
                news_items.append(NewsItem(**news_data))
        if news_items:
            item_data["news_items"] = news_items

        if item_data.get("pubDate"):
            dt = parsedate_to_datetime(item_data["pubDate"]).astimezone(timezone.utc)
            item_data["pubDate"] = dt.isoformat(timespec="seconds")

        trends.append(TrendItem(**item_data))

    return TrendsResponse(
        country=country,
        max_items=max_items,
        retrieved_at=datetime.now().isoformat(timespec="seconds"),
        trends=trends,
        total_count=len(trends),
    )
