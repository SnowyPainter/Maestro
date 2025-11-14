# How to Improve Graph RAG system with UX

## 이제 RAG는 “채팅 결과 뿌리는 피처”가 아니라 상시 작동하는 보조 브레인이 되어야 함 Copilot

### 현재 구조는
사용자가 메시지를 치면, Graph RAG 검색 → 카드로 출력, UX는 “검색 결과를 보여주는 RAG”로 제한됨
이걸 완전히 바꿔야 한다.

### RAG는 채팅보다 먼저 움직여야 한다.

1. 사용자가 채팅을 치기 전에도
2. 사용자가 어떤 페이지에 있어도
3. 사용자가 최근 한 행동을 기반으로

자동으로:
1. Quick Start 카드
2. Next Action 카드
3. Memory Highlights 카드
4. ROI 카드

이걸 “항상 우측 패널에” 띄워야 한다.

즉, RAG는 **검색 기능이 아니라 ‘행동 예측 엔진’**이 된다.

## 검색 결과를 반드시 액션 카드로 변환해야 함

예를 들어 Trend 노드를 검색했다면:

❌ “Trend 노드: 2024 AI Tools Boom” (지금)

✅ “이 트렌드로 Draft 만들기”

✅ “과거에 이 트렌드로 만든 Draft 비교”

✅ “이 트렌드로 반응이 좋은 시간대 추천”

Draft 노드를 검색했다면:

❌ “Draft 노드: #14 - AI Productivity Hacks”

✅ “이 Draft 다시 쓰기”

✅ “이 Draft의 성과 기반 CTA 추천”

✅ “비슷한 Draft 3개 비교”

Publication 노드를 찾았다면:

❌ “PostPublication 노드: external_id 32123412”

✅ “비슷한 톤으로 후속 포스트 생성”

✅ “같은 시간대/톤으로 새로운 초안 생성”

## Implementation Plan (최종안)

1. **graph_rag 플로우 신설**  
   - `apps/backend/src/orchestrator/flows/graph_rag/` 에 `graph_rag.suggest` 같은 베이스 플로우를 만들고, 빠르게 호출할 수 있는 모드들(quickstart/memory/next_action/roi)을 여기에서 관리한다.  
   - 기존 `bff.rag.*`는 외부 API 엔드포인트로 유지하되, 내부 서비스/스케줄러/웹소켓이 재사용할 수 있도록 새 플로우는 오케스트레이터 내부에서 직접 호출 가능하게 설계한다.

2. **도메인별 오퍼레이터 추가**  
   - Draft, Trend, Playbook, Persona 등 각 엔티티에 대해 “실행 가능한” 액션 오퍼레이터(예: `draft.rewrite_from_trend`, `trend.compare_historic`, `playbook.apply_next_action`)를 모듈 근처에 둔다.  
   - 각 오퍼레이터는 공통 카드 스키마에서 reference 할 수 있도록 키/설명/추가 payload 규약을 가진다.

3. **카드 스키마 통일**  
   - Quick Start / Next Action / Memory / ROI 를 표현하는 공통 카드 모델을 정의하고, Graph RAG 플로우는 카드 목록만 반환한다.  
   - 카드에는 실행 가능한 operator key, 설명, 컨텍스트(meta) 가 포함되어 NextActions 패널/다른 UI가 그대로 사용한다.

4. **자동 트리거와 백그라운드 갱신**  
   - 주요 이벤트(새 Draft 저장, 캠페인 활성화, Persona 변경, Trend update 등)와 정기 스케줄러가 `graph_rag.suggest` 플로우를 호출해 우측 패널 데이터를 미리 생성/캐시한다.  
   - 이렇게 하면 “사용자가 검색하기 전에” 필요한 카드가 이미 준비되어 improve_ux.md 가 요구하는 상시 브레인 역할을 달성할 수 있다.

5. **프론트엔드 통합**  
   - `NextActions.tsx` 등 RAG 패널 컴포넌트는 새 카드 스키마를 렌더하고, 각 카드의 operator key 를 실행하는 버튼/CTA 를 제공한다.  
   - 동일 스키마를 다른 화면(드래프트 상세, 트렌드 뷰, 플레이북 뷰 등)에도 주입해 “어떤 페이지에서든” Graph RAG 제안이 노출되도록 확장한다.

6. **점진적 확장 전략**  
   - 1차로 기존 BFF 검색 결과를 새 카드 스키마로 변환해 parity 확보.  
   - 이후 트렌드→Draft, Draft→CTA, Publication→후속 Post 등 고우선 액션부터 추가 오퍼레이터/카드 로직을 넣고, Telemetry 로 각 카드 사용률을 관찰하며 우선순위를 조정한다.
