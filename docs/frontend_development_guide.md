# 오케 Frontend 화면 구성 & 기획 (Chat + Prebuilt Components)

> 목적: 백엔드 지침과 1:1로 맞물리는 **채팅형 UX**를 중심으로, 미리 정의된 **결정론적 액션 카드/뷰**를 재사용해 빠르게 운영 가능한 UI를 설계한다. 기술 스택은 React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query + Zod.

---

## 0. 핵심 UX 원리

* **Chat-first, Card-driven**: 사용자는 채팅을 통해 의도를 표현한다. 시스템은 해석 결과(행위/지침/조회)를 **카드 컴포넌트**로 시각화하고, 필요 시 버튼/폼으로 즉시 수행.
* **Deterministic Controls**: 플래닝·실행·검증은 카드 내 **명시적 컨트롤**(토글/버튼/폼)로만 실행. LLM은 "지침/콘텐츠 생성" 단계 카드에서만 호출.
* **Context Rails**: 우측 레일에 현재 세션의 \*\*컨텍스트(계정/플레이북/페르소나/스니퍼 신호)\*\*를 핀 고정하여 상태전파를 가시화.
* **Live Eventing**: 내부 이벤트(`/internal/events/*`)는 WebSocket/SSE로 수신, 타임라인/채팅 스트림에 **System Message**로 반영.

---

## 1. 정보 구조 (IA)

### 1.1 상단 레벨

* **/chat**: 채팅형 워크스페이스 (기본 랜딩)
* **/timeline**: 전체 타임라인(Brief/Draft/Schedule/Publish 이벤트)
* **/calendar**: 스케줄 캘린더 (예약/발행 상태 관제)
* **/monitoring**: 모니터링 대시보드 (메트릭/성능/비즈니스 KPI)
* **/trends**: 스니퍼 트렌드 피드 + 검색
* **/settings**: 워크스페이스/계정/플레이북/페르소나 설정

### 1.2 공통 레이아웃

* **Top Nav**: Workspace/Account 스위처, 전역 검색, 알림, 사용자 메뉴
* **Left Nav**: 주요 섹션(/chat, /timeline, /calendar, /monitoring, /trends)
* **Right Context Rail**: 현재 세션 컨텍스트(계정, 플레이북, 페르소나, 스니퍼 신호, 멱등키, 추적ID 등)

---

## 2. 핵심 플로우

### 2.1 채팅 → 의도판별 → 카드 렌더 → 액션 실행

1. 사용자가 입력: "내일 오후 3시에 제품 A 티저 예약해줘 #해시태그 추천"
2. **Intent Router**(프론트): 간단 키워드/칩(Quick Chip) 매핑 + 서버 판별 결과 병합
3. 서버 응답(정해진 스키마):

   * `action_intent: schedule.create`
   * `guideline_intent: brief.generate` (LLM 필요)
   * `query_intent: metrics.get` (선택)
4. UI는 **ActionCard.ScheduleCreate**, **GuidelineCard.BriefGenerate**, **MetricCard**를 스트림에 순서 반영
5. 사용자는 카드 내 Form을 확인/수정 후 **확정 버튼** 클릭 → Orchestrator API 호출 (멱등키 포함)
6. 워커 결과 이벤트(`/internal/events/*`)가 **SystemMessage**로 스트림 반영

### 2.2 이메일 회신 → 드래프트 생성 루프 (갱신)

> 원칙: 이메일 유입은 **내부적으로 드래프트 생성까지 처리**하고, 기본값은 **Chat 스트림 비노출**이다. 사용자가 명시적으로 연결할 때만 Chat에 합류시킨다.

**처리 흐름 (서버 내부)**

1. CoWorker가 이메일 수신 → `POST /internal/events/draft-from-email` (서버-서버 인증)
2. Orchestrator가 드래프트 영속화: `Draft(status="inbox", source="email", campaign_id?, account_id, message_ids, in_reply_to, references…)`
3. Pub/Sub 발행(`draft.created`) 및 BFF로 중계 준비

**클라이언트 노출 방식**

* 기본: **Inbox**(우측 레일 드로어 또는 `/inbox` 페이지)에만 노출, **뱃지/토스트**로 알림
* 선택: Inbox의 `Attach to Session`(또는 `Chat에 추가`) 클릭 시, 현재 채팅 세션에 **SystemMessage + DraftCard**를 삽입
* 자동 연결 허용 조건(옵션): 아래 휴리스틱을 모두 만족할 때만 자동 부착

  * 동일 `campaign_id` 혹은 최근 활성 세션의 `account_id` 일치
  * 이메일 스레드 헤더(`In-Reply-To`/`References`)에 세션 앵커/메시지 키가 매핑됨
  * 최근 N분 내 해당 세션에서 `generate-brief` 또는 `create-draft` 수행 이력

**이벤트 & API 매핑**

* BFF SSE/WS 이벤트:

  * `draft.created` (visibility=`inbox`) → Inbox 카운트 + 카드 추가
  * `draft.attached_to_session` → 해당 Chat 스트림에 SystemMessage/카드 삽입
* BFF Read API:

  * `GET /bff/inbox?cursor=…` (드래프트 Inbox 목록)
  * `PATCH /drafts/:id/attach` (세션에 부착) / `PATCH /drafts/:id/archive` / `PATCH /drafts/:id/publish`

**사용자 액션**

* Inbox에서: `검토`, `편집`, `발행`, `세션에 부착`, `보관`
* Chat로 부착된 경우: 기존 DraftCard 액션(편집/발행/삭제) 동일 적용

**이점**

* Chat 스트림 **저소음(Noise-free)** 유지
* 이메일 기원 작업은 **Inbox 우선**으로 분리하여 **권한·책임 경로** 명확화
* 필요 시에만 세션에 합류시켜 **문맥 밀도** 보존### 2.3 트렌드 신호 주입
* Trends 탭에서 선택한 키워드/뉴스를 **Context Rail에 Pin** → 이후 생성되는 Brief에 Injector가 참고하도록 표식 표시

---

## 3. 스크린 설계 (와이어프레임 서술)

### 3.1 /chat (Workspace)

* **Header**: 세션 타이틀(수정 가능), 계정/플레이북/페르소나 선택 드롭다운, 멱등키 표시(아이콘+툴팁), TraceID 복사
* **Stream**:

  * `MessageBubble.User`, `MessageBubble.Assistant`, `MessageBubble.System`
  * `ActionCard.*`, `GuidelineCard.*`, `DraftCard`, `ScheduleCard`, `PostPreviewCard`, `MetricCard`, `TrendCard`
* **Composer (하단)**:

  * 입력창 + **Quick Chips**: `발행`, `예약`, `삭제`, `수정`, `지침생성`, `조회`
  * **날짜/시간 파서 UI**(natural language helper): 칩 선택 시 in-place 파서 팝오버
  * 첨부(이미지/템플릿), 계정 멀티선택, 해시태그 추천 토글
  * 전송 버튼(↵) + 고급 옵션(⋯)
* **Right Context Rail**:

  * **PersonaCard / PlaybookCard / AccountCard** (선택/편집)
  * **Sniffer Signals** (선택한 트렌드 태그, Google/Naver 지수 미니차트)
  * **Session Context** (X-Request-ID, X-Idempotency-Key, X-Trace-Parent 시각화)

### 3.2 /timeline

* **필터바**: 엔티티 타입(Brief/Draft/Schedule/Publish), 상태, 계정, 기간
* **이벤트 리스트**: 시간순 카드(클릭 시 /chat 해당 메세지 앵커로 이동)

### 3.3 /calendar

* **월/주/일 뷰** 전환, 계정별 색상, 상태 배지(예약/발행/실패/취소)
* 카드 클릭 → 상세 사이드패널(게시물 미리보기, 로그, 재시도/취소)

### 3.4 /monitoring

* **API/LLM/비즈니스 메트릭 카드**(Recharts): 요청 수, 응답시간, 에러율, 토큰/비용, 캠페인 성과
* **경보 규칙** 리스트 + 상태 토글

### 3.5 /trends

* **검색/필터**: 키워드, 소스(Google/Naver 등), 기간
* **트렌드 카드**: 미니차트, 관련 해시태그 제안, **Pin to Context** 버튼

### 3.6 /settings

* 워크스페이스/계정 연결, 플레이북/페르소나 관리(버전), 알림, 접근권한

---

## 4. 컴포넌트 인벤토리 (shadcn/ui 기반)

### 4.1 메시지/시스템

* `MessageBubble.User | Assistant | System`
* `SystemToast`(성공/실패/경고)

### 4.2 액션 카드 (Deterministic)

* `ActionCard.Publish`
* `ActionCard.ScheduleCreate`
* `ActionCard.ScheduleUpdate`
* `ActionCard.Delete`
* `ActionCard.Edit`

### 4.3 LLM/지침 카드 (Generator)

* `GuidelineCard.BriefGenerate` (프롬프트 미리보기, 토큰/비용 정보, 실행 버튼)
* `GuidelineCard.HashtagSuggest`
* `GuidelineCard.ToneStyleRefine`

### 4.4 콘텐츠/미리보기

* `DraftCard`
* `PostPreviewCard` (Threads/Instagram 스타일 프리뷰)
* `MediaAttachmentGrid`

### 4.5 조회/메트릭

* `MetricCard` (조회/리포트, Recharts)
* `TrendCard` (스니퍼 신호, Pin/Unpin)

### 4.6 컨텍스트/폼

* `PersonaSelector`, `PlaybookSelector`, `AccountMultiSelector`
* `NaturalDateTimeInput` (자연어 → 구조화된 시간, dateparser 결과 반영)
* `IdempotencyBadge`, `TraceBadge`

### 4.7 캘린더/타임라인

* `ScheduleCalendar` (월/주/일 + 드래그앤드롭)
* `EventTimeline` (필터/검색 포함)

### 4.8 공통

* `EmptyState`, `ErrorBoundary`, `LoadingSkeleton`

---

## 5. 상태관리 & 데이터 패턴

* **TanStack Query**: 서버상태 캐시, 옵티미스틱 업데이트는 *읽기탭*에서만 신중하게 사용
* **Zod 스키마**: API 응답/요청 검증, unsafeParse → UI 경고
* **WebSocket/SSE**: `/internal/events/*` 구독 → 스트림/캘린더/타임라인 동기화
* **URL State**: 필터/정렬/탭 상태를 쿼리스트링으로 동기화

---

## 6. API 매핑 (BFF + Orchestrator)

### 6.1 Chat 스트림

* `POST /orchestrate` → Intent 결과(행위/지침/조회)
* `POST /actions/generate-brief` → LLM 지침 생성 트리거
* `POST /actions/create-draft` | `POST /actions/create-schedule` | `PATCH /actions/update-schedule`
* `WS/SSE /internal/events/*` 수신 → SystemMessage 렌더

### 6.2 Read 전용 (BFF)

* `GET /bff/timeline` | `GET /bff/calendar` | `GET /bff/monitoring` | `GET /bff/trends`

### 6.3 보안/컨텍스트 전파

* 모든 요청 헤더: `X-Request-ID`, `X-Trace-Parent`, `X-Idempotency-Key`, `X-User-ID`, `X-Account-ID`

---

## 7. 타입/스키마 (요약)

```ts
// 공통
type ID = string;

export interface RequestContext {
  requestId: string;
  traceParent?: string;
  userId: string;
  accountId?: string;
  endpoint: string;
  action?: string;
  llmTokensUsed?: number;
  llmCost?: number;
}

export type IntentType = 'action' | 'guideline' | 'query';
export type ActionKind = 'publish' | 'schedule.create' | 'schedule.update' | 'delete' | 'edit';

export interface OrchestrateResponse {
  intents: Array<{
    type: IntentType;
    actionKind?: ActionKind;
    payload: unknown; // zod로 세부 스키마
  }>;
  context: RequestContext;
}
```

> 실제 구현시 Zod로 각 카드별 `payload` 스키마를 엄격히 분리 (예: `ScheduleCreatePayload`, `BriefGeneratePayload`).

---

## 8. 인터랙션 디테일

* **Quick Chips**: 클릭 시 템플릿 인젝션(예: `예약` → 날짜 파서 활성화)
* **NaturalDateTimeInput**: "내일 오후 3시" 입력 시 즉시 구조화값 미리보기(툴팁) + 수동 DatePicker 동기화
* **Retry/Compensation**: 실패 카드에서 재시도/롤백 버튼 고정
* **Copyable Trace/Idempotency**: 헤더/레일에서 1클릭 복사

---

## 9. 접근성/국제화

* 키보드 네비게이션(Chip/카드 포커스), 스크린리더용 aria-label
* 다국어 i18n 준비(en 기본, ko, cn 추가)

---

## 10. 스타일 가이드 (Tailwind + shadcn/ui)

* **톤**: 미니멀, 카드 그림자 약함, radius-2xl, 간격 여유(p-4 이상)
* **레이아웃**: Grid 기반(좌: Nav, 중: Stream, 우: Context Rail)
* **상태 배지**: 예약/발행/실패/취소 색상 일관성

---

### 부록 A. 컴포넌트 파일 구조

```
.
├─ .env                           # VITE_API_BASE, OPENAPI_URL, SSE_URL 등
├─ .env.local
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ postcss.config.js
└─ src/
   ├─ app/
   │  ├─ index.tsx               # 앱 엔트리: Router/Providers 묶음
   │  ├─ router.tsx              # 라우팅(/, /monitoring, /settings, 404)
   │  └─ providers/
   │     ├─ query.tsx            # QueryClientProvider, 쿼리 옵션
   │     ├─ theme.tsx            # shadcn ThemeProvider
   │     └─ toaster.tsx          # 알림 Toaster
   │
   ├─ pages/
   │  ├─ ChatPage/               # 올인원: 채팅 + 타임라인 + 접이식 캘린더 + Inbox 드로어
   │  │  ├─ ChatPage.tsx
   │  │  ├─ InboxDrawer.tsx      # 이메일/자동 생성 인박스(Attach to Session 버튼)
   │  │  ├─ QuickChips.tsx       # 발행/예약/지침/조회 칩
   │  │  ├─ IntentRenderer.tsx   # intent → UI 카드 팩토리(중앙 스트림에 렌더)
   │  │  └─ index.ts
   │  ├─ MonitoringPage/
   │  │  └─ MonitoringPage.tsx   # API/LLM/KPI 차트, 경보 토글
   │  ├─ SettingsPage/
   │  │  ├─ WorkspaceSettings.tsx
   │  │  ├─ AccountBindings.tsx  # Threads/Instagram 연동
   │  │  ├─ PersonaPlaybook.tsx  # 페르소나/플레이북 버저닝
   │  │  └─ index.ts
   │  └─ NotFound.tsx
   │
   ├─ widgets/                   # 페이지에 배치되는 대형 조립물
   │  ├─ ChatStream/
   │  │  ├─ ChatStream.tsx       # 메시지/카드 스트림(가상 스크롤 옵션)
   │  │  ├─ Composer.tsx         # 입력창(해시태그 추천 토글, Ctrl/Cmd+Enter)
   │  │  └─ SystemMessage.tsx
   │  ├─ Timelines/
   │  │  ├─ TrendTimeline.tsx    # 스니퍼/트렌드 타임라인
   │  │  └─ PostTimeline.tsx     # 게시/스케줄/이벤트 타임라인
   │  └─ Calendar/
   │     └─ CollapsibleCalendar.tsx
   │
   ├─ features/                  # “행동” 단위(뮤테이션/폼/유즈케이스) — 트리거 다양성 커버
   │  ├─ orchestrate/
   │  │  ├─ model/mutateOrchestrate.ts  # POST /orchestrate
   │  │  └─ ui/IntentResultCard.tsx
   │  ├─ draft-create/           # “초안 작성” 공통 액션 (채팅/플러스/자동 모두 이 경로)
   │  │  ├─ model/mutateCreateDraft.ts  # POST /actions/create-draft
   │  │  └─ ui/CreateDraftButton.tsx    # + 아이콘 등 수동 생성 버튼(템플릿 선택)
   │  ├─ draft-edit/
   │  │  ├─ model/mutateUpdateDraft.ts
   │  │  └─ ui/EditDraftButton.tsx
   │  ├─ draft-attach/
   │  │  ├─ model/attachDraft.ts        # PATCH /drafts/:id/attach
   │  │  └─ ui/AttachButton.tsx
   │  ├─ schedule-create/
   │  │  ├─ model/mutateSchedule.ts
   │  │  └─ ui/ScheduleCreateForm.tsx
   │  └─ publish/
   │     ├─ model/mutatePublish.ts
   │     └─ ui/PublishButton.tsx
   │
   ├─ entities/                  # “무엇” — 도메인 엔티티의 카드/타입/쿼리/스키마
   │  ├─ draft/
   │  │  ├─ ui/DraftComposerCard.tsx     # 공통 래퍼(액션바: 복사/저장/취소)
   │  │  ├─ ui/DraftPreviewCard.tsx      # 저장 후 미리보기/잠금 뷰
   │  │  ├─ ui/GuidelinePanel.tsx        # 톤/스타일/해시태그/Do&Don’t
   │  │  ├─ ui/platforms/                # 플랫폼별 에디터 슬롯 (동일 인터페이스)
   │  │  │  ├─ ThreadsEditor.tsx
   │  │  │  ├─ InstagramEditor.tsx
   │  │  │  └─ CommonConstraints.tsx     # 2200자 제한, 줄바꿈 규칙 등
   │  │  ├─ model/types.ts               # 프론트 전용 보조 타입(필요시)
   │  │  ├─ model/schema.ts              # 보조 Zod(서버 비종속 확장/템플릿 필드)
   │  │  └─ model/queries.ts             # useInboxDrafts 등 Read 훅
   │  ├─ brief/
   │  │  ├─ ui/BriefCard.tsx
   │  │  └─ model/queries.ts
   │  ├─ schedule/
   │  │  ├─ ui/ScheduleCard.tsx
   │  │  └─ model/queries.ts
   │  └─ trend/
   │     ├─ ui/TrendCard.tsx
   │     └─ model/queries.ts
   │
   ├─ components/                # 순수 UI(원자/분자) — 비즈니스 로직 없음
   │  ├─ chat/MessageBubble.tsx
   │  ├─ cards/ActionCard/
   │  │  ├─ Publish.tsx
   │  │  ├─ ScheduleCreate.tsx
   │  │  ├─ ScheduleUpdate.tsx
   │  │  ├─ Delete.tsx
   │  │  └─ Edit.tsx
   │  └─ common/
   │     ├─ IdempotencyBadge.tsx
   │     ├─ TraceBadge.tsx
   │     ├─ LoadingSkeleton.tsx
   │     ├─ EmptyState.tsx
   │     ├─ ErrorBoundary.tsx
   │     └─ ConfirmDialog.tsx
   │
   ├─ lib/                       # 인프라(자동 생성물 포함). “한 번 만들어두면 계속 씀”
   │  ├─ api/
   │  │  ├─ client.ts            # fetcher, baseURL, JWT, 멱등키/trace 헤더 주입
   │  │  ├─ interceptors.ts      # 공통 에러/재시도/토큰 갱신
   │  │  ├─ generated.ts         # (Orval 사용 시) 자동 생성 API/훅
   │  │  └─ hooks.ts             # 수동 공통 훅(orval 미사용시)
   │  ├─ types/
   │  │  └─ api.ts               # openapi-typescript 생성물
   │  ├─ schemas/
   │  │  ├─ api.zod.ts           # openapi-zod-client(orval zod) 생성물
   │  │  └─ local/
   │  │     ├─ naturalDate.ts    # “내일 3시” → 구조화, zod 검증
   │  │     └─ template.ts       # 템플릿 필드/제약 zod
   │  ├─ ws/
   │  │  ├─ sse.ts               # SSE 핸들러(Last-Event-ID 재연, 토픽 필터)
   │  │  └─ topics.ts            # tenant/account별 채널 라우팅
   │  ├─ time.ts                 # date-fns 유틸(ko locale)
   │  ├─ utils.ts
   │  └─ factories/
   │     └─ intentFactory.ts     # intent → 카드 컴포넌트 매핑(플랫폼/액션별)
   │
   ├─ store/                     # 전역 얇은 상태(필요 최소)
   │  ├─ session.ts              # 현재 세션 컨텍스트(계정/플레이북/페르소나)
   │  ├─ ui.ts                   # Inbox 열림/닫힘, 모달 상태 등
   │  └─ toast.ts
   │
   ├─ templates/                 # 드래프트 템플릿(서버 내려주거나 프론트 보조)
   │  ├─ threads/
   │  │  ├─ teaser.json
   │  │  └─ announcement.json
   │  └─ instagram/
   │     └─ teaser.json
   │
   ├─ mocks/                     # 개발용 목 데이터/핸들러(MSW 등)
   │  ├─ handlers.ts
   │  └─ server.ts
   │
   ├─ tests/
   │  ├─ unit/                   # 컴포넌트/훅 단위 테스트
   │  └─ e2e/                    # (선택) Playwright/Cypress
   │
   ├─ styles/
   │  └─ globals.css             # Tailwind import + 전역 스타일
   └─ assets/
      ├─ icons/
      └─ images/
```

### 부록 B. 상호작용 시나리오 샘플 (텍스트 와이어)

* 유저: "주말 오전에 테이스팅 영상 올려줘. 해시태그 추천도" → Chips: `예약`, `지침생성` 자동 활성
* 시스템: `ScheduleCreateCard` + `BriefGenerateCard` 등장 → 사용자가 폼 확인 → 실행
* 이벤트: `brief-ready`, `publish-done` 순으로 SystemMessage 스트림 반영 → 캘린더/타임라인 즉시 갱신
