"""BFF read flows for accounts resources."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, RootModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.schemas import (
    PersonaAccountOut,
    PersonaOut,
    PlatformAccountOut,
)
from apps.backend.src.modules.accounts.service import (
    get_persona,
    get_platform_account,
    is_valid_platform_account,
    list_accounts_for_persona,
    list_personas,
    list_personas_for_account,
    list_platform_accounts,
)
from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import (
    TaskContext,
    orchestrate_flow,
    runtime_dependency,
)
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class PlatformAccountReadPayload(BaseModel):
    account_id: int


class PlatformAccountListPayload(BaseModel):
    platform: Optional[PlatformKind] = None
    handle: Optional[str] = None
    limit: int = 50
    offset: int = 0


class PersonaReadPayload(BaseModel):
    persona_id: int


class PersonaListPayload(BaseModel):
    name: Optional[str] = None
    limit: int = 50
    offset: int = 0


class PersonaAccountsPayload(BaseModel):
    persona_id: int


class AccountPersonasPayload(BaseModel):
    account_id: int


class PlatformAccountList(RootModel[list[PlatformAccountOut]]):
    pass


class PersonaList(RootModel[list[PersonaOut]]):
    pass


class PersonaAccountList(RootModel[list[PersonaAccountOut]]):
    pass

class IsValidOut(BaseModel):
    is_valid: bool

@operator(
    key="bff.accounts.read_platform_account",
    title="Read platform account",
    side_effect="read",
)
async def op_read_platform_account(
    payload: PlatformAccountReadPayload,
    ctx: TaskContext,
) -> PlatformAccountOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    account = await get_platform_account(
        db, account_id=payload.account_id, owner_user_id=user.id
    )
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    return PlatformAccountOut.model_validate(account)

@operator(
    key="bff.accounts.is_valid_platform_account",
    title="Check if platform account is valid",
    side_effect="read",
)
async def op_is_valid_platform_account(payload: PlatformAccountReadPayload, ctx: TaskContext) -> IsValidOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    is_valid = await is_valid_platform_account(db, account_id=payload.account_id, owner_user_id=user.id)
    return IsValidOut(is_valid=is_valid)

@operator(
    key="bff.accounts.list_platform_accounts",
    title="List platform accounts",
    side_effect="read",
)
async def op_list_platform_accounts(
    payload: PlatformAccountListPayload,
    ctx: TaskContext,
) -> PlatformAccountList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    accounts = await list_platform_accounts(
        db,
        owner_user_id=user.id,
        platform=payload.platform,
        q_handle=payload.handle,
        limit=payload.limit,
        offset=payload.offset,
    )
    items = [PlatformAccountOut.model_validate(acc) for acc in accounts]
    return PlatformAccountList(root=items)


@operator(
    key="bff.accounts.read_persona",
    title="Read persona",
    side_effect="read",
)
async def op_read_persona(payload: PersonaReadPayload, ctx: TaskContext) -> PersonaOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    persona = await get_persona(db, persona_id=payload.persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return PersonaOut.model_validate(persona)


@operator(
    key="bff.accounts.list_personas",
    title="List personas",
    side_effect="read",
)
async def op_list_personas(payload: PersonaListPayload, ctx: TaskContext) -> PersonaList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    personas = await list_personas(
        db,
        owner_user_id=user.id,
        q_name=payload.name,
        limit=payload.limit,
        offset=payload.offset,
    )
    items = [PersonaOut.model_validate(per) for per in personas]
    return PersonaList(root=items)


@operator(
    key="bff.accounts.list_accounts_for_persona",
    title="List accounts for persona",
    side_effect="read",
)
async def op_list_accounts_for_persona(
    payload: PersonaAccountsPayload,
    ctx: TaskContext,
) -> PersonaAccountList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    persona = await get_persona(db, persona_id=payload.persona_id, owner_user_id=user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    links = await list_accounts_for_persona(db, persona_id=payload.persona_id)
    items = [PersonaAccountOut.model_validate(link) for link in links]
    return PersonaAccountList(root=items)


@operator(
    key="bff.accounts.list_personas_for_account",
    title="List personas for account",
    side_effect="read",
)
async def op_list_personas_for_account(
    payload: AccountPersonasPayload,
    ctx: TaskContext,
) -> PersonaAccountList:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    account = await get_platform_account(
        db, account_id=payload.account_id, owner_user_id=user.id
    )
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    links = await list_personas_for_account(db, account_id=payload.account_id)
    items = [PersonaAccountOut.model_validate(link) for link in links]
    return PersonaAccountList(root=items)

@FLOWS.flow(
    key="bff.accounts.is_valid_platform_account",
    title="Check if platform account is valid",
    description="Check if a platform account is valid for UI display",
    input_model=PlatformAccountReadPayload,
    output_model=IsValidOut,
    method="get",
    path="/accounts/platform/{account_id}/is-valid",
    tags=("bff", "accounts", "platform", "read", "ui", "frontend", "validation"),
)
def _flow_bff_is_valid_platform_account(builder: FlowBuilder):
    task = builder.task("is_valid_platform_account", "bff.accounts.is_valid_platform_account")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.accounts.read_platform_account",
    title="Get Platform Account Details",
    description="Retrieve detailed information about a specific platform account for UI display",
    input_model=PlatformAccountReadPayload,
    output_model=PlatformAccountOut,
    method="get",
    path="/accounts/platform/{account_id}",
    tags=("bff", "accounts", "platform", "read", "ui", "frontend"),
)
def _flow_bff_read_platform_account(builder: FlowBuilder):
    task = builder.task("read_platform_account", "bff.accounts.read_platform_account")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="bff.accounts.list_platform_accounts",
    title="List All Platform Accounts",
    description="Get paginated list of all platform accounts for account management interface",
    input_model=PlatformAccountListPayload,
    output_model=PlatformAccountList,
    method="get",
    path="/accounts/platform",
    tags=("bff", "accounts", "platform", "list", "ui", "frontend", "pagination"),
)
def _flow_bff_list_platform_accounts(builder: FlowBuilder):
    task = builder.task("list_platform_accounts", "bff.accounts.list_platform_accounts")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.accounts.read_persona",
    title="Get Persona Profile Details",
    description="Retrieve detailed persona profile information for audience targeting setup",
    input_model=PersonaReadPayload,
    output_model=PersonaOut,
    method="get",
    path="/accounts/personas/{persona_id}",
    tags=("bff", "accounts", "persona", "read", "ui", "frontend", "audience", "targeting"),
)
def _flow_bff_read_persona(builder: FlowBuilder):
    task = builder.task("read_persona", "bff.accounts.read_persona")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.accounts.list_personas",
    title="List All Persona Profiles",
    description="Get paginated list of all persona profiles for campaign targeting configuration",
    input_model=PersonaListPayload,
    output_model=PersonaList,
    method="get",
    path="/accounts/personas",
    tags=("bff", "accounts", "persona", "list", "ui", "frontend", "audience", "targeting", "pagination"),
)
def _flow_bff_list_personas(builder: FlowBuilder):
    task = builder.task("list_personas", "bff.accounts.list_personas")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.accounts.list_accounts_for_persona",
    title="Get Platform Accounts for Persona",
    description="List all platform accounts connected to a specific persona for content distribution",
    input_model=PersonaAccountsPayload,
    output_model=PersonaAccountList,
    method="get",
    path="/accounts/personas/{persona_id}/accounts",
    tags=("bff", "accounts", "persona", "platform", "list", "ui", "frontend", "distribution"),
)
def _flow_bff_list_accounts_for_persona(builder: FlowBuilder):
    task = builder.task("list_accounts_for_persona", "bff.accounts.list_accounts_for_persona")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="bff.accounts.list_personas_for_account",
    title="Get Personas for Platform Account",
    description="List all personas linked to a specific platform account for targeted content strategy",
    input_model=AccountPersonasPayload,
    output_model=PersonaAccountList,
    method="get",
    path="/accounts/platform/{account_id}/personas",
    tags=("bff", "accounts", "persona", "platform", "list", "ui", "frontend", "strategy"),
)
def _flow_bff_list_personas_for_account(builder: FlowBuilder):
    task = builder.task("list_personas_for_account", "bff.accounts.list_personas_for_account")
    builder.expect_terminal(task)


__all__ = []
