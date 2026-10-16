from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def enable_sqlite_foreign_keys(engine: Engine) -> None:
    """SQLite ignores foreign keys unless asked; turn them on so local runs behave like Postgres."""

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def configure_db(url: str) -> Engine:
    global _engine, _session_factory
    is_sqlite = url.startswith("sqlite")
    in_memory = url in ("sqlite://", "sqlite:///:memory:")
    _engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        poolclass=StaticPool if in_memory else None,  # one shared connection, or each would get its own empty DB
        pool_pre_ping=not in_memory,
    )
    if is_sqlite:
        enable_sqlite_foreign_keys(_engine)
    _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def init_db() -> None:
    from app import models  # noqa: F401  (registers tables on Base.metadata)
    from app.migrations import upgrade_schema

    assert _engine is not None, "configure_db() must run first"
    Base.metadata.create_all(_engine)  # new tables only
    upgrade_schema(_engine)  # new columns/indexes on tables that already existed


def get_db() -> Iterator[Session]:
    assert _session_factory is not None, "configure_db() must run first"
    session = _session_factory()
    try:
        yield session
    finally:
        session.close()
