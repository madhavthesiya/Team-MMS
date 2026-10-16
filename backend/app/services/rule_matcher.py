"""Deterministic first reading of an answer, using only the teacher's key and misconceptions."""
from app.domain import QuestionSpec, RuleResult, StudentWork
from app.services.normalizer import answers_match


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
