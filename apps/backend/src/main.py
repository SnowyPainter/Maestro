from fastapi import FastAPI
from apps.backend.src.core.middleware import ContextMiddleware
from apps.backend.src.orchestrator.auth_router import router as auth_router
from apps.backend.src.bff.me_router import router as me_router
from apps.backend.src.core.config import settings
from apps.backend.src.core.db import engine, Base
import asyncio
from pathlib import Path

PRJ_RT = Path(__file__).parent.parent

app = FastAPI(title=settings.APP_NAME)

app.openapi_schema = None
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = app.openapi()
    schema["components"] = schema.get("components", {})
    schema["components"]["securitySchemes"] = {
        "HTTPBearer": {"type": "http", "scheme": "bearer"}
    }
    schema["security"] = [{"HTTPBearer": []}]
    app.openapi_schema = schema
    return app.openapi_schema
app.openapi = custom_openapi  # 보안 스키마 반영

# 미들웨어
app.add_middleware(ContextMiddleware)

# 라우터
app.include_router(auth_router)
app.include_router(me_router)

@app.on_event("startup")
async def dump_openapi():
    from fastapi.openapi.utils import get_openapi
    import yaml
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    import os
    os.makedirs(PRJ_RT / "contracts", exist_ok=True)
    with open(PRJ_RT / "contracts" / "openapi.yaml", "w", encoding="utf-8") as f:
        yaml.dump(schema, f, sort_keys=False, allow_unicode=True)

@app.get("/health")
async def health():
    return {"ok": True}

# 개발 편의: 최초 테이블 생성 (Alembic 도입 전 임시)
@app.on_event("startup")
async def on_startup():
    # Alembic 쓰기 전 빠른 부트스트랩용. 실제 운영은 반드시 Alembic 사용.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
