# GEMINI.md (Frontend Rules)

## 1) 스코프

* 본 문서는 **프론트엔드(React + TS + Vite)** 구현 규칙만 다룸.
* **모든 타입·API 계약은 백엔드 스키마를 단일 근원(SSOT)** 으로 삼는다.

### 1.1 디렉토리 구조

frontend/                # React + TS (UI/상호작용 SoT)
│     ├─ src/
│     │  ├─ app/               # Router/Providers
│     │  ├─ pages/             # Chat/Timeline/Calendar/Monitoring/Settings
│     │  ├─ widgets/           # ChatStream/Calendar 등 큰 조립물
│     │  ├─ features/          # 행동 단위(mutations/forms/usecases)
│     │  ├─ entities/          # Draft/Brief/Schedule/Trend 카드
│     │  ├─ components/        # 순수 UI (shadcn/ui 기반)
│     │  ├─ lib/
│     │  │  ├─ api/            # fetcher & generated
│     │  │  ├─ schemas/        # zod 스키마
│     │  │  └─ types/          # types
│     │  └─ styles/
│     ├─ public/
│     └─ package.json

---

---

## 2) 모델 사용 원칙

### 2.1 API 모델 (서버 계약)

* 생성물:

  * `src/lib/api/generated.ts` (orval 등으로 생성된 API hooks/clients)
  * `src/lib/types/api.ts` (openapi-typescript로 생성된 타입)
  * `src/lib/schemas/api.zod.ts` (zod 스키마)

* **규칙**

  * ✅ 서버와 통신하는 모든 코드(요청/응답)는 **생성 타입**을 그대로 쓴다.
  * ✅ 응답을 바로 UI에 바인딩해도 되지만, 화면 전용 가공이 필요하면 **ViewModel**을 따로 만든다.
  * ⛔ **수동 DTO 정의 금지**(서버 계약을 복제·변형 금지).
  * ⛔ 생성 파일 수정 금지(편집 금지, 재생성으로만 반영).

### 2.2 ViewModel (화면 전용)

* 위치: `src/entities/**/model/` 또는 `src/features/**/model/`
* 목적: API 모델 → UI 표현/폼 상태로 **가볍게 투영**
  (예: 날짜 포맷, 선택 토글, 폼 디폴트 등)
* **규칙**

  * ✅ **얕은 매핑만** 허용(서버 계약 구조를 심하게 바꾸지 말 것).
  * ✅ 변환은 **순수 함수**로 작성(입출력 명확).
  * ⛔ ViewModel을 서버로 되돌려 보내지 말 것(서버 전송 전 반드시 API 모델로 역변환).

---

## 3) 네트워킹 & 상태

### 3.1 HTTP 클라이언트

* 베이스 URL: **`/api`** (`VITE_API_BASE`)
* 공통 헤더(자동 주입):
  `Authorization`, `X-Request-ID`, `X-Idempotency-Key(쓰기계열만)`, `X-User-ID`, `X-Account-ID`, `X-Trace-Parent`
* **규칙**

  * ✅ **생성된 훅/함수**를 통해 호출.
  * ⛔ 임의로 `fetch()` 직접 호출 금지(테스트/Mock 제외).
  * ⛔ 엔드포인트 하드코딩 금지(반드시 생성 클라이언트 사용).

### 3.2 서버 상태 관리

* 도구: **TanStack Query**
* **규칙**

  * ✅ 읽기: Query. 쓰기: Mutation(+ 적절한 `invalidateQueries`).
  * ⛔ **쓰기 요청에 낙관적 업데이트 금지**(오작동 리스크). 결과 이벤트/SERVER 응답으로 동기화.
  * ⛔ 글로벌 상태관리 툴(예: Redux) 도입 금지. 전역은 최소 `store/session.ts` 등 얇게만.

### 3.3 실시간 이벤트(SSE/WS)

* 소스: `/api/internal/events/*` (SSE 권장)
* **규칙**

  * ✅ `Last-Event-ID`를 보관·재전송(새로고침 시 이어받기).
  * ✅ 이벤트 타입에 따라 **Chat/Timeline/Calendar**로 **라우팅만** 수행.
  * ⛔ 이벤트를 **서버 진실(SSOT)** 로 오해하지 말 것(최종 스냅샷은 Read API가 책임).

---

## 4) UI/행동 규칙

### 4.1 결정론 vs. LLM

* **결정론(폼/버튼/토글)**: 플래닝·실행·검증·승인·롤백 → 전부 **명시적 UI 컨트롤**로 수행.
* **LLM(Generator 한정)**: 지침/콘텐츠 생성 카드에서만 호출 버튼 제공.
* **금지**

  * ⛔ LLM 호출로 플래닝/실행을 **대체**하거나 **자동 결정**하지 말 것.

### 4.2 접근성/스타일

* 스타일: Tailwind + shadcn/ui (미니멀, radius-2xl, 적절한 spacing)
* 접근성: 키보드 포커스·aria-label 필수.

---

## 5) 환경 & 코드 생성

### 5.1 환경 변수(예)

```
VITE_API_BASE=/api
OPENAPI_URL=/api/openapi.json
SSE_URL=/api/internal/events/stream
```

### 5.2 생성 스크립트

* `pnpm gen:api` → `src/lib/api/generated.ts`
* `pnpm gen:types` → `src/lib/types/api.ts`
* **규칙**

  * ✅ 스키마 변경 시 **반드시 재생성** 후 커밋.
  * ⛔ 생성물에 수작업 커밋 금지(변경 필요시 스키마 변경 → 재생성).

---

## 6) 에러/로깅/멱등성

* 401/403: 재로그인 유도, 토큰 리프레시 처리.
* 5xx(Read): 쿼리 자동 재시도(백오프). 5xx(Write): **재시도 금지**, 사용자가 **다시 시도** 버튼으로 수행.
* 멱등성: **쓰기 요청**은 `X-Idempotency-Key` 생성·표시 뱃지(복사 기능).

---

## 7) **절대 하지 말아야 할 것** (Never)

1. **OpenAPI 스키마를 프론트에서 재정의**(Zod로 재작성/수정)
2. **생성 파일을 직접 수정**하거나 수동 DTO 만들기
3. **엔드포인트 하드코딩 fetch**(생성 클라이언트 우회)
4. **LLM으로 실행/검증을 대체**(Generator 외 영역 자동화)
5. **쓰기요청 낙관적 업데이트** 및 **이벤트를 SSOT로 간주**
6. **전역 상태 남용**(Redux 도입, 거대 전역 Store)
7. **로컬스토리지를 진실원(SSOT)처럼 사용**(토큰/UI 프리퍼런스 외 금지)
8. **SSE Last-Event-ID 미관리**로 이벤트 유실 방치
9. **Idempotency Key 미사용**(중복 실행 위험)
10. \*\*타입 단언 남발(any/! 사용)\*\*로 생성 타입 무력화

---

## 8) **반드시 사용해야 할 것** (Must)

1. **OpenAPI 생성 타입/클라이언트**로 모든 HTTP 호출을 감쌀 것
2. **TanStack Query**로 서버 상태 관리(읽기=Query, 쓰기=Mutation)
3. **SSE Last-Event-ID** 보관/재전송
4. **결정론적 UI 컨트롤**로 실행/검증/승인/롤백 처리
5. **LLM 호출은 지침/콘텐츠 카드 한정**, 프롬프트 미리보기 제공
6. **에러 사용자 피드백**(토스트/배너) 및 401 처리 플로우
7. **Idempotency Key** 생성·표시(쓰기요청)

---

## 9) 파일 위치 규약(요지)

* API 생성물: `src/lib/api/generated.ts`, `src/lib/types/api.ts`
* HTTP 설정: `src/lib/api/client.ts`, `src/lib/api/interceptors.ts`
* SSE: `src/lib/ws/sse.ts`
* 화면 전용 스키마: `src/lib/schemas/**`
* 엔티티: `src/entities/{draft,brief,schedule,trend}/(ui|model)`
* 기능(폼/뮤테이션): `src/features/**`