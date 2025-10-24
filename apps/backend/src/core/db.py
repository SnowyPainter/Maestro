from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings

class Base(DeclarativeBase):
    pass

# asyncpg 연결 풀 설정 개선
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # 연결 풀 설정
    pool_size=20,  # 기본 연결 수
    max_overflow=30,  # 최대 추가 연결 수
    pool_recycle=3600,  # 1시간 후 연결 재생성
    pool_pre_ping=True,  # 연결 사용 전 ping으로 유효성 확인
    # asyncpg 특정 설정
    connect_args={
        "command_timeout": 60,  # 명령 타임아웃 60초
        "server_settings": {
            "application_name": "maestro-backend",
        }
    }
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with SessionLocal() as session:
        yield session