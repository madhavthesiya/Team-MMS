from sqlalchemy import func, select

from app.config import Settings
from app.models import AIRun, ClassRoom, Diagnosis, FollowUp, Hypothesis, Misconception, Question, Quiz, Response, Student
from app.rate_limit import RateLimiter
from app.security import hash_token, new_join_code, token_matches
from tests.helpers import create_class_with_quiz, join, submit


def test_health_reports_ok_and_ai_not_configured(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok", "ai_configured": False}


def test_hosted_postgres_url_uses_psycopg_driver():
    s = Settings(_env_file=None, database_url="postgres://db.example.com/app")
    assert s.sqlalchemy_url == "postgresql+psycopg://db.example.com/app"


def test_blank_database_url_falls_back_to_sqlite():
    assert Settings(_env_file=None, database_url="").sqlalchemy_url.startswith("sqlite:///")


def test_rate_limiter_blocks_after_limit_and_window_slides():
    rl = RateLimiter(2, 60)
    assert rl.allow("ip", now=0) and rl.allow("ip", now=1)
    assert not rl.allow("ip", now=2)
    assert rl.allow("other-ip", now=2)
    assert rl.allow("ip", now=60.5)


def test_rate_limiter_parses_spec():
    rl = RateLimiter.from_string("30/minute")
    assert (rl.max_requests, rl.window_seconds) == (30, 60)


def test_public_endpoints_return_429_over_the_ip_limit(make_client, settings):
    client = make_client(settings.model_copy(update={"rate_limit_public": "2/minute"}))
    codes = [client.post("/api/classes", json={"name": "x"}).status_code for _ in range(3)]
    assert codes == [201, 201, 429]


def test_classmates_on_one_wifi_ip_each_get_their_own_answer_quota(make_client, settings):
    client = make_client(settings.model_copy(update={"rate_limit_student": "2/minute"}))
    cls = create_class_with_quiz(client)
    asha, ravi = join(client, cls["join_code"], "Asha"), join(client, cls["join_code"], "Ravi")
    q1, q2 = (q["question_id"] for q in cls["quiz"]["questions"])
    assert submit(client, asha["student_token"], q1, "3/4", "x").status_code == 201
    assert submit(client, asha["student_token"], q2, "Yes", "x").status_code == 201
    assert submit(client, asha["student_token"], q2, "Yes", "x").status_code == 429
    assert submit(client, ravi["student_token"], q1, "3/4", "x").status_code == 201  # same IP, own quota


def test_tokens_are_hashed_and_join_codes_are_readable():
    assert hash_token("abc") == hash_token("abc") != "abc"
    assert token_matches("abc", hash_token("abc")) and not token_matches("abd", hash_token("abc"))
    code = new_join_code()
    assert len(code) == 6 and not set(code) & set("01OI")


def test_deleting_a_class_removes_everything_under_it(db):
    cls = ClassRoom(name="7B", join_code="ABC234", teacher_token_hash="x" * 64)
    quiz = Quiz(classroom=cls, topic="Fractions", title="t")
    q = Question(quiz=quiz, position=1, prompt="1/2 + 1/4?", correct_answer="3/4", answer_type="number", key_idea="k")
    Misconception(question=q, label="adds across", trigger_answers=["2/6"])
    s = Student(classroom=cls, nickname="Asha", token_hash="y" * 64)
    r = Response(student=s, question=q, answer_raw="3/4", explanation_raw="e", self_confidence="sure", is_correct=True)
    d = Diagnosis(response=r, version=1, label="understood", certainty=0.9, source="both", status="settled")
    Hypothesis(diagnosis=d, kind="understood", evidence_for="e", likelihood=0.9)
    FollowUp(diagnosis=d, question_text="why?")
    AIRun(diagnosis=d, step="rule_match", source="rule", latency_ms=1, ok=True)
    db.add(cls)
    db.commit()
    assert r.current_diagnosis is d

    db.delete(cls)
    db.commit()
    for model in (Quiz, Question, Misconception, Student, Response, Diagnosis, Hypothesis, FollowUp, AIRun):
        assert db.scalar(select(func.count()).select_from(model)) == 0
