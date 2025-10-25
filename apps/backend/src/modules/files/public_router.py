from __future__ import annotations

from typing import Iterable

import httpx
from fastapi import APIRouter, HTTPException, Response
from urllib.parse import quote

from apps.backend.src.core.config import settings
from apps.backend.src.services.http_clients import ASYNC_FETCH


router = APIRouter(tags=["files", "media"])

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
    object_enc = _encode_path(object_path.split("/")) if object_path else ""
    target_url = f"{base_url}/{quote(bucket, safe='')}"
    if object_enc:
        target_url = f"{target_url}/{object_enc}"

    try:
        response = await ASYNC_FETCH.request(method, target_url, timeout=30.0)
        response.raise_for_status()
        headers = {
            k: v
            for k, v in response.headers.items()
            if k.lower() in _FORWARDED_HEADERS
        }
        headers.update(
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cross-Origin-Resource-Policy": "cross-origin",
                "Cross-Origin-Embedder-Policy": "unsafe-none",
                "Cross-Origin-Opener-Policy": "unsafe-none",
            }
        )
        media_type = headers.get("content-type")
        if not media_type or media_type == "application/octet-stream":
            from mimetypes import guess_type

            guess, _ = guess_type(object_path)
            if guess:
                media_type = guess
                headers["content-type"] = media_type
            else:
                media_type = "application/octet-stream"

        if method == "HEAD":
            return Response(status_code=response.status_code, headers=headers)

        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=media_type,
            headers=headers,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Proxy failed: {exc}")


@router.get("/{bucket}/{object_path:path}")
async def get_media(bucket: str, object_path: str):
    return await _proxy_media(bucket, object_path, method="GET")


@router.head("/{bucket}/{object_path:path}")
async def head_media(bucket: str, object_path: str):
    return await _proxy_media(bucket, object_path, method="HEAD")


__all__ = ["router"]
