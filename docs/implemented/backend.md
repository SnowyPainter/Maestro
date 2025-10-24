# 백엔드 구현사항

## 철학적 기반
> **"Maestro는 당신의 판단을 기록하고 재현합니다. 브랜드의 리듬을 잃지 않은 채로."**

백엔드는 프론트엔드와 분리된 API 서버가 아닌, **프론트엔드와 융화된 오케스트레이션 엔진**입니다.
모든 사용자 의도는 **결정론적 액션 DAG**로 변환되며, 실행 결과는 **Playbook에 기록**되어 다음 판단의 근거가 됩니다.

---

## 🎭 핵심 모듈

### 1. **Orchestrator** — 지휘자
> 모든 사용자 의도를 결정론적으로 실행하는 중앙 조정 시스템

#### 주요 컴포넌트
- **`dag_executor.py`** — DAG 기반 액션 실행 엔진
  - 각 노드는 **idempotent operator** (같은 입력 → 같은 출력)
  - 실행 과정을 추적 가능하도록 기록
  - 에러 발생 시 재시도 및 보상 트랜잭션 지원

- **`dsl.py`** — 도메인 특화 언어
  - 사용자 자연어를 구조화된 **slot-based intent**로 파싱
  - 슬롯 → 액션 카드 → DAG 노드로 변환

- **`planner.py`** — 액션 계획 수립
  - 사용자 의도에서 필요한 액션 시퀀스 생성
  - Persona와 Playbook 컨텍스트를 반영하여 최적 경로 결정

- **`persona_context.py`** — 페르소나 컨텍스트 주입
  - 현재 선택된 Persona의 톤, 스타일, 금칙어를 모든 액션에 자동 주입

- **`cards.py`** — 카드 렌더링 메타데이터
  - 각 Pydantic 모델을 프론트엔드 카드 타입으로 매핑
  - `draft.detail`, `campaign.list`, `account.persona.detail` 등

- **`dispatch.py`** — 라우팅 로직
  - 사용자 입력을 적절한 flow로 디스패치

#### 라우터
- **`bff_router.py`** — BFF (Backend For Frontend)
  - 프론트엔드 특화 API 엔드포인트
  - 채팅 메시지, 카드 렌더링, 컨텍스트 조회

- **`chat_router.py`** — 채팅 인터페이스
  - 사용자 메시지 수신 → 오케스트레이터 실행 → 카드 응답

- **`action_router.py`** — 액션 실행
  - 프론트엔드에서 트리거한 명시적 액션 처리
  - 예: 게시물 발행, 삭제, 메트릭 갱신

- **`helper_router.py`** — 헬퍼 유틸리티
  - 자동완성, 제안, 메타데이터 조회

- **`auth_router.py`** — 인증
  - 로그인, 회원가입, 토큰 발급

- **`internal_router.py`** — 내부 전용 API
  - 절대 프로덕션 노출 금지 (주석 처리됨)

---

### 2. **Modules** — 도메인 모델
> 각 도메인별 데이터 모델, 서비스, CRUD 로직

#### 주요 모듈

##### 👤 **users** — 사용자 관리
- JWT 기반 인증
- 비밀번호 bcrypt 해싱

##### 🎭 **accounts** — 계정 및 페르소나
- **PlatformAccount** — 플랫폼 연동 계정 (Threads, Instagram 등)
- **Persona** — 브랜드 목소리 정의 (톤, 말투, 금칙어)
- **PersonaAccount** — Persona와 PlatformAccount 매핑

##### 📝 **drafts** — 초안 관리
- **Draft** — 게시물 초안
- **DraftVariant** — 플랫폼별 변형 (A/B 테스트 포함)
- **PostPublication** — 발행된 게시물 메타데이터 (external_id, permalink 등)
- **Compiler 시스템** — IR (Intermediate Representation)을 플랫폼별 포맷으로 컴파일

##### 📊 **campaigns** — 캠페인 관리
- **Campaign** — 마케팅 캠페인 정의
- **CampaignKPIDef** — KPI 정의 (목표, 메트릭)
- **CampaignKPIResult** — 실제 성과 기록

##### 📖 **playbooks** — 행동 기록 및 학습
- Persona × Campaign 단위의 브랜드 인텔리전스 컨테이너
- 과거 행동과 결과를 **JSON 로그**로 저장 (PlaybookLog)
- LLM 입력/출력, KPI 스냅샷, 트렌드 스냅샷 등 메타데이터 저장
- 집계 KPI (aggregate_kpi), 최적 시간대 (best_time_window), 최적 톤 (best_tone) 자동 학습

##### 📈 **insights** — 인사이트 수집
- **InsightSample** — 게시물 성과, 댓글 반응 등 수집
- Playbook 학습 데이터로 활용

##### 📅 **scheduler** — 스케줄 관리
- 예약 발행 시간 관리
- SSE (Server-Sent Events)로 프론트엔드에 실시간 스트림 전송

##### 🌐 **trends** — 트렌드 감지 및 RAG
- **Trend** — 시장 트렌드 데이터 (국가별, 랭킹별)
- **NewsItem** — 트렌드 관련 뉴스 아이템
- **RAG (Retrieval-Augmented Generation)** — 벡터 임베딩 기반 유사도 검색
  - `title_embedding` 필드로 pgvector 벡터 검색
  - `embed_texts()`로 쿼리 텍스트 임베딩 → 유사 트렌드 검색
  - 캐시 (Redis)와 DB 혼용으로 성능 최적화
- Sniffer 워커가 수집

##### 🔌 **adapters** — 플랫폼 어댑터
- **CapabilityAdapter 패턴** — 플랫폼별 차이 흡수
- **Capabilities:**
  - `PublishingCapability` — 게시
  - `DeletionCapability` — 삭제
  - `MetricsCapability` — 메트릭 수집
  - `CommentCreateCapability` — 댓글 생성
  - `CommentReadCapability` — 댓글 조회
  - `CommentDeleteCapability` — 댓글 삭제
- **Compiler 시스템** — IR을 플랫폼 제약에 맞게 변환 (텍스트 길이, 미디어 개수 등)
- **구현 현황:**
  - ✅ **Threads** — 완전 구현 (Meta Graph API v1.0)
  - 🟡 **Instagram** — Placeholder (인터페이스만 구현)

##### 🧪 **abtests** — A/B 테스트
- Variant 간 성과 비교
- 자동 Winner 선정 로직

##### 🤝 **injectors** — 의존성 주입
- LLM 프롬프트 생성, 토큰 관리

##### ⚡ **reactive** — 자동화 규칙 엔진
- **키워드 기반 자동 응답** — 댓글/메시지에서 키워드 감지 → 태그 생성 → DM/댓글 자동 응답
- **ReactionRule** — 키워드 매칭 규칙 (정규식/포함/동일 매칭 지원)
- **ReactionRuleKeyword** — 키워드 → 태그 매핑
- **ReactionRuleAction** — 태그 → DM 템플릿/Reply 템플릿/Alert 액션
- **ReactionMessageTemplate** — 재사용 가능한 메시지 템플릿
- **ReactionActionLog** — 자동화 실행 로그 및 상태 추적
- **매 5분마다 Sync Metrics** — 댓글 수집 → 규칙 평가 → 자동 응답 실행
- **LLM 지원 모드** — 템플릿 전용(LLM도 염두에 두고 설계는 함)

##### ✉️ **mail** — 이메일 기반 자동화
- **IMAP 폴링** — 이메일 기반 Draft 자동 생성
- **Mail Parser** — 이메일 본문을 구조화된 Draft IR로 변환
- **Pipeline ID** — 이메일에서 pipeline_id 추출하여 자동 플로우 실행
- **Confirmation Email** — Draft 생성 완료 시 발신자에게 확인 메일

##### 🔗 **timeline** — 통합 타임라인
- 여러 계정의 게시물을 하나의 타임라인으로 통합 뷰 제공

##### 🔧 **common** — 공통 유틸리티
- Enums (PlatformKind, VariantStatus, MetricsScope 등)
- 공통 스키마

---

### 3. **Workers** — 비동기 작업자 (Celery)
> 백그라운드에서 실행되는 자율 지능 에이전트

#### 🤖 **CoWorker** — 당신의 동료
- **`execute_due_schedules.py`** — 예약된 게시물 자동 발행
- **`generate_texts.py`** — 트렌드 기반 초안 자동 생성
- **`runtime.py`** — CoWorker 리스 관리 (점유 시간, 루틴 실행)
- **철학:**
  > "당신이 부재할 때도 루틴을 이어가는 동료"

#### 🕵️ **Sniffer** — 시장 신호 탐지
- **`tasks.py`** — 트렌드, 뉴스, 경쟁사 모니터링
- 감지된 신호를 CoWorker가 판단 근거로 활용

#### 🔄 **Synchro** — 동기화
- **`tasks.py`** — 플랫폼 상태 동기화 (메트릭 갱신, 댓글 수집 등)

#### 🔌 **Adapter** — 플랫폼 연동 작업
- 외부 API 호출을 비동기 큐로 처리

---

### 4. **Core** — 공통 인프라
- **`db.py`** — SQLAlchemy 엔진 및 세션 관리
- **`config.py`** — 환경 변수 기반 설정 (Pydantic Settings)
- **`security.py`** — JWT 토큰 생성/검증, 비밀번호 해싱
- **`middleware.py`** — 요청 컨텍스트 주입
- **`context.py`** — 요청별 컨텍스트 (현재 사용자, Persona 등)
- **`celery_app.py`** — Celery 앱 초기화
- **`logging.py`** — 구조화된 로깅

---

## 🏗️ 아키텍처 패턴

### ✅ **결정론적 실행 (DAG Executor)**
- 모든 액션은 **방향성 비순환 그래프(DAG)**로 표현
- 각 노드는 idempotent — 재실행 안전
- 실행 히스토리를 추적하여 디버깅 및 재현 가능

### ✅ **Adapter 패턴**
- 플랫폼별 API 차이를 `CapabilityAdapter`로 추상화
- 새 플랫폼 추가 시 인터페이스만 구현하면 됨
- IR (중간 표현) → 플랫폼별 컴파일 → 발행

### ✅ **RAG (Retrieval-Augmented Generation)**
- Trends 데이터에 벡터 임베딩 저장 (pgvector)
- 유사한 트렌드나 키워드로 과거 인사이트 검색
- LLM 프롬프트에 검색된 트렌드 컨텍스트 주입
- **"기억하는 자동화"**의 핵심

### ✅ **BFF (Backend For Frontend)**
- 프론트엔드 요구사항에 특화된 API 설계
- 카드 기반 응답 포맷
- OpenAPI 스펙 자동 생성 → 프론트엔드 타입/훅 자동 동기화

### ✅ **Event-Driven 워커**
- Celery 큐를 통해 CoWorker/Sniffer/Synchro 독립 실행
- 각 워커는 자율적으로 판단하고 실행
- 인간의 승인을 기다리지 않고 초안 제안 가능

---

## 🔒 보안 및 인증

- **JWT Bearer Token** — stateless 인증
- **bcrypt** — 비밀번호 해싱
- **CORS** — localhost:5173 개발 환경에서만 허용
- **HTTPBearer** — OpenAPI 스키마에 보안 스킴 명시

---

## 📦 데이터 모델 설계 철학

### 1. **Persona-Centric**
- 모든 액션은 Persona 컨텍스트 아래에서 실행
- 브랜드의 목소리를 일관되게 유지

### 2. **Audit Trail**
- 모든 중요 액션은 타임스탬프 + 사용자 ID 기록
- 누가, 언제, 무엇을, 왜 했는지 추적 가능

### 3. **Immutable Variants**
- Draft는 수정되지만, Variant는 컴파일 후 불변
- 발행된 PostPublication은 삭제만 가능, 수정 불가

### 4. **Normalized Credentials**
- 플랫폼별 인증 정보는 PlatformAccount에 암호화 저장
- Adapter가 런타임에 복호화하여 사용

---

## 🌊 주요 플로우

### 📤 게시 플로우 (2단계)
1. **"Get trends and create new draft"**
   - Sniffer가 트렌드 데이터 수집 (RAG 벡터 검색 활용)
   - Persona 컨텍스트 주입
   - LLM이 초안 생성 → `drafts.create`로 Draft 생성
   - Compiler가 플랫폼별 Variant로 컴파일
   - Draft 상세 카드 반환

2. **사용자 Schedule 설정 → 나중에 발행**
   - 사용자가 Draft에서 Schedule 버튼 클릭
   - `upsert_post_publication_schedule`로 예약 발행 설정
   - CoWorker가 `execute_due_schedules`로 정시 자동 발행
   - Adapter가 Threads Graph API 호출 → 실제 게시
   - PostPublication 기록 → Playbook JSON 로그로 학습

### 🤖 CoWorker 자동 루틴
1. Celery Beat가 정기 스케줄 트리거
2. CoWorker가 `execute_due_schedules` 실행
3. 예약된 Draft 조회 → 자동 발행
4. 발행 결과를 Insight로 수집
5. Playbook에 인사이트 저장 → 다음 판단 근거로 활용

### ⚡ 자동화 규칙 실행 (Reactive)
1. **룰 설정 → 1회 설정으로 끝**
   - "Create reactive rule" → 키워드 매칭 규칙 생성 (정규식/포함/동일)
   - "Create reply template" → DM/Reply 템플릿 생성
   - 게시물에 규칙 연결 (ReactionRulePublication)

2. **매 5분마다 자동 실행**
   - Synchro 워커가 댓글 수집 (Adapter → InsightComment)
   - Reactive 엔진이 키워드 매칭 → 태그 생성
   - 태그 기반 액션 실행 (DM 전송, 댓글 답장, Alert 생성)
   - ReactionActionLog로 실행 결과 기록

### 📊 메트릭 수집
1. Synchro 워커가 주기적으로 Adapter 호출
2. 플랫폼별 메트릭 API 쿼리 (likes, replies, views 등)
3. InsightSample 저장
4. Campaign KPIResult 업데이트
5. Playbook에 JSON 로그로 학습 데이터 저장 (persona_snapshot, kpi_snapshot 등)

---

## 🔧 확장 포인트

### 새 플랫폼 추가하기
1. `modules/adapters/impls/` 아래 새 어댑터 클래스 생성
2. `CapabilityAdapter` 상속, 필요한 Capability 구현
3. `Compiler` 서브클래스로 플랫폼 제약 정의
4. `registry.py`에 등록 → 즉시 사용 가능

### 새 워커 추가하기
1. `workers/` 아래 새 디렉토리 생성
2. Celery task 함수 작성
3. `celery_app.py`에 큐 등록
4. Orchestrator에서 워커 호출 로직 추가

---

## 🎯 핵심 가치 (코드에 입각)

1. **2단계 게시 플로우** — "Get trends and create draft" → Schedule → 정시 자동 발행
2. **판단의 복제** — Persona + Playbook이 브랜드 리듬 기억
3. **결정론적 실행** — DAG 기반 추적 가능한 액션 체인
4. **기억하는 자동화** — Trends RAG로 유사 인사이트 기반 학습
5. **키워드 기반 자동화** — Reactive 엔진으로 댓글 자동 응답 (1회 설정 → 영구 자동화)
6. **플랫폼 중립성** — Adapter 패턴으로 확장 가능한 구조
7. **프론트엔드 융화** — BFF + OpenAPI 자동 동기화로 타입 안전성 보장

---

## 🛠️ 개발 명령어

```bash
# 인프라 시작 (PostgreSQL, MinIO, Redis, TEI)
pnpm dev:infra

# Celery 워커 + Beat 시작
pnpm celery:restart

# 백엔드 API 서버 및 프론트엔드 프로젝트 시작
pnpm dev:backend:and:frontend
```

---

## 📊 모델 통계
- **총 모듈 개수:** 16+ (users, accounts, drafts, campaigns, playbooks, insights, scheduler, trends, adapters, abtests, injectors, mail, timeline, common, reactive)
- **총 Worker 종류:** 4 (CoWorker, Sniffer, Synchro, Adapter)
- **지원 플랫폼:** Threads (완전), Instagram (Placeholder)
- **데이터베이스 테이블:** 20+
- **Celery 큐:** 5 (default, sniffer, synchro, adapter, coworker)
- **RAG 구현:** Trends 벡터 검색 (pgvector)

---

> **"이 루프는 끊임없이 당신의 판단을 복제하고 정제합니다."**

