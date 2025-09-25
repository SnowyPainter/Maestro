"""Adapters and helpers for compile-time schedule templates."""

from __future__ import annotations

from typing import Callable, Dict

from apps.backend.src.modules.scheduler import schemas as scheduler_schemas

ScheduleDagSpec = scheduler_schemas.ScheduleDagSpec
ScheduleCompileRequest = scheduler_schemas.ScheduleCompileRequest
ScheduleCompileResult = scheduler_schemas.ScheduleCompileResult
ScheduleTemplateKey = scheduler_schemas.ScheduleTemplateKey
MailScheduleTemplateParams = scheduler_schemas.MailScheduleTemplateParams
ScheduleDagBuilder = scheduler_schemas.ScheduleDagBuilder
payload_ref = scheduler_schemas.payload_ref
node_ref = scheduler_schemas.node_ref
resume_ref = scheduler_schemas.resume_ref


def compile_schedule_template(request: ScheduleCompileRequest) -> ScheduleCompileResult:
    builder = _TEMPLATE_BUILDERS[request.template]
    spec = builder(request)
    return ScheduleCompileResult(dag_spec=spec)


def _build_mail_trends_with_reply(request: ScheduleCompileRequest) -> ScheduleDagSpec:
    params = request.extract_params()
    builder = ScheduleDagBuilder()

    builder.payload(
        persona_id=params.persona_id,
        persona_account_id=params.persona_account_id,
        email_to=params.email_to,
        country=params.country,
        limit=params.limit,
        wait_timeout_s=params.wait_timeout_s,
        pipeline_id=params.pipeline_id,
    )

    compose_id = builder.add_node(
        "internal.mail.compose_trends_email",
        node_id="compose",
        persona_id=payload_ref("persona_id"),
        email_to=payload_ref("email_to"),
        country=payload_ref("country"),
        limit=payload_ref("limit"),
        pipeline_id=payload_ref("pipeline_id"),
    )

    wait_id = builder.add_node(
        "internal.mail.await_reply",
        node_id="wait_reply",
        pipeline_id=node_ref(compose_id, "pipeline_id"),
        timeout_s=payload_ref("wait_timeout_s"),
    )

    builder.add_node(
        "internal.event.mail.ingest_draft_mail",
        node_id="ingest_reply",
        subject=resume_ref("event.subject"),
        from_email=resume_ref("event.from"),
        sender=resume_ref("event.sender"),
        envelope=resume_ref("event.envelope"),
        text=resume_ref("event.text"),
        body=resume_ref("event.body"),
        text_plain=resume_ref("event.text_plain"),
    )

    builder.connect(compose_id, wait_id)
    builder.connect(wait_id, "ingest_reply")

    return builder.build_model()


_TEMPLATE_BUILDERS: Dict[ScheduleTemplateKey, Callable[[ScheduleCompileRequest], ScheduleDagSpec]] = {
    ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY: _build_mail_trends_with_reply,
}


__all__ = ["compile_schedule_template"]
