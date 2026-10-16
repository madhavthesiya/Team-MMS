"""The diagnosis workflow: rules → AI hypotheses → guardrails → decision → (maybe) one follow-up.

A pure function of its inputs (no database), so tests and the eval runner call it directly.
Every step appends a TraceStep, which the teacher sees under "Why this label?".
"""
import time
from dataclasses import dataclass, replace

from pydantic import ValidationError

from app.ai.client import AIClient, AIUnavailable
from app.ai.prompts import (
    ANALYSIS_PROMPT_VERSION,
    FOLLOWUP_PROMPT_VERSION,
    build_analysis_prompt,
    build_followup_prompt,
)
from app.ai.schemas import AIAnalysis, AIFollowUp
from app.domain import HypothesisOut, Label, QuestionSpec, RuleResult, Source, Status, StudentWork, TraceStep
from app.services.guardrails import GuardedAnalysis, apply_guardrails, leaks_answer, looks_like_injection
from app.services.redact import redact_pii
from app.services.rule_matcher import rule_diagnose

# Rules alone are weak evidence; these certainties keep rule-only labels visibly tentative.
RULE_CERTAINTY: dict[str, float] = {"understood": 0.5, "guessed": 0.6, "misconception": 0.6, "not_sure": 0.0}


@dataclass(frozen=True)
class DiagnosisOutcome:
    is_correct: bool
    label: Label
    certainty: float
    source: Source
    status: Status
    misconception_id: int | None
    hypotheses: tuple[HypothesisOut, ...]
    follow_up_question: str | None
    follow_up_discriminates: tuple[str, ...]
    ai_available: bool
    trace: tuple[TraceStep, ...]


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def _rule_hypothesis(rule: RuleResult, status: str = "open") -> HypothesisOut:
    return HypothesisOut(
        kind=rule.label,
        misconception_id=rule.misconception_id,
        evidence_for=rule.reason,
        evidence_against="",
        likelihood=RULE_CERTAINTY[rule.label],
        status=status,
    )


def _from_rule(
    rule: RuleResult, trace: list[TraceStep], *, ai_available: bool, reason: str, force_not_sure: bool = False
) -> DiagnosisOutcome:
    label: Label = "not_sure" if force_not_sure else rule.label
    hypotheses = () if rule.label == "not_sure" else (_rule_hypothesis(rule, "open" if force_not_sure else "supported"),)
    trace.append(TraceStep("decision", "code", True, 0, detail=reason))
    return DiagnosisOutcome(
        is_correct=rule.is_correct,
        label=label,
        certainty=RULE_CERTAINTY[label],
        source="rule",
        status="not_sure" if label == "not_sure" else "settled",
        misconception_id=rule.misconception_id if label == "misconception" else None,
        hypotheses=hypotheses,
        follow_up_question=None,
        follow_up_discriminates=(),
        ai_available=ai_available,
        trace=tuple(trace),
    )


def _agrees(rule: RuleResult, guarded: GuardedAnalysis) -> bool:
    if rule.label == "not_sure":  # rules had no opinion, nothing to disagree with
        return True
    if rule.label != guarded.label:
        return False
    return rule.label != "misconception" or rule.misconception_id == guarded.misconception_id


def _analyse(
    question: QuestionSpec, work: StudentWork, rule: RuleResult, ai: AIClient, trace: list[TraceStep]
) -> AIAnalysis | None:
    prompt = build_analysis_prompt(question, work, rule.is_correct)
    for attempt in (1, 2):
        start = time.perf_counter()
        try:
            analysis = AIAnalysis.model_validate_json(ai.generate_json(prompt, AIAnalysis))
        except AIUnavailable as exc:
            trace.append(TraceStep("ai_analysis", "ai", False, _ms(start), ai.model, ANALYSIS_PROMPT_VERSION,
                                   f"AI unavailable: {exc.kind}"))
            return None
        except ValidationError:
            trace.append(TraceStep("ai_analysis", "ai", False, _ms(start), ai.model, ANALYSIS_PROMPT_VERSION,
                                   f"unusable output (attempt {attempt})"))
            continue
        trace.append(TraceStep("ai_analysis", "ai", True, _ms(start), ai.model, ANALYSIS_PROMPT_VERSION,
                               f"proposed '{analysis.label}' at {analysis.certainty:.2f}"))
        return analysis
    return None


def _follow_up(
    question: QuestionSpec,
    work: StudentWork,
    rule: RuleResult,
    hypotheses: tuple[HypothesisOut, ...],
    ai: AIClient,
    trace: list[TraceStep],
) -> str:
    template = f"Walk me through, step by step, how you got {work.answer.strip()}."
    start = time.perf_counter()
    try:
        raw = ai.generate_json(build_followup_prompt(question, work, list(hypotheses)), AIFollowUp)
        text = AIFollowUp.model_validate_json(raw).question.strip()
    except (AIUnavailable, ValidationError):
        trace.append(TraceStep("follow_up", "code", True, _ms(start), detail="AI could not write a question; used the template"))
        return template
    if not rule.is_correct and leaks_answer(text, question):
        trace.append(TraceStep("follow_up", "code", True, _ms(start), detail="AI question revealed the answer; used the template"))
        return template
    trace.append(TraceStep("follow_up", "ai", True, _ms(start), ai.model, FOLLOWUP_PROMPT_VERSION, "targeted question written"))
    return text


def run_diagnosis(
    question: QuestionSpec, work: StudentWork, ai: AIClient, *, threshold: float, allow_follow_up: bool
) -> DiagnosisOutcome:
    trace: list[TraceStep] = []
    work = replace(
        work,
        explanation=redact_pii(work.explanation),
        follow_up_reply=redact_pii(work.follow_up_reply) if work.follow_up_reply else work.follow_up_reply,
    )

    start = time.perf_counter()
    rule = rule_diagnose(question, work)
    trace.append(TraceStep("rule_match", "rule", True, _ms(start), detail=rule.reason))

    if looks_like_injection(f"{work.explanation}\n{work.follow_up_reply or ''}"):
        trace.append(TraceStep("guardrails", "code", True, 0, detail="student text looks like instructions to the AI; AI skipped"))
        return _from_rule(rule, trace, ai_available=True, force_not_sure=True,
                          reason="possible instruction injection → not sure, teacher should look")

    analysis = _analyse(question, work, rule, ai, trace)
    if analysis is None:
        return _from_rule(rule, trace, ai_available=False, reason="AI unavailable → rule-based result only")

    start = time.perf_counter()
    guarded = apply_guardrails(analysis, question, work, rule.is_correct)
    trace.append(TraceStep("guardrails", "code", True, _ms(start), detail="; ".join(guarded.notes) or "all evidence checked out"))

    confident = guarded.label != "not_sure" and guarded.certainty >= threshold
    if confident and _agrees(rule, guarded):
        hypotheses = tuple(
            replace(h, status="supported")
            if h.kind == guarded.label and h.misconception_id == guarded.misconception_id
            else h
            for h in guarded.hypotheses
        )
        source: Source = "both" if rule.label == guarded.label else "ai"
        trace.append(TraceStep("decision", "code", True, 0, detail=f"settled as '{guarded.label}' ({source})"))
        return DiagnosisOutcome(rule.is_correct, guarded.label, guarded.certainty, source, "settled",
                                guarded.misconception_id, hypotheses, None, (), True, tuple(trace))

    reason = f"rules say '{rule.label}', AI says '{guarded.label}'" if confident else "AI not confident enough"
    hypotheses = guarded.hypotheses
    rule_h: HypothesisOut | None = None
    if rule.label != "not_sure":
        rule_h = next((h for h in hypotheses if h.kind == rule.label and h.misconception_id == rule.misconception_id), None)
        if rule_h is None:
            rule_h = _rule_hypothesis(rule)
            hypotheses = (*hypotheses, rule_h)

    if not allow_follow_up:
        trace.append(TraceStep("decision", "code", True, 0, detail=f"{reason} → not sure, sent to the teacher"))
        return DiagnosisOutcome(rule.is_correct, "not_sure", guarded.certainty, "both", "not_sure",
                                None, hypotheses, None, (), True, tuple(trace))

    if confident and rule_h is not None:  # a real disagreement: ask the question that separates the two views
        ai_h = next(h for h in hypotheses if h.kind == guarded.label and h is not rule_h)
        top_two = (ai_h, rule_h)
    else:
        top_two = hypotheses[:2]
    question_text = _follow_up(question, work, rule, top_two, ai, trace)
    trace.append(TraceStep("decision", "code", True, 0, detail=f"{reason} → asked one follow-up"))
    return DiagnosisOutcome(rule.is_correct, "not_sure", guarded.certainty, "both", "open", None, hypotheses,
                            question_text, tuple(h.kind for h in top_two), True, tuple(trace))
