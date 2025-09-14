from modules.trends.trends_google import get_daily_trends

def test_get_daily_trends():
    trends = get_daily_trends("HK")
    assert trends is not None
    assert trends.total_count > 0
    assert trends.trends is not None
    assert len(trends.trends) > 0
    assert trends.trends[0].title is not None
    assert trends.trends[0].approx_traffic is not None
    assert trends.trends[0].pubDate is not None
    assert trends.trends[0].news_items is not None

    print(trends.pretty_print())