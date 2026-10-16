"""Riddle 4 — Better Marks, Better Understanding?

Learning only counts when it survives a changed situation, without the tool, after time — and the
explanation shows the key idea. When it doesn't travel, the story behind the miss changes the next step.
"""
import copy
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Recheck, Response, TransferItem, utcnow
from tests.fakes import WEIGHED, analysis, hyp
from tests.helpers import QUIZ, join, student, submit, teacher

TRANSFER_QUIZ = copy.deepcopy(QUIZ)
TRANSFER_QUIZ["questions"][0]["misconceptions"][0]["remedy_hint"] = "Show halves and quarters on fraction strips"
TRANSFER_QUIZ["questions"][0]["transfer_items"] = [
    {"prompt": "What is 2/5 + 3/10?", "correct_answer": "7/10", "answer_type": "number", "change": "different numbers"},
    {"prompt": "Asha drinks 1/3 of a bottle, then 1/6 more. What fraction has she drunk?", "correct_answer": "1/2",
     "answer_type": "number", "change": "word problem"},
]


def _class(client):
    r = client.post("/api/classes", json={"name": "7B"})
    cls = r.json()
    q = client.put(f"/api/classes/{cls['class_id']}/quiz", headers=teacher(cls["teacher_token"]), json=TRANSFER_QUIZ)
    assert q.status_code == 200, q.text
    return {**cls, "quiz": q.json(), "q1": q.json()["questions"][0]["question_id"]}


def _answered(client, cls, nickname="Asha", answer="3/4", explanation="1/2 is 2/4, plus 1/4"):
    s = join(client, cls["join_code"], nickname)
    r = submit(client, s["student_token"], cls["q1"], answer, explanation)
    assert r.status_code == 201, r.text
    return s, r.json()["response_id"]


def _schedule(client, cls, delay_days=0, **extra):
    return client.post(f"/api/classes/{cls['class_id']}/rechecks", headers=teacher(cls["teacher_token"]),
                       json={"question_id": cls["q1"], "delay_days": delay_days, **extra})


def _report(client, cls):
    return client.get(f"/api/classes/{cls['class_id']}/transfer", headers=teacher(cls["teacher_token"])).json()


def _answer_check(client, s, answer, explanation, confidence="sure"):
    [check] = client.get("/api/students/me", headers=student(s["student_token"])).json()["rechecks"]
    return client.post(f"/api/rechecks/{check['recheck_id']}/answer", headers=student(s["student_token"]),
                       json={"answer": answer, "explanation": explanation, "self_confidence": confidence,
                             "time_spent_seconds": 40})


def _only_recheck(client, cls):
    [q] = [q for q in _report(client, cls)["questions"] if q["question_id"] == cls["q1"]]
    return q, q["rechecks"][-1]


# ---------- authoring re-check items ----------


def test_a_recheck_item_must_change_the_situation(client):
    cls = client.post("/api/classes", json={"name": "7B"}).json()
    same = copy.deepcopy(TRANSFER_QUIZ)
    same["questions"][0]["transfer_items"] = [{"prompt": " what is 1/2 + 1/4? ", "correct_answer": "3/4",
                                               "answer_type": "number", "change": "none"}]
    r = client.put(f"/api/classes/{cls['class_id']}/quiz", headers=teacher(cls["teacher_token"]), json=same)
    assert r.status_code == 422


def test_items_reach_the_teacher_but_never_the_student(client):
    cls = _class(client)
    assert [t["change"] for t in cls["quiz"]["questions"][0]["transfer_items"]] == ["different numbers", "word problem"]
    s = join(client, cls["join_code"])
    me = client.get("/api/students/me", headers=student(s["student_token"]))
    assert me.json()["rechecks"] == [] and "2/5 + 3/10" not in me.text and "transfer" not in me.text


def test_a_new_situation_can_be_added_after_students_answered(client):
    cls = _class(client)
    _answered(client, cls)
    r = client.post(f"/api/classes/{cls['class_id']}/questions/{cls['q1']}/transfer-items",
                    headers=teacher(cls["teacher_token"]),
                    json={"prompt": "What is 1/4 + 1/8?", "correct_answer": "3/8", "answer_type": "number",
                          "change": "smaller pieces"})
    assert r.status_code == 201 and r.json()["change"] == "smaller pieces"


def test_scheduling_needs_a_recheck_item(client):
    cls = _class(client)
    q2 = cls["quiz"]["questions"][1]["question_id"]
    r = client.post(f"/api/classes/{cls['class_id']}/rechecks", headers=teacher(cls["teacher_token"]),
                    json={"question_id": q2, "delay_days": 0})
    assert r.status_code == 409


# ---------- scheduling: after a delay, a situation never seen before ----------


def test_delayed_recheck_is_hidden_until_it_opens(client):
    cls = _class(client)
    s, _ = _answered(client, cls)
    out = _schedule(client, cls, delay_days=7).json()
    assert [x["nickname"] for x in out["scheduled"]] == ["Asha"]
    assert out["scheduled"][0]["next_step"] == "No reteach needed: check that it holds in a new situation."
    assert client.get("/api/students/me", headers=student(s["student_token"])).json()["rechecks"] == []
    q, _ = _only_recheck(client, cls)
    assert (q["scheduled"], q["waiting"], q["answered"]) == (1, 1, 0)


def test_next_step_defaults_to_the_teachers_remedy_for_the_diagnosed_rule(client):
    cls = _class(client)
    _answered(client, cls, answer="2/6", explanation="added the tops and the bottoms")  # AI down: rule says misconception
    assert _schedule(client, cls).json()["scheduled"][0]["next_step"] == "Show halves and quarters on fraction strips"


def test_never_the_same_item_twice_and_a_new_kind_of_change_each_time(client, fake_ai):
    cls = _class(client)
    s, _ = _answered(client, cls)
    first = _schedule(client, cls).json()["scheduled"][0]
    assert _schedule(client, cls).json()["skipped"][0]["reason"].startswith("already has a re-check waiting")
    _answer_check(client, s, "7/10", "x")
    second = _schedule(client, cls).json()["scheduled"][0]
    assert second["transfer_item_id"] != first["transfer_item_id"] and second["change"] != first["change"]
    _answer_check(client, s, "1/2", "x")
    assert _schedule(client, cls).json()["skipped"][0]["reason"].startswith("no unused re-check item left")


def test_only_students_who_answered_are_scheduled(client):
    cls = _class(client)
    _answered(client, cls, "Asha")
    late = join(client, cls["join_code"], "Ravi")
    assert [x["nickname"] for x in _schedule(client, cls).json()["scheduled"]] == ["Asha"]
    explicit = _schedule(client, cls, student_ids=[late["student_id"]]).json()
    assert explicit["skipped"][0]["reason"] == "hasn't answered the original question yet"


# ---------- verdicts ----------


def test_right_with_the_key_idea_soon_after_has_travelled_but_not_yet_lasted(client, fake_ai):
    cls = _class(client)
    s, _ = _answered(client, cls)
    _schedule(client, cls)
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "made them both tenths", 0.9)))
    r = _answer_check(client, s, "0.7", "I made them both tenths: 4/10 + 3/10 = 7/10")
    assert r.status_code == 200 and r.json() == {"status": "done"}  # the student never sees a verdict
    q, rc = _only_recheck(client, cls)
    assert (rc["verdict"], rc["is_correct"], rc["transfer_item"]["change"]) == ("travelled", True, "different numbers")
    assert "Check again once 7 days have passed" in rc["change_plan"]
    assert (q["better_marks"], q["better_understanding"]) == (1, 1)


def test_right_with_the_key_idea_a_week_later_has_lasted(client, fake_ai, engine):
    cls = _class(client)
    s, rid = _answered(client, cls)
    with Session(engine) as db:  # the first answer was ten days ago
        db.get(Response, rid).created_at = utcnow() - timedelta(days=10)
        db.commit()
    _schedule(client, cls)
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "made them both tenths", 0.9)))
    _answer_check(client, s, "7/10", "I made them both tenths: 4/10 + 3/10")
    _, rc = _only_recheck(client, cls)
    assert rc["verdict"] == "lasting" and rc["gap_days"] >= 10
    assert rc["change_plan"].startswith("It travelled to a new situation and held after 10 days")


def test_a_better_mark_without_the_reasoning_is_not_counted_as_understanding(client, fake_ai):
    cls = _class(client)
    s, _ = _answered(client, cls)
    _schedule(client, cls)
    fake_ai.push(analysis("guessed", 0.8, hyp("guessed", "seen this kind before", 0.8)))
    _answer_check(client, s, "7/10", "seen this kind before")
    q, rc = _only_recheck(client, cls)
    assert (rc["verdict"], rc["is_correct"]) == ("unconvincing", True)
    assert "familiar pattern" in rc["change_plan"]
    assert (q["better_marks"], q["better_understanding"]) == (1, 0)


def test_without_the_ai_a_right_answer_is_not_counted_as_learned(client):
    cls = _class(client)
    s, _ = _answered(client, cls)
    _schedule(client, cls)
    _answer_check(client, s, "7/10", "tenths")  # fake model has nothing queued: AI unavailable
    _, rc = _only_recheck(client, cls)
    assert rc["verdict"] == "unconvincing" and "couldn't be checked" in rc["change_plan"]


def test_when_the_rule_comes_back_the_plan_changes_the_approach(client, fake_ai):
    cls = _class(client)
    s, _ = _answered(client, cls, answer="2/6", explanation="added the tops and the bottoms")
    mid = cls["quiz"]["questions"][0]["misconceptions"][0]["misconception_id"]
    _schedule(client, cls)
    fake_ai.push(analysis("misconception", 0.9, hyp("misconception", "2+3 and 5+10", 0.9, mid),
                          misconception_id=mid, ruled_out=WEIGHED))
    _answer_check(client, s, "5/15", "2+3 and 5+10")
    _, rc = _only_recheck(client, cls)
    assert (rc["verdict"], rc["misconception_label"]) == ("did_not_travel", "Adds tops and bottoms")
    assert "came back in a new situation" in rc["change_plan"]
    assert "Show halves and quarters on fraction strips" in rc["change_plan"]  # the step that didn't carry over
    assert "different representation" in rc["change_plan"]
    assert (rc["original_correct"], rc["original_label"]) == (False, "misconception")


def test_the_tool_is_taken_away_no_follow_up_during_a_recheck(client, fake_ai):
    cls = _class(client)
    s, _ = _answered(client, cls)
    _schedule(client, cls)
    fake_ai.push(analysis("guessed", 0.8, hyp("guessed", "hmm", 0.8)))
    calls_before = len(fake_ai.prompts)
    _answer_check(client, s, "7/10", "hmm")
    assert len(fake_ai.prompts) == calls_before + 1  # one analysis call, no follow-up question
    me = client.get("/api/students/me", headers=student(s["student_token"])).json()
    assert me["pending_follow_ups"] == [] and me["rechecks"] == []


# ---------- safety ----------


def test_recheck_answers_are_owned_once_only_and_only_when_open(client):
    cls = _class(client)
    s, _ = _answered(client, cls)
    other = join(client, cls["join_code"], "Ravi")
    _schedule(client, cls)
    [check] = client.get("/api/students/me", headers=student(s["student_token"])).json()["rechecks"]
    url, body = f"/api/rechecks/{check['recheck_id']}/answer", {"answer": "7/10", "self_confidence": "sure"}
    assert client.post(url, headers=student(other["student_token"]), json=body).status_code == 404
    assert client.post(url, headers=student(s["student_token"]), json=body).status_code == 200
    assert client.post(url, headers=student(s["student_token"]), json=body).status_code == 409


def test_a_recheck_cannot_be_answered_before_it_opens(client, engine):
    cls = _class(client)
    s, _ = _answered(client, cls)
    _schedule(client, cls, delay_days=7)
    with Session(engine) as db:
        recheck_id = db.scalar(select(Recheck.id))
    r = client.post(f"/api/rechecks/{recheck_id}/answer", headers=student(s["student_token"]),
                    json={"answer": "7/10", "self_confidence": "sure"})
    assert r.status_code == 409


def test_response_detail_shows_the_students_rechecks(client, fake_ai):
    cls = _class(client)
    s, rid = _answered(client, cls)
    _schedule(client, cls)
    _answer_check(client, s, "1/2", "x")
    d = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert [rc["verdict"] for rc in d["rechecks"]] == ["did_not_travel"]


def test_deleting_the_class_removes_rechecks_and_items(client, engine):
    cls = _class(client)
    _answered(client, cls)
    _schedule(client, cls)
    assert client.delete(f"/api/classes/{cls['class_id']}", headers=teacher(cls["teacher_token"])).status_code == 204
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Recheck)) == 0
        assert db.scalar(select(func.count()).select_from(TransferItem)) == 0


def test_sample_class_ships_two_situations_per_question(client):
    body = client.post("/api/classes/sample").json()
    info = client.get(f"/api/classes/{body['class_id']}", headers=teacher(body["teacher_token"])).json()
    assert all(len(q["transfer_items"]) == 2 for q in info["quiz"]["questions"])
