from fastapi.testclient import TestClient

QUIZ = {
    "topic": "Fractions",
    "title": "Check-in",
    "questions": [
        {
            "prompt": "What is 1/2 + 1/4?",
            "correct_answer": "3/4",
            "answer_type": "number",
            "key_idea": "Use a common denominator: 1/2 = 2/4.",
            "misconceptions": [{"label": "Adds tops and bottoms", "trigger_answers": ["2/6"]}],
            "time_limit_seconds": 60,
        },
        {
            "prompt": "Is 2/4 equal to 1/2?",
            "correct_answer": "Yes",
            "answer_type": "choice",
            "key_idea": "Equivalent fractions name the same amount.",
            "choices": ["Yes", "No"],
        },
    ],
}


def teacher(token: str) -> dict:
    return {"X-Teacher-Token": token}


def student(token: str) -> dict:
    return {"X-Student-Token": token}


def create_class(client: TestClient, name: str = "7B Maths") -> dict:
    r = client.post("/api/classes", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def create_class_with_quiz(client: TestClient, quiz: dict = QUIZ) -> dict:
    cls = create_class(client)
    r = client.put(f"/api/classes/{cls['class_id']}/quiz", headers=teacher(cls["teacher_token"]), json=quiz)
    assert r.status_code == 200, r.text
    return {**cls, "quiz": r.json()}


def join(client: TestClient, join_code: str, nickname: str = "Asha") -> dict:
    r = client.post("/api/join", json={"join_code": join_code, "nickname": nickname})
    assert r.status_code == 201, r.text
    return r.json()


def submit(client: TestClient, student_token: str, question_id: int, answer: str, explanation: str,
           confidence: str = "sure", **timing):
    return client.post(
        "/api/responses",
        headers=student(student_token),
        json={"question_id": question_id, "answer": answer, "explanation": explanation,
              "self_confidence": confidence, **timing},
    )


def follow_up_flow(client: TestClient, fake_ai) -> tuple[dict, dict, object]:
    """A student whose correct-but-unexplained answer triggers a follow-up. Returns (class, student, response)."""
    from tests.fakes import analysis, follow_up, hyp

    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    fake_ai.push(analysis("guessed", 0.8, hyp("guessed", "it looked right", 0.8)), follow_up("How would you add 1/3 and 1/6?"))
    r = submit(client, s["student_token"], s["quiz"]["questions"][0]["question_id"], "3/4", "it looked right")
    return cls, s, r
