import pytest

from apps.backend.src.modules.common.enums import PlatformKind
from apps.backend.src.modules.scheduler import registry
from apps.backend.src.modules.scheduler.registry import (
    ScheduleTemplateDefinition,
    ScheduleTemplateKey,
    compile_schedule_template,
    list_schedule_templates,
    register_template,
)
from apps.backend.src.modules.scheduler.schemas import (
    MailScheduleTemplateParams,
    PostPublishTemplateParams,
    ScheduleCompileRequest,
    ScheduleDagBuilder,
)


def test_compile_mail_trends_template_produces_expected_dag():
    request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        mail=MailScheduleTemplateParams(
            persona_id=1,
            persona_account_id=4,
            email_to="snowypainter@gmail.com",
            country="US",
            limit=15,
            wait_timeout_s=3600,
            pipeline_id="pipe-1",
        ),
    )

    result = compile_schedule_template(request)
    dag_spec = result.dag_spec

    assert dag_spec.meta["label"] == ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY.value
    assert dag_spec.payload == {
        "persona_id": 1,
        "persona_account_id": 4,
        "email_to": "snowypainter@gmail.com",
        "country": "US",
        "limit": 15,
        "wait_timeout_s": 3600,
        "pipeline_id": "pipe-1",
    }

    nodes = {node.id: node for node in dag_spec.dag.nodes}
    assert nodes["compose"].flow == "internal.mail.compose_trends_email"
    assert nodes["wait_reply"].flow == "internal.mail.await_reply"
    assert nodes["ingest_reply"].flow == "internal.event.mail.ingest_draft_mail"

    assert nodes["compose"].inputs == {
        "persona_id": "$.payload.persona_id",
        "email_to": "$.payload.email_to",
        "country": "$.payload.country",
        "limit": "$.payload.limit",
        "pipeline_id": "$.payload.pipeline_id",
    }

    assert nodes["wait_reply"].inputs["pipeline_id"] == "$.nodes.compose.pipeline_id"
    assert nodes["wait_reply"].inputs["timeout_s"] == "$.payload.wait_timeout_s"

    for attribute in ("subject", "from_email", "sender", "envelope", "text", "body", "text_plain"):
        assert nodes["ingest_reply"].inputs[attribute].startswith("$.resume.event")

    edges = {(edge.source, edge.target) for edge in dag_spec.dag.edges}
    assert edges == {("compose", "wait_reply"), ("wait_reply", "ingest_reply")}


def test_compile_post_publish_template_produces_publish_node():
    request = ScheduleCompileRequest(
        template=ScheduleTemplateKey.POST_PUBLISH,
        post_publish=PostPublishTemplateParams(
            post_publication_id=500,
            persona_account_id=600,
            variant_id=700,
            draft_id=800,
            platform=PlatformKind.INSTAGRAM,
        ),
    )

    result = compile_schedule_template(request)
    dag_spec = result.dag_spec

    expected_meta = {
        "label": ScheduleTemplateKey.POST_PUBLISH.value,
        "post_publication_id": "500",
        "variant_id": "700",
        "draft_id": "800",
        "persona_account_id": "600",
        "platform": PlatformKind.INSTAGRAM.value,
    }
    assert dag_spec.meta == expected_meta
    assert dag_spec.payload == {
        "post_publication_id": 500,
        "persona_account_id": 600,
        "variant_id": 700,
        "draft_id": 800,
        "platform": PlatformKind.INSTAGRAM.value,
    }

    (publish_node,) = dag_spec.dag.nodes
    assert publish_node.id == "publish"
    assert publish_node.flow == "internal.drafts.publish"
    assert publish_node.inputs == {
        "post_publication_id": "$.payload.post_publication_id",
        "persona_account_id": "$.payload.persona_account_id",
        "variant_id": "$.payload.variant_id",
        "platform": "$.payload.platform",
        "draft_id": "$.payload.draft_id",
    }
    assert dag_spec.dag.edges == []


def test_register_template_rejects_duplicate_keys(monkeypatch):
    monkeypatch.setattr(registry, "_TEMPLATES", {})

    def builder(_: ScheduleCompileRequest):
        dag_builder = ScheduleDagBuilder()
        dag_builder.add_node("test.flow", node_id="node")
        return dag_builder.build_model()

    definition = ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        title="Dummy",
        description="Dummy template for testing",
        builder=builder,
    )

    register_template(definition)

    with pytest.raises(ValueError, match="already registered"):
        register_template(definition)


def test_list_schedule_templates_preserves_registration_order(monkeypatch):
    monkeypatch.setattr(registry, "_TEMPLATES", {})

    def builder(_: ScheduleCompileRequest):
        dag_builder = ScheduleDagBuilder()
        dag_builder.add_node("dummy.flow", node_id="node")
        return dag_builder.build_model()

    first = ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        title="First",
        description="First template",
        builder=builder,
    )
    second = ScheduleTemplateDefinition(
        key=ScheduleTemplateKey.POST_PUBLISH,
        title="Second",
        description="Second template",
        builder=builder,
    )

    register_template(first)
    register_template(second)

    templates = list_schedule_templates()

    assert [template.key for template in templates] == [
        ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY,
        ScheduleTemplateKey.POST_PUBLISH,
    ]
