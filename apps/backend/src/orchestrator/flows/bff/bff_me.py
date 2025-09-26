"""BFF read flow for current user."""

from __future__ import annotations

from pydantic import BaseModel

from apps.backend.src.modules.users.schemas import UserResponse
from apps.backend.src.modules.users.models import User

from apps.backend.src.orchestrator.dispatch import (
    TaskContext,
    orchestrate_flow,
    runtime_dependency,
)
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class MeRequest(BaseModel):
    pass


@operator(
    key="bff.me.read_me",
    title="BFF Read Current User",
    side_effect="read",
)
async def op_read_me(payload: MeRequest, ctx: TaskContext) -> UserResponse:
    user: User = ctx.require(User)
    return UserResponse.model_validate(user)


@FLOWS.flow(
    key="bff.me.read_me",
    title="Get Current User Profile",
    description="Retrieve authenticated user profile information for user interface and settings",
    input_model=MeRequest,
    output_model=UserResponse,
    method="get",
    path="/me",
    tags=("bff", "me", "user", "profile", "read", "ui", "frontend", "authentication"),
)
def _flow_bff_read_me(builder: FlowBuilder):
    task = builder.task("read_me", "bff.me.read_me")
    builder.expect_terminal(task)

__all__ = []

