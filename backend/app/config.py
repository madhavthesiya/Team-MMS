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
    gemini_api_keys: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    groq_api_key: str = ""
    groq_api_keys: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    database_url: str = DEFAULT_SQLITE_URL
    certainty_threshold: float = 0.7
    ai_timeout_seconds: float = 20.0  # max for any single model call
    ai_budget_seconds: float = 30.0  # max for all model calls in one request (frontend waits 45 s)
    rate_limit_public: str = "120/minute"  # per IP: create class, join (a class shares one Wi-Fi IP)
    rate_limit_student: str = "20/minute"  # per student token: answers and follow-up replies
    recheck_lasting_days: float = 7.0  # Riddle 4: a re-check this long after the first answer can show it lasted
    frontend_dist: str = str(REPO_ROOT / "frontend" / "dist")

    def get_gemini_keys(self) -> list[str]:
        keys = [k.strip() for k in self.gemini_api_keys.split(",") if k.strip()]
        if self.gemini_api_key and self.gemini_api_key not in keys:
            keys.insert(0, self.gemini_api_key)
        return keys

    def get_groq_keys(self) -> list[str]:
        keys = [k.strip() for k in self.groq_api_keys.split(",") if k.strip()]
        if self.groq_api_key and self.groq_api_key not in keys:
            keys.insert(0, self.groq_api_key)
        return keys

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
