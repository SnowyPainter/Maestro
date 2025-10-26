from fastapi import FastAPI, APIRouter
from apps.backend.src.core.middleware import ContextMiddleware

from apps.backend.src.orchestrator.flows.auth_router import router as orchestrator_auth_router
from apps.backend.src.orchestrator.bff_router import router as orchestrator_bff_router
from apps.backend.src.orchestrator.chat_router import router as orchestrator_chat_router
from apps.backend.src.orchestrator.action_router import router as orchestrator_action_router
from apps.backend.src.orchestrator.helper_router import router as orchestrator_helper_router
from apps.backend.src.orchestrator.internal_router import router as orchestrator_internal_router
from apps.backend.src.modules.files.file_router import router as file_router
from apps.backend.src.modules.files.public_router import router as public_media_router
from apps.backend.src.modules.scheduler.router import router as scheduler_stream_router
from apps.backend.src.core.logging import setup_logging

from apps.backend.src.core.config import settings
from apps.backend.src.core.db import engine, Base
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from apps.backend.src.modules.users.models import User
from apps.backend.src.modules.trends.models import Trend, NewsItem
from apps.backend.src.modules.campaigns.models import Campaign, CampaignKPIDef, CampaignKPIResult
from apps.backend.src.modules.accounts.models import PlatformAccount, Persona, PersonaAccount
from apps.backend.src.modules.drafts.models import Draft, DraftVariant, PostPublication
from apps.backend.src.modules.insights.models import InsightSample
from apps.backend.src.orchestrator.slot_mentions import generate_slot_mentions_yaml

PRJ_RT = Path(__file__).parent.parent

app = FastAPI(title=settings.APP_NAME)

# 공통 프리픽스(/api 혹은 /api/v1)
api = APIRouter(prefix="/api")  # 필요하면 "/api/v1"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:5173", "http://localhost:5173"],  # 개발 프론트 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ContextMiddleware)

# BFF 라우터(오케스트레이터 기반) 등록
api.include_router(orchestrator_bff_router, prefix="/bff")
# Scheduler SSE 라우터 등록
api.include_router(scheduler_stream_router, prefix="/sse")
# 파일 라우터 등록
api.include_router(file_router, prefix="/files")
# 퍼블릭 미디어 프록시 라우터 등록
api.include_router(public_media_router, prefix="/media")
# Action 라우터(오케스트레이터 기반) 등록
api.include_router(orchestrator_action_router, prefix="/orchestrator")
# Internal 라우터(오케스트레이터 기반) 등록 (절대로 하지마라잉!)
# api.include_router(orchestrator_internal_router, prefix="/orchestrator")

# Orchestrator 라우터 등록
api.include_router(orchestrator_auth_router, prefix="/orchestrator")
api.include_router(orchestrator_chat_router, prefix="/orchestrator")
api.include_router(orchestrator_helper_router, prefix="/orchestrator")

# 헬스체크도 api 아래로
@api.get("/health")
async def health():
    return {"ok": True}

@api.post("/admin/db/reset", include_in_schema=False)
async def reset_db():
    # 절대 프로덕션에서 열지 말 것. 내부 토큰 등으로 보호하거나 DEBUG에서만.
    async with engine.begin() as conn:
        """
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        """
        #await conn.execute(text("DROP TABLE IF EXISTS coworker_leases CASCADE"))
        #await conn.execute(text("DELETE FROM insight_comments"))

        # Clean up SKIPPED and FAILED reaction action logs
        await conn.execute(text("DELETE FROM reaction_action_logs WHERE id = 21"))

        await conn.run_sync(Base.metadata.create_all)

    return {"ok": True}

# 최종적으로 app에 붙이기
app.include_router(api)

def _deunionize_nullable(d):
    """anyOf/oneOf에 [string + null] 패턴이 나오면 nullable 표현으로 정규화"""
    if isinstance(d, dict):
        # anyOf/oneOf -> nullable
        for key in ("anyOf", "oneOf"):
            if key in d and isinstance(d[key], list):
                types = { (i.get("type") if isinstance(i, dict) else None): i
                          for i in d[key] if isinstance(i, dict) }
                if "string" in types and "null" in types:
                    str_schema = types["string"]
                    # maxLength 등 제약은 string 스키마의 것을 보존
                    for k, v in str_schema.items():
                        if k not in ("type",):
                            d[k] = v
                    d["type"] = "string"
                    d["nullable"] = True
                    d.pop(key, None)

        # 자식도 재귀 처리
        for k, v in list(d.items()):
            _deunionize_nullable(v)
    elif isinstance(d, list):
        for i in d:
            _deunionize_nullable(i)

# OpenAPI 보안 + 서버 경로 반영
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi
    schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version='3.1.0',
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "HTTPBearer": {"type": "http", "scheme": "bearer"}
    }
    schema["security"] = [{"HTTPBearer": []}]
    schema["servers"] = [{"url": "/api"}]

    _deunionize_nullable(schema)

    app.openapi_schema = schema
    return app.openapi_schema
app.openapi = custom_openapi

@app.on_event("startup")
async def dump_openapi():
    setup_logging(level=settings.LOG_LEVEL.upper())
    generate_slot_mentions_yaml()
    import yaml

    contracts_dir = Path(PRJ_RT) / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)

    # custom_openapi()가 캐시까지 채우도록 한 번 호출
    schema = app.openapi()

    # safe_dump 사용 + 키 순서 유지
    with (contracts_dir / "openapi.yaml").open("w", encoding="utf-8") as f:
        yaml.safe_dump(schema, f, sort_keys=False, allow_unicode=True)

    # 2) pgvector 확장 생성 -> 테이블 생성
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
