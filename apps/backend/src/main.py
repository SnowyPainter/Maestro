from fastapi import FastAPI, APIRouter
from apps.backend.src.core.middleware import ContextMiddleware
from apps.backend.src.orchestrator.auth_router import router as auth_router
from apps.backend.src.bff.me_router import router as me_router
from apps.backend.src.core.config import settings
from apps.backend.src.core.db import engine, Base
from pathlib import Path

PRJ_RT = Path(__file__).parent.parent

app = FastAPI(title=settings.APP_NAME)

# 공통 프리픽스(/api 혹은 /api/v1)
api = APIRouter(prefix="/api")  # 필요하면 "/api/v1"

# 미들웨어
app.add_middleware(ContextMiddleware)

# 라우터 묶기
api.include_router(auth_router)
api.include_router(me_router)

# 헬스체크도 api 아래로
@api.get("/health")
async def health():
    return {"ok": True}

# 최종적으로 app에 붙이기
app.include_router(api)

# OpenAPI 보안 + 서버 경로 반영
app.openapi_schema = None
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = app.openapi()
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "HTTPBearer": {"type": "http", "scheme": "bearer"}
    }
    schema["security"] = [{"HTTPBearer": []}]
    # basePath 대체: OpenAPI 3에서는 servers 사용
    schema["servers"] = [{"url": "/api"}]   # "/api/v1"이면 여기도 맞춰줘
    app.openapi_schema = schema
    return app.openapi_schema
app.openapi = custom_openapi

# OpenAPI 파일 덤프(프리픽스 반영됨)
@app.on_event("startup")
async def dump_openapi():
    from fastapi.openapi.utils import get_openapi
    import yaml, os
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    os.makedirs(PRJ_RT / "contracts", exist_ok=True)
    with open(PRJ_RT / "contracts" / "openapi.yaml", "w", encoding="utf-8") as f:
        yaml.dump(schema, f, sort_keys=False, allow_unicode=True)

# 임시 테이블 생성(알레믹 전용)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
