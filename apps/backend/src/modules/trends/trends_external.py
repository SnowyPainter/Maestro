# apps/backend/src/modules/trends/trends_external.py
import re
import html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

from apps.backend.src.modules.trends.schemas import TrendItem, TrendsResponse
from apps.backend.src.services.http_clients import SYNC_FETCH
from apps.backend.src.services.http_clients import REDDIT_SYNC_FETCH
import httpx

# 헬퍼 함수들
def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=timezone.utc).isoformat(timespec="seconds")

def _parse_rfc822_to_iso(s: str) -> Optional[str]:
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).isoformat(timespec="seconds")
    except Exception:
        return None

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")

def _clean_html(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = html.unescape(s)
    s = _TAG_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return s

def _fmt_approx(val: Optional[int]) -> Optional[str]:
    """정수 값(views/points 등)을 '1.2K+' 형식으로 변환"""
    if val is None:
        return None
    try:
        n = int(val)
    except Exception:
        return None
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M+"
    if n >= 1_000:
        return f"{n/1_000:.1f}K+"
    return f"{n}+"

# ---------------------------
# 1) Hacker News (RSS)
# ---------------------------
def get_hn_frontpage(max_items: int = 20) -> TrendsResponse:
    """
    Hacker News 프론트페이지 RSS에서 트렌드 데이터를 가져옵니다.
    공식 RSS: https://news.ycombinator.com/rss
    """
    r = SYNC_FETCH.get("https://news.ycombinator.com/rss", timeout=15.0)
    r.raise_for_status()

    root = ET.fromstring(r.content)
    channel = root.find("channel")
    items = [] if channel is None else channel.findall("item")

    trends: List[TrendItem] = []
    for rank, it in enumerate(items[:max_items], start=1):
        title = it.findtext("title") or ""
        link = it.findtext("link") or None
        pub_raw = it.findtext("pubDate")
        pub_iso = _parse_rfc822_to_iso(pub_raw) or _now_iso()
        desc = _clean_html(it.findtext("description"))

        trends.append(TrendItem(
            rank=rank,
            retrieved=_now_iso(),
            title=title,
            approx_traffic=None,  # 점수/댓글은 확장태그가 아니라서 기본 None
            link=link,
            pub_date=pub_iso,
            picture=None,
            picture_source=None,
            news_item="",
            news_items=None,
        ))

    return TrendsResponse(
        country="US",  # Hacker News는 미국 기반
        max_items=max_items,
        retrieved_at=_now_iso(),
        trends=trends,
        total_count=len(trends),
    )

# ---------------------------
# 2) Reddit (RSS)
# ---------------------------

def get_reddit(subreddit: str = "all", max_items: int = 20) -> TrendsResponse:
    """
    차단 회피를 위해 old.reddit.com 우선, 실패 시 www.reddit.com 폴백.
    """
    domains = [
        f"https://old.reddit.com/r/{subreddit}/.rss",
        f"https://www.reddit.com/r/{subreddit}/.rss",
    ]

    last_exc = None
    content = None
    for idx, url in enumerate(domains):
        try:
            r = REDDIT_SYNC_FETCH.get(url, timeout=15.0)
            # 429/403이면 바로 다음 도메인 시도
            if r.status_code in (401, 403, 429):
                last_exc = httpx.HTTPStatusError(f"status={r.status_code}", request=r.request, response=r)
                continue
            r.raise_for_status()
            content = r.content
            break
        except httpx.HTTPError as e:
            last_exc = e
            continue

    if content is None:
        raise last_exc or RuntimeError("reddit rss fetch failed")

    root = ET.fromstring(content)
    channel = root.find("channel")
    items = [] if channel is None else channel.findall("item")

    trends: List[TrendItem] = []
    now_iso = _now_iso()
    for rank, it in enumerate(items[:max_items], start=1):
        title = it.findtext("title") or ""
        link = it.findtext("link") or None
        pub_raw = it.findtext("pubDate")
        pub_iso = _parse_rfc822_to_iso(pub_raw) or now_iso
        desc = _clean_html(it.findtext("description"))

        trends.append(TrendItem(
            rank=rank,
            retrieved=now_iso,
            title=title,
            approx_traffic=None,
            link=link,
            pub_date=pub_iso,
            picture=None,
            picture_source=None,
            news_item="",
            news_items=None,
        ))

    return TrendsResponse(
        country="global",
        max_items=max_items,
        retrieved_at=now_iso,
        trends=trends,
        total_count=len(trends),
    )
