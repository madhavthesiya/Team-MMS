"""App factory. Run with: uvicorn app.main:create_app --factory"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.ai.client import build_ai_client
from app.api import auth, classes, health, responses, students
from app.config import Settings, get_settings
from app.db import configure_db, init_db
from app.rate_limit import RateLimiter
from app.services.errors import DomainError


def _mount_frontend(app: FastAPI, dist_dir: str) -> None:
    """Serve the built React app (if present) so the whole product is one URL."""
    dist = Path(dist_dir).resolve()
    index = dist / "index.html"
    if not index.is_file():
        return
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found.")
        candidate = (dist / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(dist):
            return FileResponse(candidate)
        return FileResponse(index)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_db(settings.sqlalchemy_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db()
        yield

    app = FastAPI(title="BehindTheMark API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.rate_limiters = {
        "public": RateLimiter.from_string(settings.rate_limit_public),
        "student": RateLimiter.from_string(settings.rate_limit_student),
    }
    app.state.ai_client = build_ai_client(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})

    for module in (health, classes, students, responses, auth):
        app.include_router(module.router)
    _mount_frontend(app, settings.frontend_dist)
    return app
