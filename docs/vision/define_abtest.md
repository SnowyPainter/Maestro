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

## UX

"Start ABTest @Draft_id:1, @Draft_id:2" -> Create AB Test DTO

"List ABTests" -> List AB Tests

"Start ABTest @ABTest_id:1 at @date:2025-05-03" -> Schedule posting with persona's posting time

"Show ABTest @ABTest_id:1" -> click the winner -> finish ab_test -> PlaybookLog에 “이 브랜드는 tone='warm'일 때 engagement +104%” 식으로 기록.