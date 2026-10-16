"""Data-preserving schema upgrades, run at startup after create_all().

create_all() creates missing tables but never changes existing ones, so a database created by an
earlier version would lack newer columns. Each step here is idempotent and only ADDs things
(columns with safe defaults, indexes); nothing is dropped or rewritten, so classroom data survives.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)

# (table, column, DDL type + default). Booleans/text get NOT NULL defaults so old rows stay valid.
ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("questions", "time_limit_seconds", "INTEGER"),
    ("responses", "time_spent_seconds", "INTEGER"),
    ("responses", "timed_out", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("responses", "reported_out_of_time", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("hypotheses", "would_confirm", "TEXT NOT NULL DEFAULT ''"),
]
DIAGNOSIS_VERSION_INDEX = "uq_diagnoses_response_version"


def _has_unique_on(inspector, table: str, columns: list[str]) -> bool:
    for uc in inspector.get_unique_constraints(table):
        if sorted(uc["column_names"]) == sorted(columns):
            return True
    return any(ix.get("unique") and sorted(ix["column_names"]) == sorted(columns) for ix in inspector.get_indexes(table))


def upgrade_schema(engine: Engine) -> list[str]:
    """Bring an existing database up to the current models. Returns the steps applied."""
    applied: list[str] = []
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in ADDED_COLUMNS:
            if table in tables and column not in {c["name"] for c in inspector.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                applied.append(f"added {table}.{column}")
    if "diagnoses" in tables and not _has_unique_on(inspect(engine), "diagnoses", ["response_id", "version"]):
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS {DIAGNOSIS_VERSION_INDEX} ON diagnoses (response_id, version)"
                ))
            applied.append(f"added unique index {DIAGNOSIS_VERSION_INDEX}")
        except Exception:  # existing duplicate versions: keep running, report it, don't touch the data
            log.exception("Could not add %s; duplicate diagnosis versions exist", DIAGNOSIS_VERSION_INDEX)
    for step in applied:
        log.info("schema upgrade: %s", step)
    return applied
