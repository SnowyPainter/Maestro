from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel, field_serializer

from apps.backend.src.modules.llm.schemas import LlmInvokeContext, LlmResult, PromptKey, PromptVars
from apps.backend.src.modules.llm.service import LLMService
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator


class LlmInvokePayload(BaseModel):
    prompt_key: PromptKey
    vars: PromptVars
    version: str | None = None
    context: LlmInvokeContext | None = None

    @field_serializer("context")
    def _serialize_context(self, ctx: LlmInvokeContext | None):
        return ctx.model_dump(exclude_none=True) if isinstance(ctx, LlmInvokeContext) else ctx


@operator(
    key="internal.llm.invoke",
    title="Invoke LLM",
    side_effect="write",
    queue="generator",
)
async def op_llm_invoke(payload: LlmInvokePayload, ctx: TaskContext) -> LlmResult:
    session = ctx.optional(AsyncSession)
    invoke_ctx = payload.context or LlmInvokeContext()
    result = await LLMService.instance().ainvoke(
        prompt_key=payload.prompt_key,
        vars=payload.vars,
        ctx=invoke_ctx,
        version=payload.version,
        session=session,
    )
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return LlmResult.model_validate(result)


@FLOWS.flow(
    key="internal.llm.invoke",
    title="Invoke LLM",
    description="Invoke the configured LLM provider with a registered prompt",
    input_model=LlmInvokePayload,
    output_model=LlmResult,
    method="post",
    path="/internal/llm/invoke",
    tags=("internal", "llm"),
)
def _flow_llm_invoke(builder: FlowBuilder):
    task = builder.task("invoke", "internal.llm.invoke")
    builder.expect_terminal(task)
