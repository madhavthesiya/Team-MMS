"""Riddle 2 — One Error, Several Stories.

The same wrong answer can come from a mistaken rule, a missed condition, or running out of time.
A mistake is a clue, not a verdict: weigh the stories before choosing one, and show what would confirm each.
"""
from app.domain import MisconceptionSpec, QuestionSpec, StudentWork
from app.services.pipeline import run_diagnosis
from tests.fakes import WEIGHED, FakeAIClient, analysis, follow_up, hyp, out
from tests.helpers import create_class_with_quiz, join, submit, teacher

Q = QuestionSpec(
    prompt="What is 1/2 + 1/4?",
    correct_answer="3/4",
    answer_type="number",
    key_idea="Use a common denominator.",
    misconceptions=(MisconceptionSpec(id=7, label="Adds tops and bottoms", trigger_answers=("2/6",)),),
    time_limit_seconds=60,
)


def run(work, ai):
    return run_diagnosis(Q, work, ai, threshold=0.7, allow_follow_up=True)


# ---------- pipeline ----------


def test_wrong_answer_is_not_pinned_on_the_first_story_that_comes_to_mind():
    work = StudentWork(answer="5/8", explanation="I added the tops and the bottoms", self_confidence="sure")
    ai = FakeAIClient()
    ai.push(analysis("misconception", 0.9, hyp("misconception", "added the tops and the bottoms", 0.9, 7),
                     misconception_id=7), follow_up("What would 1/2 look like in quarters?"))
    result = run(work, ai)
    assert result.status == "open"
    assert any("stories were weighed" in (t.detail or "") for t in result.trace)


def test_story_is_chosen_once_alternatives_were_weighed_and_it_is_clearly_ahead():
    work = StudentWork(answer="5/8", explanation="I added the tops and the bottoms", self_confidence="sure")
    ai = FakeAIClient()
    ai.push(analysis("misconception", 0.9,
                     hyp("misconception", "added the tops and the bottoms", 0.9, 7, confirm="Same mistake on a new pair"),
                     misconception_id=7, ruled_out=WEIGHED))
    result = run(work, ai)
    assert (result.label, result.status, result.misconception_id) == ("misconception", "settled", 7)
    assert result.hypotheses[0].would_confirm == "Same mistake on a new pair"
    assert {h.kind for h in result.hypotheses if h.status == "ruled_out"} == {"slip", "out_of_time"}


def test_two_close_stories_stay_open_and_the_follow_up_separates_them():
    work = StudentWork(answer="5/8", explanation="I added the tops then I think I read it wrong", self_confidence="sure")
    ai = FakeAIClient()
    ai.push(analysis("misconception", 0.75, hyp("misconception", "I added the tops", 0.75, 7),
                     hyp("misread", "I read it wrong", 0.65), misconception_id=7, ruled_out=WEIGHED),
            follow_up("Can you read the question again and tell me what it asks?"))
    result = run(work, ai)
    assert result.status == "open"
    assert set(result.follow_up_discriminates) == {"misconception", "misread"}


def test_ran_out_of_time_rests_on_the_timer_not_on_ai_inference():
    work = StudentWork(answer="5/8", explanation="", self_confidence="unsure", time_spent_seconds=60, timed_out=True)
    ai = FakeAIClient()
    ai.push(analysis("out_of_time", 0.85, hyp("out_of_time", "", 0.85),
                     ruled_out=(out("misread", "no sign they misread"), out("slip", "no working shown"))))
    result = run(work, ai)
    assert (result.label, result.status) == ("out_of_time", "settled")
    assert result.hypotheses[0].evidence_for == "The 60 s timer ran out and the answer was auto-submitted"
    assert "timer ran out: yes" in ai.prompts[0]


def test_ai_cannot_claim_ran_out_of_time_without_timing_evidence():
    work = StudentWork(answer="5/8", explanation="hmm", self_confidence="sure", time_spent_seconds=12)
    ai = FakeAIClient()
    ai.push(analysis("out_of_time", 0.9, hyp("out_of_time", "", 0.9), ruled_out=WEIGHED), follow_up("How did you start?"))
    result = run(work, ai)
    assert result.label == "not_sure"
    assert any("no timer or student report" in (t.detail or "") for t in result.trace)


def test_timer_story_counts_as_a_close_runner_up():
    work = StudentWork(answer="5/8", explanation="I think it asked for 1/2 of 1/4", self_confidence="sure", timed_out=True)
    ai = FakeAIClient()
    ai.push(analysis("misread", 0.8, hyp("misread", "asked for 1/2 of 1/4", 0.8), ruled_out=WEIGHED), follow_up("Q?"))
    result = run(work, ai)
    assert result.status == "open"  # 0.8 against the timer story's 0.7: not clearly ahead
    assert "out_of_time" in {h.kind for h in result.hypotheses}


def test_without_ai_two_code_stories_are_not_decided():
    work = StudentWork(answer="2/6", explanation="", self_confidence="sure", timed_out=True)
    result = run(work, FakeAIClient())
    assert (result.label, result.status, result.source) == ("not_sure", "not_sure", "rule")
    assert {h.kind for h in result.hypotheses} == {"misconception", "out_of_time"}


def test_without_ai_a_single_timer_story_is_used():
    work = StudentWork(answer="5/8", explanation="", self_confidence="sure", reported_out_of_time=True)
    result = run(work, FakeAIClient())
    assert (result.label, result.status, result.source) == ("out_of_time", "settled", "rule")


# ---------- API ----------


def test_time_limit_reaches_the_student_and_a_timeout_needs_a_timer(client):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    q1, q2 = s["quiz"]["questions"]
    assert (q1["time_limit_seconds"], q2["time_limit_seconds"]) == (60, None)
    r = submit(client, s["student_token"], q2["question_id"], "No", "", timed_out=True, time_spent_seconds=5)
    d = client.get(f"/api/responses/{r.json()['response_id']}", headers=teacher(cls["teacher_token"])).json()
    assert (d["timed_out"], d["time_spent_seconds"]) == (False, 5)  # Q2 has no timer, so it can't time out


def test_same_wrong_answer_is_shown_with_its_different_stories(client, fake_ai):
    cls = create_class_with_quiz(client)
    q1 = cls["quiz"]["questions"][0]["question_id"]
    asha, ravi, mina = (join(client, cls["join_code"], n) for n in ("Asha", "Ravi", "Mina"))
    fake_ai.push(analysis("misread", 0.9, hyp("misread", "asked for 1/2 of 1/4", 0.9), ruled_out=WEIGHED))
    submit(client, asha["student_token"], q1, "5/8", "I thought it asked for 1/2 of 1/4 plus 1/2")
    fake_ai.push(analysis("slip", 0.9, hyp("slip", "2/4 + 1/4 = 5/8", 0.9),
                          ruled_out=(out("misread", "read it right"), out("out_of_time", "had time"))))
    submit(client, ravi["student_token"], q1, "0.625", "1/2 = 2/4 and 2/4 + 1/4 = 5/8 oops")
    fake_ai.push(analysis("out_of_time", 0.85, hyp("out_of_time", "", 0.85),
                          ruled_out=(out("misread", "no working"), out("slip", "no working"))))
    submit(client, mina["student_token"], q1, "5/8", "", confidence="unsure", timed_out=True, time_spent_seconds=60)

    res = client.get(f"/api/classes/{cls['class_id']}/results", headers=teacher(cls["teacher_token"])).json()
    first = res["questions"][0]
    assert first["same_wrong_answer_different_stories"] is True
    [group] = first["wrong_answers"]  # 5/8 and 0.625 are the same answer
    assert (group["count"], group["several_stories"]) == (3, True)
    assert [(s["label"], s["count"]) for s in group["stories"]] == [("misread", 1), ("slip", 1), ("out_of_time", 1)]
    assert [e["nickname"] for e in group["students"]] == ["Asha", "Mina", "Ravi"]


def test_response_detail_shows_what_would_confirm_each_story(client, fake_ai):
    cls = create_class_with_quiz(client)
    s = join(client, cls["join_code"])
    fake_ai.push(analysis("misread", 0.9, hyp("misread", "asked for 1/2 of 1/4", 0.9, confirm="Re-read and answer correctly"),
                          ruled_out=WEIGHED))
    r = submit(client, s["student_token"], cls["quiz"]["questions"][0]["question_id"], "5/8", "it asked for 1/2 of 1/4")
    d = client.get(f"/api/responses/{r.json()['response_id']}", headers=teacher(cls["teacher_token"])).json()
    stories = {h["kind"]: h for h in d["diagnosis"]["hypotheses"]}
    assert stories["misread"]["would_confirm"] == "Re-read and answer correctly"
    assert stories["slip"]["status"] == "ruled_out" and stories["slip"]["evidence_against"]
