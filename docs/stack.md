# 기술 스택 (Technology Stack)

## 백엔드 (Backend)
- **API Framework**: FastAPI
  - **Orchestrator**: 상태 변경 및 액션 처리
  - **BFF (Backend for Frontend)**: 읽기 전용 데이터 제공
- **ORM**: SQLAlchemy + Alembic (마이그레이션)
- **데이터베이스**: PostgreSQL

## 비동기 처리 (Asynchronous Processing)
- **Task Queue**: Celery
- **Message Broker**: Redis
  - Broker + Result Backend + Cache + 멱등성/레이트리밋 공용 저장소
  - **초기 권장**: Redis 단일 솔루션 사용

## 임베딩/RAG (Embedding & Retrieval)
- **개인화 엔진**: Synchro
- **벡터 데이터베이스**: pgvector (또는 Qdrant)

## 프론트엔드 (Frontend)
- **빌드 도구**: Vite
- **프레임워크**: React + TypeScript
- **스타일링**: Tailwind CSS + shadcn/ui
- **상태 관리**: TanStack Query
- **스키마 검증**: Zod

### 디자인 시스템
- **디자인 토큰** + `@/components/ui/*` 프리미티브 강제 적용
- **목적**: AI 위임 시에도 일관성 유지