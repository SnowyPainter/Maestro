# 🧩 마에스트로의 제품화  
> **엔진에서 제품으로 — "판단이 체감되는 순간"을 만드는 과정**

---

## 1. 현재 상태: 기술은 완성, 경험은 미완

Maestro는 이미 **기술적으로 완전한 오케스트레이션 엔진**이다.  
FastAPI + React + Graph RAG + Celery + pgvector 기반으로  
**판단의 기록과 재현**이 가능한 시스템이 완성되어 있다.

그러나 사용자 입장에서 보면, **"왜 써야 하는가"**,  
그리고 **"내 판단이 복제되었다는 체감"**이 부족하다.

> 지금의 Maestro는 ‘뛰어난 뇌’를 가졌지만, ‘몸’이 없는 상태다.  
> 이제는 사람에게 닿는 “제품 경험”이 필요하다.

---

## 2. 핵심 부족 요소 6가지

| # | 영역 | 현재 상태 | 부족한 점 | 개선 방향 |
|:-:|:------|:------------|:------------|:-------------|
| ① | **제품 경험 (Onboarding)** | 완성형 엔진 | 첫 성공 루프(aha moment) 없음 | 템플릿, 예시 명령어, 초기 플로우 제공 |
| ② | **기억의 재사용 (Memory Loop)** | 판단 저장은 완벽 | 기억을 불러오는 경험 부재 | “Reapply memory” 버튼 / “Remember why this worked” 기능 |
| ③ | **학습 루프 (Feedback → Adaptation)** | 반응 수집은 있음 | 반응 기반 재학습 루프 부재 | Playbook → “Next Action Proposal” 제안 기능 |
| ④ | **플랫폼 확장 (Adapter Layer)** | Threads/Instagram 지원 | LinkedIn, X, YouTube, Medium 미지원 | Adapter 확장 및 멀티플랫폼 루프 구축 |
| ⑤ | **가치 시각화 (Business ROI)** | KPI, 메트릭 수집 가능 | “판단 재사용의 가치” 미시각화 | “당신은 이번 주 23개의 판단을 자동 재사용했습니다 (+2h saved)” 등 메트릭 |

---

## 3. 구조적으로는 완벽하다 — 하지만 ‘루프’가 닫히지 않았다

Maestro의 기술 구조는 **“판단의 복제”**를 완벽히 구현한다.

```

Input → DSL 파싱 → DAG Executor → Playbook 기록 → Graph RAG 기억화

```

그러나 **재사용 루프**는 UX상 노출되지 않아,  
사용자는 자신의 판단이 **“다음 행동에 반영되었다”**는 체감을 얻지 못한다.

> 기술의 완성은 **판단을 저장하는 것**,  
> 제품의 완성은 **그 판단이 다시 살아나는 것**이다.

---

## 4. 제품화 방향 — Maestro 2.0 로드맵

### 🎯 1) 사용자 루프 설계
- 첫 진입 시 ChatPage(`apps/frontend/src/pages/ChatPage/ChatPage.tsx`)에서 `Quickstart` 타일을 노출해 `bff.onboarding.quickstart` 플로우 호출 → `트렌드 조회 → 초안 작성 → 스케줄`을 한 번에 실행  
- `SelectPersonaAccount`(`apps/frontend/src/features/contexts/SelectPersonaAccount.tsx`)에 데모 persona/campaign을 주입해 아무 맥락 없이도 카드 실행 가능  
- 온보딩 프롬프트/카드 복제는 `chat_router`의 카드 스트림(`apps/backend/src/orchestrator/chat_router.py`)을 그대로 활용하고, 첫 성공 시점은 로컬스토리지(`maestro-tool-order`)로 체크해 반복 노출 최소화

### 🧠 2) 기억의 재활용
- `PlaybookLog`(`apps/backend/src/modules/playbooks/models.py`)에 `playbook.memory_reapplied` 이벤트를 추가 기록하고, Graph RAG 검색(`apps/backend/src/modules/rag/search.py`) 결과를 기반으로 재생성한 초안을 `ChatStream` 카드로 띄움  
- `PersonaAccountContext`(`apps/frontend/src/widgets/PersonaAccountContext.tsx`)에 “Reapply Memory” 버튼을 넣어 persona×campaign 컨텍스트에 맞는 playbook을 선택 → `usePersonaContextStore`가 선택 ID를 저장해 이후 DSL 호출에 자동 주입  
- 실행 후 타임라인 위젯(`apps/frontend/src/entities/timeline/components/TimelinePlaybookLogEvent.tsx`)에 하이라이트로 어떤 판단이 복제되었는지 노출

### 🔁 3) 학습 루프 자동화
- CoWorker 태스크(`apps/backend/src/workers/CoWorker/generate_texts.py`)가 `_load_recent_publications`/KPI 데이터를 요약해 “Next Action Proposal” 스키마로 Playbook 로그에 남김  
- 타임라인 플로우(`apps/backend/src/orchestrator/flows/bff/bff_timeline.py`)에서 해당 로그를 `next_action` 이벤트로 변환하고 CTA 메타데이터(재사용할 톤, 복제 대상 draft 등)를 첨부  
- ChatStream 메시지/카드가 CTA 클릭 시 동일 DSL 요청을 재실행하게 하여 “반응 분석 → 다음 행동 제안 → 승인” 루프를 완결

### 🌐 4) 플랫폼 확장
- Threads 어댑터 구조(`apps/backend/src/modules/adapters/impls/Threads.py`)를 템플릿 삼아 LinkedIn/X/YouTube/Medium `CapabilityAdapter` 추가  
- 각 어댑터는 `insights` 스키마(`apps/backend/src/modules/insights/schemas.py`)에 정의된 KPI 키를 그대로 방출해 멀티플랫폼 ROI 집계가 가능하도록 함  
- OAuth/계정 상태는 `PersonaAccountContext`의 검증 흐름(`useBffAccountsIsValid...`)을 재사용하여 새 플랫폼도 동일 UX 유지

### 📊 5) 가치 메트릭화
- `PlaybookList`/`PlaybookDetail` 응답(`apps/backend/src/orchestrator/flows/bff/bff_playbook.py`)에 `memory_reuse_count`, `ai_intervention_rate`, `saved_minutes` 등을 추가 계산해 반환  
- 계산식은 `PlaybookLog` + `Insights` 데이터를 사용: 재사용 이벤트 횟수, 자동화된 게시물 수, scheduler 소요 시간 절감을 지표로 삼음  
- 프런트에서는 Chat 상단 배지 혹은 Dashboard(Tab “Memory ROI”)로 노출하고, 타임라인 이벤트에도 동일 지표를 주입해 가치 체감을 반복
---

## 5. 비전: “기억하는 엔진”에서 “배우는 동료”로

| 단계 | Maestro 1.0 | Maestro 2.0 |
|:--|:--|:--|
| 정의 | 판단 복제 엔진 | 판단 체감 제품 |
| 중심 | 결정론적 DAG, Graph RAG | 온보딩, 루프 UX, Persona 감정화 |
| 사용자 | 엔지니어, 크리에이터 | 모든 지식노동자 |
| 역할 | “기억하는 시스템” | “함께 판단하는 동료” |

---

> **결론**  
> Maestro는 “자동화”를 넘어서 “판단을 복제하는 엔진”으로 진화했다.  
> 이제 남은 과제는, 그 판단이 **느껴지고, 쓰이고, 사랑받는 경험**을 만드는 것이다.

> **— Maestro의 다음 단계는, 인간이 아닌 ‘기억’을 제품화하는 일이다.**

---

## 6. 즉시 실행 체크리스트 (주간 단위)

1. **온보딩 Quickstart**: `initialTools`에 Quickstart 추가 → `FLOWS`에 `bff.onboarding.quickstart` 등록 → 데모 persona seed 데이터 배포  
2. **Reapply Memory CTA**: `PersonaAccountContext`에 버튼 추가, `playbook.memory_reapplied` 이벤트 정의, Chat 카드/타임라인에 요약 노출  
3. **Next Action Proposal**: CoWorker 출력 스키마 확장 → Playbook 로그 이벤트 변환 → Chat CTA로 연결  
4. **플랫폼 어댑터 스프린트**: Threads 템플릿으로 LinkedIn/X 작성, KPI 매핑을 `insights`에 추가  
5. **Memory ROI 지표**: `bff_playbook` 응답 필드와 Dashboard 컴포넌트 추가, KPI 계산 배치/쿼리 정의  

위 5가지를 순차적으로 닫으면 “판단 복제”가 실제 사용자 여정에서 느껴지는 Maestro 2.0의 핵심 루프가 완성된다.
