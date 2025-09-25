# CoWorker, End-to-End

이 문서는 CoWorker 시스템이 어떻게 스케줄을 생성·실행·복구하는지 전 과정을 설명한다. Scheduler와 Orchestrator, Celery 워커, Sniffer, Lease까지 한 흐름에 묶어 CoWorker를 이해할 수 있도록 구성했다.

## 1. 전체 개요

CoWorker는 Persona 계정 단위로 반복적인 아웃바운드(이메일, 게시물)와 인바운드 상호작용을 자동화한다. 핵심 특징은 다음과 같다.

- **Schedule 중심 설계**: 모든 작업은 `schedules` 테이블에 저장된 DAG 사양(`dag_spec`)을 기반으로 실행된다.
- **DAG 기반 오케스트레이션**: `DagExecutor`가 노드 간 의존 관계를 따라 Flow를 순차 실행한다.
- **재개 가능한 실행**: Flow에서 `request_reschedule` 호출 시 컨텍스트와 함께 중단되었다가, 외부 이벤트(예: 회신 메일)로 다시 이어 실행된다.
- **Lease 기반 사용자 제어**: 사용자별 실행 허용 범위와 주기는 `coworker_leases`가 관리한다.

## 2. 구성 요소와 역할

| 구성 요소 | 위치 | 역할 |
|-----------|------|------|
| Scheduler Repository | `apps/backend/src/modules/scheduler/repository.py` | due 스케줄 조회, 상태 전환, lease 저장 |
| Schedule 모델 | `apps/backend/src/modules/scheduler/models.py` | DAG 사양(`dag_spec`), payload, context 저장 |
| CoWorker 워커 | `apps/backend/src/workers/CoWorker/execute_due_schedules.py` | Celery 태스크. due 스케줄을 가져와 `DagExecutor` 실행 |
| Sniffer 워커 | `apps/backend/src/workers/Sniffer/tasks.py` 등 | 이메일/소셜 채널 폴링. 회신 이벤트로 스케줄 재개 |
| Orchestrator Registry | `apps/backend/src/orchestrator/registry.py` | Flow 등록, Flow 정의 로딩 |
| DagSpec & DagExecutor | `apps/backend/src/orchestrator/dsl.py`, `dag_executor.py` | DAG 파싱, 노드 실행, reschedule 처리 |
| Runtime Provider | `apps/backend/src/orchestrator/dispatch.py` | Flow 실행 컨텍스트 주입(AsyncSession, User 등) |
| Lease 도메인 | `coworker_leases` 테이블 + Repo | 사용자별 자동 실행 간격, Persona 범위 관리 |

### 2.1 실행 환경

- **Celery**: 워커는 `coworker` 큐에서 실행되며, Beat가 30초 주기로 `execute_due_schedules` 태스크를 호출한다.
- **비동기 Flow**: Flow는 대부분 `async` 함수. DagExecutor가 `orchestrate_flow`를 통해 실행해준다.
- **데이터베이스 연결**: CoWorker 태스크는 동기 SQLAlchemy 세션으로 상태 전환, DagExecutor는 AsyncSession을 runtime으로 제공받는다.

## 3. 라이프사이클 개요

1. **스케줄 생성**: 템플릿 API 또는 백오피스가 DagSpec과 payload, context를 구성해 `schedules` 테이블에 Insert.
2. **픽업**: CoWorker 태스크가 `pick_due()` 로 due 스케줄을 락 걸고 `RUNNING` 으로 업데이트.
3. **DAG 실행**: DagExecutor가 노드 순서를 계산해 Flow를 호출. 결과는 `context._dag.results.<node_id>`에 누적.
4. **Reschedule** (선택): Flow에서 `ScheduleReschedule` 예외를 던지면 실행이 중단되고 새로운 `due_at`으로 재예약.
5. **외부 이벤트**: Sniffer나 사용자 액션이 `_resume` 컨텍스트를 채우고 `due_at`을 즉시로 당긴다.
6. **재개**: 다음 실행에서 DagExecutor가 `_resume`을 활용해 다음 노드부터 이어서 실행.
7. **완료/실패**: 모든 노드 성공 시 `DONE`, 예외 발생 시 `FAILED`로 상태 갱신. 컨텍스트는 저장되어 디버깅에 활용된다.

## 4. Scheduler와 Lease

### 4.1 Schedule 테이블 핵심 필드

- `dag_spec`: `{"dag": {"nodes": [...], "edges": [...]}}` 구조의 JSONB. 각 노드는 Flow 키와 입력 매핑을 가진다.
- `payload`: 스케줄 생성 시의 입력 스냅샷. immutable 원칙을 적용하며, DagExecutor에서 `${payload.*}` 참조로 사용한다.
- `context`: 실행 중 생성되는 상태. `_dag.results`, `_resume`, `pipeline_id`, 사용자 정의 플래그 등이 저장된다.
- `status`: `pending`, `queued`, `running`, `done`, `failed`, `rescheduled` 등.
- `due_at`: 다음 실행 시각. `request_reschedule` 호출 시 갱신된다.

### 4.2 Lease 동작 방식

`coworker_leases`는 사용자별 자동 실행 상태를 관리한다.

```text
+------------------+-----------------------------------------+
| 필드             | 설명                                    |
+------------------+-----------------------------------------+
| owner_user_id    | Lease 소유자 (사용자 ID)                |
| persona_account_ids | Lease가 관리하는 Persona 계정 목록  |
| interval_seconds | CoWorker 자기 재큐잉 간격 (최소 5초)   |
| task_id          | 최근 Celery 태스크 ID                   |
| active           | 실행 가능 여부                         |
```

- `execute_due_schedules(owner_user_id=...)`가 실행되면 먼저 Lease를 조회한다.
- Lease가 비활성 상태거나 Persona 목록이 비어 있으면 즉시 종료하고 `task_id`를 비운다.
- 실행 후 `_reschedule_self()` 가 Lease를 다시 확인하고 새 Celery 태스크를 `countdown=interval_seconds` 로 등록한다.
- `/actions/schedules/start_my_coworker`, `/stop_my_coworker` API가 Lease 상태를 토글하며, interval도 수정 가능하다.

### 4.3 Lease와 DAG의 연결

Lease는 스케줄 큐의 우선순위나 due 여부에 직접 관여하지 않는다. 대신 Lease가 허용한 Persona 계정 집합만이 `pick_due()` 의 필터로 쓰인다. 이를 통해 사용자별 큐를 독립적으로 제어하고, 장시간 비활성인 사용자의 스케줄은 자동으로 멈춘다.

## 5. DAG 조립법

CoWorker DAG는 최소한 다음 요소로 구성된다.

1. **노드(`nodes`)**: 각 노드는 `id`, `flow`, `in`(입력 매핑), 필요한 경우 `title`, `card_hint` 등을 정의한다.
2. **엣지(`edges`)**: `["source", "target"]` 형태. 순환 구조는 금지된다.
3. **입력 매핑**: 문자열 값에서 `$.payload.*`, `$.context.*`, `$.resume.*`, `$.nodes.*` 형식으로 참조할 수 있다.
4. **Payload Builder**: Planner나 템플릿에서 동적으로 payload를 재구성해야 할 때 사용한다. DagExecutor는 `payload_builder(results_map)`를 호출해 입력을 마련한다.

### 5.1 참고 규칙

- `payload` → 스케줄 생성 시 저장된 입력.
- `context` → 이전 실행에서 누적된 상태.
- `resume` → `_resume` 컨텍스트. Sniffer 등 외부 이벤트가 채운다.
- `nodes` → 이전 노드 실행 결과. `nodes.compose.pipeline_id` 처럼 접근한다.
- `nodes_raw` → DagExecutor에 의해 새로 추가된 원본 결과를 의미. 직렬화되지 않은 객체를 사용할 때 필요하다.

### 5.2 예시 DAG

```json
{
  "dag": {
    "nodes": [
      {
        "id": "compose",
        "flow": "internal.mail.compose_trends_email",
        "in": {
          "persona_id": "$.payload.persona_id",
          "email_to": "$.payload.email_to"
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
          "text_plain": "$.resume.event.text_plain"
        }
      }
    ],
    "edges": [["compose", "wait_reply"], ["wait_reply", "ingest_reply"]]
  },
  "payload": {
    "persona_id": 123,
    "persona_account_id": 456,
    "email_to": "user@example.com"
  }
}
```

### 5.3 DAG Builder 유틸리티

`ScheduleDagBuilder` 를 이용하면 Python 코드로 DAG를 선언적으로 작성할 수 있다.

```python
builder = ScheduleDagBuilder()
builder.payload(persona_id=1, persona_account_id=10)
compose = builder.add_node(
    "internal.mail.compose_trends_email",
    persona_id=payload_ref("persona_id"),
)
wait = builder.add_node(
    "internal.mail.await_reply",
    pipeline_id=node_ref(compose, "pipeline_id"),
)
builder.connect(compose, wait)
spec = builder.build()
```

생성된 `spec`을 `POST /actions/schedules/create` API로 제출하면 즉시 실행 가능한 Schedule이 만들어진다.

## 6. DagExecutor와 실행 흐름

1. **DagSpec 파싱**: `parse_dag_spec()`가 JSON을 검증하고 `DagNode` 객체를 만든다.
2. **상태 복구**: DagExecutor는 `schedule_context._dag.results` 를 읽어 이전 결과를 복원한다.
3. **입력 준비**:
   - `payload_builder`가 있으면 우선 실행.
   - 그렇지 않으면 `in` 매핑을 `_materialize()` 가 해석한다.
   - Pydantic 모델로 검증하여 Flow 입력을 생성한다.
4. **Flow 실행**: `orchestrate_flow()`가 런타임 의존성(AsyncSession, User 등)을 주입해 Flow를 호출한다.
5. **결과 저장**: 원본 결과를 `raw_results[node_id]`에, 직렬화된 결과를 `node_results[node_id]`에 저장한다.
6. **에러 처리**: Flow 중 예외 발생 시 `on_error` 콜백이 실행되고, `continue_on_error=True` 면 해당 노드는 건너뛴다.
7. **Reschedule**: Flow가 `ScheduleReschedule`을 raise하면 DagExecutor가 컨텍스트를 업데이트한 뒤 즉시 raise해 상위 워커로 전달한다.

### 6.1 컨텍스트 키

- `_dag.results.<node_id>`: 직렬화된 결과.
- `_dag.completed`: 완료된 노드 목록.
- `_dag.resume_next`: 재개 시 시작할 노드 힌트.
- `_resume`: 재개용 payload. Sniffer가 채운다.

### 6.2 Chat Orchestrator 연계

`apps/backend/src/orchestrator/chat_router.py` 역시 ChatPlan을 DagSpec으로 변환해 동일한 DagExecutor를 사용한다. 이는 CoWorker와 Chat이 동일한 실행 엔진을 공유함을 의미하며, Flow를 어디서 호출하든 동일한 런타임 규칙이 적용된다.

## 7. Sniffer와 Resume 흐름

1. Sniffer (예: `apps/backend/src/workers/Sniffer/tasks.py`)는 주기적으로 메일 박스를 폴링한다.
2. 회신 메일에서 `pipeline_id` 등 식별자를 추출한다.
3. 해당 스케줄을 조회해 `context._resume`에 이벤트 payload를 저장하고, `due_at`을 현재 시간으로 갱신한다.
4. CoWorker 태스크가 다음 루프에서 이 스케줄을 픽업하면, DagExecutor는 `_resume` 데이터를 이용해 대기 중이던 노드를 실행한다.
5. 실행이 끝나면 `_resume` 키는 비워지고, 컨텍스트에 최종 결과만 남는다.

> Sniffer가 이벤트를 못 찾으면 Lease 주기에 맞춰 계속 재시도한다. 환경 변수로 이메일 IMAP 정보와 폴링 간격을 조절한다.

## 8. 운영 및 모니터링

- **Celery Beat 설정**: `execute-due-schedules` 태스크를 30초 간격으로 등록. 사용자별 Lease 태스크는 `_reschedule_self()`가 책임진다.
- **로그 관찰**: `schedule <id> rescheduled` 로그로 대기 상태를 확인, `schedule <id> failed` 로그로 실패 상황을 추적한다.
- **컨텍스트 분석**: 실패 시 `Schedule.last_error`, `Schedule.context`를 확인하면 DagExecutor가 저장한 상태를 볼 수 있다.
- **Prometheus/StatsD**: 필요 시 `execute_due_schedules` 결과에 포함된 processed/rescheduled 수치를 메트릭으로 노출한다.

## 9. 확장 전략

1. **새로운 Flow 추가**: `FLOWS.flow()` 데코레이터로 Flow를 등록하면 DAG에서 `flow` 키로 사용할 수 있다.
2. **다른 채널 지원**: Slack, SMS 등 외부 채널도 Sniffer와 Resume 컨벤션만 맞추면 동일한 구조로 확장 가능하다.
3. **조건 분기**: 현재 DagExecutor는 순차 실행을 기본으로 하지만, Payload Builder에서 조건 로직을 넣어 특정 노드를 비활성화할 수 있다.
4. **멀티 테넌시**: Lease로 Persona 범위를 제한하고, Scheduler가 due 픽업 시 테넌트별 필터를 추가하면 손쉽게 격리 가능하다.

## 10. 문제 해결 가이드

| 증상 | 진단 단계 | 해결 방법 |
|------|-----------|-----------|
| 스케줄이 실행되지 않음 | Lease 활성 여부, `due_at` 확인 | `/actions/schedules/start_my_coworker` 호출 또는 `due_at` 수동 조정 |
| DAG 중간에 멈춤 | `context._resume` 값 확인 | Sniffer 이벤트가 제대로 적재됐는지, `pipeline_id` 매칭되는지 점검 |
| Flow 입력 검증 오류 | DagExecutor 로그의 `Unable to build request` 메시지 확인 | 템플릿/Builder에서 필수 파라미터 누락 여부 수정 |
| 무한 Reschedule | Flow에서 `request_reschedule` 호출 조건 검사 | timeout, 상태 플래그 조정. 필요한 경우 `max_attempts` 활용 |
| Sniffer 중복 처리 | `_resume` 덮어쓰기 여부 확인 | Sniffer가 동일 메일을 반복 처리하지 않도록 IMAP UID 관리 |

## 11. 용어 정리

- **Schedule**: DAG 실행 단위. due_at, payload, context를 포함한다.
- **DagSpec**: DAG 구조를 정의한 JSON. 노드+엣지 목록으로 구성된다.
- **DagExecutor**: DagSpec을 실행하는 엔진. Flow 호출과 상태 저장을 담당한다.
- **Flow**: Orchestrator에 등록된 작업 단위. Pydantic input/output 모델을 갖는다.
- **Lease**: 사용자별 CoWorker 실행 권한과 주기 설정.
- **Sniffer**: 외부 이벤트(메일, 댓글 등)를 감지해 스케줄을 재개시키는 워커.
- **Resume Payload (`_resume`)**: 중단된 DAG를 이어 실행하기 위한 입력.
- **Pipeline ID**: 메일 발송과 회신을 매칭하기 위한 식별자.
