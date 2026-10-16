from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import AppSettings, DbSession

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(db: DbSession, settings: AppSettings) -> dict:
    db.execute(text("SELECT 1"))
    configured = bool(settings.get_gemini_keys() or settings.get_groq_keys())
    return {
        "status": "ok",
        "db": "ok",
        "ai_configured": configured,
    }


