from tests.helpers import create_class_with_quiz, join, submit, teacher


def test_ai_generate_question_endpoint(client):
    cls = create_class_with_quiz(client)
    res = client.post(
        f"/api/classes/{cls['class_id']}/ai-generate-question",
        headers=teacher(cls["teacher_token"]),
        json={"topic": "Adding Fractions", "grade_level": "Grade 6", "misconception_focus": "Adding numerators directly"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "prompt" in data
    assert "correct_answer" in data
    assert "key_idea" in data
    assert len(data["misconceptions"]) >= 1


def test_ai_class_summary_endpoint(client):
    cls = create_class_with_quiz(client)
    tok = join(client, cls["join_code"])["student_token"]
    q_id = cls["quiz"]["questions"][0]["question_id"]
    submit(client, tok, q_id, answer="2/5", explanation="I added across 1+1 and 2+3")

    res = client.post(
        f"/api/classes/{cls['class_id']}/ai-summary",
        headers=teacher(cls["teacher_token"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_students"] == 1
    assert "executive_summary" in data
    assert "ten_minute_reteach_plan" in data


def test_ai_intervention_endpoint(client):
    cls = create_class_with_quiz(client)
    tok = join(client, cls["join_code"])["student_token"]
    q_id = cls["quiz"]["questions"][0]["question_id"]
    sub = submit(client, tok, q_id, answer="2/5", explanation="added numerators and denominators").json()
    resp_id = sub["response_id"]

    res = client.post(
        f"/api/responses/{resp_id}/ai-intervention",
        headers=teacher(cls["teacher_token"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["student_nickname"] == "Asha"
    assert "one_on_one_script" in data
    assert len(data["one_on_one_script"]) >= 1
    assert "concrete_counterexample" in data
    assert "check_for_understanding_question" in data


def test_ai_endpoints_require_teacher_auth(client):
    cls = create_class_with_quiz(client)
    # 401 without header
    assert client.post(f"/api/classes/{cls['class_id']}/ai-summary").status_code == 401
    assert client.post(f"/api/classes/{cls['class_id']}/ai-generate-question", json={"topic": "Math"}).status_code == 401
    # 403 with wrong token
    assert client.post(f"/api/classes/{cls['class_id']}/ai-summary", headers=teacher("wrong")).status_code == 403
