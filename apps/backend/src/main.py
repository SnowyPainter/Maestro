from fastapi import FastAPI, APIRouter
from apps.backend.src.core.middleware import ContextMiddleware
from apps.backend.src.orchestrator.auth_router import router as auth_router
from apps.backend.src.bff.me_router import router as me_router
from apps.backend.src.core.config import settings
from apps.backend.src.core.db import engine, Base
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

PRJ_RT = Path(__file__).parent.parent

app = FastAPI(title=settings.APP_NAME)

# 공통 프리픽스(/api 혹은 /api/v1)
api = APIRouter(prefix="/api")  # 필요하면 "/api/v1"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 개발 프론트 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi
    schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "HTTPBearer": {"type": "http", "scheme": "bearer"}
    }
    schema["security"] = [{"HTTPBearer": []}]
    schema["servers"] = [{"url": "/api"}]
    app.openapi_schema = schema
    return app.openapi_schema
app.openapi = custom_openapi

@app.on_event("startup")
async def dump_openapi():
    import yaml

    contracts_dir = Path(PRJ_RT) / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)

    # custom_openapi()가 캐시까지 채우도록 한 번 호출
    schema = app.openapi()

    # safe_dump 사용 + 키 순서 유지
    with (contracts_dir / "openapi.yaml").open("w", encoding="utf-8") as f:
        yaml.safe_dump(schema, f, sort_keys=False, allow_unicode=True)

# 임시 테이블 생성(알레믹 전용)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
