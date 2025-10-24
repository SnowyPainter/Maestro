# Reactive Frontend 통합 가이드 (ChatStream 중심)

## 1. 목표와 원칙
- 모든 댓글 자동화(Reactive Flow) UX를 **ChatStream** 안에서 카드 기반으로 노출하고 조작한다.
- 기존 프론트엔드 계층(entities / features / widgets.ChatStream)을 그대로 활용해 재사용성을 확보한다.
- 운영자가 룰을 만들고, 게시물과 연결하고, 실행 로그를 확인하는 흐름이 하나의 대화 스트림 안에서 이어지도록 설계한다.

## 2. 핵심 사용자 여정 (ChatStream 기준)
1. **Rule Overview 카드**  
   - ChatStream에 `reactive.rule.overview` 카드가 도착 → 현재 룰 목록 요약, “새 룰 만들기” / “랙티브 활동 보기” 버튼 포함.  
   - 메시지 버튼 클릭 시 대응 인터랙션(폼 Drawer, Activity 카드) 노출.
2. **Rule Compose 카드**  
   - “새 룰 만들기” 선택 → `reactive.rule.compose` 카드 렌더 → Drawer로 키워드/액션 입력 폼 제공.  
   - 저장 시 orchestrator `POST /reactive/rules` 호출 → 성공하면 ChatStream에 성공 SystemMessage + 최신 Overview 카드 재요청.
3. **Publication Linker 카드**  
   - 특정 룰 행의 “게시물 연결” 액션 → `reactive.rule.linker` 카드 (모달형)→ Post Publication 리스트(필터) + 우선순위/기간 지정.  
   - 저장 후 카드 닫고 Overview/Detail 카드 갱신.
4. **Activity Log 카드**  
   - `reactive.activity.log` 카드에 최근 `reaction_action_logs` + 상태 필터/검색.  
   - 로그 행 클릭 → 팝오버로 DM/Reply 본문 또는 Alert 메타 확인.
5. **Context Panel 연동 (선택)**  
   - ChatStream 메시지 포커스 시 우측 `ChatContextPanel`에 선택 룰/게시물 상세를 띄워 Desk-top 관리에 도움.

## 3. 카드 타입 정의 및 컴포넌트 배치
| Card Type | 컴포넌트 경로 | 기능 |
|-----------|----------------|------|
| `reactive.rule.overview` | `src/entities/reactive/components/RuleOverviewCard.tsx` | 룰 리스트, CTA, 최근 실행 지표 |
| `reactive.rule.detail` | `src/entities/reactive/components/RuleDetailCard.tsx` | 선택 룰의 키워드/액션/연결 게시물 뷰 |
| `reactive.rule.compose` | `src/features/reactive-rule/components/RuleComposeDrawer.tsx` | 생성/수정 폼 (React Hook Form + Zod) |
| `reactive.rule.linker` | `src/features/reactive-rule/components/RulePublicationModal.tsx` | 게시물 연결 폼 + 검색 |
| `reactive.activity.log` | `src/entities/reactive/components/ActionLogCard.tsx` | 로그 테이블, 필터, 상세 확인 |

> 카드 추가 시 `apps/backend/src/orchestrator/cards.py`에 해당 `card_type` 등록 + `ChatCard` 스키마 확장 → 프론트 `cardRouter`에 위 컴포넌트를 매핑.

## 4. 프론트엔드 계층별 구현 계획

### 4.1 Entities (`src/entities/reactive`)
- `model/queries.ts`:  
  - `useReactiveRules()` → `GET /bff/reactive/rules`  
  - `useReactiveRule(ruleId)` → `GET /bff/reactive/rules/{id}`  
  - `useReactiveRuleLinks(ruleId)` → `GET /bff/reactive/rules/{id}/publications`  
  - `useReactiveActionLogs(params)` (추가 API 준비 시)
- `components/RuleOverviewCard.tsx`:  
  - Query 훅으로 룰 로드 → 테이블/카드뷰 + CTA.  
  - 카드 액션은 props 콜백(`onCreateRule`, `onViewActivity`, `onSelectRule`)으로 위임.
- `components/RuleDetailCard.tsx`:  
  - 룰 상세 & 연결 게시물 표시.  
  - 게시물 Chip 클릭 시 `onRequestLinker(ruleId)` 호출하여 Linker 카드/모달 열기.
- `components/ActionLogCard.tsx`:  
  - 로그 리스트 + 상태 필터.  
  - 행 클릭 시 Alert/DM/Reply 내용 popover.

### 4.2 Features (`src/features/reactive-rule`)
- `model/mutations.ts`:  
  - `useCreateRule()`, `useUpdateRule()`, `useDeleteRule()` → orchestrator `/reactive/*` API.  
  - `useCreateRuleLink()`, `useDeleteRuleLink()`.
  - 공통 onSuccess에서 ChatStream 컨텍스트에 `refresh` 이벤트 publish (e.g. invalidate Query + `ChatStreamSyncContext` 이용).
- `components/RuleComposeDrawer.tsx`:  
  - Form schema → `ruleSchema` (Zod).  
  - 키워드/액션 필드 반복 components (componentized).  
  - 저장 후 Drawer 닫고 성공 토스트.
- `components/RulePublicationModal.tsx`:  
  - Post Publication 검색 컴포넌트 재사용 (`entities/post-publications`).  
  - 선택 → priority/기간 입력 → mutate → invalidate.

### 4.3 Widgets / 메시지 플로우
- `src/entities/messages/cardRouter.tsx`  
  - `case 'reactive.rule.overview' => <RuleOverviewCard ...>`  
  - `case 'reactive.rule.detail' => <RuleDetailCard ...>`  
  - `case 'reactive.activity.log' => <ActionLogCard ...>`  
  - compose/linker 카드는 보통 카드 내부에서 Dialog/Different component trigger. 필요 시 카드 자체를 `DialogCard`로 렌더.
- `src/widgets/ChatStream.tsx`  
  - 카드 콜백 구현:  
    - `onCreateRule` → `pushSystemMessage({ card_type: 'reactive.rule.compose', ... })`  
    - `onViewActivity` → `pushSystemMessage({ card_type: 'reactive.activity.log', ... })`  
    - `onSelectRule(ruleId)` → 해당 룰 detail 카드 요청 API 호출 or orchestrator intent.  
  - 메시지 큐는 기존 `ChatMessagesContext` 재사용.
- `ChatContextPanel.tsx`  
  - 선택된 메시지가 reactive rule이면 우측 패널에 상세/최근 로그 요약 제공 (옵션).

## 5. 데이터 흐름 & API 매핑
- **읽기 (BFF)**  
  - `GET /bff/reactive/rules` → Overview/Detail 카드.  
  - `GET /bff/reactive/rules/{id}/publications` → Detail + Linker 초기값.  
  - (추가 예정) `GET /bff/reactive/action-logs` → Activity 카드.
- **쓰기 (Orchestrator)**  
  - `POST /reactive/rules` / `PATCH /reactive/rules/{id}` / `DELETE /reactive/rules/{id}`  
  - `POST /reactive/rules/{id}/publications` / `DELETE /reactive/publications/{link_id}`  
  - 결과는 ChatStream에 SystemMessage 또는 신규 카드로 피드백.
- **실시간 갱신**  
  - SSE 토픽 `reactive.action_log` (추가 예정) 구독 → 작업 성공/실패 시 Activity 카드 갱신 메시지 자동 주입.  
  - `ChatStream`의 동일 채널을 사용하므로 타 기능과 동일한 SSE 구독 로직 사용.

## 6. components & UX 세부 고려
- **모듈형 카드**: 각 카드에 `CardActionBar` 붙여 편집/삭제/활동 보기 버튼 노출.  
- **문맥 유지**: 룰 생성/연결 완료 후 자동으로 Overview/Detail 카드 최신 데이터 재호출.  
- **템플릿 안내**: 액션 행에 DM/Reply 템플릿 미지정 시 “템플릿 없으면 실행 안 함” 토스트/tooltip 명확 표시.  
- **정규식 검증**: 프론트에서 즉시 검증 + 실패 시 입력란 빨간색, helper text.  
- **반응 로그**: `SKIPPED` 상태(이미 답변 등)를 회색 배지로 처리, tooltip에 스킵 사유 표시.

## 7. 개발 순서 (ChatStream 중심)
1. **Entities scaffold**: `src/entities/reactive` 생성, Query 훅/타입 정의.  
2. **Overview 카드**부터 구현 → ChatStream cardRouter 연결 → 임시 Mock 데이터로 렌더 확인.  
3. **Mutations & Forms**: Compose Drawer, Linker Modal → orchestrator API 연동.  
4. **Detail/Activity 카드** 추가 → 메시지 콜백으로 상호작용 완성.  
6. **QA**: Storybook 카드 스토리, React Testing Library로 폼 유효성/상호작용 테스트, Cypress 시나리오(룰 생성→게시물 연결→로그 확인).

## 8. 파일 구조 예시
```
src/
 ├─ entities/
 │   └─ reactive/
 │       └─ components/
 │           ├─ RuleOverviewCard.tsx
 │           ├─ RuleDetailCard.tsx
 │           └─ ActionLogCard.tsx
 ├─ features/
 │   └─ reactive-rule/
 │       └─ components/
 │           ├─ RuleComposeDrawer.tsx
 │           └─ RulePublicationModal.tsx
 ├─ entities/messages/
 │   └─ cardRouter.tsx          // reactive.* 카드 매핑 추가
 └─ widgets/
     └─ ChatStream.tsx          // 카드 액션 콜백/메시지 push 로직 확장
```

## 9. 테스트 전략
- **Unit**: Zod schema, keyword/action 필드 컴포넌트.  
- **Component**: 카드 렌더러 + 폼 submit → react-query mutation mock.  
- **Integration (E2E)**: ChatStream 대화 시나리오 (룰 생성→게시물 연결→로그 검토).  
- **Visual Regression**: Storybook for Rule cards (light/dark, 다양한 상태).  
- **SSE 시뮬레이션**: 테스트에서 `EventSource` mock → Activity 카드 자동 갱신 확인.

---

이 가이드를 따라 구현하면 Reactive Flow가 기존 ChatStream 카드 시스템에 자연스럽게 녹아들며, 다른 엔티티/피처와 동일한 개발 패턴을 유지할 수 있다. 필요 시 추가 카드 타입이나 Context Panel 확장을 통해 운영자가 한 화면에서 댓글 자동화를 제어하도록 돕는다.
