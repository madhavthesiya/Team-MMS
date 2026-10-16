"""The diagnosis workflow: rules → AI hypotheses → guardrails → decision → (maybe) one follow-up.

A pure function of its inputs (no database), so tests and the eval runner call it directly.
Every step appends a TraceStep, which the teacher sees under "Why this label?".

Decision policy:
- A mistake is a clue, not a verdict. For a wrong answer we only choose a story after weighing
  alternatives: at least MIN_STORIES_WEIGHED stories considered, and the chosen one ahead of the
  next by STORY_MARGIN. Otherwise the stories stay open and we ask one follow-up.
- Settle when the AI is confident AND agrees with the rules (or the rules had no opinion).
- Rules only look at the answer string. A follow-up reply is direct evidence about the reasoning,
  so on the second pass a confident AI label whose quoted evidence comes FROM THE REPLY settles
  the case even against the rule; the rule's reading is kept as a ruled-out hypothesis.
- "Ran out of time" rests on recorded timing (timer or student report), never on AI inference.
- All AI calls share one time budget; when it runs out we fall back to rules / a template question.
"""
import time
from collections.abc import Callable
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
from app.domain import ExpectedEvidence, FollowUpPlan, HypothesisOut, Label, QuestionSpec, RuleResult, Source, Status, StudentWork, TraceStep
from app.services.followups import choose_follow_up
from app.services.guardrails import GuardedAnalysis, apply_guardrails, looks_like_injection, quote_in
from app.services.redact import redact_pii
from app.services.rule_matcher import RULE_CERTAINTY, rule_diagnose, rule_would_confirm, timing_hypothesis

# Don't start an AI call with less time than this left in the budget.
MIN_CALL_SECONDS = 2.0
# Before choosing one story for a wrong answer: how many stories must have been weighed,
# and how far ahead of the next story the chosen one must be.
MIN_STORIES_WEIGHED = 3
STORY_MARGIN = 0.2

Clock = Callable[[], float]


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
    follow_up_rationale: str = ""
    follow_up_expected_evidence: tuple[ExpectedEvidence, ...] = ()


class _Budget:
    def __init__(self, seconds: float, clock: Clock):
        self._clock = clock
        self._deadline = clock() + seconds

    def left(self) -> float:
        return self._deadline - self._clock()


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def _key(h: HypothesisOut) -> tuple[str, int | None]:
    return h.kind, h.misconception_id


_STATUS_RANK = {"supported": 0, "open": 1, "ruled_out": 2}


def _reconcile(hypotheses: tuple[HypothesisOut, ...]) -> tuple[HypothesisOut, ...]:
    """One entry per story (kind + misconception). If a story has evidence and was also ruled out,
    keep the evidence-backed entry and carry the rejection reason into its evidence_against."""
    merged: dict[tuple[str, int | None], HypothesisOut] = {}
    for h in hypotheses:
        k = _key(h)
        if k not in merged:
            merged[k] = h
            continue
        keep, other = sorted((merged[k], h), key=lambda x: _STATUS_RANK[x.status])
        if other.status == "ruled_out" and other.evidence_against and not keep.evidence_against:
            keep = replace(keep, evidence_against=other.evidence_against)
        merged[k] = keep
    return tuple(merged.values())


def _rule_hypothesis(question: QuestionSpec, rule: RuleResult, status: str = "open") -> HypothesisOut:
    return HypothesisOut(
        kind=rule.label,
        misconception_id=rule.misconception_id,
        evidence_for=rule.reason,
        evidence_against="",
        likelihood=RULE_CERTAINTY[rule.label],
        status=status,
        would_confirm=rule_would_confirm(question, rule),
    )


def _from_rule(
    question: QuestionSpec,
    work: StudentWork,
    rule: RuleResult,
    trace: list[TraceStep],
    *,
    ai_available: bool,
    reason: str,
    force_not_sure: bool = False,
) -> DiagnosisOutcome:
    """Result from code-owned evidence only. With two competing code stories we don't pick one."""
    stories = [] if rule.label == "not_sure" else [_rule_hypothesis(question, rule)]
    timing = timing_hypothesis(question, work, rule.is_correct)
    if timing is not None and all(_key(h) != _key(timing) for h in stories):
        stories.append(timing)
    stories.sort(key=lambda h: h.likelihood, reverse=True)

    if force_not_sure or len(stories) != 1:
        label: Label = "not_sure"
        if len(stories) > 1:
            reason += f" ({len(stories)} stories fit: not choosing one without more evidence)"
    else:
        label = stories[0].kind
        stories = [replace(stories[0], status="supported")]
    trace.append(TraceStep("decision", "code", True, 0, detail=reason))
    chosen = stories[0] if label != "not_sure" else None
    return DiagnosisOutcome(
        is_correct=rule.is_correct,
        label=label,
        certainty=chosen.likelihood if chosen else 0.0,
        source="rule",
        status="not_sure" if label == "not_sure" else "settled",
        misconception_id=chosen.misconception_id if chosen and label == "misconception" else None,
        hypotheses=tuple(stories),
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


def _backs_label(h: HypothesisOut, guarded: GuardedAnalysis) -> bool:
    return h.kind == guarded.label and (guarded.label != "misconception" or h.misconception_id == guarded.misconception_id)


def _reply_backs_label(guarded: GuardedAnalysis, reply: str | None) -> bool:
    """True if the AI's chosen label is supported by a quote taken from the follow-up reply."""
    return bool(reply) and any(_backs_label(h, guarded) and quote_in(h.evidence_for, reply) for h in guarded.hypotheses)


def _story_gate(guarded: GuardedAnalysis, stories: tuple[HypothesisOut, ...], rule: RuleResult) -> str | None:
    """For a wrong answer: None if alternatives were weighed and the chosen story is clearly ahead,
    otherwise the reason we must keep the stories open."""
    weighed = {h.kind for h in stories} | {h.kind for h in guarded.ruled_out}
    if rule.label != "not_sure":
        weighed.add(rule.label)
    if len(weighed) < MIN_STORIES_WEIGHED:
        return f"only {len(weighed)} of the possible stories were weighed; need {MIN_STORIES_WEIGHED} before choosing"
    chosen = max((h.likelihood for h in stories if _backs_label(h, guarded)), default=0.0)
    runner_up = max((h.likelihood for h in stories if not _backs_label(h, guarded)), default=0.0)
    if chosen - runner_up < STORY_MARGIN:
        return f"'{guarded.label}' ({chosen:.2f}) is not clearly ahead of the next story ({runner_up:.2f})"
    return None


def _analyse(
    question: QuestionSpec, work: StudentWork, rule: RuleResult, ai: AIClient, trace: list[TraceStep], budget: _Budget
) -> AIAnalysis | None:
    prompt = build_analysis_prompt(question, work, rule.is_correct)
    for attempt in (1, 2):
        left = budget.left()
        if left < MIN_CALL_SECONDS:
            trace.append(TraceStep("ai_analysis", "ai", False, 0, ai.model, ANALYSIS_PROMPT_VERSION, "time budget used up"))
            return None
        start = time.perf_counter()
        try:
            analysis = AIAnalysis.model_validate_json(ai.generate_json(prompt, AIAnalysis, timeout_seconds=left))
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
    budget: _Budget,
) -> FollowUpPlan | None:
    left = budget.left()
    if left < MIN_CALL_SECONDS:
        trace.append(TraceStep("follow_up", "code", True, 0, detail="no time left for AI; targeted template or teacher review"))
        return choose_follow_up(question, work, hypotheses)
    start = time.perf_counter()
    try:
        raw = ai.generate_json(build_followup_prompt(question, work, list(hypotheses)), AIFollowUp, timeout_seconds=left)
        proposal = AIFollowUp.model_validate_json(raw)
    except (AIUnavailable, ValidationError):
        trace.append(TraceStep("follow_up", "code", True, _ms(start), detail="AI unavailable; targeted template or teacher review"))
        return choose_follow_up(question, work, hypotheses)
    plan = choose_follow_up(question, work, hypotheses, proposal)
    generated = plan is not None and plan.question in [c.question.strip() for c in [proposal, *proposal.alternatives]]
    trace.append(TraceStep(
        "follow_up", "ai" if generated else "code", True, _ms(start), ai.model, FOLLOWUP_PROMPT_VERSION,
        "brief safe candidate selected (word-count heuristic, not measured gain)" if generated
        else "unsafe/repetitive candidates rejected; targeted template or teacher review",
    ))
    return plan


def run_diagnosis(
    question: QuestionSpec,
    work: StudentWork,
    ai: AIClient,
    *,
    threshold: float,
    allow_follow_up: bool,
    budget_seconds: float = 30.0,
    clock: Clock = time.monotonic,
) -> DiagnosisOutcome:
    budget = _Budget(budget_seconds, clock)
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
        return _from_rule(question, work, rule, trace, ai_available=True, force_not_sure=True,
                          reason="possible instruction injection → not sure, teacher should look")

    analysis = _analyse(question, work, rule, ai, trace, budget)
    if analysis is None:
        return _from_rule(question, work, rule, trace, ai_available=False, reason="AI unavailable → rule-based result only")

    start = time.perf_counter()
    guarded = apply_guardrails(analysis, question, work, rule.is_correct)
    trace.append(TraceStep("guardrails", "code", True, _ms(start), detail="; ".join(guarded.notes) or "all evidence checked out"))

    # Every story with evidence: the AI's, plus the timing story the code owns.
    stories = guarded.hypotheses
    ruled_out = guarded.ruled_out
    timing = timing_hypothesis(question, work, rule.is_correct)
    if timing is not None:
        if all(_key(h) != _key(timing) for h in stories):
            stories = tuple(sorted((*stories, timing), key=lambda h: h.likelihood, reverse=True))
        # Recorded timing is a fact; the model can't rule the timing story out.
        ruled_out = tuple(h for h in ruled_out if h.kind != "out_of_time")
        guarded = replace(guarded, ruled_out=ruled_out)

    confident = guarded.label != "not_sure" and guarded.certainty >= threshold
    agrees = _agrees(rule, guarded)
    reply_settles = confident and not agrees and _reply_backs_label(guarded, work.follow_up_reply)
    gate = _story_gate(guarded, stories, rule) if confident and not rule.is_correct else None

    if confident and (agrees or reply_settles) and gate is None:
        settled = tuple(replace(h, status="supported") if _backs_label(h, guarded) else h for h in stories)
        source: Source = "both" if rule.label == guarded.label else "ai"
        if reply_settles:
            settled = (
                *(h for h in settled if _key(h) != (rule.label, rule.misconception_id)),
                _rule_hypothesis(question, rule, "ruled_out"),
            )
            detail = f"follow-up reply supports '{guarded.label}' over the answer-pattern rule ('{rule.label}')"
        else:
            detail = f"settled as '{guarded.label}' ({source})"
        trace.append(TraceStep("decision", "code", True, 0, detail=detail))
        return DiagnosisOutcome(rule.is_correct, guarded.label, guarded.certainty, source, "settled",
                                guarded.misconception_id, _reconcile((*settled, *guarded.ruled_out)), None, (), True, tuple(trace))

    if gate is not None:
        reason = gate
    elif confident:
        reason = f"rules say '{rule.label}', AI says '{guarded.label}'"
    else:
        reason = "AI not confident enough"
    hypotheses = stories
    rule_h: HypothesisOut | None = None
    if rule.label != "not_sure":
        rule_h = next((h for h in hypotheses if _key(h) == (rule.label, rule.misconception_id)), None)
        if rule_h is None:
            rule_h = _rule_hypothesis(question, rule)
            hypotheses = (*hypotheses, rule_h)

    if not allow_follow_up:
        trace.append(TraceStep("decision", "code", True, 0, detail=f"{reason} → not sure, sent to the teacher"))
        return DiagnosisOutcome(rule.is_correct, "not_sure", guarded.certainty, "both", "not_sure",
                                None, _reconcile((*hypotheses, *guarded.ruled_out)), None, (), True, tuple(trace))

    if confident and not agrees and rule_h is not None:  # rule vs AI: ask what separates the two views
        ai_h = next((h for h in hypotheses if _backs_label(h, guarded) and h is not rule_h), None)
        top_two = (ai_h, rule_h) if ai_h is not None else hypotheses[:2]
    else:
        top_two = hypotheses[:2]
    plan = _follow_up(question, work, rule, top_two, ai, trace, budget)
    trace.append(TraceStep("decision", "code", True, 0, detail=f"{reason} → " + (
        "offered one optional follow-up" if plan else "no useful safe check; teacher review"
    )))
    return DiagnosisOutcome(rule.is_correct, "not_sure", guarded.certainty, "both", "open" if plan else "not_sure", None,
                            _reconcile((*hypotheses, *guarded.ruled_out)), plan.question if plan else None,
                            tuple(h.kind for h in top_two) if plan else (), True, tuple(trace),
                            plan.rationale if plan else "", plan.expected_evidence if plan else ())
