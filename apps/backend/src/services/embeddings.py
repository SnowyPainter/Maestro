from __future__ import annotations
import httpx, numpy as np
from typing import List
from apps.backend.src.core.config import settings

EMBED_URL = settings.EMBED_PROVIDER_URL
EMBED_DIM = settings.EMBED_DIM
NORMALIZE = settings.EMBED_NORMALIZE

async def embed_texts(texts: List[str]) -> List[List[float]]:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(EMBED_URL, json={"input": texts, "truncate": True})
        r.raise_for_status()
        vecs = [d["embedding"] for d in r.json()["data"]]
    if NORMALIZE:
        arr = np.array(vecs, dtype="float32")
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        vecs = (arr / norms).tolist()
    if any(len(v) != EMBED_DIM for v in vecs):
        raise ValueError(f"Embedding dim mismatch. expected={EMBED_DIM}")
    return vecs

def embed_texts_sync(texts: List[str]) -> List[List[float]]:
    with httpx.Client(timeout=30) as client:
        r = client.post(EMBED_URL, json={"input": texts, "truncate": True})
        r.raise_for_status()
        vecs = [d["embedding"] for d in r.json()["data"]]
    if NORMALIZE:
        arr = np.array(vecs, dtype="float32")
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        vecs = (arr / norms).tolist()
    if any(len(v) != EMBED_DIM for v in vecs):
        raise ValueError(f"Embedding dim mismatch. expected={EMBED_DIM}")
    return vecs

async def upsert_trend_embeddings(db, rows: List[tuple[int, str]]):
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession
    assert isinstance(db, AsyncSession)
    titles = [t for _, t in rows]
    vecs = await embed_texts(titles)
    sql = text("UPDATE trends SET title_embedding = (:vec)::vector WHERE id = :id")
    for (tid, _), v in zip(rows, vecs):
        await db.execute(sql, {"id": tid, "vec": v})
    await db.commit()
