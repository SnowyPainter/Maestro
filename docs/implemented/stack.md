# 기술 스택

## 핵심 철학
> "당신의 판단을 복제하는 중입니다"

Maestro는 단순한 자동화 툴이 아닌, **당신의 판단과 행동을 하나의 시스템으로 연결하는 엔진**입니다.
프론트엔드와 백엔드는 분리되지 않고 **하나의 오케스트레이션 시스템**으로 융화되어 있습니다.

---

## 백엔드

### 🔹 Core Framework
- **Python 3.10+**
- **FastAPI 0.115+** — 비동기 API 서버
- **Uvicorn** — ASGI 서버
- **Pydantic 2.8+** — 타입 안전성과 데이터 검증

### 🔹 데이터베이스 & 저장소
- **PostgreSQL 16** (with `pgvector` extension) — 메인 데이터베이스 + 벡터 검색
- **SQLAlchemy 2.0+** — ORM
- **Alembic 1.13+** — 데이터베이스 마이그레이션
- **MinIO** — 오브젝트 스토리지 (S3 호환)

### 🔹 비동기 작업 처리 (CoWorker/Sniffer/Synchro/Adapter/RAG)
- **Celery 5.4+** with Redis — 분산 작업 큐
- **Redis 5.0+** — 메시지 브로커 및 캐시
- **Celery Beat** — 주기적 작업 스케줄러 (Graph RAG 사이드카 동기화)

### 🔹 AI & 임베딩
- **Text Embeddings Inference (TEI)** — Hugging Face의 `intfloat/multilingual-e5-base` 모델 (CPU)
- **벡터 임베딩** — 768차원 벡터 (설정: `EMBED_DIM=768`, `EMBED_NORMALIZE=true`)
- **pgvector 0.7.0+** — PostgreSQL 벡터 확장으로 코사인 유사도 검색
  - Trends 데이터 벡터 검색 (단순 RAG)
  - **Graph RAG** — `rag_nodes`, `rag_chunks` 테이블에 벡터 저장 후 그래프 탐색

### 🔹 인증 & 보안
- **passlib[bcrypt]** — 비밀번호 해싱
- **python-jose[cryptography]** — JWT 토큰 기반 인증
- HTTPBearer 스키마

### 🔹 외부 API 연동
- **httpx** — 비동기 HTTP 클라이언트
- **Threads (Meta Graph API)** 완전 구현 ✅
- Instagram 어댑터 (Placeholder — 구조만 준비됨)

---

## 프론트엔드

### 🔹 Core Framework
- **React 19.1+** — UI 라이브러리
- **TypeScript 5.8+** — 타입 안전성
- **Vite 7.1+** — 빌드 도구 및 개발 서버
- **React Router DOM 7.9+** — 클라이언트 사이드 라우팅

### 🔹 상태 관리 & 데이터 페칭
- **Zustand 5.0+** — 경량 상태 관리
- **TanStack React Query 5.87+** — 서버 상태 관리 및 캐싱

### 🔹 UI 컴포넌트 & 스타일링
- **Radix UI** — 접근성 높은 headless 컴포넌트
  - Dialog, Dropdown, Popover, Tabs, Slider, Switch, Tooltip, Accordion 등
- **Tailwind CSS 4.1+** — 유틸리티 우선 CSS
- **Framer Motion 12.23+** — 애니메이션
- **Lucide React** — 아이콘
- **next-themes** — 다크모드 지원
- **Sonner** — 토스트 알림

### 🔹 폼 & 입력
- **React Hook Form 7.62+** — 폼 상태 관리
- **@hookform/resolvers** — Zod 통합
- **Lexical 0.35+** — 리치 텍스트 에디터 (Markdown 지원)

### 🔹 드래그 앤 드롭
- **@dnd-kit** — 접근성 우선 드래그 앤 드롭 (Sortable 지원)

### 🔹 API 코드 생성
- **Orval** — OpenAPI 스펙에서 자동으로 React Query hooks 생성
- **openapi-typescript** — TypeScript 타입 자동 생성
- 백엔드의 `contracts/openapi.yaml`을 실시간 감지하여 프론트엔드 API 클라이언트 자동 동기화

### 🔹 국제화
- **i18next** — 다국어 지원
- **react-i18next** — React 바인딩

---

## 인프라 & DevOps

### 🔹 컨테이너화
- **Docker Compose** — 로컬 개발 환경
  - PostgreSQL 16 (pgvector 0.7.0+)
  - MinIO (오브젝트 스토리지)
  - Text Embeddings Inference (TEI) — `intfloat/multilingual-e5-base`
  - Redis (Celery 브로커 + 캐시)
  - **Prometheus** — 메트릭 수집 (Graph RAG 사이드카 모니터링)

### 🔹 개발 워크플로우
- **Concurrently** — 여러 프로세스 동시 실행 (API + Frontend + Celery)
- **pnpm** — 패키지 매니저 (모노레포 워크스페이스)
- **ESLint** — 코드 린팅
- **Chokidar** — 파일 감지 (OpenAPI 스펙 변경 시 자동 재생성)

### 🔹 배포
- TBD (현재 로컬 개발 환경 기준)

---

## 지원 플랫폼

### ✅ 완전 구현
- **Threads** (Meta)
  - 게시 (텍스트, 이미지)
  - 삭제
  - 메트릭 수집 (likes, replies, reposts, quotes)
  - 댓글 생성/삭제/조회
  - Graph API v1.0 기반

### 🟡 Placeholder (구조만 준비)
- **Instagram** — 어댑터 인터페이스 구현됨, 실제 API 연동 미구현

---

## 아키텍처 특징

### 🎯 결정론적 오케스트레이션
- **DAG Executor** — 모든 행동을 추적 가능하고 재현 가능하게 실행
- **Idempotent Action Cards** — 같은 입력은 같은 결과 보장
- **Slot-based DSL** — 사용자 의도를 구조화된 액션으로 변환

### 🧠 기억하는 자동화
- **Persona** — 브랜드의 목소리와 금칙어 기억
- **Playbook** — 과거 행동과 결과를 JSON 로그로 학습
- **Trends RAG** — 벡터 검색으로 유사 트렌드 기반 인사이트 검색
- **Graph RAG** — 도메인 간 관계를 그래프로 연결하여 "Persona → Campaign → Draft → Publication → Comment" 경로 추적
  - `rag_nodes` (9종 노드), `rag_edges` (7종 간선), `rag_chunks` (본문 청크)
  - Celery 사이드카가 주기적으로 domain 테이블 스캔 → 자동 동기화
  - 벡터 검색 + 그래프 확장으로 풍부한 컨텍스트 제공
- **CoWorker** — 정해진 루틴을 자동 실행 (Celery 기반)

### 🔄 실시간 동기화
- **2단계 게시 플로우** — Draft 생성 → Schedule 설정 → 정시 자동 발행
- **OpenAPI 자동 동기화** — 백엔드 스펙 변경 시 프론트엔드 타입/훅 자동 생성

### 🎨 채팅 기반 UI
- **카드 기반 인터페이스** — 각 응답이 독립된 액션 카드로 렌더링
- **Multi-source Timeline** — 여러 계정의 게시물을 통합 뷰로 관리
- **Ctrl + K** — 어디서든 Maestro 호출 (Context-aware 입력)

---

## 핵심 가치 (코드에 입각)

1. **2단계 게시 플로우** — "Get trends and create draft" → Schedule → 정시 자동 발행
2. **판단의 복제** — Persona와 Playbook이 당신의 브랜드 톤과 판단 패턴을 기억하고 재현
3. **결정론적 실행** — 모든 액션은 추적 가능하고 재현 가능한 DAG 기반 실행
4. **Graph RAG** — 벡터 검색 + 그래프 탐색으로 도메인 간 관계를 추적하여 풍부한 컨텍스트 제공 (Celery 사이드카 자동 동기화)
5. **기억하는 자동화** — 단순 반복이 아닌, Trends 벡터 검색으로 유사 인사이트 기반 학습
6. **플랫폼 추상화** — Adapter 패턴으로 플랫폼별 차이를 흡수, 일관된 인터페이스 제공
7. **타입 안전 동기화** — OpenAPI 기반 자동 코드 생성으로 프론트/백엔드 계약 보장

---

> **"Maestro는 당신의 리듬을 대신 연주합니다."**

