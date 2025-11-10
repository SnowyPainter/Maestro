from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Protocol

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from apps.backend.src.core.config import settings
from apps.backend.src.modules.link_tracking.models import TrackingLink


@dataclass
class TrackingReplacement:
    link_id: int
    token: str
    original_url: str
    public_url: str


@dataclass
class TrackingLinkContext:
    persona_id: int
    owner_user_id: int
    persona_name: Optional[str] = None
    variant_id: Optional[int] = None
    draft_id: Optional[int] = None
    platform: Optional[str] = None
    ir_revision: Optional[int] = None


class TrackingLinkAllocator(Protocol):
    def allocate(self, *, original_url: str) -> TrackingReplacement: ...


class DBTrackingLinkAllocator(TrackingLinkAllocator):
    def __init__(
        self,
        session: Session,
        *,
        context: TrackingLinkContext,
        public_base: Optional[str] = None,
    ) -> None:
        self._session = session
        self._context = context
        base = public_base or settings.LINK_TRACKING_PUBLIC_BASE
        if not base:
            raise RuntimeError("LINK_TRACKING_PUBLIC_BASE is not configured")
        self._public_base = base.rstrip("/")

    def allocate(self, *, original_url: str) -> TrackingReplacement:
        existing = _lookup_existing_link(self._session, self._context, original_url)
        if existing:
            _maybe_update_link_context(existing, self._context)
            public_url = f"{self._public_base}/l/{existing.token}"
            return TrackingReplacement(
                link_id=existing.id,
                token=existing.token,
                original_url=original_url,
                public_url=public_url,
            )

        token = _generate_token(self._session)
        link = TrackingLink(
            token=token,
            owner_user_id=self._context.owner_user_id,
            persona_id=self._context.persona_id,
            variant_id=self._context.variant_id,
            draft_id=self._context.draft_id,
            target_url=original_url,
            context=_build_context(self._context),
        )
        self._session.add(link)
        self._session.flush()
        public_url = f"{self._public_base}/l/{link.token}"
        return TrackingReplacement(
            link_id=link.id,
            token=link.token,
            original_url=original_url,
            public_url=public_url,
        )


def _generate_token(session: Session, *, retries: int = 5) -> str:
    for _ in range(retries):
        token = secrets.token_urlsafe(8)
        exists = session.execute(
            select(TrackingLink.id).where(TrackingLink.token == token)
        ).scalar_one_or_none()
        if not exists:
            return token
    raise RuntimeError("unable to allocate unique tracking token")


def _build_context(meta: TrackingLinkContext) -> dict:
    context: dict = {
        "persona_id": meta.persona_id,
        "persona_name": meta.persona_name,
        "variant_id": meta.variant_id,
        "draft_id": meta.draft_id,
        "platform": meta.platform,
        "ir_revision": meta.ir_revision,
    }
    return {k: v for k, v in context.items() if v not in (None, "", [])}


def _lookup_existing_link(
    session: Session,
    context: TrackingLinkContext,
    original_url: str,
) -> TrackingLink | None:
    stmt = select(TrackingLink).where(
        TrackingLink.persona_id == context.persona_id,
        TrackingLink.target_url == original_url,
    )
    if context.variant_id is not None:
        stmt = stmt.where(TrackingLink.variant_id == context.variant_id)
    elif context.draft_id is not None:
        stmt = stmt.where(
            TrackingLink.variant_id.is_(None),
            TrackingLink.draft_id == context.draft_id,
        )
    else:
        stmt = stmt.where(
            TrackingLink.variant_id.is_(None),
            TrackingLink.draft_id.is_(None),
        )
    stmt = stmt.order_by(TrackingLink.id.desc())
    return session.execute(stmt).scalar_one_or_none()


def _maybe_update_link_context(link: TrackingLink, context: TrackingLinkContext) -> None:
    updated = False
    if context.variant_id is not None and link.variant_id is None:
        link.variant_id = context.variant_id
        updated = True
    if context.draft_id is not None and link.draft_id is None:
        link.draft_id = context.draft_id
        updated = True
    if updated:
        link.context = _build_context(context)
        link.updated_at = datetime.now(timezone.utc)


async def resolve_tracking_link(
    db: AsyncSession,
    *,
    token: str,
) -> TrackingLink | None:
    stmt = select(TrackingLink).where(TrackingLink.token == token)
    return (await db.execute(stmt)).scalar_one_or_none()


async def record_tracking_visit(
    db: AsyncSession,
    *,
    link: TrackingLink,
    request: Request | None = None,
) -> None:
    metadata = dict(link.context or {})
    visit_meta = metadata.get("last_visit", {})
    visit_meta.update(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip": request.client.host if request and request.client else None,
            "user_agent": request.headers.get("user-agent") if request else None,
            "referer": request.headers.get("referer") if request else None,
        }
    )
    metadata["last_visit"] = {k: v for k, v in visit_meta.items() if v}
    link.context = metadata
    link.visit_count = (link.visit_count or 0) + 1
    link.last_visited_at = datetime.now(timezone.utc)
    db.add(link)
    await db.flush()


__all__ = [
    "TrackingReplacement",
    "TrackingLinkContext",
    "TrackingLinkAllocator",
    "DBTrackingLinkAllocator",
    "resolve_tracking_link",
    "record_tracking_visit",
]
