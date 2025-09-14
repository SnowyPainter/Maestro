from pydantic_settings import BaseSettings
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../apps/backend
DB_FILE = BACKEND_DIR / "dev.db"                   # .../apps/backend/dev.db
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    APP_NAME: str = "Maestro Backend"
    ENV: str = "dev"
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DB_FILE.as_posix()}"
    JWT_SECRET: str = "change-me-in-env"
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    class Config:
        env_file = BACKEND_DIR / ".env"
        extra = "allow"  # Allow extra fields from environment variables

settings = Settings()