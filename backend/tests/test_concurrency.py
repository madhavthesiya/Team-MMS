"""OPEN-01: a teacher override must stay authoritative even when it lands while the AI is re-reading.

The fake model runs a callback mid-call, standing in for a second request (teacher or another tab).
These tests run on SQLite; Postgres row locking (SELECT ... FOR UPDATE) still needs a hosted check.
"""
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ClassRoom, Diagnosis, Question, Quiz, Response, Student
from app.schemas import OverrideIn
from app.services.diagnosis_store import override_diagnosis, reply_to_follow_up
from app.services.errors import ConflictError
from tests.fakes import FakeAIClient, analysis, hyp
from tests.helpers import follow_up_flow, student, teacher


def test_teacher_override_during_the_ai_call_stays_final(client, fake_ai, engine):
    cls, s, r = follow_up_flow(client, fake_ai)
    rid, fid = r.json()["response_id"], r.json()["follow_up"]["follow_up_id"]

    def teacher_steps_in():
        fake_ai.on_call = None
        with Session(engine, expire_on_commit=False) as other:
            override_diagnosis(other, other.get(Response, rid), OverrideIn(label="guessed", note="decided in class"))

    fake_ai.on_call = teacher_steps_in
    fake_ai.push(analysis("understood", 0.95, hyp("understood", "1/3 is 2/6", 0.95)))
    reply = client.post(f"/api/follow-ups/{fid}/reply", headers=student(s["student_token"]), json={"reply": "1/3 is 2/6"})
    assert reply.status_code == 200

    d = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert (d["diagnosis"]["version"], d["diagnosis"]["source"], d["diagnosis"]["label"]) == (2, "teacher", "guessed")
    assert [h["version"] for h in d["history"]] == [1]  # the AI re-read was not stored on top
    assert d["follow_up"]["student_reply"] == "1/3 is 2/6"  # the reply is kept as evidence


def test_a_second_reply_arriving_mid_call_is_rejected(client, fake_ai, engine, settings):
    _, s, r = follow_up_flow(client, fake_ai)
    fid = r.json()["follow_up"]["follow_up_id"]
    outcome = {}

    def second_tab_replies():
        fake_ai.on_call = None
        with Session(engine, expire_on_commit=False) as other:
            try:
                reply_to_follow_up(other, other.get(Student, s["student_id"]), fid, "second tab", FakeAIClient(), settings)
                outcome["second"] = "accepted"
            except ConflictError:
                outcome["second"] = "conflict"

    fake_ai.on_call = second_tab_replies
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "first tab", 0.9)))
    first = client.post(f"/api/follow-ups/{fid}/reply", headers=student(s["student_token"]), json={"reply": "first tab"})
    assert first.status_code == 200
    assert outcome["second"] == "conflict"


def test_two_writers_cannot_claim_the_same_diagnosis_version(db):
    cls = ClassRoom(name="7B", join_code="XYZ234", teacher_token_hash="x" * 64)
    q = Question(quiz=Quiz(classroom=cls, topic="t", title="t"), position=1, prompt="p", correct_answer="1",
                 answer_type="number", key_idea="k")
    r = Response(student=Student(classroom=cls, nickname="A", token_hash="z" * 64), question=q, answer_raw="1",
                 explanation_raw="", self_confidence="sure", is_correct=True)
    db.add(cls)
    db.commit()
    db.add_all([
        Diagnosis(response_id=r.id, version=1, label="understood", source="ai", status="settled"),
        Diagnosis(response_id=r.id, version=1, label="guessed", source="teacher", status="settled"),
    ])
    with pytest.raises(IntegrityError):
        db.commit()
