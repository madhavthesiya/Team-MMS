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


def test_ai_class_summary_empty_class(client):
    cls = create_class_with_quiz(client)
    res = client.post(
        f"/api/classes/{cls['class_id']}/ai-summary",
        headers=teacher(cls["teacher_token"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_students"] == 0
    assert data["correct_count"] == 0
    assert "No student responses have been submitted yet" in data["executive_summary"]
    assert len(data["ten_minute_reteach_plan"]) >= 1


def test_ai_question_generator_trigger_sanitization():
    import json
    from app.schemas import AIGenerateQuestionIn
    from app.services.ai_features import generate_ai_question

    class MockAI:
        model = "mock"

        def generate_json(self, prompt, schema, timeout_seconds=None):
            return json.dumps({
                "prompt": "What is 3/4 + 1/4?",
                "correct_answer": "1",
                "answer_type": "choice",
                "choices": ["4/8", "2/4"],  # Missing "1"
                "key_idea": "Fractions with common denominators add numerators only",
                "misconceptions": [
                    {
                        "label": "Add all across",
                        "trigger_answers": ["4/8", "1"],  # "1" matches correct_answer!
                        "signal_text": "added denominators",
                        "remedy_hint": "Use visual pie chart",
                    }
                ],
                "time_limit_seconds": 60,
            })

    out = generate_ai_question(AIGenerateQuestionIn(topic="Fractions", grade_level="Grade 5"), MockAI())
    assert "1" in out.choices
    assert len(out.choices) >= 2
    # "1" must be stripped from trigger_answers to prevent QuestionIn validation failure
    assert "1" not in out.misconceptions[0].trigger_answers
    assert "4/8" in out.misconceptions[0].trigger_answers


def test_composite_ai_client_failover():
    from pydantic import BaseModel
    from app.ai.client import AIUnavailable, CompositeAIClient

    class Dummy(BaseModel):
        msg: str

    class FailingClient:
        model = "failing"

        def generate_json(self, prompt, schema, timeout_seconds=None):
            raise AIUnavailable("rate_limited")

    class WorkingClient:
        model = "working"

        def generate_json(self, prompt, schema, timeout_seconds=None):
            return '{"msg": "ok"}'

    client = CompositeAIClient(primary=FailingClient(), fallback=WorkingClient())
    res = client.generate_json("hi", Dummy)
    assert res == '{"msg": "ok"}'


def test_ai_intervention_correct_answer_riddle_1(client):
    cls = create_class_with_quiz(client)
    tok = join(client, cls["join_code"])["student_token"]
    q_id = cls["quiz"]["questions"][0]["question_id"]
    # Student gives correct answer 5/6, but guessed or gave lucky wrong explanation
    sub = submit(client, tok, q_id, answer="5/6", explanation="I just guessed C because it looked biggest").json()
    resp_id = sub["response_id"]

    res = client.post(
        f"/api/responses/{resp_id}/ai-intervention",
        headers=teacher(cls["teacher_token"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert "one_on_one_script" in data
    assert len(data["one_on_one_script"]) >= 1
    assert "concrete_counterexample" in data
    assert "check_for_understanding_question" in data


