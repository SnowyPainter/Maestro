from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.db import get_db
from apps.backend.src.modules.link_tracking.service import (
    record_tracking_visit,
    resolve_tracking_link,
)

router = APIRouter(tags=["link-tracking"])


@router.get("/{token}")
async def redirect_tracking_link(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    link = await resolve_tracking_link(db, token=token)
    if not link:
        raise HTTPException(status_code=404, detail="tracking link not found")
    await record_tracking_visit(db, link=link, request=request)
    await db.commit()
    return RedirectResponse(link.target_url, status_code=307)


__all__ = ["router"]
