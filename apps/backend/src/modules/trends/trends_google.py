import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from .models import GoogleTrendsResponse, TrendItem, NewsItem

def get_daily_trends(country: str, max_items: int = 10) -> GoogleTrendsResponse:
    """
    Google Trends 'Daily Search Trends' RSS를 읽어 DataFrame 반환
    
    Args:
        country: ISO 3166-1 alpha-2 (KR, US, JP …)
        max_items: 트렌드 항목 개수 제한
    Returns:
        GoogleTrendsResponse: 트렌드 데이터프레임
    """
    url = f"https://trends.google.com/trending/rss?geo={country.upper()}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    response = requests.get(url, headers=headers, timeout=(5, 30))
    response.raise_for_status()
    root = ET.fromstring(response.content)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("채널 정보를 찾을 수 없습니다.")
    
    trends = []
    for rank, item in enumerate(channel.findall("item")[:max_items], start=1):
        # Get all available elements from the item
        item_data = {
            "rank": rank,
            "retrieved": datetime.now().isoformat(timespec="seconds"),
        }
        for child in item:
            tag_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if child.text:
                item_data[tag_name] = child.text.strip()
        
        # Handle nested news items
        news_items = []
        for news_item in item.findall(".//ht:news_item", {"ht": "https://trends.google.com/trending/rss"}):
            news_data = {}
            for news_child in news_item:
                news_tag = news_child.tag.split('}')[-1] if '}' in news_child.tag else news_child.tag
                if news_child.text:
                    news_data[news_tag] = news_child.text.strip()
            if news_data:  # Only add if there's actual data
                news_items.append(NewsItem(**news_data))
        
        if news_items:
            item_data["news_items"] = news_items
        
        for attr_name, attr_value in item.attrib.items():
            item_data[f"attr_{attr_name}"] = attr_value

        if item_data["pubDate"]:
            from email.utils import parsedate_to_datetime
            parsed_date = parsedate_to_datetime(item_data["pubDate"])
            item_data["pubDate"] = parsed_date.astimezone(timezone.utc).isoformat(timespec="seconds")

        trends.append(TrendItem(**item_data))

    return GoogleTrendsResponse(
        country=country,
        max_items=max_items,
        retrieved_at=datetime.now().isoformat(timespec="seconds"),
        trends=trends,
        total_count=len(trends)
    )