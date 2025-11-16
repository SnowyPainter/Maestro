# Graph RAG Copilot

## 현재 동작 개요
- **엔드포인트**: `/graph-rag/suggest`(기본) 및 quickstart/memory/next-action 전용 엔드포인트가 모두 `graph_rag.py`에서 동일한 플로우 빌더를 공유하며, `GraphRagSuggestPayload` 기반으로 카드 리스트(`GraphRagSuggestionResponse`)를 반환한다.
- **컨텍스트 수집**: `op_graph_rag_collect_context`가 페르소나/캠페인 컨텍스트를 해석하고, 비어 있는 쿼리일 때 모드별 fallback 쿼리를 주입한다. 이후 `search_rag`로 그래프+벡터 검색을 실행하고, 섹션 플래그에 따라 Quickstart 템플릿, Memory highlight, Next Action, ROI를 계산한다. 이미 완료된 노드/플레이북/액션 서명은 `load_completed_graph_actions`로 필터링하여 카드 생성에 반영된다.
- **카드 생성**: 네 개의 오퍼레이터가 컨텍스트를 받아 카드화한다.
  - Trend 카드: Quickstart 템플릿 또는 트렌드 노드를 Trend→Draft CTA로 노출.
  - Draft 카드: Next Action 제안이나 Draft 노드를 "Run next action" 또는 "Open draft" CTA로 노출하며 완료된 액션 서명은 스킵.
  - Playbook 카드: Memory highlight를 재사용 CTA로 노출하며 재사용 횟수/최근 사용 시점 기반 confidence를 부여.
  - Persona 카드: (제거됨) 컨텍스트 고정이 기본이므로 별도 포커스 CTA 없음.
- **집계/정렬**: `op_graph_rag_aggregate_cards`가 카드 ID로 dedupe 후 priority→title→ID 순으로 정렬하여 limit까지 반환한다.
- **액션 실행** (`actions.py`):
  - `trend_to_draft`: 트렌드 설명과 쿼리로 IR을 구성해 Draft를 생성하고, playbook 이벤트를 기록 후 `graph_rag_refresh` 이벤트 발행.
  - `next_action`: Next Action 실행을 이벤트로 기록하고 refresh 발행.
  - `playbook_reapply`: 필요한 경우 플레이북/캠페인/페르소나를 역으로 채워 넣어 재사용 이벤트 기록 후 refresh.
- **프런트엔드**: `ChatContextPanel`에서 `/api/sse/graph-rag/suggestions/stream` SSE로 수신한 ROI/Trend/Draft/Playbook/Persona 카드를 `flow_path`에 맞춰 즉시 실행하거나 이전/다음 탐색 UI로 노출한다.

## 상품화 업그레이드 제안
1) **추천 품질/랭킹 강화**
- `graph_rag.py` 카드 생성 시 검색 스코어, 관련 엣지 강도, 최근성 등을 priority 산정에 반영하고, 동일 source_node/업데이트 시점 기준으로 하중치 있는 dedupe/채점 함수를 추가.
- `GraphRagActionContext`에 사용자 피드백(건너뛰기/싫어요 등) 히스토리를 받아 재노출 억제 필터를 적용.

2) **모드별 경험 최적화**
- `rag_mode_config`로 설정되는 fallback 쿼리/limit를 UI 모드와 동기화하고, quickstart 모드에서 trend-only, memory 모드에서 playbook-only처럼 카드 유형별 필터를 명시적으로 적용.
- ROI 포함 여부(`include_roi`)를 사용자 세션 옵션으로 노출해 계산 비용 절감 경로 제공.

3) **액션 안전성 및 감사 가능성**
- `op_graph_rag_next_action`와 같이 DB 커밋 경계를 암묵적으로 두는 함수에 대해 트랜잭션/에러 처리/로깅을 통일해 일관된 성공 기준을 확보하고, 실행 결과 메타(`action_signature`, `confidence`)를 액션 로그에 저장해 재추천 방지 정확도를 높인다.
- CTA 실행 전 개인화 맥락이 비어 있을 때 `_resolve_persona_context`의 추론 결과를 카드 메타에 명시적으로 표기해 프런트엔드에서 확인/변경할 수 있게 한다.

4) **신선도 및 폴백 전략**
- `publish_graph_rag_refresh` 트리거 외에 캐시 만료/주기적 새로고침을 추가하고, SSE 타임아웃 시 `fallback_query_for_mode`를 활용한 기본 카드 세트를 즉시 공급하는 폴백을 제공.
- 그래프 검색 실패 시 최근 성공한 카드 세트를 리플레이하거나 Draft/Playbook 최근 활동 로그를 기반으로 최소 설정 카드 묶음을 구성.

5) **관측성/실험 토대**
- 각 오퍼레이터에 구조화 로깅(추천 개수, 필터로 제외된 카드 수, dedupe 비율, 평균 priority)을 추가하고, SSE 구독/CTA 실행까지의 end-to-end 지표(전환율, ROI 클릭률)를 계측.
- 추천 알고리즘/priority 함수를 토글할 수 있는 플래그를 도입해 A/B 테스트를 빠르게 돌릴 수 있게 만든다.

6) **프런트엔드 UX 정교화**
- 카드마다 로딩/실패/성공 상태를 `ActionAck`로 확장해 “실행 중 → 완료 → 후속 제안” 흐름을 명시하고, CTA 연속 실행 시 비동기 중복 실행을 막는 optimistic UI를 적용.
- 카드 묶음을 Persona/Campaign 컨텍스트와 연동해 세션 간 동일 맥락 재진입 시 이전 추천을 복원하고, 컨텍스트 변경 시 강제 새로고침하도록 큐를 분리.

7) **개발 편의/안전 가드** (단기)
- Graph RAG 추천/액션 플로우를 `__all__`에 명시한 키 기반으로 자동 테스트하는 smoke 테스트를 추가하고, 스키마 변경 시 플로우 빌더가 깨지지 않도록 pydantic 모델 필수 필드 스냅샷을 유지.
- 카드 수(`limit`)와 섹션 토글을 관리하는 프런트 설정값을 `.env`나 런타임 구성으로 노출해 운영 중 핫픽스 가능성을 높인다.
