import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (registers tables)
from app.ai.client import get_ai_client
from app.config import Settings
from app.db import Base, enable_sqlite_foreign_keys, get_db
from app.main import create_app
from tests.fakes import FakeAIClient


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        gemini_api_key="",
        database_url="sqlite://",
        rate_limit_public="1000/minute",
        rate_limit_student="1000/minute",
        frontend_dist="__no_frontend__",
    )


@pytest.fixture
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    enable_sqlite_foreign_keys(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def fake_ai() -> FakeAIClient:
    return FakeAIClient()


@pytest.fixture
def make_client(engine, fake_ai):
    """Build a TestClient for given settings, wired to the test DB and the fake AI."""
    clients: list[TestClient] = []

    def build(settings: Settings) -> TestClient:
        app = create_app(settings)
        factory = sessionmaker(bind=engine, expire_on_commit=False)

        def override_db():
            session = factory()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_ai_client] = lambda: fake_ai
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    yield build
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client, settings) -> TestClient:
    return make_client(settings)
