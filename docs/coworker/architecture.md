# CoWorker 구성안 (정리본)

## 1. 스케줄러

* **스케줄 테이블**을 단일 진입점으로 사용.
* 30초마다 스캔 → due 항목을 큐에 enqueue.
* 모든 예약성 작업을 여기로 환원:

  * Default Job: PostPublication은 맨날 봐야함(스케쥴 `발행` 때문)
  * 발행 / 삭제 (Adapter 태스크 호출)
  * 메트릭 수집(InsightSample)
  * 댓글 모니터링 / 상호작용
  * 이메일 발송
  * 트렌드 기반 Draft 생성 루프
* 정책화:

  * PersonaAccount 단위로만 동작 (없으면 무효).
  * 사용자도 직접 스케줄에 개입 가능 (화이트보드 UX).
  * 댓글 인터랙션은 정책/랜덤 배치로 “자연스러움” 확보.

## 2. 워커 종류

* **이메일 워커**

  * 지침/발행/모니터링 결과를 이메일로 전달.
  * 발행 직전 알림 → 무시/취소 옵션 제공.

* **코어 상호작용 워커** (별도 네이밍 불필요)

  * Sniffer 결과와 Persona 유사도 기반 Draft 생성.
  * 회신 시 DraftIR 확정 → 컴파일 → PostPublication upsert.
  * 댓글 정책(QnA) 기반 자동응답.
  
* **집계 워커** (역시 별도 네이밍 불필요)

  * 일일 KPI 집계.
  * 댓글 동향 집계.
  * 이메일/타임라인 이벤트로 전송.

## 3. 엔티티/피처

* **PostPublication** = 모든 발행/삭제/모니터링의 단일 SoT.
* **Schedule** = 예약성 행위의 SoT.
* **타임라인 뷰** = 시간축 이벤트 통합. 필터링으로 Draft/Publication/Insight/KPI/댓글 상호작용/CoWorker 액션 전부 노출.

## 4. 사용성 보고서 및 운영 노트

### 4.1 사용성(UX)
- 단일 `Schedule` SoT 기반으로 발송, 대기, 재개, 실패 복구 등 상태가 일관되게 추적됩니다.
- 템플릿(`mail.trends_with_reply`, `post.publish`)을 통해 반복 작업을 쉽게 모델링할 수 있습니다.
- DAG 기반 실행으로 의존 관계가 명확하고, 각 노드의 결과를 `_dag.results`와 `completed`로 추적합니다.

### 4.2 장점
- 스케줄 재시도/대기/재개를 DB 한 곳에서 관리 → 장애 복구 단순화.
- 외부 이벤트(이메일 회신)로 DAG를 중단/재개할 수 있어 사용자 상호작용형 자동화가 가능.
- 템플릿 컴파일 → 표준화된 DAG 스펙(JSON) 저장 → 추적/감사 용이.

### 4.3 단점/주의점
- JSON 컬럼의 변경 감지: SQLAlchemy에서 in-place 변경은 추적되지 않을 수 있어 최종에 `schedule.context = dict(context)` 재할당 권장.
- 재개 시점의 선행 검사: `await_reply` suspend 후 재개 시 선행 완료 플래그가 필요. 실행기 보완으로 `waiting_node` 또는 `resume_next`의 선행들을 completed로 처리하여 진행 보장.
- 중복 실행: RUNNING도 due 피킹 허용 시, 오퍼레이터 레벨(idempotency guard)로 중복 전송을 방지해야 함.

### 4.4 트러블슈팅 기록(요약)
- 증상: 회신 이벤트가 들어왔는데 `ingest_draft_mail`이 실행되지 않고 DONE으로 종료. 메타데이터에 `_resume`이 반영되지 않음.
- 원인:
  1) `schedule.context`를 in-place로 수정하여 변경이 저장되지 않음 → dict 재할당으로 해결.
  2) 재개 시 `wait_reply`가 completed로 간주되지 않아 `ingest_reply`가 선행 검사에 막혀 스킵됨 → 실행기에서 재개 시 `waiting_node` 또는 `resume_next`의 선행들을 completed로 처리하도록 수정.
- 결과: 회신 도착 시 `_resume.event` 주입 + `due_at=now`로 재개되고, `ingest_draft_mail` 실행 및 Draft 생성 정상화.

### 4.5 await_reply 기반 작업 중단/재개
- 대기: `await_reply` 오퍼레이터가 `request_reschedule(delay=timeout)`로 스케줄을 RUNNING/미래 `due_at`으로 설정하고 `_dag.waiting_node=wait_reply`, `resume_next=[ingest_reply]` 저장.
- 재개(회신 수신): Sniffer가 `_resume.event`를 `context`에 주입하고 `due_at=now`로 업데이트 → CoWorker가 선택 → 실행기에서 `waiting_node`(또는 선행) 완료 처리 후 `ingest_reply` 실행.
- 재개(타임아웃): due 도래 시 `_resume` 없이 재개 → `ingest_reply`는 유효성 오류로 실패/재시도 경로로 전개.