# Define A/B Test

## 통제 변수

같은 캠페인, 같은 페르소나, 동시 발행 원칙, 동일 KPI 수집

## 실험 변수

* 사용자가 구체적으로 명시

## 데이터 모델

```py
class ABTest(Base):
    __tablename__ = "ab_tests"

    id = Column(Integer, primary_key=True)
    persona_id = Column(Integer, ForeignKey("personas.id"))
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))

    variable = Column(String(50))  # "tone", "hashtags", "posting_time"
    variant_a_id = Column(Integer, ForeignKey("drafts.id"))
    variant_b_id = Column(Integer, ForeignKey("drafts.id"))

    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    winner_variant = Column(String(1), nullable=True)  # "A" or "B"
    uplift_percentage = Column(Float, nullable=True)
```

## 검증 규칙

* Variant A/B는 서로 다른 Draft를 가리켜야 한다.
* Draft는 ABTest가 속한 캠페인/페르소나 소유자와 일치해야 한다.
* 다른 진행 중인 ABTest에 사용 중인 Draft는 재사용할 수 없다.
* Variant 관련 게시물이 이미 게시(PUBLISHED/MONITORING) 상태라면 ABTest를 만들 수 없다.

## 스케줄 자동화

* 오케스트레이터 액션  
  * `POST /actions/abtests` → ABTest 생성  
  * `POST /actions/abtests/{abtest_id}/schedule` → 두 Variant를 동일 시각에 게시하도록 예약 (선택적으로 종료 스케줄 `complete_at` 지정)
* 스케줄 템플릿  
  * `abtest.schedule_ab_test` : A/B Variant 게시 (`internal.drafts.publish` 두 노드 직렬 실행)  
  * `abtest.complete_ab_test` : 게시 후 모니터링 윈도우 종료 시점에 후속 작업을 트리거
* 스케줄 생성 시 PostPublication이 Variant 각각에 대해 생성/갱신되며, Playbook 로그에 `abtest.scheduled` 이벤트가 기록된다.
* 완결 스케줄이 트리거되면 `abtest.completion_ready` 이벤트가 Playbook에 적재되어 성과 검토/승자 결정 단계로 이어진다.

## UX

"Start ABTest @Draft_id:1, @Draft_id:2" -> Create AB Test DTO

"List ABTests" -> List AB Tests

"Start ABTest @ABTest_id:1 at @date:2025-05-03" -> Schedule posting with persona's posting time

"Show ABTest @ABTest_id:1" -> click the winner -> finish ab_test -> PlaybookLog에 “이 브랜드는 tone='warm'일 때 engagement +104%” 식으로 기록.
