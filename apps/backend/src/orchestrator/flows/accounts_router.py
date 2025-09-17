"""Accounts orchestration flows implemented via the DSL."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.backend.src.modules.accounts.schemas import (
    PersonaAccountLinkCreate,
    PersonaAccountOut,
    PersonaBase,
    PersonaCreate,
    PersonaOut,
    PersonaUpdate,
    PlatformAccountCreate,
    PlatformAccountOut,
    PlatformAccountUpdate,
)
from apps.backend.src.modules.accounts.service import (
    create_persona,
    create_platform_account,
    delete_persona,
    delete_platform_account,
    get_persona,
    get_platform_account,
    link_persona_account,
    unlink_persona_account,
    update_persona,
    update_platform_account,
)
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import TaskContext, orchestrate_flow, runtime_dependency
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class MessageOut(BaseModel):
    message: str


class PlatformAccountCreateCommand(BaseModel):
    account: PlatformAccountCreate


class PlatformAccountUpdateCommand(BaseModel):
    account_id: Optional[int] = None
    data: PlatformAccountUpdate


class PlatformAccountDeleteCommand(BaseModel):
    account_id: Optional[int] = None
    soft: bool = True


class PersonaCreatePayload(PersonaBase):
    pass


class PersonaCreateCommand(BaseModel):
    persona: PersonaCreatePayload


class PersonaUpdateCommand(BaseModel):
    persona_id: Optional[int] = None
    data: PersonaUpdate


class PersonaDeleteCommand(BaseModel):
    persona_id: Optional[int] = None


class PersonaAccountLinkCommand(BaseModel):
    link: PersonaAccountLinkCreate


class PersonaAccountUnlinkCommand(BaseModel):
    persona_id: Optional[int] = None
    account_id: Optional[int] = None


def _to_model(model_cls: type[BaseModel], value) -> BaseModel:
    if isinstance(value, model_cls):
        return value
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(value)
    if isinstance(value, BaseModel):
        return model_cls.parse_obj(value.dict())
    return model_cls.parse_obj(value)


def _model_dump(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


# ---------------------------------------------------------------------------
# Operators
# ---------------------------------------------------------------------------


@operator(
    key="accounts.platform.create_account",
    title="Create platform account",
    side_effect="write",
)
async def op_create_platform_account(
    payload: PlatformAccountCreateCommand,
    ctx: TaskContext,
) -> PlatformAccountOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    payload.account.owner_user_id = user.id  # type: ignore[attr-defined]
    created = await create_platform_account(db, payload.account)
    return _to_model(PlatformAccountOut, created)


@operator(
    key="accounts.platform.update_account",
    title="Update platform account",
    side_effect="write",
)
async def op_update_platform_account(
    payload: PlatformAccountUpdateCommand,
    ctx: TaskContext,
) -> PlatformAccountOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    if payload.account_id is None:
        raise HTTPException(status_code=422, detail="account_id is required")
    account = await get_platform_account(
        db, account_id=payload.account_id, owner_user_id=user.id
    )
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    updated = await update_platform_account(db, account=account, data=payload.data)
    return _to_model(PlatformAccountOut, updated)


@operator(
    key="accounts.platform.delete_account",
    title="Delete platform account",
    side_effect="write",
)
async def op_delete_platform_account(
    payload: PlatformAccountDeleteCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    if payload.account_id is None:
        raise HTTPException(status_code=422, detail="account_id is required")
    account = await get_platform_account(
        db, account_id=payload.account_id, owner_user_id=user.id
    )
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    await delete_platform_account(db, account=account, soft=payload.soft)
    return MessageOut(message="Platform account deleted successfully")


@operator(
    key="accounts.persona.create_persona",
    title="Create persona",
    side_effect="write",
)
async def op_create_persona(payload: PersonaCreateCommand, ctx: TaskContext) -> PersonaOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    persona_input = PersonaCreate(owner_user_id=user.id, **_model_dump(payload.persona))
    persona = await create_persona(db, persona_input)
    return _to_model(PersonaOut, persona)


@operator(
    key="accounts.persona.update_persona",
    title="Update persona",
    side_effect="write",
)
async def op_update_persona(payload: PersonaUpdateCommand, ctx: TaskContext) -> PersonaOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    if payload.persona_id is None:
        raise HTTPException(status_code=422, detail="persona_id is required")
    persona = await get_persona(
        db, persona_id=payload.persona_id, owner_user_id=user.id
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    updated = await update_persona(db, persona=persona, data=payload.data)
    return _to_model(PersonaOut, updated)


@operator(
    key="accounts.persona.delete_persona",
    title="Delete persona",
    side_effect="write",
)
async def op_delete_persona(payload: PersonaDeleteCommand, ctx: TaskContext) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    if payload.persona_id is None:
        raise HTTPException(status_code=422, detail="persona_id is required")
    persona = await get_persona(
        db, persona_id=payload.persona_id, owner_user_id=user.id
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    await delete_persona(db, persona=persona)
    return MessageOut(message="Persona deleted successfully")


@operator(
    key="accounts.link.create_link",
    title="Link persona/account",
    side_effect="write",
)
async def op_link_persona_account(
    payload: PersonaAccountLinkCommand,
    ctx: TaskContext,
) -> PersonaAccountOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    link = await link_persona_account(db, payload.link, owner_user_id=user.id)
    return _to_model(PersonaAccountOut, link)


@operator(
    key="accounts.link.unlink",
    title="Unlink persona/account",
    side_effect="write",
)
async def op_unlink_persona_account(
    payload: PersonaAccountUnlinkCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    if payload.persona_id is None or payload.account_id is None:
        raise HTTPException(status_code=422, detail="persona_id and account_id are required")
    await unlink_persona_account(
        db,
        persona_id=payload.persona_id,
        account_id=payload.account_id,
        owner_user_id=user.id,
    )
    return MessageOut(message="Persona-account link removed successfully")


# ---------------------------------------------------------------------------
# Flow registrations
# ---------------------------------------------------------------------------


@FLOWS.flow(
    key="accounts.platform.create",
    title="Create New Platform Account",
    description="Create a new platform account (social media, website, etc.) for the user",
    input_model=PlatformAccountCreateCommand,
    output_model=PlatformAccountOut,
    method="post",
    path="/accounts/platform",
    tags=("accounts", "platform", "create", "social-media"),
)
def _flow_create_platform(builder: FlowBuilder):
    task = builder.task("create_platform", "accounts.platform.create_account")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.platform.update",
    title="Update Platform Account Details",
    description="Update platform account information like username, credentials, or settings",
    input_model=PlatformAccountUpdateCommand,
    output_model=PlatformAccountOut,
    method="put",
    path="/accounts/platform/{account_id}",
    tags=("accounts", "platform", "update", "social-media"),
)
def _flow_update_platform(builder: FlowBuilder):
    task = builder.task("update_platform", "accounts.platform.update_account")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.platform.delete",
    title="Remove Platform Account",
    description="Permanently delete a platform account and all associated data",
    input_model=PlatformAccountDeleteCommand,
    output_model=MessageOut,
    method="delete",
    path="/accounts/platform/{account_id}",
    tags=("accounts", "platform", "delete", "social-media", "dangerous"),
)
def _flow_delete_platform(builder: FlowBuilder):
    task = builder.task("delete_platform", "accounts.platform.delete_account")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.persona.create",
    title="Create New Persona Profile",
    description="Create a new persona with specific characteristics for content targeting",
    input_model=PersonaCreateCommand,
    output_model=PersonaOut,
    method="post",
    path="/accounts/personas",
    tags=("accounts", "persona", "create", "audience", "targeting"),
)
def _flow_create_persona(builder: FlowBuilder):
    task = builder.task("create_persona", "accounts.persona.create_persona")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.persona.update",
    title="Update Persona Profile",
    description="Modify persona characteristics, demographics, or targeting preferences",
    input_model=PersonaUpdateCommand,
    output_model=PersonaOut,
    method="put",
    path="/accounts/personas/{persona_id}",
    tags=("accounts", "persona", "update", "audience", "targeting"),
)
def _flow_update_persona(builder: FlowBuilder):
    task = builder.task("update_persona", "accounts.persona.update_persona")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.persona.delete",
    title="Remove Persona Profile",
    description="Permanently delete a persona and all associated targeting data",
    input_model=PersonaDeleteCommand,
    output_model=MessageOut,
    method="delete",
    path="/accounts/personas/{persona_id}",
    tags=("accounts", "persona", "delete", "audience", "targeting", "dangerous"),
)
def _flow_delete_persona(builder: FlowBuilder):
    task = builder.task("delete_persona", "accounts.persona.delete_persona")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.link.create",
    title="Connect Persona to Platform Account",
    description="Link a persona profile to a specific platform account for targeted content",
    input_model=PersonaAccountLinkCommand,
    output_model=PersonaAccountOut,
    method="post",
    path="/accounts/persona-account-links",
    tags=("accounts", "persona", "platform", "link", "targeting"),
)
def _flow_link_persona_account(builder: FlowBuilder):
    task = builder.task("link_persona_account", "accounts.link.create_link")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="accounts.link.delete",
    title="Disconnect Persona from Platform Account",
    description="Remove the connection between a persona and a platform account",
    input_model=PersonaAccountUnlinkCommand,
    output_model=MessageOut,
    method="delete",
    path="/accounts/persona-account-links/{persona_id}/{account_id}",
    tags=("accounts", "persona", "platform", "unlink", "targeting"),
)
def _flow_unlink_persona_account(builder: FlowBuilder):
    task = builder.task("unlink_persona_account", "accounts.link.unlink")
    builder.expect_terminal(task)


router = FLOWS.build_router(
    orchestrate_flow,
    prefix="",
    tags=["accounts"],
    runtime_dependency=runtime_dependency,
    flow_filter=lambda flow: "accounts" in flow.tags and "bff" not in flow.tags,
)


__all__ = ["router"]
