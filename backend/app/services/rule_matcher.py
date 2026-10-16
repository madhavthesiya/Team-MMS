"""Deterministic evidence: the teacher's answer key and misconceptions, and timing data.

Code — not the AI — owns these stories, because they rest on facts the AI cannot see or verify:
which wrong answer was typed, and whether the clock ran out.
"""
from app.domain import HypothesisOut, QuestionSpec, RuleResult, StudentWork
from app.services.normalizer import answers_match

# Rules alone are weak evidence; these certainties keep rule-only labels visibly tentative.
RULE_CERTAINTY: dict[str, float] = {
    "understood": 0.5, "guessed": 0.6, "misconception": 0.6, "out_of_time": 0.6, "not_sure": 0.0,
}


def rule_diagnose(question: QuestionSpec, work: StudentWork) -> RuleResult:
    is_correct = answers_match(work.answer, question.correct_answer, question.answer_type)
    guessed = work.self_confidence == "guessed"
    if is_correct:
        if guessed:
            return RuleResult(True, "guessed", None, "Correct answer, but the student said they guessed")
        return RuleResult(True, "understood", None, "Correct answer")
    for m in question.misconceptions:
        if any(answers_match(work.answer, t, question.answer_type) for t in m.trigger_answers):
            return RuleResult(False, "misconception", m.id, f"Answer matches the known wrong answer for: {m.label}")
    if guessed:
        return RuleResult(False, "guessed", None, "Wrong answer and the student said they guessed")
    return RuleResult(False, "not_sure", None, "Wrong answer that matches no known misconception")


def timing_evidence(question: QuestionSpec, work: StudentWork) -> str | None:
    """Facts that support the "ran out of time" story, or None. Never inferred by the AI."""
    if work.timed_out and question.time_limit_seconds:
        return f"The {question.time_limit_seconds} s timer ran out and the answer was auto-submitted"
    if work.reported_out_of_time:
        return "Student said they ran out of time"
    return None


def timing_hypothesis(question: QuestionSpec, work: StudentWork, is_correct: bool) -> HypothesisOut | None:
    evidence = timing_evidence(question, work)
    if evidence is None or is_correct:
        return None
    return HypothesisOut(
        kind="out_of_time",
        misconception_id=None,
        evidence_for=evidence,
        evidence_against="",
        likelihood=0.7 if work.timed_out else RULE_CERTAINTY["out_of_time"],
        would_confirm="Give the same question again with no time limit and see if the answer changes",
    )


def rule_would_confirm(question: QuestionSpec, rule: RuleResult) -> str:
    if rule.label == "misconception":
        signal = next((m.signal_text for m in question.misconceptions if m.id == rule.misconception_id), "")
        return f"Their working should show it: {signal}" if signal else "Ask them to explain the rule they used"
    if rule.label == "understood":
        return "Ask them to explain the key idea in their own words"
    if rule.label == "guessed":
        return "Ask them to solve a similar question and explain each step"
    return ""
