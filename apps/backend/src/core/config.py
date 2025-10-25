from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings

# 프로젝트 루트 기준 경로 (apps/backend)
BACKEND_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    # ----- App -----
    APP_NAME: str = "Maestro Backend"
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    # ----- JWT -----
    JWT_SECRET: str = "change-me-in-env"
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24

    # ----- Redis / Celery -----
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    TIMEZONE: str = "Asia/Seoul"

    # ----- Postgres 구성 옵션 -----
    # 1) DATABASE_URL을 직접 주면 그대로 사용 (권장: async URL)
    # 2) 없으면 POSTGRES_* 값으로 async/sync URL 자동 생성
    DATABASE_URL: Optional[str] = None  # e.g. postgresql+asyncpg://user:pass@host:5432/db

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "maestro"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    EMBED_PROVIDER_URL: str = "http://localhost:8080/embeddings"  # TEI 등
    EMBED_DIM: int = 1024  # bge-m3=1024, e5/multilingual-base=768, MiniLM=384
    EMBED_NORMALIZE: bool = True

    # ----- Object storage / SeaweedFS -----
    SEAWEEDFS_ENDPOINT: str = "localhost:8333"
    SEAWEEDFS_ACCESS_KEY: str = "maestro"
    SEAWEEDFS_SECRET_KEY: str = "maestrosecret"
    SEAWEEDFS_REGION: Optional[str] = "us-east-1"
    SEAWEEDFS_SECURE: bool = False
    SEAWEEDFS_PUBLIC_ENDPOINT: Optional[str] = None
    SEAWEEDFS_BUCKET_TRENDS: str = "maestro-trends"
    SEAWEEDFS_BUCKET_DRAFT_MEDIA: str = "maestro-drafts-media"

    # 내부적으로 sync URL도 필요할 수 있음 (예: Alembic 마이그레이션)
    _ASYNC_DRIVER: str = "postgresql+asyncpg"
    _SYNC_DRIVER: str = "postgresql+psycopg2"

    TRENDS_COUNTRIES: str = "US,HK" #중국 시장은 없음. HK 홍콩
    TRENDS_INTERVAL_MINUTES: int = 60
    TRENDS_MAX_ITEMS: int = 20

    # ----- Mailer -----
    MAIL_HOST: str = "localhost"
    MAIL_PORT: int = 587
    MAIL_USER: str = "localhost"
    MAIL_PASSWORD: str = "localhost"
    MAIL_SENDER_NAME: str = "localhost"
    MAIL_SENDER_EMAIL: str = "localhost"
    INBOUND_EMAIL_SECRET: str = "s1cr3tzkqjz"
    MAIL_IMAP_HOST: str = "imap.naver.com"
    MAIL_IMAP_PORT: int = 993
    MAIL_IMAP_USER: str = ""
    MAIL_IMAP_PASSWORD: str = ""
    MAIL_IMAP_FOLDER: str = "INBOX"

    # ----- SNS -----
    TEST_DOMAIN: str = ""
    PRD_DOMAIN: Optional[str] = None
    THREADS_CLIENT_ID: str = ""
    THREADS_CLIENT_SECRET: str = ""

    # ----- LLM -----
    LLM_PRIMARY_MODEL: str = "gemini-2.0-flash-lite"
    GEMINI_API_KEY: Optional[str] = None
    COST_PER_1K_PROMPT: float = 0.03
    COST_PER_1K_COMPLETION: float = 0.06

    @model_validator(mode="after")
    def _fill_database_urls(self) -> "Settings":
        # DATABASE_URL이 주어지지 않았다면 POSTGRES_*로 async URL 생성
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"{self._ASYNC_DRIVER}://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self

    @computed_field  # type: ignore[misc]
    @property
    def SYNC_DATABASE_URL(self) -> str:
        """
        동기 드라이버 URL (Alembic 등에서 유용)
        """
        if self.DATABASE_URL and self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            # async → sync로 드라이버만 치환
            return self.DATABASE_URL.replace("postgresql+asyncpg", self._SYNC_DRIVER, 1)

        # 사용자가 다른 async 드라이버를 썼다면 POSTGRES_*로 안전하게 재조립
        return (
            f"{self._SYNC_DRIVER}://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[misc]
    @property
    def SEAWEEDFS_PUBLIC_BASE(self) -> str:
        base = self.SEAWEEDFS_PUBLIC_ENDPOINT
        if base:
            return base.rstrip("/")
        scheme = "https" if self.SEAWEEDFS_SECURE else "http"
        return f"{scheme}://{self.SEAWEEDFS_ENDPOINT}".rstrip("/")

    class Config:
        env_file = BACKEND_DIR / ".env"
        extra = "allow"  # 알 수 없는 환경변수도 허용

settings = Settings()
