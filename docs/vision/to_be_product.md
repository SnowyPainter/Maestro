# 🧩 Maestro, Copilot 시대의 제품화 메모
> 판단을 복제하던 엔진에서, 판단이 체감되는 도구로

---

## 1. 현재 상태

1. **완성된 기술 스택**  
   FastAPI + React + Graph RAG + Celery + pgvector로 구성된 오케스트레이션 엔진이 안정적으로 동작한다. 모든 DSL 실행은 Playbook 로그로 남고, Graph RAG는 이를 기억으로 전환한다.
2. **Copilot 중심 UX**  
   `apps/backend/src/orchestrator/flows/graph_rag/graph_rag.py`와 `actions.py`가 Copilot 흐름을 담당하며, ChatPage에는 Quickstart 카드가 자동 노출된다. Copilot이 `trend → draft → schedule`을 한 번에 실행해 온보딩이 이미 닫혔다.
3. **기억과 ROI 노출**  
   “Reapply Memory” CTA, Timeline 로그, Dashboard(Tab “Memory ROI”) 배지가 동일한 데이터를 공유한다. 사용자는 어떤 판단이 재사용됐고 얼마나 시간을 절약했는지 확인할 수 있다.
4. **남은 공백**  
   Copilot이 실행한 작업은 Playbook 로그 기반으로 필터링되어 중복 추천이 차단되지만, persona별 개인화 루프와 CoWorker → Copilot → 사용자 승인의 자동화는 여전히 개선 여지가 있다.

---

## 2. UX 개선 과제

### 2.1 Copilot 실행 · 기록 루프
- Graph RAG 추천이 노출되면 `CopilotTask` 스키마로 일관되게 표현한다.
- 사용자가 카드를 수락하거나 직접 완료하면 `PlaybookLog`에 `copilot.task_completed` 이벤트로 남기고, Graph RAG 검색 시 동일 노드를 제외한다.
- Quickstart도 로컬 스토리지가 아닌 Playbook 로그를 근거로 “이미 실행된 카드”와 “다음에 실행해야 할 카드”를 분리한다.

### 2.2 개인화된 온보딩 흐름
- `SelectPersonaAccount` 컨텍스트를 기반으로 Copilot이 persona/campaign 맞춤 Quickstart를 제안하도록 만든다.
- 페르소나마다 필요한 카드 묶음(예: awareness / conversion)을 정의하고, Copilot이 Graph RAG 노드 히스토리를 참고해 새로운 행동만 노출한다.

### 2.3 기억 재활용 UX
- Reapply Memory 버튼이 선택한 playbook ID를 `usePersonaContextStore`에 저장하고, 이후 Graph RAG 액션 호출 시 DSL 파라미터에 자동 주입되도록 정비한다.
- Copilot 카드가 기존 초안을 기반으로 생성될 때는 `playbook.memory_reapplied` 이벤트와 연결해 “어떤 판단을 복제했는지”를 카드/타임라인에서 바로 보여준다.

### 2.4 Next Action & 학습 루프
- CoWorker(`apps/backend/src/workers/CoWorker/generate_texts.py`)가 KPI/콘텐츠 반응을 요약해 “Next Action Proposal” 이벤트를 만든다.
- `bff_timeline` 플로우가 해당 이벤트를 CTA로 변환하고, 사용자가 클릭하면 동일 DSL이 재실행되어 “반응 → 제안 → 승인” 루프가 닫힌다.

### 2.5 플랫폼 확장 & ROI 일관성
- Threads 어댑터 템플릿을 활용해 LinkedIn/X/YouTube/Medium용 `CapabilityAdapter`를 추가하고, `insights` 스키마의 KPI 키를 재사용한다.
- Copilot 카드에도 Dashboard와 동일한 ROI 배지를 부착해 “왜 이 제안이 가치 있는지”를 설명한다.

---

## 3. 진행 상황

| 항목 | 상태 | 메모 |
|:--|:--|:--|
| Copilot Quickstart 온보딩 | ✅ 완료 | ChatPage 카드 노출, `initialTools` 의존성 제거 |
| Reapply Memory CTA/로그 | ✅ 완료 | Persona 컨텍스트 + Timeline 하이라이트 제공 |
| Memory ROI 배지 | ✅ 완료 | Dashboard + Copilot 카드 연동 (프런트 메트릭 반영 중) |
| Copilot Action Logging | 🔄 진행중 | `copilot.task_completed` 이벤트 정의 및 PlaybookLog 저장 |
| Graph RAG 중복 추천 차단 | ✅ 완료 | PlaybookLog 기반으로 추천 카드 생성 시 완료된 노드/플레이북 자동 제외 |
| Next Action Proposal 루프 | 🔄 진행중 | CoWorker 출력 스키마 확장, CTA 연결 작업 중 |
| 플랫폼 어댑터 확장 | 🔄 진행중 | LinkedIn/X 우선, KPI 매핑 `insights`에 추가 예정 |

> **포인트**  
> 이미 구현된 온보딩/기억/ROI 경험을 Copilot 루프에 완전히 결합하고, 로그 기반 개인화와 추천 필터링만 닫으면 “판단이 체감되는 제품”이 된다.  
> 사용자에게는 “왜 지금 이 제안을 따라야 하는지”가 ROI와 함께 설명되고, Copilot은 중복 없이 다음 행동을 제시하는 진짜 동료가 된다.
