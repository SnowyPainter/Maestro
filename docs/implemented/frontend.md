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
- 현재 선택된 **Persona** 표시
- 연결된 **PlatformAccount** 목록
- 사용 가능한 **Flow** 목록

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

#### 🤝 **coworkers**
- CoWorker 리스 관리
- 자동 루틴 설정
- 실행 히스토리

#### 📖 **playbooks**
- Persona × Campaign 단위 인사이트 관리
- 과거 행동 JSON 로그 조회
- KPI 집계 및 최적 시간대/톤 분석
- LLM 입력/출력 히스토리 시각화

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
   - Adapter가 Threads Graph API 호출 → 실제 게시
   - `post-publication.detail` 카드 반환 (permalink 포함)

### ⚡ 자동화 규칙 설정 및 모니터링 (Reactive)
1. **룰 생성 → 1회 설정으로 끝**
   - "Create reactive rule" → 키워드 매칭 규칙 생성 (정규식/포함/동일)
   - "Create reply template" → DM/Reply 템플릿 생성
   - 게시물에 규칙 연결 (RulePublication)

2. **실시간 모니터링**
   - ActionLogCard에서 실행 결과 실시간 확인
   - Payload JSON을 예쁘게 표시 (링크 클릭 가능)
   - Context Registry에 rule_id 자동 등록

3. **댓글 기반 후속 글 생성**
   - "List all campaigns" → Campaign 목록 조회
   - Campaign 컨텍스트 주입
   - "List comments post_publication_id:9" → 특정 게시물 댓글 조회
   - "Create a new draft" → 댓글 기반 새 Draft 생성

### 📊 실시간 스케줄 스트림 (SSE)
1. `useEffect`에서 `/api/sse/scheduler/stream` 연결
2. 백엔드가 예약된 게시물 상태 변화 스트림
3. 프론트엔드가 실시간으로 스케줄 카드 업데이트

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
5. **키워드 기반 자동화** — Reactive 엔진으로 댓글 자동 응답 (1회 설정 → 영구 자동화)
6. **Trends RAG** — 벡터 검색으로 유사 트렌드 기반 인사이트 제공
7. **타입 안전성** — OpenAPI 자동 생성으로 프론트/백엔드 계약 보장

---

## 📊 컴포넌트 통계
- **Pages:** 7+
- **Widgets:** 5
- **Features:** 12+ (백엔드 모듈 16개 연동)
- **Entities:** 13+
- **UI Components:** 30+
- **자동 생성 API Hooks:** 50+

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

> **"Maestro는 나를 대신 쓰는 게 아니라, 나의 리듬을 대신 연주한다."**

