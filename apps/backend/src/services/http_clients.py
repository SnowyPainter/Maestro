# apps/backend/src/services/http_clients.py
import httpx

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
