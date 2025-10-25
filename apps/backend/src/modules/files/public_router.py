from __future__ import annotations

from typing import Iterable

import httpx
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from urllib.parse import quote

from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import ASYNC_FETCH


router = APIRouter(tags=["files", "media"], default_response_class=StreamingResponse)

_FORWARDED_HEADERS: set[str] = {
    "content-type",
    "content-length",
    "content-disposition",
    "last-modified",
    "etag",
    "cache-control",
    "accept-ranges",
}


def _seaweed_base_url() -> str:
    base = settings.SEAWEEDFS_ENDPOINT
    if not base:
        raise HTTPException(status_code=503, detail="storage endpoint not configured")
    if not base.startswith(("http://", "https://")):
        base = f"http://{base}"
    return base.rstrip("/")


def _encode_path(parts: Iterable[str]) -> str:
    return "/".join(quote(part, safe="") for part in parts)

async def _proxy_media(bucket: str, object_path: str, method: str):
    base_url = _seaweed_base_url()
    bucket_enc = quote(bucket, safe="")
    object_enc = _encode_path(object_path.split("/")) if object_path else ""
    target_url = f"{base_url}/{bucket_enc}"
    if object_enc:
        target_url = f"{target_url}/{object_enc}"

    try:
        # ⚠️ 여기서는 async with 하지 말고 generator 안에서 열기
        async def iter_stream():
            async with ASYNC_FETCH.stream(method, target_url, timeout=30.0) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    yield chunk

        # 첫 요청 시 header용 preflight
        async with ASYNC_FETCH.stream("HEAD", target_url, timeout=5.0) as head_response:
            head_response.raise_for_status()
            headers = {
                k: v
                for k, v in head_response.headers.items()
                if k.lower() in _FORWARDED_HEADERS
            }
            headers.pop("content-length", None)
            content_type = headers.get("content-type")

        if method == "HEAD":
            return Response(status_code=200, headers=headers)

        return StreamingResponse(
            iter_stream(),
            status_code=200,
            headers=headers,
            media_type=content_type,
        )

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="media not found")
        raise HTTPException(status_code=502, detail=f"media proxy failed: HTTP {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"media proxy failed: {exc}")


@router.get("/{bucket}/{object_path:path}")
async def get_media(bucket: str, object_path: str):
    return await _proxy_media(bucket, object_path, method="GET")


@router.head("/{bucket}/{object_path:path}")
async def head_media(bucket: str, object_path: str):
    return await _proxy_media(bucket, object_path, method="HEAD")


__all__ = ["router"]
