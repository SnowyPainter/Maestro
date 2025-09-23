# apps/backend/src/services/http_clients.py
import httpx

"""
[WRK] Traceback (most recent call last):
[WRK]   File "/home/snowypainter/miniconda3/envs/fastapi-env/lib/python3.10/site-packages/celery/app/trace.py", line 453, in trace_task
[WRK]     R = retval = fun(*args, **kwargs)
[WRK]   File "/home/snowypainter/miniconda3/envs/fastapi-env/lib/python3.10/site-packages/celery/app/trace.py", line 736, in __protected_call__
[WRK]     return self.run(*args, **kwargs)
[WRK]   File "/home/snowypainter/Maestro/apps/backend/src/workers/Sniffer/tasks.py", line 120, in sniff_reddit_trends
[WRK]     raise self.retry(exc=e, countdown=min(30 * (self.request.retries + 1), 120))
[WRK]   File "/home/snowypainter/miniconda3/envs/fastapi-env/lib/python3.10/site-packages/celery/app/task.py", line 743, in retry
[WRK]     raise_with_context(exc)
[WRK]   File "/home/snowypainter/Maestro/apps/backend/src/workers/Sniffer/tasks.py", line 118, in sniff_reddit_trends
[WRK]     resp = trends_external.get_reddit(subreddit=target, max_items=max_items or settings.TRENDS_MAX_ITEMS)
[WRK]   File "/home/snowypainter/Maestro/apps/backend/src/modules/trends/trends_external.py", line 101, in get_reddit
[WRK]     r.raise_for_status()
[WRK]   File "/home/snowypainter/miniconda3/envs/fastapi-env/lib/python3.10/site-packages/httpx/_models.py", line 829, in raise_for_status
[WRK]     raise HTTPStatusError(message, request=request, response=self)
[WRK] httpx.HTTPError: Client error '403 Forbidden' for url 'https://www.reddit.com/r/all/.rss'
[WRK] For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403
"""

ASYNC_FETCH = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=3.0, read=10.0, write=5.0, pool=15.0),
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=20.0),
    headers={"User-Agent": "Maestro-Fetcher/1.0"},
    http2=True,
    follow_redirects=True,
)

SYNC_FETCH = httpx.Client(
    timeout=httpx.Timeout(connect=3.0, read=10.0, write=5.0, pool=15.0),
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=20.0),
    headers={"User-Agent": "Maestro-Fetcher/1.0"},
    http2=True,
    follow_redirects=True,
)

REDDIT_HEADERS = {
    "User-Agent": "linux:maestro.sniffer:1.0.0 (by /u/1238jf1qpzdk8d1; contact fk1289faamzdnd@gmail.com)",
    "Accept": "application/rss+xml, text/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

REDDIT_SYNC_FETCH = httpx.Client(
    timeout=httpx.Timeout(connect=3.0, read=10.0, write=5.0, pool=15.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=15.0),
    headers=REDDIT_HEADERS,
    http2=False,                 # 중요: HTTP/2 끄기
    follow_redirects=True,
)