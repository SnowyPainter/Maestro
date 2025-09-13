```
maestro/
├─ apps/
│  ├─ backend/                 # FastAPI + Celery (API/도메인 SoT)
│  │  ├─ src/
│  │  │  ├─ core/              # 설정/보안/미들웨어 (요청 컨텍스트 전파 SoT)
│  │  │  ├─ modules/           # 도메인 모듈(User, Campaign, Brief, Draft, Schedule)
│  │  │  ├─ orchestrator/      # 액션 엔드포인트(단일 쓰기 창구 SoT)
│  │  │  ├─ bff/               # 읽기 전용 API(BFF SoT: Calendar/Timeline/Monitoring)
│  │  │  ├─ workers/           # Celery tasks (Generator/Scheduler/Sniffer/Synchro/CoWorker)
│  │  │  ├─ adapters/          # Threads/Instagram 등 외부 연동 어댑터 계약 SoT
│  │  │  └─ main.py
│  │  ├─ migrations/           # Alembic (DB 스키마 SoT)
│  │  ├─ contracts/
│  │  │  ├─ openapi.yaml       # API 스키마 SoT(프론트 타입 생성의 유일한 근원)
│  │  │  └─ events/            # 내부 이벤트 스키마(brief-ready/publish-done 등) SoT
│  │  ├─ tests/
│  │  └─ pyproject.toml
│  │
│  └─ frontend/                # React + TS (UI/상호작용 SoT)
│     ├─ src/
│     │  ├─ app/               # Router/Providers
│     │  ├─ pages/             # Chat/Timeline/Calendar/Monitoring/Settings
│     │  ├─ widgets/           # ChatStream/Calendar 등 큰 조립물
│     │  ├─ features/          # 행동 단위(mutations/forms/usecases)
│     │  ├─ entities/          # Draft/Brief/Schedule/Trend 카드·타입
│     │  ├─ components/        # 순수 UI (shadcn/ui 기반)
│     │  ├─ lib/
│     │  │  ├─ api/            # fetcher & generated types (OpenAPI → types/zod)
│     │  │  ├─ ws/             # SSE/WS
│     │  │  └─ schemas/        # 로컬 zod (자연어시간 등)
│     │  └─ styles/
│     ├─ public/
│     └─ package.json
│
├─ packages/
│  └─ shared/                  # 공용 패키지(선택) — DTO/유틸, i18n, 이벤트 타입
│     └─ package.json
│
├─ infra/
│  ├─ docker-compose.yml       # Postgres/Redis/Worker/Web 모두 로컬 실행
│  ├─ env/
│  │  ├─ backend.example.env
│  │  ├─ frontend.example.env
│  │  └─ postgres.example.env
│  └─ sql/
│     └─ init.sql              # 개발 초기 스키마/확장(pgvector 등)
│
├─ ops/
│  ├─ makefile                 # make up/down/db/migrate 등 단축키
│  ├─ scripts/                 # 초기화/데이터시드/코드젠 스크립트
│  └─ ci/                      # CI 파이프라인 템플릿
│
├─ docs/
│  ├─ ARCHITECTURE.md          # 의사결정 기록(ADR) + 컨텍스트 전파 설계
│  └─ GUIDES/                  # 개발 가이드(백/프론트, 이벤트, 멱등성 등)
│
├─ .tool-versions              # (선택) asdf/pyenv/node 버전 잠금
├─ README.md
└─ LICENSE

```