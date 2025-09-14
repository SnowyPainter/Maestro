from __future__ import annotations

import asyncio
import httpx
import numpy as np
from typing import List, Any
from apps.backend.src.core.config import settings

EMBED_URL = settings.EMBED_PROVIDER_URL
EMBED_DIM = settings.EMBED_DIM
NORMALIZE = settings.EMBED_NORMALIZE

# ─────────────────────────────────────────────────────────────────────────────
# Long-lived HTTP clients (purpose-specific)
#  - Async: API 서버(예: FastAPI)에서 사용
#  - Sync : Celery 워커 등 동기 컨텍스트에서 사용
# ─────────────────────────────────────────────────────────────────────────────
_ASYNC_EMBED_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=30.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30.0),
    headers={"User-Agent": "Maestro-Embeddings/1.0"},
    http2=False,            # 서버가 HTTP/2 안정적이면 True로 바꿔도 됨
    follow_redirects=True,
)

_SYNC_EMBED_CLIENT = httpx.Client(
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=30.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30.0),
    headers={"User-Agent": "Maestro-Embeddings/1.0"},
    http2=False,
    follow_redirects=True,
)

# ─────────────────────────────────────────────────────────────────────────────
# Retry helpers (지수 백오프)
# ─────────────────────────────────────────────────────────────────────────────
_RETRYABLE_EXC = (
    httpx.ReadError,
    httpx.ConnectError,
    httpx.RemoteProtocolError,
    httpx.PoolTimeout,
)

def _extract_vectors(payload: Any) -> List[List[float]]:
    # 2D list 바로 주는 케이스: [[...], [...]]
    if isinstance(payload, list):
        if not payload:
            return []
        if isinstance(payload[0], list):
            return payload
        if isinstance(payload[0], dict) and "embedding" in payload[0]:
            return [it["embedding"] for it in payload]

    if isinstance(payload, dict):
        if "data" in payload:
            data = payload["data"]
            if isinstance(data, list):
                if data and isinstance(data[0], list):
                    return data
                if data and isinstance(data[0], dict) and "embedding" in data[0]:
                    return [it["embedding"] for it in data]
            if isinstance(data, dict) and "embedding" in data:
                return [data["embedding"]]
        if "embeddings" in payload and isinstance(payload["embeddings"], list):
            return payload["embeddings"]
        if "embedding" in payload and isinstance(payload["embedding"], list):
            return [payload["embedding"]]

    raise ValueError(f"Unknown embedding response shape: {type(payload).__name__}")


async def _post_json_async(url: str, payload: dict, max_tries: int = 5):
    backoff = 1.0
    for attempt in range(1, max_tries + 1):
        try:
            resp = await _ASYNC_EMBED_CLIENT.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
        except _RETRYABLE_EXC:
            if attempt == max_tries:
                raise
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2.0, 16.0)
        except httpx.HTTPStatusError as e:
            if 500 <= e.response.status_code < 600:
                if attempt == max_tries:
                    raise
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2.0, 16.0)
                continue
            # 4xx 등은 즉시 실패
            raise

def _post_json_sync(url: str, payload: dict, max_tries: int = 5):
    backoff = 1.0
    for attempt in range(1, max_tries + 1):
        try:
            resp = _SYNC_EMBED_CLIENT.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
        except _RETRYABLE_EXC:
            if attempt == max_tries:
                raise
            import time
            time.sleep(backoff)
            backoff = min(backoff * 2.0, 16.0)
        except httpx.HTTPStatusError as e:
            if 500 <= e.response.status_code < 600:
                if attempt == max_tries:
                    raise
                import time
                time.sleep(backoff)
                backoff = min(backoff * 2.0, 16.0)
                continue
            raise

# ─────────────────────────────────────────────────────────────────────────────
# Normalization / shape check
# ─────────────────────────────────────────────────────────────────────────────
def _postproc_and_validate(vecs: List[List[float]]) -> List[List[float]]:
    if NORMALIZE:
        arr = np.array(vecs, dtype="float32")
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        vecs = (arr / norms).tolist()
    if any(len(v) != EMBED_DIM for v in vecs):
        raise ValueError(f"Embedding dim mismatch. expected={EMBED_DIM}")
    return vecs

# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────
async def embed_texts(texts: List[str]) -> List[List[float]]:
    data = await _post_json_async(EMBED_URL, {"inputs": texts, "truncate": True})
    vecs = _extract_vectors(data)
    return _postproc_and_validate(vecs)

def embed_texts_sync(texts: List[str]) -> List[List[float]]:
    data = _post_json_sync(EMBED_URL, {"inputs": texts, "truncate": True})
    vecs = _extract_vectors(data)
    return _postproc_and_validate(vecs)

# 배치 upsert (AsyncSession)
async def upsert_trend_embeddings(db, rows: List[tuple[int, str]]):
    """
    rows: [(trend_id, title), ...]
    """
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession
    assert isinstance(db, AsyncSession)

    if not rows:
        return 0

    titles = [t for _, t in rows]
    vecs = await embed_texts(titles)

    # executemany 스타일 (드라이버가 지원하면 한 방에)
    sql = text("UPDATE trends SET title_embedding = (:vec)::vector WHERE id = :id")
    params = [{"id": tid, "vec": v} for (tid, _), v in zip(rows, vecs)]
    await db.execute(sql, params)
    await db.commit()
    return len(params)
