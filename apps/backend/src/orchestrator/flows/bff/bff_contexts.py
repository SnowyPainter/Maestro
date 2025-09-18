from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.schemas import (
    PersonaAccountOut,
    PersonaOut,
)
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.accounts.service import get_persona_account

from pydantic import BaseModel

class CurrentPersonaAccountPayload(BaseModel):
    persona_account_id: Optional[int] = None

@operator(
    key="bff.contexts.current_persona_account",
    title="Get current persona account",
    side_effect="read",
)
async def op_current_persona_account(payload: CurrentPersonaAccountPayload, ctx: TaskContext) -> PersonaAccountOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    """
    ctx.require로 굳이 안해도 planner가 자동으로 payload에 추가해줌
    """

    persona_account = await get_persona_account(db, persona_account_id=payload.persona_account_id)
    return PersonaAccountOut.model_validate(persona_account)

@FLOWS.flow(
    key="bff.contexts.current_persona_account",
    title="Get current persona account",
    description="Get the current persona account for the user",
    input_model=CurrentPersonaAccountPayload,
    output_model=PersonaAccountOut,
    method="get",
    path="/contexts/persona_account/current",
    tags=("bff", "contexts", "persona account", "current"),
)
def _flow_bff_current_persona_account(builder: FlowBuilder):
    task = builder.task("current_persona_account", "bff.contexts.current_persona_account")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.contexts.current_persona",
    title="Get current connected persona",
    description="Get the current connected persona for the user",
    input_model=CurrentPersonaAccountPayload,
    output_model=PersonaOut,
    method="get",
    path="/contexts/persona/current",
    tags=("bff", "contexts", "persona", "current"),
)
def _flow_bff_current_persona(builder: FlowBuilder):
    account_task = builder.task("current_persona_account", "bff.contexts.current_persona_account")

    def _persona_payload_factory(_state, persona_account):
        if persona_account is None:
            raise ValueError("Persona account resolution returned no data")
        persona_id = getattr(persona_account, "persona_id", None)
        if persona_id is None and isinstance(persona_account, dict):
            persona_id = persona_account.get("persona_id")
        if persona_id is None:
            raise ValueError("Persona account is missing persona_id")
        return {"persona_id": persona_id}

    persona_task = builder.task(
        "current_persona",
        "bff.accounts.read_persona",
        upstream=[account_task],
        config={
            "payload_from": "task:current_persona_account",
            "payload_factory": _persona_payload_factory,
        },
    )

    builder.expect_entry(account_task)
    builder.expect_terminal(persona_task)

__all__ = []
