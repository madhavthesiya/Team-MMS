import re

from app.services.sample import load_sample_quiz
from tests.fakes import analysis, follow_up, hyp
from tests.helpers import QUIZ, create_class, create_class_with_quiz, join, student, submit, teacher

# ---------- classes and quizzes ----------


def test_create_class_returns_readable_code_and_secret_token(client):
    body = create_class(client)
    assert re.fullmatch(r"[A-Z2-9]{6}", body["join_code"])
    assert len(body["teacher_token"]) >= 20


def test_teacher_endpoints_check_the_link_token(client):
    cls = create_class(client)
    url = f"/api/classes/{cls['class_id']}"
    assert client.get(url, headers=teacher(cls["teacher_token"])).json()["quiz"] is None
    assert client.get(url).status_code == 401
    assert client.get(url, headers=teacher("wrong")).status_code == 403
    assert client.get("/api/classes/999", headers=teacher(cls["teacher_token"])).status_code == 404


def test_blank_class_name_is_rejected(client):
    assert client.post("/api/classes", json={"name": "   "}).status_code == 422


def test_put_quiz_stores_questions_in_order_and_can_replace(client):
    cls = create_class_with_quiz(client)
    assert [q["position"] for q in cls["quiz"]["questions"]] == [1, 2]
    assert cls["quiz"]["questions"][0]["misconceptions"][0]["misconception_id"] > 0
    one = {**QUIZ, "questions": QUIZ["questions"][:1]}
    r = client.put(f"/api/classes/{cls['class_id']}/quiz", headers=teacher(cls["teacher_token"]), json=one)
    assert r.status_code == 200 and len(r.json()["questions"]) == 1


def test_quiz_validation_rejects_bad_choice_and_trigger_equal_to_answer(client):
    cls = create_class(client)
    url, h = f"/api/classes/{cls['class_id']}/quiz", teacher(cls["teacher_token"])
    bad_choice = {**QUIZ, "questions": [{**QUIZ["questions"][1], "correct_answer": "Maybe"}]}
    assert client.put(url, headers=h, json=bad_choice).status_code == 422
    bad_trigger = {**QUIZ, "questions": [{**QUIZ["questions"][0], "misconceptions": [{"label": "x", "trigger_answers": ["0.75"]}]}]}
    assert client.put(url, headers=h, json=bad_trigger).status_code == 422


def test_delete_class(client):
    cls = create_class(client)
    url, h = f"/api/classes/{cls['class_id']}", teacher(cls["teacher_token"])
    assert client.delete(url, headers=h).status_code == 204
    assert client.get(url, headers=h).status_code == 404


def test_sample_quiz_is_valid_input_and_creates_a_sample_class(client):
    assert len(load_sample_quiz().questions) == 10
    body = client.post("/api/classes/sample").json()
    info = client.get(f"/api/classes/{body['class_id']}", headers=teacher(body["teacher_token"])).json()
    assert info["is_sample"] is True and len(info["quiz"]["questions"]) == 10


# ---------- students ----------


def test_join_is_case_insensitive_and_hides_answers(client):
    cls = create_class_with_quiz(client)
    r = client.post("/api/join", json={"join_code": cls["join_code"].lower(), "nickname": " Asha "})
    assert r.status_code == 201
    body = r.json()
    assert body["nickname"] == "Asha" and len(body["quiz"]["questions"]) == 2
    for secret in ("correct_answer", "key_idea", "misconception", "3/4"):
        assert secret not in r.text


def test_join_unknown_code_is_404(client):
    assert client.post("/api/join", json={"join_code": "ZZZZZZ", "nickname": "A"}).status_code == 404


def test_submit_settles_when_rules_and_ai_agree_and_reveals_nothing(client, fake_ai):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    q1 = s["quiz"]["questions"][0]["question_id"]
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/2 is 2/4", 0.9)))
    r = submit(client, s["student_token"], q1, "0.75", "1/2 is 2/4, plus 1/4")
    assert r.status_code == 201, r.text
    assert r.json()["follow_up"] is None
    assert "is_correct" not in r.text and "label" not in r.text
    me = client.get("/api/students/me", headers=student(s["student_token"])).json()
    assert me["answered_question_ids"] == [q1]


def test_submit_errors(client):
    cls = create_class_with_quiz(client)
    other = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    q1 = s["quiz"]["questions"][0]["question_id"]
    other_q = other["quiz"]["questions"][0]["question_id"]
    assert submit(client, s["student_token"], q1, "3/4", "x").status_code == 201
    assert submit(client, s["student_token"], q1, "3/4", "x").status_code == 409
    assert submit(client, s["student_token"], other_q, "3/4", "x").status_code == 404
    assert client.post("/api/responses", json={"question_id": q1, "answer": "1", "self_confidence": "sure"}).status_code == 401


def test_ai_down_still_accepts_the_answer(client):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    r = submit(client, s["student_token"], s["quiz"]["questions"][0]["question_id"], "3/4", "2/4 + 1/4")
    assert r.status_code == 201 and r.json()["follow_up"] is None


def test_quiz_is_locked_after_first_response(client):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    submit(client, s["student_token"], s["quiz"]["questions"][0]["question_id"], "3/4", "x")
    r = client.put(f"/api/classes/{cls['class_id']}/quiz", headers=teacher(cls["teacher_token"]), json=QUIZ)
    assert r.status_code == 409


def _follow_up_flow(client, fake_ai):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    fake_ai.push(analysis("guessed", 0.8, hyp("guessed", "it looked right", 0.8)), follow_up("How would you add 1/3 and 1/6?"))
    r = submit(client, s["student_token"], s["quiz"]["questions"][0]["question_id"], "3/4", "it looked right")
    return cls, s, r


def test_follow_up_reply_settles_the_reading(client, fake_ai):
    cls, s, r = _follow_up_flow(client, fake_ai)
    fu = r.json()["follow_up"]
    assert fu["question_text"] == "How would you add 1/3 and 1/6?"
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/3 is 2/6", 0.9)))
    url = f"/api/follow-ups/{fu['follow_up_id']}/reply"
    rr = client.post(url, headers=student(s["student_token"]), json={"reply": "1/3 is 2/6 so 2/6 + 1/6 = 3/6"})
    assert rr.status_code == 200 and rr.json() == {"status": "done"}
    assert client.post(url, headers=student(s["student_token"]), json={"reply": "again"}).status_code == 409

    detail = client.get(f"/api/responses/{r.json()['response_id']}", headers=teacher(cls["teacher_token"])).json()
    assert (detail["diagnosis"]["version"], detail["diagnosis"]["label"]) == (2, "understood")
    assert detail["history"][0]["status"] == "open"
    assert detail["follow_up"]["student_reply"].startswith("1/3 is 2/6")


def test_another_student_cannot_reply_to_my_follow_up(client, fake_ai):
    cls, _, r = _follow_up_flow(client, fake_ai)
    intruder = join(client, cls["join_code"], "Ravi")
    url = f"/api/follow-ups/{r.json()['follow_up']['follow_up_id']}/reply"
    assert client.post(url, headers=student(intruder["student_token"]), json={"reply": "x"}).status_code == 404


# ---------- teacher results ----------


def test_results_split_same_score_students_by_reason(client, fake_ai):
    cls = create_class_with_quiz(client)
    q1 = cls["quiz"]["questions"][0]["question_id"]
    asha, ravi = join(client, cls["join_code"], "Asha"), join(client, cls["join_code"], "Ravi")
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/2 is 2/4", 0.9)))
    submit(client, asha["student_token"], q1, "3/4", "1/2 is 2/4 so 3 quarters")
    fake_ai.push(analysis("guessed", 0.85, hyp("guessed", "", 0.85)))
    submit(client, ravi["student_token"], q1, "3/4", "", confidence="guessed")

    res = client.get(f"/api/classes/{cls['class_id']}/results", headers=teacher(cls["teacher_token"])).json()
    first = res["questions"][0]
    assert first["total_responses"] == 2 and first["same_score_different_reasons"] is True
    [right] = first["groups"]
    assert right["is_correct"] is True
    assert [(g["label"], g["students"][0]["nickname"]) for g in right["labels"]] == [("understood", "Asha"), ("guessed", "Ravi")]
    assert res["questions"][1]["groups"] == [] and res["rule_only_count"] == 0


def test_results_count_rule_only_readings_when_ai_is_down(client):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    submit(client, s["student_token"], cls["quiz"]["questions"][0]["question_id"], "2/6", "added across")
    res = client.get(f"/api/classes/{cls['class_id']}/results", headers=teacher(cls["teacher_token"])).json()
    assert res["rule_only_count"] == 1
    entry = res["questions"][0]["groups"][0]["labels"][0]["students"][0]
    assert (entry["label"], entry["misconception_label"], entry["source"]) == ("misconception", "Adds tops and bottoms", "rule")


def test_response_detail_shows_evidence_hypotheses_and_trace(client, fake_ai):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "1/2 is 2/4", 0.9)))
    rid = submit(client, s["student_token"], cls["quiz"]["questions"][0]["question_id"], "3/4", "1/2 is 2/4").json()["response_id"]
    d = client.get(f"/api/responses/{rid}", headers=teacher(cls["teacher_token"])).json()
    assert (d["answer"], d["is_correct"], d["diagnosis"]["source"]) == ("3/4", True, "both")
    assert d["diagnosis"]["hypotheses"][0]["evidence_for"] == "1/2 is 2/4"
    assert [t["step"] for t in d["trace"]] == ["rule_match", "ai_analysis", "guardrails", "decision"]
    assert d["history"] == [] and d["follow_up"] is None


def test_teacher_override_adds_a_version_and_keeps_history(client):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    q = cls["quiz"]["questions"][0]
    rid = submit(client, s["student_token"], q["question_id"], "5/8", "not sure").json()["response_id"]
    url, h = f"/api/responses/{rid}/override", teacher(cls["teacher_token"])

    assert client.post(url, headers=h, json={"label": "misconception", "misconception_id": 999}).status_code == 422
    mid = q["misconceptions"][0]["misconception_id"]
    d = client.post(url, headers=h, json={"label": "misconception", "misconception_id": mid, "note": "Talked to her"}).json()
    assert (d["diagnosis"]["version"], d["diagnosis"]["source"], d["diagnosis"]["misconception_label"]) == (2, "teacher", "Adds tops and bottoms")
    assert d["diagnosis"]["note"] == "Talked to her" and len(d["history"]) == 1


def test_teacher_of_another_class_cannot_read_responses(client):
    cls = create_class_with_quiz(client)
    other = create_class(client)
    s = join(client, cls["join_code"])
    rid = submit(client, s["student_token"], cls["quiz"]["questions"][0]["question_id"], "3/4", "x").json()["response_id"]
    assert client.get(f"/api/responses/{rid}", headers=teacher(other["teacher_token"])).status_code == 403
