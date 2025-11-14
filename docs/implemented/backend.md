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
- **Tracking links × KPI** — `tracking_links` 테이블에서 persona/draft 단위 방문수를 집계해 `LINK_CLICKS`, `CTR`을 캠페인 KPI에 자동 반영 (variant/draft/페르소나 경계를 지키면서 재사용)

##### 📖 **playbooks** — 행동 기록 및 학습 (브랜드 기억 저장소)
- **나와 CoWorker의 모든 행동 기록** — 인간 + AI의 모든 판단과 실행을 JSON 로그로 저장
- **완전한 컨텍스트 스냅샷**:
  - 🤖 **LLM 입력/출력** — 어떤 프롬프트로 어떤 응답을 받았는지
  - 📊 **Campaign KPI 스냅샷** — 당시 캠페인 성과는 어땠는지
  - 🌊 **트렌드 스냅샷** — 어떤 트렌드를 기반으로 판단했는지
  - 🎭 **페르소나 스냅샷** — 어떤 목소리로, 어떤 금칙어를 적용했는지
- **Persona × Campaign 단위의 브랜드 인텔리전스 컨테이너**
- **자동 학습**: 집계 KPI, 최적 시간대, 최적 톤을 데이터로부터 추론
- **브랜드 기억**: "이전에는 이렇게 했는데 결과는 어땠지?" 자동 회상
- **KPI ↔ 트렌드 상관분석**: 트렌드 랭킹 vs. 콘텐츠 성과 예측 모델링 (신규)

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

##### 🕸️ **rag** — Graph RAG (지식 그래프 + 벡터 검색)
- **GraphNode** — 모든 도메인 엔티티를 통합한 정규화된 그래프 노드
  - `node_type` — persona, campaign, draft, draft_variant, post_publication, trend, insight_comment, reaction_rule, playbook
  - `embedding` — pgvector(768) 벡터 임베딩 (TEI multilingual-e5-base 모델)
  - `title`, `summary` — 각 노드의 요약 정보
  - `source_table`, `source_id` — 원본 도메인 테이블 참조
  - `owner_user_id`, `persona_id`, `campaign_id` — 필터링 컨텍스트
  - `signature_hash` — 내용 변경 감지 (중복 임베딩 방지)
- **GraphEdge** — 노드 간 관계를 표현하는 방향성 간선
  - `edge_type` — produces, published_as, related_trend, comment_on, watches_publication, belongs_to, collaborates_with
  - `weight` — 관계의 가중치 (검색 시 우선순위 결정)
  - 그래프 확장(expansion) 시 우선순위: produces > published_as > comment_on > related_trend > watches_publication
- **GraphChunk** — 긴 본문을 350~400 토큰 단위로 분할한 청크
  - `chunk_index` — 청크 순서
  - `body_text` — 청크 본문
  - `embedding` — 청크별 벡터 임베딩
  - 검색 결과에서 상위 2개 청크만 반환하여 컨텍스트 효율화
- **검색 파이프라인** (검색 시 추가 LLM 호출 없음)
  1. **쿼리 정규화** — 소문자/공백 정리, `persona:`, `campaign:` 프리픽스 파싱
  2. **임베딩 생성** — `embed_texts` 호출, Redis 60초 TTL 캐시
  3. **벡터 검색** — pgvector 코사인 유사도로 1차 후보 40개 추출
  4. **그래프 확장** — 선택된 노드의 이웃 노드를 edge_type 우선순위로 탐색
  5. **점수 보정** — 최신성(`updated_at`), node_type 선호도, 사용자 피드백 반영
  6. **중복 제거** — 동일 source_table/source_id는 최고 점수만 유지
  7. **컨텍스트 조립** — summary + 상위 2개 chunk + meta를 번들로 반환
- **Celery 사이드카 동기화** — `graph_rag` 전용 큐
  - Beat 스케줄: Draft/Variant 30초, Trend 5분, 기타 2분 주기
  - Watchers: `watch_personas`, `watch_campaigns`, `watch_drafts`, `watch_trends`, `watch_publications`, `watch_insights`, `watch_reaction_rules`
  - Canonicalizer: 각 도메인 데이터를 `CanonicalPayload`로 정규화 (요약은 규칙 기반, LLM 호출 없음)
  - Chunker: 본문을 350~400 토큰 단위로 분할
  - Graph Syncer: GraphNode/Chunk/Edge를 멱등 upsert (signature_hash로 중복 방지)
  - Edge Builder: 외래키 및 비즈니스 규칙으로 간선 자동 생성
- **BFF API**
  - `POST /api/orchestrator/bff/rag/search` — 쿼리 기반 벡터 검색
  - `GET /api/orchestrator/bff/rag/nodes/{node_id}/neighbors` — 노드 이웃 확장
- **모니터링**
  - Prometheus 메트릭: `rag_nodes_processed_total`, `rag_embeddings_failures_total`, `rag_watch_duration_seconds`
  - Slack 알람: `graph_rag` 큐 실패 시 webhook 전송
- **의미**: 단순 벡터 검색을 넘어 **도메인 간 관계를 그래프로 탐색**하여 더 풍부한 컨텍스트 제공
  - 예: "Trend X와 관련된 Draft는?" → Trend 노드 검색 → related_trend 간선으로 Draft/Publication 자동 탐색
  - 예: "Campaign Y의 모든 게시물과 댓글" → Campaign 노드 → belongs_to → Publication → comment_on → InsightComment
- **Graph Copilot & SSE**
  - `apps/backend/src/orchestrator/flows/graph_rag/graph_rag.py`의 `graph_rag.suggest*` 플로우가 Trend/Draft/Playbook/Persona 카드를 만들어 `/api/orchestrator/graph-rag/suggest` 및 `/api/sse/graph-rag/suggestions/stream`으로 제공
  - 각 카드에는 실행 가능한 operator key + `flow_path` + payload가 포함되어 Copilot UI에서 그대로 실행 가능
  - ROI(`RagValueInsight`)를 항상 포함하도록 하여 BFF와 동일한 인사이트 블럭을 전달
- **실시간 새로고침**
  - 사이드카 Canonicalizer가 `sync_payload` 이후 `publish_graph_rag_refresh(GraphRagRefreshEvent)`를 호출하여 그래프가 갱신되면 즉시 SSE가 새 데이터를 스트리밍
  - SSE 라우터는 요청마다 새로운 AsyncSession을 생성/정리하여 커넥션 누수 없이 장시간 스트림을 유지

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
  - ✅ **Instagram** — 완전 구현 (Meta Graph API v23.0)
    - **게시글 업로드**: 이미지/비디오/캐러셀 게시물 자동 업로드
    - **댓글 자동 달기**: 게시물에 댓글 생성 및 대댓글 지원 (페르소나 정책 자동 적용)
    - **인사이트 추적**: 도달 범위, 좋아요, 댓글, 저장, 공유, 조회수 등 실시간 메트릭 수집
    - **댓글 자동 답변**: 게시물 댓글에 대한 자동 답글 기능 (템플릿 품질 페르소나 보장)
    - **DM 자동 보내기**: 댓글 작성자에게 private reply (DM) 자동 전송 (링크 변환, 금칙어 필터링)

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
- **템플릿 품질 보장**: 템플릿이 잘못되었어도 **페르소나가 항상 내용 보정** (link_policy, banned_words, extras 자동 적용)
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

### ✅ **Graph RAG (그래프 기반 검색 증강 생성)**
- **벡터 검색 + 그래프 탐색** — pgvector 코사인 유사도 검색 후 GraphEdge로 이웃 노드 확장
- **통합 지식 그래프** — Persona, Campaign, Draft, Publication, Trend, Comment, Rule을 단일 그래프로 연결
- **Celery 사이드카** — 주기적으로 domain 테이블 스캔 → CanonicalPayload 정규화 → 임베딩 생성 → GraphNode/Chunk/Edge 동기화
- **실시간 관계 업데이트** — Playbook/Draft 로그의 트렌드 스냅샷을 해석해 `trend_reference`, `trend_of` 엣지를 자동 생성하여 “이 판단이 어떤 트렌드를 재사용했는지”가 그래프에 즉시 반영
- **멱등 동기화** — `signature_hash`로 중복 임베딩 방지, 변경된 내용만 재처리
- **관계 우선순위** — edge_type별 가중치로 중요한 관계 우선 탐색 (produces > published_as > comment_on > related_trend)
- **LLM 호출 없음** — 검색 시 추가 요약/생성 없이 **저장된 요약/메트릭을 그대로 활용**하여 지연 최소화
- **Redis 캐싱** — 쿼리 임베딩 60초 TTL, 컨텍스트 번들 30~120초 TTL
- **Prometheus 메트릭** — `rag_nodes_processed_total`, `rag_watch_duration_seconds`로 사이드카 상태 모니터링
- **의미**: 단순 트렌드 검색을 넘어 **"Persona X가 Campaign Y에서 Trend Z를 기반으로 작성한 Draft와 그 성과"를 그래프 관계로 추적**
- **"기억하는 자동화"의 핵심** — 과거 판단의 맥락(페르소나, 캠페인, 트렌드, 성과)을 그래프로 기억하고 검색

> 현재 사이드카 파이프라인은 모든 Playbook/Draft 갱신을 감지해 수십 초 내에 임베딩과 엣지를 재계산합니다. 따라서 “그래프 RAG 시스템과 사이드카가 정상 작동한다”는 것은 단순 슬로건이 아니라, 실제로 신규 판단/트렌드가 기록되자마자 그래프 검색에서 즉시 노출되고 있음을 의미합니다.

#### 사용자 플로우 (BFF RAG 엔드포인트)
- `POST /rag/search` — **기본 그래프 검색**. 자연어 질의 + persona/campaign 필터로 그래프상의 노드를 찾고, 연관 엣지 정보를 모두 전달합니다. 프런트에서 임의 조합을 만들고 싶을 때 사용.
- `POST /rag/search/quickstart` — **온보딩/Quickstart 루프**. 트렌드 노드와 그 주변 판단을 우선적으로 정렬해 “지금 당장 실행할 카드” 형태로 반환합니다. Chat Quickstart 타일이 이 엔드포인트를 호출합니다.
- `POST /rag/search/memory` — **Reapply Memory**. `trend_reference`, `memory_reapplied` 엣지를 기반으로 과거 성공 판단만 추려 `memory_highlights` 섹션에 담아 줍니다. PersonaContext 패널의 “기억 재사용” CTA가 호출합니다.
- `POST /rag/search/next-action` — **Next Action Proposal**. 그래프에 저장된 트렌드/행동 엣지를 CTA 형태로 가공하여 `next_actions` 배열로 돌려줍니다. 타임라인과 Chat CTA 버튼이 그대로 실행할 DSL을 얻을 때 사용합니다.

모든 플로우는 동일 오퍼레이터(`bff.rag.search`)를 공유하므로, 프런트는 목적에 맞는 엔드포인트를 선택하기만 하면 되고 응답 스키마(quickstart/memory_highlights/next_actions/roi)가 일관되게 유지됩니다.

### ✅ **BFF (Backend For Frontend)**
- 프론트엔드 요구사항에 특화된 API 설계
- 카드 기반 응답 포맷
- OpenAPI 스펙 자동 생성 → 프론트엔드 타입/훅 자동 동기화
- `GET /bff/me/links` — 내 모든 트래킹 링크를 페이지네이션 + URL/게시글 검색으로 조회 (persona, draft, 방문수 포함)

### ✅ **Event-Driven 워커**
- Celery 큐를 통해 CoWorker/Sniffer/Synchro 독립 실행
- 각 워커는 자율적으로 판단하고 실행
- 인간의 승인을 기다리지 않고 초안 제안 가능

### ✅ **Flow Chaining + Adaptive Scoring (플로우 체이닝 + 적응형 점수화)**
- **어댑팅 보너스 점수 (ADAPTER_BONUS = 0.2)**: 이전 플로우와 현재 플로우가 어댑터로 연결될 수 있으면 자동으로 0.2점 보너스 부여
- **자연스러운 플로우 연계**: "List all post publications" → "Search comments..."가 자연스럽게 연결되어 복합 명령어 처리
- **확장성 극대화**: 새로운 플로우를 추가할 때 기존 플로우와의 어댑터만 정의하면 즉시 체이닝 가능
- **DSL 실행의 효율성**: LLM은 판단/추론이 아닌 "적절한 글 생성"에만 충실 → 템플릿 품질 보장 및 페르소나 정책 자동 적용
- **예시**: 댓글 검색 결과가 템플릿 생성 플로우의 입력으로 자동 변환되어 "Search comments ... and create reaction message template" 명령어 처리

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
   - Adapter가 Threads/Instagram Graph API 호출 → 실제 게시
   - **Playbook에 완전한 기록**: 당시 트렌드, Campaign KPI, 페르소나 컨텍스트, LLM 입력/출력 모두 JSON 로그로 저장

### 🤖 CoWorker 자동 루틴 (AI의 독립적 판단 기록)
1. Celery Beat가 정기 스케줄 트리거
2. CoWorker가 `execute_due_schedules` 실행
3. 예약된 Draft 조회 → 자동 발행
4. 발행 결과를 Insight로 수집
5. **Playbook에 완전한 기록**: CoWorker의 판단 컨텍스트 (트렌드, KPI, 페르소나), 실행 결과, 성과 메트릭 모두 저장 → 다음 판단 근거로 활용

### ⚡ 자동화 규칙 실행 (Reactive) — **유즈케이스 중심**

#### 🎯 **유즈케이스 1: 키워드 기반 자동 응답 (1회 설정 → 영구 자동화)**
1. **룰 생성 및 템플릿 설정**
   - "Create reactive rule" → 키워드 매칭 규칙 생성 (정규식/포함/동일)
   - "Create reply template" → DM/Reply 템플릿 생성
   - 게시물에 규칙 연결 (ReactionRulePublication)

2. **매 5분마다 자동 실행**
   - Synchro 워커가 댓글 수집 (Adapter → InsightComment)
   - Reactive 엔진이 키워드 매칭 → 태그 생성 → 액션 실행
   - **결과**: DM 전송, 댓글 답장, Alert 생성 (Threads/Instagram 모두 지원)
   - **템플릿 품질 보장**: 템플릿 내용이 페르소나 정책에 따라 자동 보정 (링크 변환, 금칙어 필터링)
   - ReactionActionLog로 실행 결과 기록

#### 🎯 **유즈케이스 2: 댓글 기반 후속 콘텐츠 생성**
1. **캠페인 컨텍스트 수집**
   - "List all campaigns" → Campaign 목록 조회
   - Campaign 컨텍스트 주입 (Persona + 전략 정보)

2. **댓글 분석 및 콘텐츠 생성**
   - "List all post publications" → 발행된 게시물 목록
   - "List comments post_publication_id:9 and create a new draft" → 특정 게시물 댓글 조회 후 댓글 기반 새 Draft 생성
   - **결과**: LLM이 댓글 분석 → 관련 트렌드 검색 → 후속 콘텐츠 초안 생성

#### 🎯 **유즈케이스 3: 댓글 기반 자동 메시지 템플릿 생성 (Flow Chaining + Adapter)**
1. **게시물 목록 조회**
   - "List all post publications" → 발행된 게시물 목록 확인
   - 특정 게시물 ID 선택

2. **댓글 검색 및 템플릿 자동 생성**
   - "Search comments post_publication:1 q:*some comment* and create reaction message template" → 특정 게시물의 댓글들을 검색하여 자동으로 DM/Reply 메시지 템플릿 생성
   - **결과**: 댓글 내용 분석 → 페르소나 정책 적용 → 적절한 응답 템플릿 자동 생성 (DM용/댓글 답장용 분리)
   - **특징**: Flow Chaining을 통해 "댓글 검색" → "템플릿 생성"이 자연스럽게 연결되며, LLM은 템플릿 품질 보장만 담당

3. **템플릿 배포 및 자동화**
   - 생성된 템플릿을 Reactive Rule에 연결하여 영구 자동화
   - **결과**: 미래 댓글에 대한 자동 응답 체계 구축

#### 🎯 **유즈케이스 4: 링크 추적 KPI & CTR 확인**
1. **링크 발급 & 모니터링**
   - Draft/DM/댓글 생성 시 페르소나 링크 정책에 따라 모든 URL이 외부 링크로 자동 변환
2. **캠페인 KPI 반영**
   - 링크 클릭되는 것이 바로 DB에 저장, 캠페인 집계시 누적
   - CTR 정의가 있다면 `LINK_CLICKS / IMPRESSIONS`로 자동 산출 (플랫폼에서 제공하는 impression과 결합)
3. **인사이트 활용**
   - 내 링크들을 볼 수 있고, 어느 링크에서 방문자수가 폭발하고 현재 링크가 아무도 방문하지 않는 것인지도 확인 가능  
   - 따라서 같은 링크라도 어떤 게시글에서 방문자가 폭발적이었는지 확인 가능  

### 📊 메트릭 수집 (지속적 학습 데이터 축적)
1. Synchro 워커가 주기적으로 Adapter 호출
2. 플랫폼별 메트릭 API 쿼리 (likes, replies, views 등)
3. InsightSample 저장
4. Campaign KPIResult 업데이트
5. **Playbook에 완전한 스냅샷 기록**: persona_snapshot, kpi_snapshot, trend_snapshot, llm_context 등 모든 판단 근거를 JSON 로그로 저장

### 📈 KPI ↔ 트렌드 상관분석
1. **실시간 상관계수 계산**: 트렌드 랭킹 vs. 게시물 KPI (likes, comments, impressions, engagement_rate) 간 피어슨 상관계수 계산
2. **국가별 트렌드 효과성 분석**: US/EU 등 지역별 트렌드 활용도와 콘텐츠 성과 비교
3. **트렌드 랭킹 기반 성과 예측**: Google Trends Top 10 트렌드 기반 콘텐츠의 평균 참여율 분석
4. **시계열 상관분석**: 트렌드 검색량 피크와 게시물 참여율 피크의 시간적 동기화 분석
5. **대시보드 시각화**: 트렌드 랭킹 vs 참여율 산점도, 국가별 트렌드 효과성 히트맵, 트렌드-메트릭 시계열 차트

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
2. **판단의 복제** — 나와 CoWorker의 모든 행동을 완전하게 기록 (트렌드, KPI, 페르소나, LLM 컨텍스트)하여 브랜드 리듬을 기억하고 재현
3. **결정론적 실행** — DAG 기반 추적 가능한 액션 체인
4. **Graph RAG** — 벡터 검색 + 그래프 탐색으로 도메인 간 관계를 추적하여 풍부한 컨텍스트 제공 (Celery 사이드카 자동 동기화)
5. **기억하는 자동화** — Trends RAG로 유사 인사이트 기반 학습
6. **키워드 기반 자동화** — Reactive 엔진으로 댓글 자동 응답 (템플릿이 잘못되었어도 페르소나가 내용 보정)
7. **KPI ↔ 트렌드 상관분석** — 트렌드 랭킹 vs. 콘텐츠 성과 예측 모델링으로 최적 트렌드 선정
8. **Flow Chaining + Adaptive Scoring** — 어댑팅 보너스로 자연스러운 플로우 연계, LLM은 생성에만 충실하여 확장성과 효율성 극대화
9. **플랫폼 중립성** — Adapter 패턴으로 확장 가능한 구조
10. **프론트엔드 융화** — BFF + OpenAPI 자동 동기화로 타입 안전성 보장

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
- **총 모듈 개수:** 17+ (users, accounts, drafts, campaigns, playbooks, insights, scheduler, trends, adapters, abtests, injectors, mail, timeline, common, reactive, **rag**)
- **총 Worker 종류:** 5 (CoWorker, Sniffer, Synchro, Adapter, **RAG**)
- **지원 플랫폼:** Threads (완전), Instagram (완전)
- **데이터베이스 테이블:** 23+ (기존 20+ + **rag_nodes, rag_edges, rag_chunks**)
- **Celery 큐:** 6 (default, sniffer, synchro, adapter, coworker, **graph_rag**)
- **Graph RAG 구현:** 벡터 검색(pgvector) + 그래프 탐색 + 사이드카 동기화
- **Graph RAG 노드 타입:** 9종 (persona, campaign, playbook, draft, draft_variant, post_publication, trend, insight_comment, reaction_rule)
- **Graph RAG 간선 타입:** 7종 (produces, published_as, related_trend, comment_on, watches_publication, belongs_to, collaborates_with)

---

> **"나와 CoWorker의 모든 행동은 기록됩니다. 트렌드가 무엇이었는지, Campaign KPI들은 어땠는지, 페르소나는 무엇을 썼는지 — 이 루프는 끊임없이 당신의 판단을 복제하고 정제합니다."**
