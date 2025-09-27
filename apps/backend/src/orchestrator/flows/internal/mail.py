# apps/backend/src/orchestrator/flows/internal/mail.py

from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.mail.service import ingest_draft_mail
from . import operators as mail_ops


class EmailInboundPayload(BaseModel):
    """Draft mail payload."""
    subject: str | None = None
    from_email: str | None = None
    sender: str | None = None
    envelope: Dict[str, Any] | None = None
    text: str | None = None
    body: str | None = None
    text_plain: str | None = None


class EmailInboundResult(BaseModel):
    """Draft mail processing result."""
    ok: bool
    pipeline_id: str
    draft_id: int
    title: str | None = None
    tags: list[str] | None = None
    settings: Dict[str, str] | None = None


@operator(
    key="internal.event.mail.ingest_draft_mail",
    title="Ingest Draft Mail",
    side_effect="write",
)
async def op_ingest_draft_mail(payload: EmailInboundPayload, ctx: TaskContext) -> EmailInboundResult:
    """Ingest draft mail and create draft."""
    # Convert payload to dict format expected by ingest_draft_mail
    email_payload = {
        "subject": payload.subject,
        "from": payload.from_email,
        "sender": payload.sender,
        "envelope": payload.envelope or {},
        "text": payload.text,
        "body": payload.body,
        "text/plain": payload.text_plain,
    }

    result = await ingest_draft_mail(email_payload, ctx.runtime)
    return EmailInboundResult(
        ok=result["ok"],
        pipeline_id=result["pipeline_id"],
        draft_id=result["draft_id"],
        title=result["title"],
        tags=result["tags"],
        settings=result["settings"],
    )


@FLOWS.flow(
    key="internal.event.mail.ingest_draft_mail",
    title="Ingest Draft Mail",
    description="Ingest draft mail from Gmail webhook and create draft",
    input_model=EmailInboundPayload,
    output_model=EmailInboundResult,
    method="post",
    path="/events/mail/ingest_draft_mail",
    tags=("internal", "event", "mail", "ingest", "draft", "mail"),
)
def _flow_ingest_draft_mail(builder: FlowBuilder):
    """Flow for ingesting draft mail."""
    task = builder.task("ingest_draft_mail", "internal.event.mail.ingest_draft_mail")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="internal.mail.compose_trends_email",
    title="Compose Persona Trends Email",
    description="Compose and send persona-adapted trend digest via email",
    input_model=mail_ops.ComposeTrendsEmailPayload,
    output_model=mail_ops.ComposeTrendsEmailResult,
    method="post",
    path="/mail/compose_trends_email",
    tags=("internal", "mail", "trends", "persona", "schedule"),
)
def _flow_compose_trends_email(builder: FlowBuilder):
    task = builder.task("compose", "internal.mail.compose_trends_email")
    builder.expect_terminal(task)


@FLOWS.flow(
    key="internal.mail.await_reply",
    title="Await Mail Reply",
    description="Suspend schedule until matching email reply arrives",
    input_model=mail_ops.AwaitReplyPayload,
    output_model=mail_ops.AwaitReplyPayload,
    method="post",
    path="/mail/await_reply",
    tags=("internal", "mail", "wait", "pipeline"),
)
def _flow_await_mail_reply(builder: FlowBuilder):
    task = builder.task("await_reply", "internal.mail.await_reply")
    builder.expect_terminal(task)
