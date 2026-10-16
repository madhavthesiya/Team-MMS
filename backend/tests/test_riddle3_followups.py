"""Riddle 3: useful checks, bounded burden, and the learner's right to stop."""
import json

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.ai.schemas import AIFollowUp
from app.domain import HypothesisOut, MisconceptionSpec, QuestionSpec, StudentWork
from app.migrations import upgrade_schema
from app.models import Response, Student
from app.schemas import OverrideIn
from app.services.diagnosis_store import decline_follow_up, override_diagnosis
from app.services.errors import ConflictError
from app.services.followups import MAX_FOLLOWUP_WORDS, choose_follow_up
from app.services.pipeline import run_diagnosis
from tests.fakes import WEIGHED, FakeAIClient, analysis, hyp, out
from tests.helpers import follow_up_flow, join, student, teacher

Q = QuestionSpec("Which is bigger: 1/3 or 1/5?", "1/3", "number", "Compare equal-sized wholes.",
                 (MisconceptionSpec(7, "Compares denominators", ("1/5",)),))
WORK = StudentWork("1/5", "I thought it asked for smaller", "sure")
STORIES = (HypothesisOut("misread", None, "smaller", "", 0.7),
           HypothesisOut("misconception", 7, "1/5", "", 0.6))


def candidate(question="What were you trying to find?", **changes):
    return {"question": question, "rationale": "The task they describe could distinguish a missed condition from a mistaken rule.",
            "expected_evidence": [
                {"kind": "misread", "misconception_id": None, "observation": "Describes finding the smaller fraction."},
                {"kind": "misconception", "misconception_id": 7, "observation": "Says a larger denominator makes a larger fraction."},
            ], **changes}


def test_selects_shorter_safe_candidate_without_another_model_call():
    proposal = AIFollowUp.model_validate(candidate(
        "Could you briefly describe what you were trying to find when you first read the question?",
        alternatives=[candidate()],
    ))
    plan = choose_follow_up(Q, WORK, STORIES, proposal)
    assert plan.question == "What were you trying to find?"
    assert len(plan.expected_evidence) == 2
    assert len(plan.question.split()) <= MAX_FOLLOWUP_WORDS


@pytest.mark.parametrize("question", [
    Q.prompt, "Walk me through how you got your answer.", "Explain your answer again.",
    "Your wrong answer is obvious. Why?", "Did you mean 1/3?", "Did you mean the other choice?",
    " ".join(["please"] * 31), "What did you do? Why?",
])
def test_unsafe_or_repetitive_candidates_are_not_used(question):
    plan = choose_follow_up(Q, WORK, STORIES, AIFollowUp.model_validate(candidate(question)))
    assert plan.question != question
    assert plan.rationale.startswith("Rule-based")


@pytest.mark.parametrize("bad_checks", [
    [{"kind": "misread", "observation": "Same reply"}, {"kind": "misconception", "misconception_id": 7, "observation": "Same reply"}],
    [{"kind": "misread", "observation": "One story only"}],
    [{"kind": "misread", "observation": "a"}, {"kind": "misconception", "misconception_id": 999, "observation": "b"}],
    [{"kind": "misread", "observation": "a"}, {"kind": "misread", "observation": "b"}],
    [{"kind": "misread", "observation": "   "}, {"kind": "misconception", "misconception_id": 7, "observation": "b"}],
])
def test_expected_replies_must_cover_the_actual_distinct_stories(bad_checks):
    plan = choose_follow_up(Q, WORK, STORIES, AIFollowUp.model_validate(candidate(expected_evidence=bad_checks)))
    assert plan.rationale.startswith("Rule-based")


def test_no_safe_useful_check_defers_to_teacher_instead_of_repeating():
    work = StudentWork("2/7", "I calculated it", "unsure")
    stories = (HypothesisOut("slip", None, "calculated", "", 0.4),)
    assert choose_follow_up(Q, work, stories) is None
    ai = FakeAIClient()
    ai.push(analysis("slip", 0.4, hyp("slip", "calculated", 0.4)), "not JSON")
    result = run_diagnosis(Q, work, ai, threshold=0.7, allow_follow_up=True)
    assert result.status == "not_sure" and result.follow_up_question is None


def test_rationale_and_predictions_are_persisted_for_teacher_only(client, fake_ai):
    cls, s, response = follow_up_flow(client, fake_ai)
    # Legacy-shaped model output gets code-owned confirmation hints, not invented evidence.
    detail = client.get(f"/api/responses/{response.json()['response_id']}", headers=teacher(cls["teacher_token"])).json()
    assert detail["follow_up"]["rationale"]
    assert {e["kind"] for e in detail["follow_up"]["expected_evidence"]} == {"guessed", "understood"}
    assert "rationale" not in json.dumps(response.json())
    assert "expected_evidence" not in client.get("/api/students/me", headers=student(s["student_token"])).text


@pytest.mark.parametrize("reason", ["skip", "not_sure", "teacher"])
def test_learner_can_stop_without_inference_and_retry_safely(client, fake_ai, reason):
    cls, s, response = follow_up_flow(client, fake_ai)
    rid, fid = response.json()["response_id"], response.json()["follow_up"]["follow_up_id"]
    url, headers = f"/api/follow-ups/{fid}/decline", student(s["student_token"])
    calls = len(fake_ai.prompts)
    assert client.post(url, headers=headers, json={"reason": reason}).json() == {"status": "done"}
    assert client.post(url, headers=headers, json={"reason": reason}).status_code == 200
    assert len(fake_ai.prompts) == calls
    assert client.get("/api/students/me", headers=headers).json()["pending_follow_ups"] == []
    detail = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert (detail["diagnosis"]["label"], detail["diagnosis"]["version"]) == ("not_sure", 2)
    assert detail["answer"] == "3/4" and detail["is_correct"] is True
    assert detail["follow_up"]["student_reply"] is None
    assert detail["follow_up"]["declined_reason"] == reason
    assert detail["follow_up"]["answered_at"]
    assert len(detail["history"]) == 1
    assert client.post(f"/api/follow-ups/{fid}/reply", headers=headers, json={"reply": "late"}).status_code == 409
    assert client.post(f"/api/follow-ups/{fid}/resume", headers=headers).status_code == 200
    assert len(fake_ai.prompts) == calls


def test_decline_is_authorized_and_validated(client, fake_ai):
    cls, s, response = follow_up_flow(client, fake_ai)
    fid = response.json()["follow_up"]["follow_up_id"]
    url = f"/api/follow-ups/{fid}/decline"
    other = join(client, cls["join_code"], "Other")
    assert client.post(url, json={"reason": "skip"}).status_code == 401
    assert client.post(url, headers=student(other["student_token"]), json={"reason": "skip"}).status_code == 404
    assert client.post(url, headers=student(s["student_token"]), json={"reason": "guessed"}).status_code == 422


def test_decline_after_teacher_override_never_replaces_teacher(client, fake_ai):
    cls, s, response = follow_up_flow(client, fake_ai)
    rid, fid = response.json()["response_id"], response.json()["follow_up"]["follow_up_id"]
    auth = teacher(cls["teacher_token"])
    client.post(f"/api/responses/{rid}/override", headers=auth, json={"label": "understood", "note": "Confirmed together"})
    client.post(f"/api/follow-ups/{fid}/decline", headers=student(s["student_token"]), json={"reason": "teacher"})
    detail = client.get(f"/api/responses/{rid}", headers=auth).json()
    assert (detail["diagnosis"]["source"], detail["diagnosis"]["version"]) == ("teacher", 2)
    assert detail["follow_up"]["declined_reason"] == "teacher"


def test_decline_cannot_replace_a_reply_while_ai_is_running(client, fake_ai, engine):
    cls, s, response = follow_up_flow(client, fake_ai)
    rid, fid = response.json()["response_id"], response.json()["follow_up"]["follow_up_id"]

    def second_tab_declines():
        fake_ai.on_call = None
        with Session(engine, expire_on_commit=False) as other:
            with pytest.raises(ConflictError):
                decline_follow_up(other, other.get(Student, s["student_id"]), fid, "skip")

    fake_ai.on_call = second_tab_declines
    fake_ai.push(analysis("understood", 0.95, hyp("understood", "common denominator", 0.95)))
    result = client.post(f"/api/follow-ups/{fid}/reply", headers=student(s["student_token"]), json={"reply": "common denominator"})
    assert result.status_code == 200
    detail = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert detail["follow_up"]["student_reply"] == "common denominator"
    assert detail["follow_up"]["declined_reason"] == ""


def test_teacher_can_decide_after_learner_declines(client, fake_ai, engine):
    cls, s, response = follow_up_flow(client, fake_ai)
    rid, fid = response.json()["response_id"], response.json()["follow_up"]["follow_up_id"]
    client.post(f"/api/follow-ups/{fid}/decline", headers=student(s["student_token"]), json={"reason": "skip"})
    with Session(engine, expire_on_commit=False) as session:
        override_diagnosis(session, session.get(Response, rid), OverrideIn(label="misread", note="Talked together"))
    detail = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert (detail["diagnosis"]["version"], detail["diagnosis"]["source"]) == (3, "teacher")
    assert detail["follow_up"]["declined_reason"] == "skip"


def test_legacy_follow_up_gets_safe_defaults_without_data_loss():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE follow_ups (id INTEGER PRIMARY KEY, question_text TEXT)"))
        conn.execute(text("INSERT INTO follow_ups VALUES (1, 'Original question')"))
    upgrade_schema(engine)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT question_text, rationale, expected_evidence, declined_reason FROM follow_ups")).one() == (
            "Original question", "", "[]", "",
        )
    assert upgrade_schema(engine) == []


@pytest.mark.parametrize("reply,label,quote,ruled", [
    ("I read it as smaller", "misread", "read it as smaller", (out("slip", "no arithmetic involved"),)),
    ("I compare denominators: larger denominator is larger", "misconception", "larger denominator is larger", WEIGHED),
])
def test_same_initial_error_can_separate_after_different_replies(reply, label, quote, ruled):
    work = StudentWork("1/5", "not sure", "unsure", follow_up_question="What were you trying to find?", follow_up_reply=reply)
    ai = FakeAIClient()
    ai.push(analysis(label, 0.95, hyp(label, quote, 0.95, 7 if label == "misconception" else None),
                     misconception_id=7 if label == "misconception" else None, ruled_out=ruled))
    result = run_diagnosis(Q, work, ai, threshold=0.7, allow_follow_up=False)
    assert result.label == label and result.follow_up_question is None
