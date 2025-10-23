"""Action flows for schedule and automation management."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.backend.src.modules.scheduler.models import Schedule
from apps.backend.src.modules.scheduler.schemas import MailBatchRequest, SyncMetricsBatchRequest
from apps.backend.src.modules.common.enums import ScheduleStatus
from apps.backend.src.modules.scheduler.registry import ScheduleTemplateKey, TemplateVisibility, compile_schedule_template
from apps.backend.src.modules.scheduler.schemas import (
    ScheduleCompileRequest,
    ScheduleCompileResult,
    CancelPostScheduleCommand,
    ScheduleBatchRequest,
    ScheduleCreateFromRawDagRequest,
    CancelSchedulesCommand,
    RawDagScheduleInstance,
    SchedulePlanInstance,
    ScheduleDagSpec,
    ABTestCompleteTemplateParams,
)
from apps.backend.src.modules.scheduler.planner import normalize_due_at, plan_schedule_instances
from apps.backend.src.orchestrator.flows.action.drafts import MessageOut
from apps.backend.src.modules.users.models import User
from apps.backend.src.orchestrator.dispatch import TaskContext
from apps.backend.src.orchestrator.registry import FLOWS, FlowBuilder, operator
from apps.backend.src.modules.abtests.service import (
    ABTestSchedulePlan,
    schedule_abtest as service_schedule_abtest,
)
from apps.backend.src.modules.drafts.service import (
    cancel_post_publication,
    _load_owned_draft,
    remove_publication_schedule,
    upsert_post_publication_schedule,
    ensure_publication_schedule,
)
from apps.backend.src.modules.drafts.models import PostPublication
from apps.backend.src.modules.playbooks.service import record_playbook_event

# ---- 공통 유틸: DB가 TIMESTAMP WITHOUT TIME ZONE이면 모든 dt를 UTC-naive로 강제 ----
def to_utc_naive(dt: datetime) -> datetime:
    """
    - aware -> UTC로 변환 후 tzinfo 제거
    - naive -> 그대로 사용 (이미 UTC라고 가정)
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)

def opt_to_utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    return None if dt is None else to_utc_naive(dt)

def _require_identifier(value: Optional[int], name: str) -> int:
    if value is None:
        raise HTTPException(status_code=422, detail=f"{name} is required")
    return value

# ---- 오퍼레이터 ----

# ---------------------------------------------------------------------------
# Template metadata helpers
# ---------------------------------------------------------------------------


class ScheduleTemplateSummary(BaseModel):
    key: ScheduleTemplateKey
    title: str
    description: str
    visibility: TemplateVisibility


class ListScheduleTemplatesResult(BaseModel):
    templates: List[ScheduleTemplateSummary]


class ScheduleCreateResult(BaseModel):
    schedule_ids: List[int]


class SchedulePlanBatchResult(BaseModel):
    dag_spec: ScheduleDagSpec
    instances: List[SchedulePlanInstance]

class _EmptyPayload(BaseModel):
    """Placeholder model for GET endpoints."""


class DraftPostScheduleRequest(BaseModel):
    persona_account_id: int
    variant_id: int
    run_at: datetime


class ABTestScheduleCommand(BaseModel):
    abtest_id: Optional[int] = None
    persona_account_id: int
    run_at: datetime
    complete_at: Optional[datetime] = None


class ABTestScheduleResult(BaseModel):
    abtest_id: int
    persona_account_id: int
    schedule_id: Optional[int] = None
    completion_schedule_id: Optional[int] = None
    post_publication_ids: List[int]
    run_at: datetime
    complete_at: Optional[datetime] = None



# ---------------------------------------------------------------------------
# Template-based helpers (retained for compatibility)
# ---------------------------------------------------------------------------


@operator(
    key="action.schedule.compile_template",
    title="Compile Schedule Template",
    side_effect="read",
)
async def op_compile_schedule_template(
    payload: ScheduleCompileRequest,
    ctx: TaskContext,
) -> ScheduleCompileResult:
    return compile_schedule_template(payload)


@FLOWS.flow(
    key="action.schedule.compile_template",
    title="Compile Schedule DAG",
    description="Generate a schedule DAG specification from higher level template parameters",
    input_model=ScheduleCompileRequest,
    output_model=ScheduleCompileResult,
    method="post",
    path="/actions/schedules/compile",
    tags=("action", "schedule", "dag", "compile"),
)
def _flow_compile_schedule(builder: FlowBuilder):
    task = builder.task("compile_template", "action.schedule.compile_template")
    builder.expect_terminal(task)

def _merge_meta(base: Dict[str, Any], extra: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = dict(base)
    if extra:
        merged.update({k: v for k, v in extra.items() if v is not None})
    return merged


def _get_spec_field(spec: Any, field: str) -> Any:
    if isinstance(spec, dict):
        return spec.get(field)
    return getattr(spec, field, None)


def _extract_template_hint(context: Dict[str, Any], dag_spec: Any) -> Optional[str]:
    template_from_context = context.get("template")
    if template_from_context:
        return template_from_context
    meta = _get_spec_field(dag_spec, "meta")
    if isinstance(meta, dict):
        label = meta.get("label")
        if label:
            return label
    return None


def _format_schedule_event_name(template_hint: Optional[str], payload_data: Dict[str, Any]) -> str:
    if template_hint:
        return f"schedule.created.{template_hint}"
    if "post_publication_id" in payload_data:
        return "schedule.created.post_publish"
    if "abtest_id" in payload_data:
        return "schedule.created.abtest"
    if "post_publication_ids" in payload_data:
        return "schedule.created.abtest.complete"
    return "schedule.created"


def _collect_payload_identifiers(payload_data: Dict[str, Any]) -> Dict[str, Any]:
    keys = (
        "persona_id",
        "persona_account_id",
        "campaign_id",
        "draft_id",
        "variant_id",
        "post_publication_id",
        "post_publication_ids",
        "abtest_id",
    )
    return {key: payload_data[key] for key in keys if key in payload_data and payload_data[key] is not None}


def _dag_stats(dag_spec: Any) -> Dict[str, Any]:
    dag = _get_spec_field(dag_spec, "dag")
    nodes = []
    edges = []
    if isinstance(dag, dict):
        nodes = dag.get("nodes") or []
        edges = dag.get("edges") or []
    elif dag is not None:
        nodes = getattr(dag, "nodes", []) or []
        edges = getattr(dag, "edges", []) or []
    return {
        "dag_nodes": len(nodes),
        "dag_edges": len(edges),
    }


def _persist_schedule(
    db: AsyncSession,
    *,
    persona_account_id: int,
    dag_spec: Dict[str, Any],
    payload: Dict[str, Any],
    due_at: datetime,
    queue: Optional[str],
    context: Optional[Dict[str, Any]] = None,
) -> Schedule:
    schedule = Schedule(
        persona_account_id=persona_account_id,
        dag_spec=dag_spec,
        payload=payload,
        context=context or {},
        status=ScheduleStatus.PENDING.value,
        due_at=normalize_due_at(due_at),
        queue=queue,
        idempotency_key=uuid4().hex,
    )
    db.add(schedule)
    return schedule


async def _persist_schedules(
    db: AsyncSession,
    *,
    persona_account_id: int,
    dag_spec: Dict[str, Any],
    payload: Dict[str, Any],
    due_times: Iterable[tuple[datetime, Dict[str, Any]]],
    queue: Optional[str],
    base_context: Optional[Dict[str, Any]] = None,
) -> List[int]:
    schedule_ids: List[int] = []
    if isinstance(payload, BaseModel):
        payload_data = payload.model_dump()
    elif isinstance(payload, dict):
        payload_data = payload
    else:
        payload_data = {}
    dag_meta = _get_spec_field(dag_spec, "meta")
    dag_meta = dag_meta if isinstance(dag_meta, dict) else {}
    dag_stats_info = _dag_stats(dag_spec)
    for due_at, ctx_extra in due_times:
        context = dict(base_context or {})
        context.update(ctx_extra)
        template_hint = _extract_template_hint(context, dag_spec)
        event_name = _format_schedule_event_name(template_hint, payload_data)
        identifiers = _collect_payload_identifiers(payload_data)
        schedule = _persist_schedule(
            db,
            persona_account_id=persona_account_id,
            dag_spec=dag_spec,
            payload=payload,
            due_at=due_at,
            queue=queue,
            context=context,
        )
        await db.flush()
        meta_payload = {
            "template": template_hint,
            "plan_title": context.get("plan_title"),
            "plan_segment": context.get("plan_segment"),
            "schedule_index": context.get("schedule_index"),
            "queue": queue,
            "due_at_utc": due_at.isoformat(),
            "plan_local_due": context.get("plan_local_due"),
            "dag_label": dag_meta.get("label"),
            **dag_stats_info,
        }
        if dag_meta:
            meta_payload.setdefault("dag_meta", dag_meta)
        if identifiers:
            meta_payload["identifiers"] = identifiers
        meta_payload = {key: value for key, value in meta_payload.items() if value is not None}
        await record_playbook_event(
            db,
            event=event_name,
            schedule_id=schedule.id,
            schedule=schedule,
            persona_id=payload_data.get("persona_id"),
            persona_account_id=persona_account_id,
            campaign_id=payload_data.get("campaign_id"),
            draft_id=payload_data.get("draft_id"),
            variant_id=payload_data.get("variant_id"),
            post_publication_id=payload_data.get("post_publication_id"),
            meta=meta_payload or None,
        )
        schedule_ids.append(schedule.id)
    return schedule_ids


def _iter_plan_instances(instances: Iterable[SchedulePlanInstance]) -> Iterable[tuple[datetime, Dict[str, Any], Dict[str, Any]]]:
    for instance in instances:
        meta_delta = {
            "plan_segment": instance.segment_id,
            "scheduled_for": instance.local_due_at.isoformat(),
            "schedule_index": instance.schedule_index,
        }
        context_delta = {
            "plan_segment": instance.segment_id,
            "plan_local_due": instance.local_due_at.isoformat(),
            "schedule_index": instance.schedule_index,
        }
        yield instance.due_at_utc, meta_delta, context_delta


def _compile_request_for_batch(payload: ScheduleBatchRequest) -> ScheduleCompileRequest:
    try:
        template_key = ScheduleTemplateKey(payload.template)
    except ValueError as exc:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=400, detail="unsupported schedule template") from exc

    compile_kwargs: Dict[str, Any] = {"template": template_key}
    if template_key == ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY:
        compile_kwargs["mail"] = payload.payload_template
    elif template_key == ScheduleTemplateKey.POST_PUBLISH:
        compile_kwargs["post_publish"] = payload.payload_template
    elif template_key == ScheduleTemplateKey.INSIGHTS_SYNC_METRICS:
        compile_kwargs["sync_metrics"] = payload.payload_template
    else:
        raise HTTPException(status_code=400, detail="unsupported schedule template")
    return ScheduleCompileRequest(**compile_kwargs)


@operator(
    key="action.schedule.plan_batch",
    title="Plan Schedule Batch",
    side_effect="read",
)
async def op_plan_schedule_batch(
    payload: ScheduleBatchRequest,
    ctx: TaskContext,
) -> SchedulePlanBatchResult:
    compile_request = _compile_request_for_batch(payload)
    compile_result = compile_schedule_template(compile_request)

    try:
        planned_instances = plan_schedule_instances(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not planned_instances:
        raise HTTPException(
            status_code=400,
            detail="no schedule instances could be generated for the provided window",
        )
    return SchedulePlanBatchResult(dag_spec=compile_result.dag_spec, instances=planned_instances)

@operator(
    key="action.schedule.create_from_raw_dag",
    title="Create Schedule(s) From DAG",
    side_effect="write",
)
async def op_create_schedule_from_raw_dag(
    payload: ScheduleCreateFromRawDagRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)

    def _compact(instance: RawDagScheduleInstance) -> tuple[Dict[str, Any], Dict[str, Any]]:
        spec = instance.dag_spec
        meta = _merge_meta(spec.meta or {}, instance.meta)
        spec_with_meta = spec.model_copy(update={"meta": meta})
        return (
            spec_with_meta.model_dump(by_alias=True, exclude_none=True),
            spec_with_meta.payload,
        )

    base_spec = payload.dag_spec
    base_meta = _merge_meta(base_spec.meta or {}, payload.meta)
    base_spec_with_meta = base_spec.model_copy(update={"meta": base_meta})
    base_dag_json = base_spec_with_meta.model_dump(by_alias=True, exclude_none=True)
    base_payload = base_spec_with_meta.payload

    instances: Iterable[RawDagScheduleInstance]
    if payload.repeats > 1 and payload.repeat_interval_minutes:
        step = timedelta(minutes=payload.repeat_interval_minutes)
        instances = (
            RawDagScheduleInstance(
                dag_spec=base_spec_with_meta,
                run_at=payload.run_at + step * idx,
                queue=payload.queue,
            )
            for idx in range(payload.repeats)
        )
    else:
        instances = (
            RawDagScheduleInstance(
                dag_spec=base_spec_with_meta,
                run_at=payload.run_at,
                queue=payload.queue,
            ),
        )

    schedule_ids: List[int] = []
    for instance in instances:
        dag_json, dag_payload = _compact(instance)
        schedule = _persist_schedule(
            db,
            persona_account_id=payload.persona_account_id,
            dag_spec=dag_json,
            payload=dag_payload,
            due_at=instance.run_at,
            queue=instance.queue,
        )
        await db.flush()
        schedule_ids.append(schedule.id)

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)


@operator(
    key="action.schedule.create_draft_post_schedule",
    title="Create Draft Post Schedule",
    side_effect="write",
)
async def op_create_draft_post_schedule(
    payload: DraftPostScheduleRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    variant = await _load_owned_draft(
        db,
        variant_id=payload.variant_id,
        owner_user_id=user.id,  
    )

    try:
        publication = await upsert_post_publication_schedule(
            db,
            variant=variant,
            persona_account_id=payload.persona_account_id,
            scheduled_at=payload.run_at,
            owner_user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    schedule = await ensure_publication_schedule(
        db,
        publication=publication,
        variant=variant,
        persona_account_id=payload.persona_account_id,
        scheduled_at=payload.run_at,
    )

    schedule_context = schedule.context_data()
    schedule_context.setdefault("template", ScheduleTemplateKey.POST_PUBLISH.value)
    schedule_context["scheduled_via"] = "action.schedule.create_draft_post_schedule"
    schedule_context["requested_at"] = datetime.now(timezone.utc).isoformat()
    scheduled_for = schedule.due_at or payload.run_at
    if scheduled_for.tzinfo is None:
        scheduled_for = scheduled_for.replace(tzinfo=timezone.utc)
    else:
        scheduled_for = scheduled_for.astimezone(timezone.utc)
    schedule_context["scheduled_for"] = scheduled_for.isoformat()
    schedule_context["user_id"] = user.id
    schedule.context = schedule_context
    db.add(schedule)

    await db.commit()
    return ScheduleCreateResult(schedule_ids=[schedule.id])

@operator(
    key="action.schedule.cancel_draft_post_schedule",
    title="Cancel Post Schedule",
    side_effect="write",
)
async def op_cancel_post_schedule(
    payload: CancelPostScheduleCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)

    variant = await _load_owned_draft(db, variant_id=payload.variant_id, owner_user_id=user.id)

    publication: PostPublication | None = await cancel_post_publication(
        db,
        variant=variant,
        persona_account_id=payload.persona_account_id,
        owner_user_id=user.id,
    )
    if publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")
    await remove_publication_schedule(db, publication=publication)
    await db.commit()
    await db.refresh(publication)
    return MessageOut(message="Post schedule cancelled")


def _infer_schedule_template(schedule: Schedule) -> Optional[str]:
    context = schedule.context_data()
    template = context.get("template") if isinstance(context, dict) else None
    if isinstance(template, str):
        return template

    dag_spec = schedule.dag_spec
    if isinstance(dag_spec, dict):
        meta = dag_spec.get("meta")
        if isinstance(meta, dict):
            label = meta.get("label") or meta.get("kind")
            if isinstance(label, str):
                return label
    return None


async def _cancel_post_publish_schedule(
    db: AsyncSession,
    *,
    schedule: Schedule,
    user: Optional[User],
) -> bool:
    if user is None:
        return False

    payload = schedule.payload_data()
    variant_id = payload.get("variant_id")
    persona_account_id = payload.get("persona_account_id", schedule.persona_account_id)

    if variant_id is None or persona_account_id is None:
        return False

    try:
        variant_id_int = int(variant_id)
        persona_account_id_int = int(persona_account_id)
    except (TypeError, ValueError):
        return False

    variant = await _load_owned_draft(
        db,
        variant_id=variant_id_int,
        owner_user_id=user.id,
    )
    try:
        publication = await cancel_post_publication(
            db,
            variant=variant,
            persona_account_id=persona_account_id_int,
            owner_user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await remove_publication_schedule(db, publication=publication)
    return True


@operator(
    key="action.schedule.create_trends_mail_schedule",
    title="Create Trends Mail Schedule",
    side_effect="write",
)
async def op_create_trends_mail_schedule(
    payload: MailBatchRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    try:
        template_key = ScheduleTemplateKey(payload.template)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="unsupported schedule template") from exc

    if template_key != ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY:
        raise HTTPException(status_code=400, detail="mail schedule template expected")

    plan_result = await op_plan_schedule_batch(payload, ctx)
    dag_spec = plan_result.dag_spec
    planned_instances = plan_result.instances

    base_meta = dict(dag_spec.meta or {})
    if payload.title:
        base_meta.setdefault("title", payload.title)
        base_meta["plan_title"] = payload.title

    base_context: Dict[str, Any] = {
        "template": ScheduleTemplateKey.MAIL_TRENDS_WITH_REPLY.value,
        "plan_timezone": payload.timezone,
    }
    if payload.title:
        base_context["plan_title"] = payload.title
    if user is not None:
        base_context["user_id"] = user.id

    persona_account_id = payload.payload_template.persona_account_id
    queue = payload.queue or "coworker"

    schedule_ids: List[int] = []
    for due_at_utc, meta_delta, context_delta in _iter_plan_instances(planned_instances):
        spec_instance = dag_spec.model_copy(update={"meta": _merge_meta(base_meta, meta_delta)})
        dag_json = spec_instance.model_dump(by_alias=True, exclude_none=True)
        schedule_ids.extend(
            await _persist_schedules(
                db,
                persona_account_id=persona_account_id,
                dag_spec=dag_json,
                payload=spec_instance.payload,
                due_times=[(due_at_utc, context_delta)],
                queue=queue,
                base_context=base_context,
            )
        )

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)


@operator(
    key="action.schedule.create_sync_metrics_schedule",
    title="Create Sync Metrics Schedule",
    side_effect="write",
)
async def op_create_sync_metrics_schedule(
    payload: SyncMetricsBatchRequest,
    ctx: TaskContext,
) -> ScheduleCreateResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    try:
        template_key = ScheduleTemplateKey(payload.template)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="unsupported schedule template") from exc

    if template_key != ScheduleTemplateKey.INSIGHTS_SYNC_METRICS:
        raise HTTPException(status_code=400, detail="sync metrics template expected")

    plan_result = await op_plan_schedule_batch(payload, ctx)
    dag_spec = plan_result.dag_spec
    planned_instances = plan_result.instances

    base_meta = dict(dag_spec.meta or {})
    if payload.title:
        base_meta.setdefault("title", payload.title)
        base_meta["plan_title"] = payload.title

    base_context: Dict[str, Any] = {
        "template": ScheduleTemplateKey.INSIGHTS_SYNC_METRICS.value,
        "plan_timezone": payload.timezone,
    }
    if payload.title:
        base_context["plan_title"] = payload.title
    if user is not None:
        base_context["user_id"] = user.id

    persona_account_id = payload.payload_template.persona_account_id
    queue = payload.queue or "insights"

    schedule_ids: List[int] = []
    for due_at_utc, meta_delta, context_delta in _iter_plan_instances(planned_instances):
        spec_instance = dag_spec.model_copy(update={"meta": _merge_meta(base_meta, meta_delta)})
        dag_json = spec_instance.model_dump(by_alias=True, exclude_none=True)
        schedule_ids.extend(
            await _persist_schedules(
                db,
                persona_account_id=persona_account_id,
                dag_spec=dag_json,
                payload=spec_instance.payload,
                due_times=[(due_at_utc, context_delta)],
                queue=queue,
                base_context=base_context,
            )
        )

    await db.commit()
    return ScheduleCreateResult(schedule_ids=schedule_ids)


# ---------------------------------------------------------------------------
# AB test scheduling flows
# ---------------------------------------------------------------------------


@operator(
    key="abtests.schedule",
    title="Schedule AB Test Run",
    side_effect="write",
)
async def op_schedule_abtest(
    payload: ABTestScheduleCommand,
    ctx: TaskContext,
) -> ABTestScheduleResult:
    db: AsyncSession = ctx.require(AsyncSession)
    user: User = ctx.require(User)
    abtest_id = _require_identifier(payload.abtest_id, "abtest_id")

    # Validate that completion time is after publication time
    if payload.complete_at is not None and payload.complete_at <= payload.run_at:
        raise HTTPException(
            status_code=400,
            detail="Completion time must be after publication time"
        )

    try:
        plan: ABTestSchedulePlan = await service_schedule_abtest(
            db,
            abtest_id=abtest_id,
            persona_account_id=payload.persona_account_id,
            run_at=payload.run_at,
            owner_user_id=user.id,
            complete_at=payload.complete_at,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # publish_request가 없으면 publish 스케줄링을 건너뜀
    publish_schedule = None
    publication_ids = [pub.id for pub in plan.publications]
    scheduled_iso = plan.run_at.astimezone(timezone.utc).replace(microsecond=0).isoformat()

    if plan.publish_request is not None:
        publish_result = compile_schedule_template(plan.publish_request)
        publish_spec = publish_result.dag_spec
        publish_dag = publish_spec.model_dump(by_alias=True, exclude_none=True)

        base_context: Dict[str, Any] = {
            "template": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
            "abtest_id": plan.abtest.id,
            "persona_id": plan.abtest.persona_id,
            "campaign_id": plan.abtest.campaign_id,
            "persona_account_id": plan.persona_account_id,
            "post_publication_ids": publication_ids,
            "scheduled_for": scheduled_iso,
            "user_id": user.id,
        }

        publish_schedule = _persist_schedule(
            db,
            persona_account_id=plan.persona_account_id,
            dag_spec=publish_dag,
            payload=publish_spec.payload,
            due_at=plan.run_at,
            queue="coworker",
            context=base_context,
        )
        await db.flush()

        timestamp = datetime.now(timezone.utc)
        publications_with_labels = [
            (plan.variant_a.label, plan.publications[0]),  # type: ignore
            (plan.variant_b.label, plan.publications[1]),  # type: ignore
        ]
        for label, publication in publications_with_labels:
            meta = dict(publication.meta or {})
            meta.update(
                {
                    "schedule_label": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
                    "schedule_id": publish_schedule.id,
                    "scheduled_at": scheduled_iso,
                    "abtest_id": plan.abtest.id,
                    "persona_account_id": plan.persona_account_id,
                    "abtest_variant": label,
                }
            )
            publication.meta = meta
            publication.updated_at = timestamp
            db.add(publication)

    completion_schedule = None
    completion_iso: Optional[str] = None
    if plan.complete_at is not None and plan.completion_params is not None:
        completion_iso = plan.complete_at.astimezone(timezone.utc).replace(microsecond=0).isoformat()

        completion_params = ABTestCompleteTemplateParams(**plan.completion_params)
        completion_request = ScheduleCompileRequest(
            template=ScheduleTemplateKey.COMPLETE_AB_TEST,
            abtest_complete=completion_params,
        )
        completion_result = compile_schedule_template(completion_request)
        completion_spec = completion_result.dag_spec
        completion_dag = completion_spec.model_dump(by_alias=True, exclude_none=True)
        completion_context = {
            "template": ScheduleTemplateKey.COMPLETE_AB_TEST.value,
            "abtest_id": plan.abtest.id,
            "persona_id": plan.abtest.persona_id,
            "campaign_id": plan.abtest.campaign_id,
            "scheduled_for": completion_iso,
            "user_id": user.id,
        }
        completion_schedule = _persist_schedule(
            db,
            persona_account_id=plan.persona_account_id,
            dag_spec=completion_dag,
            payload=completion_spec.payload,
            due_at=plan.complete_at,
            queue="coworker",
            context=completion_context,
        )
        await db.flush()

        # publications에 completion meta 추가
        timestamp = datetime.now(timezone.utc)
        completion_meta = {
            "completion_schedule_id": completion_schedule.id,
            "completion_scheduled_at": completion_iso,
        }
        for publication in plan.publications:
            meta = dict(publication.meta or {})
            meta.update(completion_meta)
            publication.meta = meta
            publication.updated_at = timestamp
            db.add(publication)

    await db.flush()

    # 이벤트 기록
    if publish_schedule is not None:
        # publish 스케줄이 생성된 경우
        meta_payload = {
            key: value
            for key, value in {
                "template": ScheduleTemplateKey.SCHEDULE_AB_TEST.value,
                "persona_account_id": plan.persona_account_id,
                "post_publication_ids": publication_ids,
                "completion_schedule_id": completion_schedule.id if completion_schedule else None,
                "run_at": scheduled_iso,
                "complete_at": completion_iso,
            }.items()
            if value is not None
        }

        await record_playbook_event(
            db,
            event="abtest.scheduled",
            schedule_id=publish_schedule.id,
            schedule=publish_schedule,
            persona_id=plan.abtest.persona_id,
            persona_account_id=plan.persona_account_id,
            campaign_id=plan.abtest.campaign_id,
            abtest_id=plan.abtest.id,
            meta=meta_payload,
        )
    elif completion_schedule is not None:
        # completion만 스케줄된 경우
        meta_payload = {
            key: value
            for key, value in {
                "template": ScheduleTemplateKey.COMPLETE_AB_TEST.value,
                "persona_account_id": plan.persona_account_id,
                "post_publication_ids": publication_ids,
                "completion_schedule_id": completion_schedule.id,
                "complete_at": completion_iso,
            }.items()
            if value is not None
        }

        await record_playbook_event(
            db,
            event="abtest.completion_scheduled",
            schedule_id=completion_schedule.id,
            schedule=completion_schedule,
            persona_id=plan.abtest.persona_id,
            persona_account_id=plan.persona_account_id,
            campaign_id=plan.abtest.campaign_id,
            abtest_id=plan.abtest.id,
            meta=meta_payload,
        )

    await db.commit()
    return ABTestScheduleResult(
        abtest_id=abtest_id,
        persona_account_id=plan.persona_account_id,
        schedule_id=publish_schedule.id if publish_schedule else None,
        completion_schedule_id=completion_schedule.id if completion_schedule else None,
        post_publication_ids=publication_ids,
        run_at=plan.run_at,
        complete_at=plan.complete_at,
    )

@operator(
    key="action.schedule.cancel_schedules",
    title="Cancel Schedules",
    side_effect="write",
)
async def op_cancel_schedules(
    payload: CancelSchedulesCommand,
    ctx: TaskContext,
) -> MessageOut:
    db: AsyncSession = ctx.require(AsyncSession)
    user: Optional[User] = ctx.optional(User)

    # 최소 한 개의 필터는 필요
    if not any([
        payload.schedule_ids,
        payload.persona_account_id is not None,
        payload.status is not None,
        payload.window_start is not None,
        payload.window_end is not None,
    ]):
        raise HTTPException(status_code=400, detail="at least one filter must be provided")

    # 필터의 날짜도 모두 UTC-naive로 정규화
    window_start_naive = opt_to_utc_naive(payload.window_start)
    window_end_naive   = opt_to_utc_naive(payload.window_end)

    stmt = select(Schedule)
    if payload.schedule_ids:
        stmt = stmt.where(Schedule.id.in_(payload.schedule_ids))
    if payload.persona_account_id is not None:
        stmt = stmt.where(Schedule.persona_account_id == payload.persona_account_id)
    if payload.status is not None:
        stmt = stmt.where(Schedule.status == payload.status.value)
    if window_start_naive is not None:
        stmt = stmt.where(Schedule.due_at >= window_start_naive)
    if window_end_naive is not None:
        stmt = stmt.where(Schedule.due_at <= window_end_naive)

    result = await db.execute(stmt)
    schedules: List[Schedule] = list(result.scalars().all())

    if not schedules:
        return MessageOut(message="No schedules matched the provided filters")

    cancellable_statuses = {
        ScheduleStatus.PENDING.value,
        ScheduleStatus.ENQUEUED.value,
        ScheduleStatus.RUNNING.value,
        ScheduleStatus.FAILED.value,
    }

    # DB 컬럼이 TIMESTAMP WITHOUT TIME ZONE 이므로 UTC-naive 값으로 저장
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    cancelled = 0
    for schedule in schedules:
        if schedule.status not in cancellable_statuses:
            continue

        payload_data = schedule.payload_data()
        template_key = _infer_schedule_template(schedule)
        if template_key == ScheduleTemplateKey.POST_PUBLISH.value:
            draft_cancelled = await _cancel_post_publish_schedule(
                db,
                schedule=schedule,
                user=user,
            )
            if draft_cancelled:
                await record_playbook_event(
                    db,
                    event="schedule.cancelled",
                    schedule_id=schedule.id,
                    schedule=schedule,
                    persona_account_id=schedule.persona_account_id,
                    persona_id=payload_data.get("persona_id"),
                    campaign_id=payload_data.get("campaign_id"),
                    draft_id=payload_data.get("draft_id"),
                    variant_id=payload_data.get("variant_id"),
                    post_publication_id=payload_data.get("post_publication_id"),
                    meta={"template": template_key} if template_key else None,
                )
                cancelled += 1
                continue

        schedule.status = ScheduleStatus.CANCELLED.value
        schedule.updated_at = now_utc_naive

        context = schedule.context_data() or {}
        context.update({
            "cancelled_at": now_utc_naive.isoformat() + "Z",  # 컨텍스트는 문자열 ISO UTC로
            "cancel_reason": "user_request",
        })
        schedule.context = context

        db.add(schedule)
        await record_playbook_event(
            db,
            event="schedule.cancelled",
            schedule_id=schedule.id,
            schedule=schedule,
            persona_account_id=schedule.persona_account_id,
            persona_id=payload_data.get("persona_id"),
            campaign_id=payload_data.get("campaign_id"),
            draft_id=payload_data.get("draft_id"),
            variant_id=payload_data.get("variant_id"),
            post_publication_id=payload_data.get("post_publication_id"),
            meta={"template": template_key} if template_key else None,
        )
        cancelled += 1

    if cancelled == 0:
        return MessageOut(message="No schedules were cancelled")

    await db.commit()
    return MessageOut(message=f"Cancelled {cancelled} schedule(s)")


@FLOWS.flow(
    key="action.schedule.create_from_raw_dag",
    title="Create Schedule(s) From DAG",
    description="Persist one or multiple schedules using a provided DAG specification",
    input_model=ScheduleCreateFromRawDagRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/create/raw",
    tags=("action", "schedule", "create", "dag"),
)
def _flow_create_schedule_from_raw_dag(builder: FlowBuilder):
    task = builder.task("create_from_raw_dag", "action.schedule.create_from_raw_dag")
    builder.expect_terminal(task)


# ---------------------------------------------------------------------------
# Draft scheduling flows
# ---------------------------------------------------------------------------

@FLOWS.flow(
    key="action.schedule.create_draft_post_schedule",
    title="Create Post Schedule",
    description="Create or update a post publication schedule for the given draft variant",
    input_model=DraftPostScheduleRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/create/draft/post",
    tags=("action", "schedule", "create", "draft", "post"),
)
def _flow_create_draft_post_schedule(builder: FlowBuilder):
    task = builder.task(
        "create_draft_post_schedule",
        "action.schedule.create_draft_post_schedule",
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.schedule.cancel_draft_post_schedule",
    title="Cancel Post Schedule",
    description="Cancel a post publication schedule for the given draft variant",
    input_model=CancelPostScheduleCommand,
    output_model=MessageOut,
    method="post",
    path="/actions/schedules/cancel/draft/post",
    tags=("action", "schedule", "cancel", "draft", "post"),
)
def _flow_cancel_draft_post_schedule(builder: FlowBuilder):
    task = builder.task("cancel_draft_post_schedule", "action.schedule.cancel_draft_post_schedule")
    builder.expect_terminal(task)

# ---------------------------------------------------------------------------
# Mailing schedule flows
# ---------------------------------------------------------------------------

@FLOWS.flow(
    key="action.schedule.create_trends_mail_schedule",
    title="Create Trends similar to persona Mail Schedule",
    description="Create or update a mail publication schedule for the given draft variant",
    input_model=MailBatchRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/mail/create",
    tags=("action", "schedule", "cancel")
)
def _flow_create_trends_mail_schedule(builder: FlowBuilder):
    task = builder.task(
        "create_trends_mail_schedule",
        "action.schedule.create_trends_mail_schedule",
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.schedule.create_sync_metrics_schedule",
    title="Create Sync Metrics Schedule",
    description="Create or update sync metrics schedules for publications",
    input_model=SyncMetricsBatchRequest,
    output_model=ScheduleCreateResult,
    method="post",
    path="/actions/schedules/sync_metrics/create",
    tags=("action", "schedule", "metrics"),
)
def _flow_create_sync_metrics_schedule(builder: FlowBuilder):
    task = builder.task(
        "create_sync_metrics_schedule",
        "action.schedule.create_sync_metrics_schedule",
    )
    builder.expect_terminal(task)


@FLOWS.flow(
    key="action.schedule.cancel_schedules",
    title="Cancel Schedules",
    description="Cancel a list of schedules",
    input_model=CancelSchedulesCommand,
    output_model=MessageOut,
    method="post",
    path="/actions/schedules/cancel",
    tags=("action", "schedule", "cancel"),
)
def _flow_cancel_schedules(builder: FlowBuilder):
    task = builder.task("cancel_schedules", "action.schedule.cancel_schedules")
    builder.expect_terminal(task)

@FLOWS.flow(
    key="abtests.schedule_abtest",
    title="Schedule AB Test Variants",
    description="Schedule both variants of an AB test to publish simultaneously",
    input_model=ABTestScheduleCommand,
    output_model=ABTestScheduleResult,
    method="post",
    path="/actions/abtests/{abtest_id}/schedule",
    tags=("action", "abtests", "schedule"),
)
def _flow_schedule_abtest(builder: FlowBuilder) -> None:
    task = builder.task("schedule_abtest", "abtests.schedule")
    builder.expect_terminal(task)



__all__ = []
