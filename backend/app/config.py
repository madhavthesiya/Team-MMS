from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_URL = f"sqlite:///{(REPO_ROOT / 'behindthemark.db').as_posix()}"


class Settings(BaseSettings):
    """All runtime settings. Read from environment variables or the repo-root .env file."""

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    database_url: str = DEFAULT_SQLITE_URL
    certainty_threshold: float = 0.7
    ai_timeout_seconds: float = 20.0
    rate_limit: str = "30/minute"
    frontend_dist: str = str(REPO_ROOT / "frontend" / "dist")

    @field_validator("database_url", mode="before")
    @classmethod
    def _default_when_blank(cls, value: str | None) -> str:
        return value or DEFAULT_SQLITE_URL

    @property
    def sqlalchemy_url(self) -> str:
        """Hosted Postgres URLs (Neon, Render) use the psycopg 3 driver."""
        for prefix in ("postgres://", "postgresql://"):
            if self.database_url.startswith(prefix):
                return "postgresql+psycopg://" + self.database_url[len(prefix):]
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
