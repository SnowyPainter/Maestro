완료본 드랍한다. 아래 조각들 그대로 넣으면 “Schedule→DAG 중심”으로 정리되고, 기존 runner 계층은 제거 가능하다. (경로/네임스페이스는 네가 쓰는 구조에 맞춰 조정해도 됨.)

# 0) Alembic 마이그레이션

```py
# versions/20250925_schedule_flow_dag.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as psql

revision = "20250925_schedule_flow_dag"
down_revision = "<prev>"

def upgrade():
    op.add_column("schedules", sa.Column("dag_spec", psql.JSONB(astext_type=sa.Text()), nullable=False))
    op.add_column("schedules", sa.Column("context",  psql.JSONB(astext_type=sa.Text()), nullable=True))
    # status/due_at 인덱스 강권
    op.create_index("ix_schedules_status_due", "schedules", ["status", "due_at"])
    op.drop_column("schedules", "flow_key")

def downgrade():
    op.drop_index("ix_schedules_status_due", table_name="schedules")
    op.drop_column("schedules", "context")
    op.drop_column("schedules", "dag_spec")
    op.add_column("schedules", sa.Column("flow_key", sa.String(), nullable=True))
    op.drop_column("schedules", "dag_spec")
```

# 1) SQLAlchemy 모델 (입력 payload 불변 원칙 반영)

```py
# apps/backend/src/modules/scheduler/models.py
class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True)
    persona_account_id = Column(Integer, ForeignKey("persona_accounts.id"), nullable=False)
    due_at = Column(DateTime, nullable=False, index=True)
    queue = Column(String, nullable=True, index=True)
    dag_spec = Column(JSON, nullable=False)
    payload = Column(JSON, nullable=True)
    context = Column(JSON, nullable=True)

    status = Column(String, default="pending", index=True)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_error = Column(String, nullable=True)
    errors = Column(JSON, nullable=True)
    idempotency_key = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
```

# 2) 레포지토리 헬퍼

```py
# apps/backend/src/modules/scheduler/repo.py
from sqlalchemy import select, update, func, text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from contextlib import contextmanager
from .models import Schedule

def pick_due(session: Session, limit: int = 100) -> list[Schedule]:
    q = (
        select(Schedule)
        .where(Schedule.status == "queued")
        .where(Schedule.due_at <= func.now())
        .with_for_update(skip_locked=True)
        .limit(limit)
    )
    return list(session.execute(q).scalars().all())

@contextmanager
def lock(session: Session, schedule_id: int):
    try:
        session.execute(select(Schedule).where(Schedule.id == schedule_id).with_for_update())
        yield
        session.commit()
    except Exception:
        session.rollback()
        raise

def mark_running(session: Session, schedule_id: int):
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(status="running", locked_at=func.now())
    )

def mark_done(session: Session, schedule_id: int):
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(status="done", locked_at=None, last_error=None)
    )

def mark_failed(session: Session, schedule_id: int, err: str):
    session.execute(
        update(Schedule)
        .where(Schedule.id == schedule_id)
        .values(status="failed", locked_at=None, last_error=err, retries=Schedule.retries + 1)
    )
```

# 3) 오케스트레이터 진입점(Flow/DAG 실행기)

```py
# apps/backend/src/workers/CoWorker/execute_due_schedules.py
from apps.backend.src.orchestrator.dsl import parse_dag_spec
from apps.backend.src.orchestrator.dag_executor import DagExecutor

async def _run_snapshot(snapshot: ScheduleSnapshot) -> ExecutionResult:
    if not snapshot.dag_spec:
        raise ValueError("Schedule is missing dag_spec")

    spec = parse_dag_spec(snapshot.dag_spec)
    context = dict(snapshot.context)
    resume_payload = context.pop("_resume", None)
    runtime = ExecutionRuntime()
    async with AsyncSessionLocal() as db:
        runtime.provide(db, name="db", type_hint=AsyncSession)
        ...  # user / persona_account / schedule context 주입
        executor = DagExecutor(
            spec,
            runtime=runtime,
            schedule_payload=dict(snapshot.payload),
            schedule_context=context,
            resume_payload=resume_payload,
        )
        return await executor.run()

@shared_task(name="apps.backend.src.workers.coworker.execute_due_schedules", queue="coworker")
def execute_due_schedules(self):
    with SessionLocal() as session:
        for schedule in repo.pick_due(session):
            repo.mark_running(session, schedule.id)
            try:
                result = asyncio.run(_run_snapshot(ScheduleSnapshot.from_model(schedule)))
                repo.mark_done(session, schedule.id, context=result.context)
            except ScheduleReschedule as suspend:
                repo.mark_rescheduled(
                    session,
                    schedule.id,
                    due_at=suspend.directive.effective_resume_at(),
                    payload=suspend.directive.payload,
                    context=suspend.directive.context,
                    status=ScheduleStatus(suspend.directive.status),
                )
            except Exception as exc:
                repo.mark_failed(session, schedule.id, error=str(exc), context=schedule.context)
```

> 포인트: **코루틴 반환 금지**, Celery 태스크는 동기 함수로 유지, 내부에서 `asyncio.run(...)`.

> `kind`/`flow_key` 컬럼은 제거되었으므로, `dag_spec` 가 비어 있으면 곧바로 실패 처리된다.

# 4) 기존 runner 제거 / 대체 플로우 정의

# 4) 메일 플로우 구성 (오퍼레이터 분리)

```py
# apps/backend/src/orchestrator/flows/internal/operators.py
@operator("internal.mail.load_persona_profile")
async def op_load_persona_profile(payload: ComposeTrendsEmailPayload, ctx: TaskContext) -> PersonaProfile:
    ...

@operator("internal.mail.embed_persona_profile")
async def op_embed_persona_profile(payload: PersonaProfile, ctx: TaskContext) -> PersonaEmbeddingResult:
    ...

@operator("internal.mail.fetch_similar_trends")
async def op_fetch_similar_trends(payload: FetchSimilarTrendsPayload, ctx: TaskContext) -> SimilarTrendsResult:
    ...

@operator("internal.mail.prepare_trends_email")
async def op_prepare_trends_email(payload: PrepareTrendsEmailPayload, ctx: TaskContext) -> PreparedTrendsEmail:
    ...

@operator("internal.mail.compose_trends_email")
async def op_compose_trends_email(payload: ComposeTrendsEmailPayload, ctx: TaskContext) -> ComposeTrendsEmailResult:
    ...

@operator("internal.mail.await_reply")
async def op_await_mail_reply(payload: AwaitReplyPayload, ctx: TaskContext) -> AwaitReplyPayload:
    ...  # request_reschedule(delay=timeout_s, status="running", context 업데이트)

@FLOWS.flow(key="internal.mail.compose_trends_email", ...)
def _flow_compose_trends_email(builder: FlowBuilder):
    node = builder.task("compose", "internal.mail.compose_trends_email")
    builder.expect_terminal(node)

@FLOWS.flow(key="internal.mail.await_reply", ...)
def _flow_await_mail_reply(builder: FlowBuilder):
    node = builder.task("await_reply", "internal.mail.await_reply")
    builder.expect_terminal(node)
```

`internal.mail.await_reply` 오퍼레이터는 이메일 전송 후 `request_reschedule` 를 발생시켜 스케줄을 RUNNING 상태로 유지한다. 이때 스케줄 컨텍스트에 `pipeline_id`, `schedule_id`, `wait_state="mail_reply"` 를 저장하여 답장 도착 시 어떤 스케줄을 재개해야 하는지 추적한다. 사용자가 답장을 보내면 `internal.event.mail.ingest_draft_mail` 플로우가 동일한 `pipeline_id` 를 가진 스케줄 컨텍스트에 `_resume.event` 를 적재하고 `due_at` 을 현재 시각으로 당겨, 코워커가 다음 노드(`ingest_reply`)부터 다시 실행할 수 있게 한다.

사용자가 `dag_spec` 으로 입력하는 예시는 아래와 같다. `persona_id` 를 누락하면 스케줄은 즉시 실패 처리된다.

```json
{
  "dag": {
    "nodes": [
      {
        "id": "compose",
        "flow": "internal.mail.compose_trends_email",
        "in": {
          "persona_id": "$.payload.persona_id",
          "email_to": "$.payload.email_to",
          "country": "$.payload.country",
          "limit": "$.payload.limit"
        }
      },
      {
        "id": "wait_reply",
        "flow": "internal.mail.await_reply",
        "in": {
          "pipeline_id": "$.nodes.compose.pipeline_id",
          "timeout_s": 604800
        }
      },
      {
        "id": "ingest_reply",
        "flow": "internal.event.mail.ingest_draft_mail",
        "in": {
          "subject": "$.resume.event.subject",
          "from_email": "$.resume.event.from",
          "sender": "$.resume.event.sender",
          "envelope": "$.resume.event.envelope",
          "text": "$.resume.event.text",
          "body": "$.resume.event.body",
          "text_plain": "$.resume.event.text_plain"
        }
      }
    ],
    "edges": [
      ["compose", "wait_reply"],
      ["wait_reply", "ingest_reply"]
    ]
  },
  "payload": {
    "persona_id": 123,
    "persona_account_id": 456,
    "email_to": "user@example.com",
    "country": "US",
    "limit": 20
  }
}
```

# 5) 인바운드 메일/폴러 플로우(스케줄화)

# 5) 인바운드 메일/폴러 DAG 예시

```py
MAIL_POLL_DAG = {
    "dag": {
        "nodes": [
            {
                "id": "poll",
                "flow": "internal.mail.poll_inbox_once",
                "in": {}
            }
        ],
        "edges": []
    }
}

await schedules.enqueue(dag_spec=MAIL_POLL_DAG, due_in_sec=0, payload={})
```

`internal.mail.poll_inbox_once` 는 IMAP 기반으로 메일 박스를 확인하고, 신규 메시지에서 `pipeline_id` 를 추출한 뒤 해당 값을 컨텍스트에 `_resume.event` 로 넣어 스케줄을 깨운다. 실제 구현에서는 Sniffer 워커가 `poll_mailbox()` 를 호출해 동일한 처리를 수행하며, 환경 변수 `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT`, `MAIL_IMAP_USER`, `MAIL_IMAP_PASSWORD`, `MAIL_IMAP_FOLDER` 를 사용한다.

> NOTE: `internal.mail.poll_inbox_once` 플로우는 별도 구현이 필요하며, 현재는 `sniff_mailbox` Celery 태스크가 동일한 로직을 수행한다.

# 6) Inbound에서 Flow 호출 방식 통일

```py
# apps/backend/src/modules/mail/service.py (일부)
from apps.backend.src.orchestrator.registry import FLOWS
from apps.backend.src.orchestrator.dispatch import orchestrate_flow

async def create_draft_from_incoming(payload: dict):
    flow = FLOWS.get("drafts.create")  # 문자열 키를 Flow로 해석
    return await orchestrate_flow(flow, payload, context={"channel": "mail"})
```

# 7) Celery Beat(30초 루프) 설정 예

```py
# celery.py / beat_schedule
beat_schedule = {
    "execute-due-schedules": {
        "task": "coworker.execute_due_schedules",
        "schedule": 30.0,
    },
}
```

---

## 운영 체크리스트

* [ ] 기존 `runners/*` 제거 및 import 경로 정리
* [ ] 인바운드/아웃바운드 모든 진입점에서 **FLOWS.get(...) → orchestrate_flow(...)**로 통일
* [ ] 모든 Celery 태스크는 **동기**로 두고 내부에서 `asyncio.run(...)` 수행
* [ ] `Schedule.payload`는 “입력 스냅샷”만 저장(불변). 중간 산출물은 이벤트/로그로만 기록
* [ ] `mail.poll_mailbox` 스케줄 1개 주입(자기 재스케줄)

## 템플릿 컴파일 유틸리티

프론트엔드에서 간단히 스케줄을 조립할 수 있도록 `ScheduleDagBuilder` 및 템플릿 API를 추가했다.

```python
from apps.backend.src.modules.scheduler.schemas import (
    ScheduleDagBuilder,
    payload_ref,
    node_ref,
)

builder = ScheduleDagBuilder()
builder.payload(persona_id=1, persona_account_id=10, email_to="user@example.com")
compose = builder.add_node(
    "internal.mail.compose_trends_email",
    persona_id=payload_ref("persona_id"),
    email_to=payload_ref("email_to"),
)
wait = builder.add_node(
    "internal.mail.await_reply",
    pipeline_id=node_ref(compose, "pipeline_id"),
)
builder.connect(compose, wait)
spec = builder.build()
```

고수준 템플릿은 `POST /actions/schedules/compile` (payload: `ScheduleCompileRequest`) 엔드포인트에서 제공되며, 현재 `mail.trends_with_reply` 템플릿을 지원한다. 이 API는 `ScheduleDagSpec`을 반환해 바로 스케줄 생성에 사용할 수 있다.

추가로,

- `GET /actions/schedules/templates` : 사용 가능한 템플릿 목록을 조회한다.
- `POST /actions/schedules/create` : 선택한 템플릿과 반복 옵션(`repeats`, `repeat_interval_minutes`)으로 여러 스케줄을 한 번에 생성한다. 응답에는 생성된 `schedule_ids`가 포함되므로 UI에서 묶음 관리가 가능하다. 템플릿별 필수 파라미터(예: `persona_id`, `persona_account_id`, `email_to`)는 `params` 객체에 채워야 하며, 필요하다면 `queue` 로 대상 작업 큐도 지정할 수 있다.
