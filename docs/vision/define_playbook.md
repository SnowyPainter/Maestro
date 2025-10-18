# Define Playbook

Maestro에서의 “Playbook”을 독자 개념으로 정립.
이제부터 Playbook은 “사람이 작성하는 문서형 매뉴얼”이 아님.
시스템이 자동으로 축적하고, 사용자는 ‘조회만 하는’ 브랜드 지능 모델.

## Maestro에서의 Playbook 정의

Playbook = Persona(브랜드 정체성) × Campaign(실행 맥락)의 조합 단위에서
자동으로 생성·누적되는 브랜드 운영 인텔리전스(Brand Intelligence) 객체.

* 브랜드의 “누적된 행동 + 결과”를 모두 담는 자동 생성·자동 학습 데이터 구조
* 사용자는 직접 수정 불가, 조회 및 비교 가능
* CoWorker, Orchestrator에서 "행동 단위" 자동 업데이트

## Playbook 생성 및 업데이트 로직

on_event 에서 InternalEvent를 받음.
Persona_Id, Campaign_Id에 따라 합성 유니크. 자동 생성/가져오기

## 구조적 차이

| 항목     | 전통적 Playbook    | Maestro Playbook      |
| ------ | --------------- | --------------------- |
| 생성 방식  | 사람이 작성          | 시스템이 이벤트 기반 자동 생성     |
| 내용     | 전략 문서 / 가이드라인   | 행동·성과 로그 기반 인텔리전스     |
| 역할     | 사전 계획서          | 사후 학습 기록 + 실시간 요약     |
| 사용 방식  | 수정·참조           | 조회·분석만                |
| 단위     | 브랜드 전체 / 마케팅 조직 | Persona × Campaign    |
| 데이터 출처 | 인간 인사이트         | LLM 입력/출력 + KPI + 트렌드 |

## 데이터 모델

| 엔티티             | 역할                                     | 생성/갱신 방식                                |
| --------------- | -------------------------------------- | --------------------------------------- |
| **Playbook**    | Persona × Campaign 단위의 브랜드 인텔리전스 컨테이너  | Draft/Publish 등 이벤트 시 `get_or_create()` |
| **PlaybookLog** | 모든 행동의 세부 로그 (LLM 입력, 결과, KPI 등)       | 각 이벤트 시 자동 append                       |
| **관계**          | `Playbook 1 : N PlaybookLogs`          | Cascade delete                          |

```py
# models/playbook.py
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, JSON, UniqueConstraint, Text
)
from sqlalchemy.orm import relationship

class Playbook(Base):
    """
    Persona × Campaign 단위의 브랜드 지능 컨테이너
    """
    __tablename__ = "playbooks"
    __table_args__ = (
        UniqueConstraint("persona_id", "campaign_id", name="uq_playbook_persona_campaign"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)

    persona = relationship("Persona", backref="playbooks")
    campaign = relationship("Campaign", backref="playbooks")
    logs = relationship("PlaybookLog", back_populates="playbook", cascade="all, delete-orphan")

    # 집계된 인사이트 / 통계 요약
    aggregate_kpi = Column(JSON, nullable=True)        # {"avg_engagement": 0.043, "click_rate": 0.021, ...}
    best_time_window = Column(String(40), nullable=True)
    best_tone = Column(String(40), nullable=True)
    top_hashtags = Column(JSON, nullable=True)
    last_event = Column(String(50))
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlaybookLog(Base):
    """
    Playbook에 속한 모든 이벤트 로그
    """
    __tablename__ = "playbook_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    playbook_id = Column(Integer, ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False)
    event = Column(String(50), nullable=False)        # "draft.created", "publish.done", "llm.invoke", "abtest.completed"
    timestamp = Column(DateTime, default=datetime.utcnow)

    # 참조 정보
    draft_id = Column(Integer, nullable=True)
    schedule_id = Column(Integer, nullable=True)
    abtest_id = Column(Integer, nullable=True)
    ref_id = Column(Integer, nullable=True)           # 범용 참조 ID

    # 로그 컨텍스트 (LLM 입력/출력, KPI 등)
    persona_snapshot = Column(JSON, nullable=True)
    trend_snapshot = Column(JSON, nullable=True)
    llm_input = Column(JSON, nullable=True)
    llm_output = Column(JSON, nullable=True)
    kpi_snapshot = Column(JSON, nullable=True)
    meta = Column(JSON, nullable=True)

    playbook = relationship("Playbook", back_populates="logs")
```

## 데이터 흐름

```
[1] Draft 생성
     → PlaybookLog(event="draft.created", llm_input/output 저장)
     → Playbook.last_event="draft.created"

[2] Publish 완료
     → PlaybookLog(event="publish.done", kpi_snapshot 기록)
     → Playbook.aggregate_kpi 업데이트 (평균, 트렌드 등)

[3] Schedule 취소
     → PlaybookLog(event="schedule.cancelled", meta={"reason":...})

[4] A/B 테스트 종료
     → PlaybookLog(event="abtest.completed", meta={"winner": "B"})
     → Playbook.best_tone, top_hashtags 등 갱신
```

### 정리

Playbook은 Persona×Campaign 단위로 하나만 존재하고,
PlaybookLog는 해당 Playbook의 시간순 행동 기록을 쌓는다.

브랜드 정체성(Persona)과 캠페인 맥락(Campaign)은 이미 FK로 연결되어 있으므로
PlaybookLog만 잘 정의하면 “학습 가능한 브랜드 지능 캐시” 구조가 완성된다.