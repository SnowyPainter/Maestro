# 백엔드 개발 지침 (Backend Development Guide)

## 개요

AI 기반 콘텐츠 오케스트레이션 시스템의 백엔드 개발을 위한 종합 지침서입니다. 시스템 아키텍처, 기술 스택, 개발 원칙, 그리고 구현 가이드라인을 포함합니다.

---

## 1. 시스템 아키텍처 원칙

### 1.1 핵심 설계 원칙

#### LLM 사용 시점 제한
- **LLM 활용 범위**: 지침/콘텐츠 생성 (Generator 단계)에서만 사용
- **제외 영역**: 플래닝, 실행, 검증/승인/롤백은 결정론적 처리
- **이유**: 안정성, 비용 절감, 재현성, 안전성 확보

#### 단일 쓰기 창구 (SSOT)
- **Orchestrator API**: 모든 상태 변경의 유일한 진입점
- **내부 이벤트**: `/internal/events/*` 엔드포인트를 통한 상태 반영
- **멱등성**: `X-Idempotency-Key` 헤더로 중복 실행 방지

### 1.2 컴포넌트 구조

#### Service Layer
- **Orchestrator API**: 상태 변경 및 액션 처리의 단일 창구
- **BFF Layer**: 읽기 전용 데이터 제공

#### Logic Engines
- **Injector**: 플레이북/페르소나/스니퍼 충돌 규칙에 따른 지시사항 정리 로직
- **LLMInterface**: LLM 호출 인터페이스 (`ainvoke` 방식 사용)

#### Background Tasks
- **Generator**: `Injector` → `LLMInterface` → 지침 생성 워크플로우
- **Sniffer**: 외부 트렌드 데이터 수집 (Google Trends, Naver 등)
- **Synchro**: 개인화된 임베딩 엔진 (사용자별 → 계정별 메타데이터)
- **Adapter**: 플랫폼별 인터페이스 추상화 (게시/삭제/메트릭/데이터 전달) -> 플랫폼별 컴파일러
- **CoWorker**: 이메일 루프 및 알림, Adapter를 이용한 작업 등 "Off the Screen", 발행 스케쥴링

---

## 2. 기술 스택

### 2.1 백엔드 스택

| 컴포넌트 | 기술 | 용도 |
|----------|------|------|
| **API Framework** | FastAPI | Orchestrator + BFF |
| **ORM** | SQLAlchemy + Alembic | 데이터 모델링 + 마이그레이션 |
| **데이터베이스** | PostgreSQL | 메인 데이터 저장소 |
| **Task Queue** | Celery | 비동기 작업 처리 |
| **Message Broker** | Redis | Broker + Result Backend + Cache + 멱등성/레이트리밋 |
| **벡터 DB** | pgvector | 임베딩 저장 |

### 2.2 프론트엔드 스택

| 컴포넌트 | 기술 | 용도 |
|----------|------|------|
| **빌드 도구** | Vite | 번들링 |
| **프레임워크** | React + TypeScript | UI 개발 |
| **스타일링** | Tailwind CSS + shadcn/ui | 디자인 시스템 |
| **상태 관리** | TanStack Query | 서버 상태 관리 |
| **스키마 검증** | Zod | 타입 안전성 |

---

## 3. 개발 원칙

### 3.1 컨텍스트 전파 (Context Propagation)

#### 요구사항
- **추적 범위**: 사용자/계정, 엔드포인트, 액션, LLM 토큰/비용
- **전파 경로**: FastAPI → Celery → LLM → `/internal/events` 콜백
- **헤더 구조**: `X-Request-ID`, `X-Trace-Parent`, `X-Idempotency-Key`, `X-User-ID`, `X-Account-ID`

#### 구현 원칙
- FastAPI 미들웨어에서 컨텍스트 추출 및 설정
- Celery 태스크에서 컨텍스트 복원
- LLM 호출 시 컨텍스트 포함
- 내부 이벤트 발송 시 컨텍스트 전파

### 3.2 의도 분류 및 처리

#### Action Intent (행위 지시)
- **키워드 매핑**: "발행해줘" → `publish`, "예약해" → `schedule`, "삭제해" → `delete`, "수정해" → `edit`
- **처리 방식**: 형태소 분석기(MeCab-ko, Kiwi, khaiii) + 사전 매칭

#### Guideline Intent (콘텐츠 지침)
- **LLM 필요**: 여기서는 결국 LLM 필요
- **라우팅 규칙**: "톤/스타일/해시태그/자연스러운 문장" 키워드 → `Generator(LLMInterface)`로 라우팅
- **기본 처리**: 나머지는 결정론적 액션으로 처리

#### Query Intent (정보 조회)
- **트리거 키워드**: "보여줘/어땠어/확인/리포트/조회"
- **처리 방식**: SQL 쿼리나 `Adapter.metrics` 호출로 매핑

#### Date/Time Parsing
- **Python 라이브러리**: `dateparser` (한국어 자연어 시간 파싱), `parsedatetime`
- **한국어 지원**: "2025년 9월 20일", "내일", "모레 오후 3시" 등 처리
- **확장 가능**: 사전 룰 추가 (예: "주말" → 토/일)

---

## 4. API 설계

### 4.1 Orchestrator API 엔드포인트

#### Public Actions (쓰기/행동)
- **POST /orchestrate**: 플래닝 (동기 LLM)
- **POST /actions/generate-brief**: 지시사항 생성 (비동기 트리거)
- **POST /actions/create-draft**: 드래프트 생성
- **POST /actions/create-schedule**: 스케줄 생성
- **PATCH /actions/update-schedule**: 스케줄 수정

#### Public Read (선택/BFF가 사용)
- **GET /sniffer/index**: 트렌드 데이터 조회
- **GET /posts/:id**: 게시글 조회
- **GET /campaigns/:id**: 캠페인 조회

#### Internal Events (워커/외부시스템 → 사실 신고)
- **POST /internal/events/brief-ready**: 지시사항 생성 완료 보고
- **POST /internal/events/publish-done**: 발행 완료/실패 보고
- **POST /internal/events/metrics**: 모니터링 윈도우 메트릭 보고
- **POST /internal/events/draft-from-email**: 이메일 회신→드래프트 생성 요청

### 4.2 BFF API (읽기 전용)
- **GET /bff/timeline**: 타임라인 조회
- **GET /bff/calendar**: 캘린더 조회
- **GET /bff/monitoring**: 모니터링 대시보드
- **GET /bff/trends**: 트렌드 데이터

---

## 5. 데이터 모델

### 5.1 핵심 엔티티

#### 사용자 및 계정
- **User**: 사용자 기본 정보
- **Account**: 플랫폼별 계정 정보 (Threads, Instagram 등)

#### 콘텐츠 생성 파이프라인
- **Campaign**: 캠페인 정보
- **Playbook**: Persona x Campaign 단위 브랜드 인텔리전스 캐시 (자동 생성)
- **PlaybookLog**: Playbook에 누적되는 이벤트 로그 (LLM 입출력, KPI, A/B 테스트 기록)
- **ABTest**: 변주 비교 실험 기록 (승자/효과, Playbook 로그와 연동)
- **Draft**: 드래프트 (초안, 완료, 발행 상태)
- **Schedule**: 스케줄 (예약됨, 발행됨, 실패, 취소 상태)

### 5.2 컨텍스트 추적
- **RequestContext**: 요청별 컨텍스트 정보 (request_id, trace_parent, user_id, account_id, endpoint, action, llm_tokens_used, llm_cost)

### 5.3 Playbook & A/B Test 도메인 모듈
- **모듈 경로**
  - Playbook: `apps/backend/src/modules/playbooks/` (schema/model/service)
  - A/B Test: `apps/backend/src/modules/abtests/` (schema/model/service)
- **주요 서비스 함수**
  - `ensure_playbook` / `record_event`: 이벤트 기반으로 Playbook 생성 및 로그 축적
  - `list_logs`: 최근 PlaybookLog 조회하여 인사이트 스트림 확보
  - `create_abtest` / `complete_abtest`: 실험 생성·종료 및 Playbook에 승자/인사이트 기록
- **데이터 연계**
  - A/B 테스트 종료 시 `record_abtest_completion`을 통해 PlaybookLog에 자동 반영
  - CoWorker LLM 태스크는 Playbook의 집계 정보와 최근 로그를 프롬프트 컨텍스트에 포함

---

## 6. Celery 워커

### 6.1 Generator 워커
- **역할**: `Injector` → `LLMInterface` → 지침 생성
- **워크플로우**: 지시사항 구성 → LLM 호출 → 내부 이벤트 발송
- **재시도 로직**: 최대 3회 재시도, 지수 백오프

### 6.2 CoWorker 워커
- **역할**: Sniffer/Adapter/Generator 활용 이메일, 알림, 모니터링, 등 다른 워커를 이용한 다양한 작업
- **워크플로우**: 사용자가 일하지 않아도 스스로 일하는 로직중심, 시간적으로 free
- **텍스트 생성 태스크**
  - `generate_contextual_text`: 단일 프롬프트 입력을 Persona/Campaign/Playbook 컨텍스트와 결합해 카피 생성 (`PromptKey.COWORKER_CONTEXTUAL_WRITE`)
  - Celery include: `apps.backend.src.workers.CoWorker.generate_texts`
  - Helper API: `POST /helpers/coworker/generate-text` (동기 호출 시 Celery 태스크 대기)

### 6.3 기타 워커
- **Sniffer**: 상시 작동, 외부 트렌드 데이터 수집
- **Synchro**: 개인화 임베딩 엔진

---

## 7. 보안 및 인증

### 7.1 인증 전략
- **JWT 토큰**: 사용자 인증
- **HMAC 서명**: 내부 서비스 간 인증
- **서비스 토큰**: 내부 이벤트 인증

### 7.2 데이터 보안
- **암호화**: 플랫폼 인증 정보 암호화 저장
- **환경 변수**: 민감한 정보 환경 변수로 관리

---

## 8. 모니터링 및 로깅

### 8.1 구조화된 로깅
- **요청 컨텍스트**: request_id, user_id, endpoint, action 추적
- **LLM 사용량**: 토큰 사용량, 비용 추적
- **성능 메트릭**: 응답 시간, 처리량 모니터링

### 8.2 메트릭 수집
- **API 메트릭**: 요청 수, 응답 시간, 에러율
- **LLM 메트릭**: 토큰 사용량, 비용, 모델별 사용량
- **비즈니스 메트릭**: 캠페인 성과, 사용자 활동

---

## 9. 테스트 전략

### 9.1 단위 테스트
- **API 엔드포인트**: 요청/응답 검증
- **비즈니스 로직**: 의도 분류, 데이터 처리
- **워커 태스크**: Celery 태스크 동작 검증

### 9.2 통합 테스트
- **End-to-End 플로우**: 사용자 요청부터 완료까지
- **컨텍스트 전파**: 요청 추적 검증
- **이벤트 처리**: 내부 이벤트 흐름 검증

---

## 10. 배포 및 운영

### 10.1 컨테이너화
- **Docker**: 애플리케이션 컨테이너화
- **Docker Compose**: 로컬 개발 환경
- **환경 변수**: 설정 관리

### 10.2 운영 환경
- **데이터베이스**: PostgreSQL 클러스터
- **캐시**: Redis 클러스터
- **모니터링**: Prometheus + Grafana
- **로깅**: ELK Stack 또는 유사 솔루션

---

## 11. 성능 최적화

### 11.1 데이터베이스 최적화
- **인덱스**: 자주 조회되는 컬럼에 인덱스 설정
- **쿼리 최적화**: N+1 문제 해결, 적절한 JOIN 사용
- **연결 풀**: 데이터베이스 연결 풀 설정

### 11.2 캐싱 전략
- **Redis 캐싱**: 자주 조회되는 데이터 캐싱
- **메모리 캐싱**: 사용자 설정 등 정적 데이터
- **CDN**: 정적 리소스 캐싱

---

## 12. 에러 처리

### 12.1 예외 계층 구조
- **ValidationError**: 입력 검증 오류
- **BusinessLogicError**: 비즈니스 로직 오류
- **ExternalServiceError**: 외부 서비스 오류

### 12.2 재시도 및 회로 차단기
- **재시도 로직**: 지수 백오프를 통한 재시도
- **회로 차단기**: 외부 서비스 장애 시 대응
- **타임아웃**: 적절한 타임아웃 설정

---

## 13. 핵심 원칙 요약

### 13.1 아키텍처 원칙
1. **LLM 사용 제한**: 창의적 콘텐츠 생성에만 활용
2. **단일 쓰기 창구**: Orchestrator API를 통한 모든 상태 변경
3. **컨텍스트 전파**: 요청부터 완료까지의 완전한 추적
4. **결정론적 처리**: 플래닝, 실행, 검증은 규칙 기반
5. **안전한 아키텍처**: 멱등성, 재시도, 회로 차단기 적용

### 13.2 개발 원칙
1. **안정성**: 예측 가능한 동작 보장
2. **비용 효율성**: LLM 사용 최소화
3. **재현성**: 같은 입력에 대한 일관된 결과
4. **안전성**: 사이드 이펙트 최소화
5. **확장성**: 모듈화된 구조로 확장 용이
