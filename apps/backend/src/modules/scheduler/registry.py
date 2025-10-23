"""Central registry for schedule templates."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, List, TYPE_CHECKING

from apps.backend.src.core.context import draft_id_ctx

if TYPE_CHECKING:  # pragma: no cover - typing helpers
    from .schemas import (
        MailScheduleTemplateParams,
        PostPublishTemplateParams,
        ScheduleCompileRequest,
        ScheduleCompileResult,
        ScheduleDagSpec,
        ScheduleCreateFromRawDagRequest,
    )


class TemplateVisibility(str, Enum):
    PUBLIC = "public"
    ADVANCED = "advanced"
    SYSTEM = "system"


class ScheduleTemplateKey(str, Enum):
    MAIL_TRENDS_WITH_REPLY = "mail.trends_with_reply"
    POST_PUBLISH = "post.publish"
    INSIGHTS_SYNC_METRICS = "insights.sync_metrics"
    SCHEDULE_AB_TEST = "abtest.schedule_ab_test"
    COMPLETE_AB_TEST = "abtest.complete_ab_test"

@dataclass(frozen=True)
class ScheduleTemplateDefinition:
    """Metadata and builder for a reusable schedule template."""

    key: ScheduleTemplateKey
    title: str
    description: str
    builder: Callable[["ScheduleCompileRequest"], "ScheduleDagSpec"]
    visibility: TemplateVisibility = TemplateVisibility.PUBLIC
    group: str = "general"


_TEMPLATES: Dict[ScheduleTemplateKey, ScheduleTemplateDefinition] = {}


def register_template(definition: ScheduleTemplateDefinition) -> None:
    if definition.key in _TEMPLATES:
        raise ValueError(f"schedule template '{definition.key}' already registered")
    _TEMPLATES[definition.key] = definition


def list_schedule_templates() -> List[ScheduleTemplateDefinition]:
    """Return registered schedule templates in declaration order."""

    return list(_TEMPLATES.values())


def compile_schedule_template(request: "ScheduleCompileRequest") -> "ScheduleCompileResult":
    """Compile a template request into a DAG specification."""

    definition = _TEMPLATES.get(request.template)
    if definition is None:
        raise KeyError(f"schedule template '{request.template}' is not registered")
    spec = definition.builder(request)

    from .schemas import ScheduleCompileResult  # local import to avoid circular

    return ScheduleCompileResult(dag_spec=spec)


# ---------------------------------------------------------------------------
# Default template and blueprint registrations
# ---------------------------------------------------------------------------


def _build_mail_trends_with_reply(request: "ScheduleCompileRequest") -> "ScheduleDagSpec":
    from .schemas import (
        MailScheduleTemplateParams,
        ScheduleDagBuilder,
        payload_ref,
        node_ref,
        resume_ref,
    )

    params: MailScheduleTemplateParams = request.require_mail_params()
    builder = ScheduleDagBuilder()

    builder.meta(label=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY.value)
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
        persona_account_id=payload_ref("persona_account_id"),
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
        should_wait=node_ref(compose_id, "sent"),
        reason=node_ref(compose_id, "reason"),
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


def _build_post_publish_template(request: "ScheduleCompileRequest") -> "ScheduleDagSpec":
    from .schemas import (
        ScheduleDagBuilder,
        payload_ref,
    )

    params: PostPublishTemplateParams = request.require_post_publish_params()
    builder = ScheduleDagBuilder()
    builder.meta(
        label=ScheduleTemplateKey.POST_PUBLISH.value,
        post_publication_id=str(params.post_publication_id),
        variant_id=str(params.variant_id),
        draft_id=str(params.draft_id),
        persona_account_id=str(params.persona_account_id),
        platform=params.platform.value,
    )
    builder.payload(
        post_publication_id=params.post_publication_id,
        persona_account_id=params.persona_account_id,
        variant_id=params.variant_id,
        draft_id=params.draft_id,
        platform=params.platform.value,
    )
    builder.add_node(
        "internal.drafts.publish",
        node_id="publish",
        post_publication_id=payload_ref("post_publication_id"),
        persona_account_id=payload_ref("persona_account_id"),
        variant_id=payload_ref("variant_id"),
        platform=payload_ref("platform"),
        draft_id=payload_ref("draft_id")
    )
    return builder.build_model()


def _build_insights_sync_metrics_template(request: "ScheduleCompileRequest") -> "ScheduleDagSpec":
    from .schemas import (
        ScheduleDagBuilder,
        payload_ref,
    )

    params = request.require_sync_metrics_params()
    builder = ScheduleDagBuilder()
    builder.meta(
        label=ScheduleTemplateKey.INSIGHTS_SYNC_METRICS.value,
        post_publication_id=str(params.post_publication_id),
        persona_account_id=str(params.persona_account_id),
        platform=params.platform.value,
    )
    builder.payload(
        post_publication_id=params.post_publication_id,
        persona_account_id=params.persona_account_id,
        platform=params.platform.value,
    )
    builder.add_node(
        "internal.insights.sync_metrics",
        node_id="sync_metrics",
        post_publication_id=payload_ref("post_publication_id"),
        persona_account_id=payload_ref("persona_account_id"),
        platform=payload_ref("platform"),
    )
    return builder.build_model()


def _build_schedule_abtest_template(request: "ScheduleCompileRequest") -> "ScheduleDagSpec":
    from .schemas import (
        ABTestScheduleTemplateParams,
        ScheduleDagBuilder,
        payload_ref,
    )

    params: ABTestScheduleTemplateParams = request.require_abtest_schedule_params()
    builder = ScheduleDagBuilder()
    builder.meta(
        label=ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
        abtest_id=str(params.abtest_id),
        persona_account_id=str(params.persona_account_id),
        campaign_id=str(params.campaign_id),
        variant_a_label=params.variant_a.label,
        variant_b_label=params.variant_b.label,
    )
    builder.payload(
        abtest_id=params.abtest_id,
        persona_id=params.persona_id,
        campaign_id=params.campaign_id,
        persona_account_id=params.persona_account_id,
        variant_a=params.variant_a.model_dump(mode="json"),
        variant_b=params.variant_b.model_dump(mode="json"),
    )
    publish_a = builder.add_node(
        "internal.drafts.publish",
        node_id="publish_variant_a",
        post_publication_id=payload_ref("variant_a.post_publication_id"),
        persona_account_id=payload_ref("variant_a.persona_account_id"),
        variant_id=payload_ref("variant_a.variant_id"),
        draft_id=payload_ref("variant_a.draft_id"),
        platform=payload_ref("variant_a.platform"),
    )
    publish_b = builder.add_node(
        "internal.drafts.publish",
        node_id="publish_variant_b",
        post_publication_id=payload_ref("variant_b.post_publication_id"),
        persona_account_id=payload_ref("variant_b.persona_account_id"),
        variant_id=payload_ref("variant_b.variant_id"),
        draft_id=payload_ref("variant_b.draft_id"),
        platform=payload_ref("variant_b.platform"),
    )
    builder.connect(publish_a, publish_b)
    return builder.build_model()


def _build_complete_abtest_template(request: "ScheduleCompileRequest") -> "ScheduleDagSpec":
    from .schemas import (
        ABTestCompleteTemplateParams,
        ScheduleDagBuilder,
        payload_ref,
        node_ref,
    )

    params: ABTestCompleteTemplateParams = request.require_abtest_complete_params()
    builder = ScheduleDagBuilder()
    builder.meta(
        label=ScheduleTemplateKey.COMPLETE_AB_TEST.value,
        abtest_id=str(params.abtest_id),
        persona_account_id=str(params.persona_account_id),
        campaign_id=str(params.campaign_id),
        publish_schedule_id=str(params.publish_schedule_id),
    )
    builder.payload(
        abtest_id=params.abtest_id,
        persona_id=params.persona_id,
        campaign_id=params.campaign_id,
        persona_account_id=params.persona_account_id,
        publish_schedule_id=params.publish_schedule_id,
        post_publication_ids=params.post_publication_ids,
    )
    determine_id = builder.add_node(
        "abtests.determine_winner",
        node_id="determine_winner",
        abtest_id=payload_ref("abtest_id"),
    )
    complete_id = builder.add_node(
        "abtests.complete",
        node_id="complete_abtest",
        abtest_id=payload_ref("abtest_id"),
        winner_variant=node_ref(determine_id, "winner_variant"),
        uplift_percentage=node_ref(determine_id, "uplift_percentage"),
        insight_note=node_ref(determine_id, "insight_note"),
        finished_at=node_ref(determine_id, "finished_at"),
    )
    builder.connect(determine_id, complete_id)
    return builder.build_model()


register_template(
    ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        title="Persona Trends Mail with Reply",
        description="Send persona-adapted trends email and await reply to ingest draft",
        builder=_build_mail_trends_with_reply,
        visibility=TemplateVisibility.PUBLIC,
        group="monitoring",
    )
)

register_template(
    ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.POST_PUBLISH,
        title="Publish Draft Variant",
        description="Publish a compiled draft variant via platform adapter",
        builder=_build_post_publish_template,
        visibility=TemplateVisibility.PUBLIC,
        group="publishing",
    )
)

register_template(
    ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.INSIGHTS_SYNC_METRICS,
        title="Sync Metrics for Post",
        description="Sync metrics data for a published post",
        builder=_build_insights_sync_metrics_template,
        visibility=TemplateVisibility.PUBLIC,
        group="monitoring",
    )
)

register_template(
    ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.SCHEDULE_AB_TEST,
        title="Schedule AB Test Variants",
        description="Publish both variants of an AB test during a single scheduled run",
        builder=_build_schedule_abtest_template,
        visibility=TemplateVisibility.ADVANCED,
        group="abtests",
    )
)

register_template(
    ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.COMPLETE_AB_TEST,
        title="Complete AB Test",
        description="Trigger post-run workflows to evaluate and close an AB test",
        builder=_build_complete_abtest_template,
        visibility=TemplateVisibility.SYSTEM,
        group="abtests",
    )
)


__all__ = [
    "ScheduleTemplateDefinition",
    "ScheduleTemplateKey",
    "TemplateVisibility",
    "compile_schedule_template",
    "list_schedule_templates",
]
