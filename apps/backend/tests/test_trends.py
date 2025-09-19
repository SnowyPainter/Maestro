from apps.backend.src.modules.trends.trends_google import get_daily_trends
from apps.backend.src.modules.trends.trends_external import get_hn_frontpage, get_reddit
from datetime import datetime, timedelta


def test_get_daily_trends():
    """Google Trends 데이터 테스트"""
    trends = get_daily_trends("HK")
    assert trends is not None
    assert trends.total_count > 0
    assert trends.trends is not None
    assert len(trends.trends) > 0
    assert trends.trends[0].title is not None
    assert trends.trends[0].approx_traffic is not None
    assert trends.trends[0].pub_date is not None
    assert trends.country == "HK"

    print("Google Trends 테스트:")
    print(trends.pretty_print())


def test_get_hn_frontpage():
    """Hacker News 프론트페이지 테스트"""
    trends = get_hn_frontpage(max_items=5)
    assert trends is not None
    assert trends.total_count >= 0  # RSS가 비어있을 수도 있음
    assert trends.trends is not None
    assert len(trends.trends) == trends.total_count
    assert trends.max_items == 5
    assert trends.country == "US"

    if trends.total_count > 0:
        assert trends.trends[0].title is not None

    print(f"\nHacker News 테스트: {trends.total_count}개 항목")
    print(trends.pretty_print())


def test_get_reddit():
    """Reddit 트렌드 테스트"""
    trends = get_reddit(subreddit="all", max_items=5)
    assert trends is not None
    assert trends.total_count >= 0
    assert trends.trends is not None
    assert len(trends.trends) == trends.total_count
    assert trends.max_items == 5
    assert trends.country == "global"

    if trends.total_count > 0:
        assert trends.trends[0].title is not None

    print(f"Reddit 테스트: {trends.total_count}개 항목")
    print(trends.pretty_print())