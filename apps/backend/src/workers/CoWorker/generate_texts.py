"""Celery tasks that transform user prompts into persona-aware copy."""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select, create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.backend.src.core.celery_app import celery_app
from apps.backend.src.core.context import (
    get_campaign_id,
    get_persona_account_id,
    get_request_id,
    get_user_id,
)
from apps.backend.src.core.config import settings
from apps.backend.src.modules.accounts.models import Persona, PersonaAccount
from apps.backend.src.modules.campaigns.models import Campaign
from apps.backend.src.modules.llm.schemas import LlmInvokeContext, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.modules.playbooks.models import Playbook, PlaybookLog

logger = logging.getLogger(__name__)
ENGINE = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=ENGINE, autocommit=False, autoflush=False)
_LOOP: Optional[asyncio.AbstractEventLoop] = None
_LOOP_THREAD: Optional[threading.Thread] = None
_LOOP_LOCK = threading.Lock()


def _loop_runner(loop: asyncio.AbstractEventLoop) -> None:
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _ensure_loop() -> asyncio.AbstractEventLoop:
    global _LOOP, _LOOP_THREAD
    with _LOOP_LOCK:
        needs_start = False
        if _LOOP is None or _LOOP.is_closed():
            _LOOP = asyncio.new_event_loop()
            needs_start = True
        if needs_start or _LOOP_THREAD is None or not _LOOP_THREAD.is_alive():
            _LOOP_THREAD = threading.Thread(
                target=_loop_runner,
                name="coworker-generate-loop",
                args=(_LOOP,),
                daemon=True,
            )
            _LOOP_THREAD.start()
    return _LOOP  # type: ignore[return-value]


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


def _gather_context(
    persona_account_id: Optional[int],
    campaign_id: Optional[int],
) -> Tuple[Optional[Persona], Optional[Campaign], Optional[Dict[str, Any]]]:
    with SessionLocal() as session:
        persona, _ = _load_persona_scope(session, persona_account_id)
        campaign = _load_campaign(session, campaign_id, persona)
        playbook_summary = _load_playbook_summary(session, persona, campaign)
    return persona, campaign, playbook_summary


def _load_persona_scope(
    session: Session, persona_account_id: Optional[int]
) -> Tuple[Optional[Persona], Optional[PersonaAccount]]:
    if persona_account_id is None:
        return None, None
    acct = session.get(PersonaAccount, persona_account_id)
    if acct is None:
        return None, None
    persona = session.get(Persona, acct.persona_id)
    return persona, acct


def _load_campaign(
    session: Session,
    campaign_id: Optional[int],
    persona: Optional[Persona] = None,
) -> Optional[Campaign]:
    if campaign_id is not None:
        return session.get(Campaign, campaign_id)
    if persona is None:
        return None
    stmt = (
        select(Campaign)
        .where(Campaign.owner_user_id == persona.owner_user_id)
        .order_by(Campaign.created_at.desc())
        .limit(1)
    )
    return session.execute(stmt).scalar_one_or_none()


def _load_playbook_summary(
    session: Session,
    persona: Optional[Persona],
    campaign: Optional[Campaign],
    *,
    log_limit: int = 5,
) -> Optional[Dict[str, Any]]:
    if persona is None or campaign is None:
        return None
    playbook_stmt = (
        select(Playbook)
        .where(
            Playbook.persona_id == persona.id,
            Playbook.campaign_id == campaign.id,
        )
        .limit(1)
    )
    playbook = session.execute(playbook_stmt).scalar_one_or_none()
    if playbook is None:
        return None
    logs_stmt = (
        select(PlaybookLog)
        .where(PlaybookLog.playbook_id == playbook.id)
        .order_by(PlaybookLog.timestamp.desc())
        .limit(log_limit)
    )
    logs = session.execute(logs_stmt).scalars().all()
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


async def _invoke_llm(
    prompt_text: str,
    *,
    persona_account_id: Optional[int],
    persona_brief: Optional[Dict[str, Any]],
    campaign_brief: Optional[Dict[str, Any]],
    playbook_summary: Optional[Dict[str, Any]],
) -> str:
    service = LLMService.instance()
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
    )

    data = result.get("data") or {}
    text = data.get("text")
    if not text:
        logger.error("LLM response missing 'text' field", extra={"result": result})
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
    persona_account_id = _parse_int(get_persona_account_id())
    campaign_id = _parse_int(get_campaign_id())
    persona, campaign, playbook_summary = _gather_context(
        persona_account_id,
        campaign_id,
    )
    persona_brief = _persona_to_brief(persona)
    campaign_brief = _campaign_to_brief(campaign)

    async def _execute() -> str:
        return await _invoke_llm(
            prompt_text,
            persona_account_id=persona_account_id,
            persona_brief=persona_brief,
            campaign_brief=campaign_brief,
            playbook_summary=playbook_summary,
        )

    loop = _ensure_loop()
    future = asyncio.run_coroutine_threadsafe(_execute(), loop)
    try:
        return future.result()
    except Exception as exc:
        logger.exception("generate_contextual_text failed")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
        raise
