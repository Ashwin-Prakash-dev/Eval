from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration, sourced from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Hackathon Evaluation Platform"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api"

    # PostgreSQL is the target production database. A local sqlite file is accepted
    # for zero-infrastructure local development, since the ORM layer is dialect-agnostic.
    DATABASE_URL: str = "sqlite:///./dev.db"

    JWT_SECRET_KEY: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days - internal tool, long-lived sessions

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "ChangeMe123!"

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 300

    DEFAULT_DISAGREEMENT_THRESHOLD: float = 1.5

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
