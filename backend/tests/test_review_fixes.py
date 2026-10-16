"""Regression tests for review findings on 00fef16: schema upgrade, resumable replies,
one entry per story, and the eval label list."""
import pathlib
import re

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app import models  # noqa: F401  (registers tables)
from app.db import Base
from app.domain import MisconceptionSpec, QuestionSpec, StudentWork
from app.migrations import ADDED_COLUMNS, DIAGNOSIS_VERSION_INDEX, upgrade_schema
from app.services import diagnosis_store
from app.services.pipeline import run_diagnosis
from tests.fakes import WEIGHED, FakeAIClient, analysis, hyp, out
from tests.helpers import follow_up_flow, student, teacher

# ---------- 1. existing databases are upgraded in place, data kept ----------


def _old_database(tmp_path):
    """A database as created before the Riddle 2 columns and the version constraint existed."""
    engine = create_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for table, column, _ in ADDED_COLUMNS:
            conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
        # Rebuild diagnoses without UNIQUE(response_id, version), as the old schema had it.
        conn.execute(text("ALTER TABLE diagnoses RENAME TO diagnoses_new"))
        conn.execute(text(
            "CREATE TABLE diagnoses (id INTEGER PRIMARY KEY, response_id INTEGER, version INTEGER, label VARCHAR(20), "
            "certainty FLOAT, source VARCHAR(10), status VARCHAR(10), misconception_id INTEGER, note TEXT, created_at DATETIME)"
        ))
        conn.execute(text("DROP TABLE diagnoses_new"))
        conn.execute(text(
            "INSERT INTO classes (id, name, join_code, teacher_token_hash, is_sample, created_at) "
            "VALUES (1, '7B', 'ABC234', 'h', 0, '2026-10-16 22:00:00')"
        ))
        conn.execute(text("INSERT INTO quizzes (id, class_id, topic, title) VALUES (1, 1, 't', 't')"))
        conn.execute(text(
            "INSERT INTO questions (id, quiz_id, position, prompt, correct_answer, answer_type, key_idea, choices) "
            "VALUES (1, 1, 1, 'p', '1', 'number', 'k', '[]')"
        ))
    return engine


def test_old_database_gets_new_columns_and_keeps_its_data(tmp_path):
    engine = _old_database(tmp_path)
    applied = upgrade_schema(engine)
    assert len(applied) == len(ADDED_COLUMNS) + 1
    insp = inspect(engine)
    for table, column, _ in ADDED_COLUMNS:
        assert column in {c["name"] for c in insp.get_columns(table)}
    assert DIAGNOSIS_VERSION_INDEX in {ix["name"] for ix in insp.get_indexes("diagnoses")}
    with engine.connect() as conn:
        assert conn.execute(text("SELECT prompt, time_limit_seconds FROM questions")).one() == ("p", None)
    assert upgrade_schema(engine) == []  # idempotent


def test_upgraded_database_enforces_unique_versions(tmp_path):
    engine = _old_database(tmp_path)
    upgrade_schema(engine)
    insert = text("INSERT INTO diagnoses (response_id, version, label, source, status) VALUES (1, 1, 'x', 'ai', 'open')")
    with engine.begin() as conn:
        conn.execute(insert)
    try:
        with engine.begin() as conn:
            conn.execute(insert)
        raise AssertionError("duplicate version was accepted")
    except IntegrityError:
        pass


def test_fresh_database_needs_no_upgrade(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'new.db').as_posix()}")
    Base.metadata.create_all(engine)
    assert upgrade_schema(engine) == []


# ---------- 2. a reply whose save failed can be resumed ----------


def test_failed_save_leaves_the_follow_up_resumable(client, fake_ai, monkeypatch):
    cls, s, r = follow_up_flow(client, fake_ai)
    fid, rid = r.json()["follow_up"]["follow_up_id"], r.json()["response_id"]
    headers = student(s["student_token"])

    real_store = diagnosis_store.store_outcome

    def always_conflicts(*_args, **_kwargs):
        raise IntegrityError("INSERT", {}, Exception("version taken"))

    monkeypatch.setattr(diagnosis_store, "store_outcome", always_conflicts)
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/3 is 2/6", 0.9)))
    failed = client.post(f"/api/follow-ups/{fid}/reply", headers=headers, json={"reply": "1/3 is 2/6"})
    assert failed.status_code == 409 and "saved" in failed.json()["detail"]

    [pending] = client.get("/api/students/me", headers=headers).json()["pending_follow_ups"]
    assert (pending["follow_up_id"], pending["reply_saved"]) == (fid, True)
    assert client.post(f"/api/follow-ups/{fid}/reply", headers=headers, json={"reply": "again"}).status_code == 409

    monkeypatch.setattr(diagnosis_store, "store_outcome", real_store)
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/3 is 2/6", 0.9)))
    assert client.post(f"/api/follow-ups/{fid}/resume", headers=headers).status_code == 200
    assert client.get("/api/students/me", headers=headers).json()["pending_follow_ups"] == []

    d = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert (d["diagnosis"]["version"], d["diagnosis"]["label"]) == (2, "understood")
    assert d["follow_up"]["student_reply"] == "1/3 is 2/6"  # the original reply, not the retry text


def test_resume_is_safe_to_repeat_and_needs_a_reply_first(client, fake_ai):
    _, s, r = follow_up_flow(client, fake_ai)
    fid, headers = r.json()["follow_up"]["follow_up_id"], student(s["student_token"])
    assert client.post(f"/api/follow-ups/{fid}/resume", headers=headers).status_code == 409  # nothing to resume yet
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "2/6", 0.9)))
    client.post(f"/api/follow-ups/{fid}/reply", headers=headers, json={"reply": "1/3 is 2/6"})
    assert client.post(f"/api/follow-ups/{fid}/resume", headers=headers).status_code == 200  # already done: no-op
    assert fake_ai.prompts[-1].count("1/3 is 2/6") >= 1 and not fake_ai.queue


# ---------- 3. one entry per story ----------

TIMED = QuestionSpec(
    prompt="What is 1/2 + 1/4?",
    correct_answer="3/4",
    answer_type="number",
    key_idea="Use a common denominator.",
    misconceptions=(MisconceptionSpec(id=7, label="Adds tops and bottoms", trigger_answers=("2/6",)),),
    time_limit_seconds=60,
)


def test_recorded_timing_story_is_not_also_listed_as_ruled_out():
    work = StudentWork(answer="5/8", explanation="I think it asked for 1/2 of 1/4", self_confidence="sure", timed_out=True)
    ai = FakeAIClient()
    ai.push(analysis("misread", 0.95, hyp("misread", "asked for 1/2 of 1/4", 0.95),
                     ruled_out=(out("out_of_time", "No timing evidence"), out("slip", "no arithmetic shown"))))
    result = run_diagnosis(TIMED, work, ai, threshold=0.7, allow_follow_up=True)
    timing = [h for h in result.hypotheses if h.kind == "out_of_time"]
    assert len(timing) == 1
    assert timing[0].status == "open" and timing[0].evidence_against == ""
    assert len({(h.kind, h.misconception_id) for h in result.hypotheses}) == len(result.hypotheses)


def test_rule_story_ruled_out_by_the_ai_keeps_the_ai_reason_as_evidence_against():
    work = StudentWork(answer="2/6", explanation="I simplified 3/9 by mistake", self_confidence="sure")
    ai = FakeAIClient()
    ai.push(analysis("slip", 0.8, hyp("slip", "simplified 3/9 by mistake", 0.8),
                     ruled_out=(out("misconception", "they never add tops and bottoms", 7), *WEIGHED)), "{}")
    result = run_diagnosis(TIMED, work, ai, threshold=0.7, allow_follow_up=True)
    [rule_story] = [h for h in result.hypotheses if h.kind == "misconception"]
    assert rule_story.status == "open" and rule_story.evidence_against == "they never add tops and bottoms"


# ---------- 4. eval runner template knows every label ----------


def test_eval_template_lists_every_label():
    from typing import get_args

    from app.domain import Label

    repo = pathlib.Path(__file__).resolve().parents[2]
    for path in ("eval/run_eval.py", "docs/superpowers/plans/2026-10-16-track-c-eval-ops-docs.md"):
        labels_line = re.search(r"^LABELS = \[(.*)\]$", (repo / path).read_text(encoding="utf-8"), re.M).group(1)
        assert {s.strip(' "') for s in labels_line.split(",")} == set(get_args(Label)), path
