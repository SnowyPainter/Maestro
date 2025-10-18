"""Celery tasks that transform user prompts into persona-aware copy."""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional, Tuple, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.core.celery_app import celery_app
from apps.backend.src.core.context import (
    get_campaign_id,
    get_persona_account_id,
    get_request_id,
    get_user_id,
)
from apps.backend.src.core.db import SessionLocal as AsyncSessionLocal
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.llm.schemas import LlmInvokeContext, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.modules.playbooks import service as playbook_service

logger = logging.getLogger(__name__)


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _iso(dt) -> Optional[str]:
    if dt is None:
        return None
    try:
        return dt.isoformat()
    except AttributeError:
        return None


async def _load_persona_scope(
    session: AsyncSession, persona_account_id: Optional[int]
) -> Tuple[Optional[Persona], Optional[PersonaAccount]]:
    if persona_account_id is None:
        return None, None
    acct = await session.get(PersonaAccount, persona_account_id)
    if acct is None:
        return None, None
    persona = await session.get(Persona, acct.persona_id)
    return persona, acct


async def _load_campaign(
    session: AsyncSession,
    campaign_id: Optional[int],
    persona: Optional[Persona] = None,
) -> Optional[Campaign]:
    if campaign_id is not None:
        return await session.get(Campaign, campaign_id)
    if persona is None:
        return None
    stmt = (
        select(Campaign)
        .where(Campaign.owner_user_id == persona.owner_user_id)
        .order_by(Campaign.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _load_playbook_summary(
    session: AsyncSession,
    persona: Optional[Persona],
    campaign: Optional[Campaign],
    *,
    log_limit: int = 5,
) -> Optional[Dict[str, Any]]:
    if persona is None or campaign is None:
        return None
    playbook = await playbook_service.find_playbook(
        session,
        persona_id=persona.id,
        campaign_id=campaign.id,
    )
    if playbook is None:
        return None
    logs, _ = await playbook_service.list_logs(
        session,
        playbook_id=playbook.id,
        limit=log_limit,
        offset=0,
    )
    return {
        "id": playbook.id,
        "aggregate_kpi": playbook.aggregate_kpi,
        "best_time_window": playbook.best_time_window,
        "best_tone": playbook.best_tone,
        "top_hashtags": playbook.top_hashtags,
        "last_event": playbook.last_event,
        "last_updated": _iso(playbook.last_updated),
        "logs": [
            {
                "event": log.event,
                "timestamp": _iso(log.timestamp),
                "message": log.message,
                "meta": log.meta,
            }
            for log in logs
        ],
    }


def _persona_to_brief(persona: Optional[Persona]) -> Optional[Dict[str, Any]]:
    if persona is None:
        return None
    return {
        "id": persona.id,
        "name": persona.name,
        "language": persona.language,
        "tone": persona.tone,
        "style_guide": persona.style_guide,
        "pillars": list(persona.pillars or []),
        "banned_words": list(persona.banned_words or []),
        "default_hashtags": list(persona.default_hashtags or []),
        "hashtag_rules": persona.hashtag_rules,
        "link_policy": persona.link_policy,
        "posting_windows": persona.posting_windows,
        "bio": persona.bio,
    }


def _campaign_to_brief(campaign: Optional[Campaign]) -> Optional[Dict[str, Any]]:
    if campaign is None:
        return None
    return {
        "id": campaign.id,
        "name": campaign.name,
        "description": campaign.description,
        "start_at": _iso(campaign.start_at),
        "end_at": _iso(campaign.end_at),
    }


def _build_llm_context(persona_account_id: Optional[int]) -> LlmInvokeContext:
    return LlmInvokeContext(
        request_id=get_request_id(),
        user_id=get_user_id(),
        account_id=str(persona_account_id) if persona_account_id is not None else None,
        endpoint="helpers.generate_text",
        action="coworker.generate_text",
    )


async def _run_generation(prompt_text: str) -> str:
    service = LLMService.instance()
    persona_account_id = _parse_int(get_persona_account_id())
    campaign_id = _parse_int(get_campaign_id())

    async with AsyncSessionLocal() as session:  # type: ignore[assignment]
        persona, _ = await _load_persona_scope(session, persona_account_id)
        campaign = await _load_campaign(session, campaign_id, persona)
        playbook_summary = await _load_playbook_summary(session, persona, campaign)

        persona_brief = _persona_to_brief(persona)
        campaign_brief = _campaign_to_brief(campaign)

        prompt_vars = PromptVars(
            text=prompt_text,
            tone=persona_brief.get("tone") if persona_brief else None,
            persona_brief=persona_brief,
            campaign_brief=campaign_brief,
            playbook_summary=playbook_summary,
        )
        ctx = _build_llm_context(persona_account_id)
        result = await service.ainvoke(
            PromptKey.COWORKER_CONTEXTUAL_WRITE,
            prompt_vars,
            ctx=ctx,
            session=session,
        )

    data = result.get("data") or {}
    text = data.get("text")
    if not text:
        raise ValueError("LLM response did not include 'text' field")
    return text


@celery_app.task(
    name="apps.backend.src.workers.CoWorker.generate_texts.generate_contextual_text",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="coworker",
)
def generate_contextual_text(self, prompt_text: str) -> str:
    """
    Generate brand-aware copy from a single user prompt.
    """

    async def _execute() -> str:
        return await _run_generation(prompt_text)

    try:
        return asyncio.run(_execute())
    except Exception as exc:
        logger.exception("generate_contextual_text failed")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
        raise
