# 프론트엔드 구현사항

## 철학적 기반
> **"Ctrl + K" — 당신이 어디서 쓰든, 그 순간 Maestro가 함께 합니다.**

프론트엔드는 단순한 UI가 아닌, **백엔드 오케스트레이터와 융화된 지휘 인터페이스**입니다.
모든 인터랙션은 **카드 기반**으로 시각화되며, 사용자의 판단을 **맥락과 함께** 백엔드에 전달합니다.

---

## 🎨 핵심 아키텍처

### 1. **Feature-Sliced Design**
> 도메인별로 독립된 feature 모듈 구성

```
src/
├── app/          — 앱 진입점 및 Provider
├── pages/        — 라우트별 페이지
├── widgets/      — 독립된 복합 UI 블록
├── features/     — 도메인별 기능 (비즈니스 로직)
├── entities/     — 도메인 엔티티 (타입, 스토어, API 훅)
├── components/   — 재사용 가능한 UI 컴포넌트
├── lib/          — 유틸리티, API 클라이언트
└── store/        — 전역 상태 (Zustand)
```

---

## 🧩 주요 구성 요소

### 📄 **Pages** — 라우트별 페이지

#### 🏠 **LandingPage**
- Maestro 철학과 비전 소개
- CTA: "브랜드 지능 시작하기"
- 슬로건: "당신의 판단을 복제하는 중입니다"

#### 💬 **ChatPage**
- **채팅 기반 오케스트레이션 인터페이스**
- 3-column 레이아웃:
  1. **ChatSidebar** — 툴 선택, 새 채팅
  2. **ChatStream** — 메시지 및 카드 스트림
  3. **ChatContextPanel** — 현재 페르소나, 플로우 정보

#### 🔐 **Auth Pages**
- `LoginPage` — JWT 로그인
- `SignupPage` — 회원가입

#### ⚙️ **SettingsPage**
- 계정 설정
- Persona 관리
- PlatformAccount 연동

#### 📜 **Legal Pages**
- `PrivacyPolicyPage` — 개인정보 처리방침
- `DataDeletionPolicyPage` — 데이터 삭제 정책
- `TermsOfServicePage` — 서비스 약관

---

### 🧱 **Widgets** — 독립된 복합 UI 블록

#### 💬 **ChatStream**
- 메시지와 카드를 스트림으로 렌더링
- 카드 타입별 동적 렌더링 (`CardRenderer`)
- 무한 스크롤 지원

#### 🎤 **ChatInput**
- Lexical 기반 리치 텍스트 에디터
- Markdown 문법 지원
- 이미지/비디오 첨부 (paste 지원)

#### 🎛️ **ChatSidebar**
- 빠른 액션 툴 모음
  - "트렌드 조회"
  - "새 캠페인"
  - "Draft 생성"
- 채팅 히스토리

#### 📋 **ChatContextPanel**
- 현재 선택된 **Persona** / **Campaign** 컨텍스트 표시
- Graph RAG Copilot 카드
  - `/api/sse/graph-rag/suggestions/stream` SSE로 실시간 제안 스트림 수신
  - ROI(재사용 횟수, 절약 시간, 자동화 비율)와 Trend/Draft/Playbook/Persona 액션 카드 렌더
  - 복수 액션을 이전/다음 버튼으로 탐색 가능, 각 카드 CTA는 서버가 제공한 `flow_path`로 즉시 실행

#### 👤 **PersonaAccountContext**
- Persona 선택 드롭다운
- 연결된 계정 표시 및 토글

---

### 🎯 **Features** — 도메인별 기능

#### 🎭 **personas**
- Persona CRUD
- 톤, 스타일, 금칙어 정의
- PersonaAccount 매핑

#### 🔗 **accounts**
- PlatformAccount 연동 (Threads, Instagram)
- OAuth 플로우
- 인증 정보 관리

#### 📝 **drafts**
- Draft 생성/편집/삭제
- IR (Intermediate Representation) 기반 블록 에디터
  - `TextBlock` — Markdown 텍스트
  - `ImageBlock` — 이미지 첨부
  - `VideoBlock` — 비디오 첨부
- Variant 컴파일 결과 미리보기
- A/B 테스트 설정

#### 📊 **campaigns**
- Campaign 생성/관리
- KPI 정의 및 목표 설정
- 실시간 성과 대시보드

#### 📈 **schedules**
- 예약 발행 관리
- 캘린더 뷰
- SSE로 실시간 상태 업데이트

#### 🌐 **trends**
- 트렌드 데이터 조회 (국가별, 랭킹별)
- RAG 기반 유사 트렌드 검색
- 뉴스 피드
- 트렌드 기반 Draft 제안
- 벡터 검색 결과 시각화

#### 🕸️ **rag** — Graph RAG 탐색 및 시각화
- **GraphExplorer** — 지식 그래프 노드/엣지 인터랙티브 탐색
  - 벡터 검색 결과를 카드 형식으로 시각화
  - 노드별 `node_type` 필터링 (persona, campaign, draft, publication, trend, comment, rule 등)
  - 실시간 검색어 필터링 (title, summary, chunks 매칭)
  - 노드 확장(expand) 버튼으로 이웃 노드 탐색 (`onExpandNode` 콜백)
  - 관계 간선(edge) 시각화 — edge_type, weight, meta 정보 표시
  - 제한적 표시(상위 2개) + "Show more" 버튼으로 성능 최적화
- **GraphNodeCard** — 개별 노드 카드 컴포넌트
  - `title`, `summary`, `node_type`, `score` 표시
  - Chunks 펼치기/접기 토글
  - 원본 소스(`source_table`, `source_id`) 참조 링크
  - 확장 버튼으로 이웃 노드 탐색
- **RelatedNodeCard** — 관련 노드 간선 카드
  - `edge_type` 배지 (produces, published_as, related_trend, comment_on 등)
  - 대상 노드 정보 (`title`, `summary`, `node_type`)
  - 클릭 시 해당 노드로 네비게이션
- **BFF API 통합**
  - `POST /api/orchestrator/bff/rag/search` — 쿼리 기반 검색 (`usePostApiOrchestratorBffRagSearchPost`)
  - `GET /api/orchestrator/bff/rag/nodes/{node_id}/neighbors` — 노드 이웃 확장
- **카드 타입**: `rag.search.result` — 채팅 스트림에서 Graph RAG 결과를 `GraphExplorer`로 자동 렌더링
- **콜백 체인**: `onRagExpand`, `onRagNavigate` — 사용자가 노드를 확장/탐색할 때 채팅 메시지로 전파하여 연속 탐색 가능
- **의미**: 단순 검색 결과를 넘어 **도메인 간 관계를 시각화**하여 사용자가 "Trend → Draft → Publication → Comment" 경로를 인터랙티브하게 탐색
- **Copilot 통합**: Graph RAG suggestion SSE를 받아 ROI + 실행 카드 UI (`CopilotCard`) 로 재구성, 실행 시 `useGraphRagSuggestions` 훅이 `/api/orchestrator/graph-rag/actions/*` 플로우 호출
- **ActionAck 컴포넌트**: Graph RAG 액션 실행 결과를 `ActionAck` 카드로 채팅 스트림에 삽입하여 성공/실패 피드백과 후속 제안을 이어감

#### 🤝 **coworkers**
- CoWorker 리스 관리
- 자동 루틴 설정
- 실행 히스토리

#### 📖 **playbooks** — 브랜드 기억 저장소
- **나와 CoWorker의 모든 행동 기록** — 인간 + AI 판단의 완전한 히스토리
- **완전한 컨텍스트 조회**:
  - 🤖 **LLM 입력/출력 히스토리** — 어떤 프롬프트로 어떤 응답을 받았는지
  - 📊 **Campaign KPI 추이** — 당시 캠페인 성과는 어땠는지
  - 🌊 **트렌드 컨텍스트** — 어떤 트렌드를 기반으로 판단했는지
  - 🎭 **페르소나 적용 내역** — 어떤 목소리로, 어떤 금칙어를 적용했는지
- **Persona × Campaign 단위 인사이트 관리**
- **데이터 기반 최적화**: KPI 집계, 최적 시간대, 최적 톤 자동 분석
- **브랜드 기억 시각화**: "이전에는 이렇게 했는데 결과는 어땠지?" 인터랙티브 조회

#### 📊 **playbooks.analysis** — 실시간 성과 분석 대시보드
- **컴팩트 다중 페이지 대시보드** — 공간 절약과 빠른 인사이트 제공
- **Overview 페이지**: 메트릭 카드 + 시간대별 활동량 라인 차트 (shadcn/ui chart)
- **Event Chain 페이지**: 이벤트 타입 분포 파이차트 + 메트릭 카드
- **Performance 페이지**: 성공률 분포 파이차트 + 액션별 통계
- **Insights 페이지**: Creator/Manager/Brand 페르소나별 가치 분석
- **Trend Correlation 페이지**: KPI ↔ 트렌드 상관분석 (신규) — 트렌드 랭킹 vs. 콘텐츠 성과 예측
- **Recommendations 페이지**: 개발 로드맵 타임라인 + AI 기반 추천
- **플로팅 네비게이션**: 좌우 화살표 버튼으로 페이지 간 이동
- **실시간 데이터 연동**: BFF API를 통한 실제 데이터베이스 메트릭 계산
- **PlaybookList 통합**: "Select" 버튼 옆에 "Analyze" 버튼 추가

#### 🧪 **abtests**
- A/B 테스트 결과 비교
- Winner 자동 선정
- 통계 그래프

#### ⚡ **reactive**
- **키워드 기반 자동 응답 규칙 관리** — 키워드 → 태그 → DM/댓글 자동 응답
- **Rule 생성** — 정규식/포함/동일 매칭 규칙 설정
- **Template 관리** — DM/Reply 템플릿 생성 및 편집
- **Action Log 모니터링** — 자동화 실행 결과 실시간 확인
- **Rule Overview** — 모든 규칙 목록 및 상태 관리
- **매 5분마다 자동 실행** — 설정 한번으로 영구 자동화

#### ✉️ **mail** (백엔드 자동화)
- 이메일 기반 Draft 자동 생성 (IMAP)
- Pipeline ID 기반 자동 플로우 실행
- 이메일 → Draft IR 변환 (백엔드 전용)

---

### 🧩 **Entities** — 도메인 엔티티

각 feature에 대응하는 엔티티는 다음을 포함합니다:

- **타입 정의** — OpenAPI에서 자동 생성된 TypeScript 타입
- **API Hooks** — React Query 기반 자동 생성 훅
  - `useGetDraftsApiOrchestratorBffDraftsGet`
  - `useCreateDraftApiOrchestratorBffDraftsPost`
  - 등
- **Context Provider** — 도메인별 상태 관리
  - `ChatMessagesContext` — 채팅 메시지 상태
  - `PersonaContext` — 현재 선택된 Persona

---

### 🎨 **Components** — 재사용 가능한 UI

#### 🎴 **Chat Components**
- `Chip` — 빠른 액션 버튼
- `InputBox` — 텍스트 입력 박스
- `Suggest` — 자동완성 제안

#### ✏️ **Draft Components**
- `DraftIREditor` — IR 블록 에디터
- `DraftIRBlockRender` — 블록 렌더러
- `TextBlock`, `ImageBlock`, `VideoBlock` — 개별 블록 컴포넌트
- **Ctrl + K** 단축키 지원

#### 📊 **Dashboard Components**
- `PlaybookAnalysisDashboard` — 컴팩트 다중 페이지 대시보드 메인 컴포넌트
- `OverviewPage` — 메트릭 카드 + 시간대별 활동량 라인 차트
- `EventChainPage` — 이벤트 체인 메트릭 + 타입 분포 파이차트
- `PerformancePage` — 성공률 분포 + 액션 통계
- `InsightsPage` — 페르소나별 가치 분석 카드
- `TrendCorrelationPage` — KPI ↔ 트렌드 상관분석 (신규) — 산점도, 히트맵, 상관계수 시각화
- `RecommendationsPage` — 개발 로드맵 타임라인 + AI 추천
- `shadcn/ui Chart` 통합 — `ChartContainer`, `ChartTooltip`, `LineChart`, `PieChart`, `ScatterChart`, `BarChart`

#### 🕸️ **Graph RAG Components**
- `GraphExplorer` — 지식 그래프 인터랙티브 탐색기
  - 노드 카드 목록 + 검색어 필터 + `node_type` 셀렉터
  - "Show more" 토글로 결과 제한 표시
  - 노드 확장(expand) 버튼으로 이웃 탐색
- `GraphNodeCard` — 노드 정보 카드 (title, summary, score, chunks, source_ref)
- `RelatedNodeCard` — 관련 노드 간선 카드 (edge_type, dst_node 정보)
- `ParentNodeHeader` — 현재 탐색 중인 부모 노드 정보 헤더

#### 🧩 **UI Components** (Radix 기반)
- `Button`, `Input`, `Select`, `Checkbox`, `Switch`
- `Dialog`, `Popover`, `Dropdown`, `Tooltip`
- `Tabs`, `Accordion`, `Slider`, `Progress`
- `Avatar`, `Separator`, `ScrollArea`
- 모두 Tailwind로 스타일링됨

#### 🎨 **Layouts**
- `RootLayout` — 공통 레이아웃 (헤더, 푸터)
- `ProtectedRoute` — 인증 필요 라우트 래퍼

---

### 🗂️ **Store** — 전역 상태 (Zustand)

#### 🔐 **session**
- JWT 토큰 관리
- 현재 로그인 사용자 정보
- 로그인/로그아웃 액션

#### 🎭 **persona-context**
- 현재 선택된 Persona ID
- PersonaAccount 매핑 상태

#### 💬 **chat-context-registry**
- 채팅 컨텍스트 (선택된 Persona, PlatformAccount 등)
- 채팅 세션 관리

#### ✍️ **generate-text**
- LLM 텍스트 생성 상태
- 스트리밍 응답 처리

---

## 🔄 API 통합

### 🤖 **Orval 자동 생성**
- `apps/backend/contracts/openapi.yaml`을 감지하여 자동 생성
- **React Query 훅** 자동 생성
  - `useGetApiOrchestratorChatMessagesGet`
  - `usePostApiOrchestratorChatMessagePost`
  - 등
- **TypeScript 타입** 자동 생성
  - `DraftOut`, `PersonaOut`, `CampaignKPIResultOut` 등

### 📡 **TanStack React Query**
- 서버 상태 캐싱 및 자동 재요청
- Optimistic UI 업데이트
- Mutation 후 자동 invalidation

---

## 🎯 핵심 플로우

### 💬 채팅 기반 플로우 (2단계)
1. **"Get trends and create new draft"**
   - 사용자가 `ChatInput`에 명령 입력
   - `useChatPageEvents.handleChatSend` 호출
   - `usePostApiOrchestratorChatMessagePost` 훅으로 백엔드 전송
   - Sniffer가 트렌드 수집 (RAG 벡터 검색) → LLM 초안 생성
   - `drafts.create`로 Draft 생성 → Draft 카드 반환

2. **Schedule 설정 → 정시 발행**
   - 사용자가 Draft 카드에서 Schedule 버튼 클릭
   - `upsert_post_publication_schedule`로 예약 설정
   - CoWorker가 정시 자동 발행 → 실제 게시
   - PostPublication 기록 → Playbook 학습

### 📝 Draft 작성 및 발행 (2단계)
1. **Draft 생성**
   - 사용자가 "Get trends and create new draft" 명령
   - 백엔드가 Sniffer 트렌드 수집 + LLM 초안 생성
   - `drafts.create`로 Draft 생성 → `draft.detail` 카드 반환
   - 사용자가 `DraftIREditor`로 내용 편집

2. **Schedule 설정 → 정시 발행**
   - 사용자가 Draft 카드에서 Schedule 버튼 클릭
   - `upsert_post_publication_schedule`로 예약 시간 설정
   - CoWorker가 정시 자동 발행 → `usePublishDraftApiOrchestratorActionPublishPost`
   - Adapter가 Threads/Instagram Graph API 호출 → 실제 게시
   - `post-publication.detail` 카드 반환 (permalink 포함)

### ⚡ 자동화 규칙 설정 및 모니터링 (Reactive) — **유즈케이스 중심**

#### 🎯 **유즈케이스 1: 키워드 기반 자동 응답 설정**
1. **룰 생성 및 템플릿 설정**
   - "Create reactive rule" → 키워드 매칭 규칙 생성 (정규식/포함/동일)
   - "Create reply template" → DM/Reply 템플릿 생성
   - 게시물에 규칙 연결 (RulePublication)

2. **실시간 모니터링**
   - ActionLogCard에서 실행 결과 실시간 확인 (Threads/Instagram 모두 지원)
   - Payload JSON을 예쁘게 표시 (링크 클릭 가능)
   - Context Registry에 rule_id 자동 등록

#### 🎯 **유즈케이스 2: 댓글 기반 후속 콘텐츠 생성**
1. **캠페인 컨텍스트 수집**
   - "List all campaigns" → Campaign 목록 조회
   - Campaign 컨텍스트 주입 (Persona + 전략 정보)

2. **댓글 분석 및 콘텐츠 생성**
   - "List all post publications" → 발행된 게시물 목록
   - "List comments post_publication_id:9" → 특정 게시물 댓글 조회
   - "Create a new draft" → 댓글 기반 새 Draft 생성
   - **결과**: LLM이 댓글 분석 → 관련 트렌드 검색 → 후속 콘텐츠 초안 생성

#### 🎯 **유즈케이스 3: 링크 추적/CTR 모니터링**
1. **링크 인벤토리 탐색**
   - URL/게시글 키워드로 필터링, persona/draft별 방문수 정렬
2. **성과 해석**
   - 각 링크 카드에서 퍼블릭 URL, 원본 URL, 마지막 방문 시각 확인
   - CTA가 잘 작동하는지 비교 후 Draft/Persona 정책 즉시 수정
3. **KPI 연동**
   - 동일한 visit_count가 Campaign KPI의 `LINK_CLICKS`로 반영됨을 대시보드에서 확인
   - Impression 값이 있을 경우 CTR 카드로 바로 확인 → 메시지/채널 우선순위 재조정

### 📊 실시간 스케줄 스트림 (SSE)
1. `useEffect`에서 `/api/sse/scheduler/stream` 연결
2. 백엔드가 예약된 게시물 상태 변화 스트림
3. 프론트엔드가 실시간으로 스케줄 카드 업데이트

### 📈 Playbook 성과 분석 플로우
1. **Playbook 선택 및 분석 요청**
   - 사용자가 `PlaybookList`에서 "Analyze" 버튼 클릭
   - `PlaybookAnalysisDashboard` 컴포넌트가 채팅에 추가
   - BFF API 호출로 실시간 데이터 조회

2. **다중 페이지 대시보드 탐색**
   - 플로팅 화살표 버튼으로 페이지 간 이동 (Overview → Event Chain → Performance → Insights → Trend Correlation → Recommendations)
   - 각 페이지별 데이터 시각화 (shadcn/ui chart 기반)
   - 메트릭 카드와 차트로 성과 분석

3. **실시간 메트릭 계산**
   - Overview: 총 로그 수, 성공률, 시간대별 활동량
   - Event Chain: 이벤트 타입 분포, 평균 동기화 간격
   - Performance: 액션별 성공률, 실패율 분석
   - Insights: 페르소나별 가치 메트릭 (Creator/Manager/Brand)
   - Recommendations: AI 기반 최적화 제안

### 🕸️ Graph RAG 탐색 플로우
1. **초기 검색**
   - 사용자가 채팅에서 "Search knowledge graph: {query}" 입력
   - BFF API `POST /rag/search` 호출
   - `GraphExplorer` 컴포넌트가 `rag.search.result` 카드로 렌더링

2. **노드 탐색 및 확장**
   - 사용자가 특정 노드 카드에서 "Expand" 버튼 클릭
   - `onExpandNode` 콜백이 `node_id`, `node_type`을 채팅 메시지로 전송
   - BFF API `GET /rag/nodes/{node_id}/neighbors` 호출
   - 이웃 노드 목록이 새 `rag.search.result` 카드로 추가

3. **관계 기반 네비게이션**
   - `RelatedNodeCard`에서 특정 간선 클릭
   - `onRagNavigate` 콜백으로 대상 노드 탐색
   - 해당 노드의 상세 정보 및 이웃 노드가 새 카드로 추가

4. **필터링 및 검색**
   - `node_type` 셀렉터로 특정 타입만 표시 (예: draft, publication만)
   - 검색어로 title/summary/chunks 실시간 필터링
   - "Show more" 토글로 전체 결과 확인

5. **연속 탐색**
   - 사용자가 "Trend → Draft → Publication → Comment" 경로를 따라 연속 탐색
   - 각 단계마다 새 카드가 채팅 스트림에 추가되어 탐색 히스토리 유지
   - **의미**: 단순 검색이 아닌 **지식 그래프를 따라가는 인터랙티브 탐험**

---

## 🎨 디자인 시스템

### 🎨 컬러
- **Primary** — Cobalt Blue (오케스트레이션 액센트)
- **Muted** — 배경색 (회색 톤)
- **Accent** — 강조색 (금색 또는 파란색)

### 🌓 다크모드
- `next-themes` 기반
- 시스템 설정 자동 감지
- 토글 지원

### 📐 레이아웃
- **Responsive** — 모바일, 태블릿, 데스크탑
- **Grid 기반** — Tailwind Grid
- **Card 기반 UI** — 모든 응답은 카드로 시각화

### ✨ 애니메이션
- **Framer Motion** — 카드 등장, 전환 애니메이션
- **tailwindcss-animate** — Radix UI 애니메이션 확장

---

## 🔒 인증 및 보안

### 🔐 JWT Bearer Token
- 로그인 시 `access_token` 받아서 `sessionStore`에 저장
- 모든 API 요청에 `Authorization: Bearer <token>` 헤더 추가
- 토큰 만료 시 로그인 페이지로 리다이렉트

### 🛡️ Protected Routes
- `ProtectedRoute` 컴포넌트로 래핑
- 인증되지 않은 사용자는 `/login`으로 리다이렉트

---

## 🌍 국제화 (i18n)

- **i18next** 기반
- 언어 자동 감지 (브라우저 설정)
- 현재 지원: 한국어, 영어 (placeholder)

---

## 🎯 핵심 가치 (코드에 입각)

1. **2단계 게시 플로우** — "Get trends and create draft" → Schedule → 자동 발행
2. **Ctrl + K 중심 UX** — 어디서든 Maestro 호출, 맥락 인식 입력
3. **카드 기반 인터페이스** — 모든 응답을 액션 가능한 카드로 시각화
4. **실시간 동기화** — SSE로 백엔드 상태 실시간 반영
5. **브랜드 기억 저장소** — 나와 CoWorker의 모든 행동을 완전하게 기록 (트렌드, KPI, 페르소나, LLM 컨텍스트)
6. **컴팩트 분석 대시보드** — 실시간 메트릭 + 시각화로 즉시 인사이트 제공 (shadcn/ui chart)
7. **KPI ↔ 트렌드 상관분석** — 트렌드 랭킹 vs. 콘텐츠 성과 예측 모델링으로 최적 트렌드 선정 (신규)
8. **키워드 기반 자동화** — Reactive 엔진으로 댓글 자동 응답 (1회 설정 → 영구 자동화)
9. **Graph RAG 탐색** — 지식 그래프 인터랙티브 탐색으로 도메인 간 관계 시각화 (GraphExplorer)
10. **Trends RAG** — 벡터 검색으로 유사 트렌드 기반 인사이트 제공
11. **타입 안전성** — OpenAPI 자동 생성으로 프론트/백엔드 계약 보장

---

## 📊 컴포넌트 통계
- **Pages:** 7+
- **Widgets:** 5
- **Features:** 14+ (백엔드 모듈 17개 연동, **rag** 포함)
- **Entities:** 14+ (**rag** 포함)
- **UI Components:** 30+
- **Dashboard Components:** 7 (PlaybookAnalysisDashboard + 6 페이지 컴포넌트)
- **Graph RAG Components:** 4 (GraphExplorer, GraphNodeCard, RelatedNodeCard, ParentNodeHeader)
- **자동 생성 API Hooks:** 52+ (Graph RAG API 포함: `usePostApiOrchestratorBffRagSearchPost`, `useGetApiOrchestratorBffRagNodesNodeIdNeighborsGet`)

---

## 🔧 확장 포인트

### 새 Feature 추가하기
1. `src/features/[feature-name]` 디렉토리 생성
2. 도메인 로직 구현
3. `src/entities/[feature-name]` 엔티티 생성
4. `orval`이 OpenAPI에서 자동으로 API 훅 생성
5. `src/pages` 또는 `ChatStream` 카드 렌더러에 통합

### 새 카드 타입 추가하기
1. 백엔드 `orchestrator/cards.py`에 카드 타입 매핑 추가
2. 프론트엔드 `CardRenderer`에 새 카드 컴포넌트 추가
3. 백엔드가 카드 응답 반환하면 자동 렌더링

---

## 🎨 UI/UX 특징

### 🎴 카드 기반 대화
- 각 응답이 독립된 카드로 렌더링
- 카드마다 액션 버튼 포함 (편집, 삭제, 복사 등)
- 카드 타입별 아이콘 및 색상 구분

### 📊 컴팩트 분석 대시보드
- **다중 페이지 네비게이션**: 플로팅 화살표 버튼으로 공간 절약
- **실시간 차트 시각화**: shadcn/ui chart로 메트릭 즉시 확인
- **반응형 메트릭 카드**: 페르소나별 가치 분석 구조화
- **타임라인 기반 추천**: 개발 로드맵 + AI 최적화 제안

### 🌊 Multi-source Timeline
- 여러 계정의 게시물을 하나의 타임라인으로 통합
- 플랫폼별 필터링
- 드래그 앤 드롭으로 순서 변경 (`@dnd-kit`)

### 📅 스케줄 캘린더
- 예약 발행 일정 시각화
- 드래그 앤 드롭으로 일정 변경
- SSE로 실시간 상태 업데이트

### 🎭 Persona 컨텍스트 스위칭
- 채팅 중 Persona 변경 가능
- 변경 시 백엔드가 자동으로 컨텍스트 적용
- 현재 Persona가 사이드바에 항상 표시

---

## 🎯 백엔드와의 융화

### 🔄 **실시간 동기화**
- 백엔드가 OpenAPI 스펙 변경 시 프론트엔드 타입/훅 자동 재생성
- 타입 불일치 시 **컴파일 에러**로 즉시 감지

### 📡 **SSE 스트림**
- 백엔드가 스케줄 상태 변경 시 프론트엔드에 즉시 푸시
- 새로고침 없이 실시간 반영

### 🎴 **카드 기반 프로토콜**
- 백엔드가 Pydantic 모델을 `card_type`과 함께 반환
- 프론트엔드가 `CardRenderer`로 동적 렌더링
- 새 카드 타입 추가 시 프론트엔드만 수정하면 됨

---

> **"Maestro는 나를 대신 쓰는 게 아니라, 나와 CoWorker의 모든 행동을 기록하며 나의 리듬을 대신 연주한다."**
