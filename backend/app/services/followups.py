"""Riddle 3: choose a brief, safe check; predictions stay separate from observed evidence.

Word count is a burden heuristic, not measured information gain. Semantic usefulness still
needs evaluation and teacher judgement. No extra model calls are spent ranking candidates.
"""
import re

from app.ai.schemas import AIFollowUp
from app.domain import ExpectedEvidence, FollowUpPlan, HypothesisOut, QuestionSpec, StudentWork
from app.services.guardrails import leaks_answer

MAX_FOLLOWUP_WORDS = 30
_JUDGEMENT = re.compile(r"wrong answer|incorrect|you failed|you are wrong|obvious|careless|correct answer", re.I)
_REPEAT = re.compile(r"walk me through|explain.*again|how (?:did|do) you (?:get|arrive)|repeat your", re.I)
_LEADING = re.compile(r"^(?:did you mean|is the answer|don't you|surely|you meant)\b", re.I)

_OBSERVATIONS = {
    "understood": "Explains why the method works, rather than only repeating the answer.",
    "guessed": "Says they chose without a method or cannot explain their choice.",
    "misread": "Describes a different condition or task from the one in the original question.",
    "misconception": "Explains a rule matching this teacher-defined misconception.",
    "slip": "Describes a sound method and identifies a calculation or copying mistake.",
    "out_of_time": "Recorded timing supports time pressure; an untimed explanation adds context, not proof of cause.",
}


def _norm(text: str) -> str:
    return " ".join(re.findall(r"\w+", text.casefold()))


def _safe(text: str, question: QuestionSpec, work: StudentWork) -> bool:
    return bool(
        text.strip()
        and len(text.split()) <= MAX_FOLLOWUP_WORDS
        and text.count("?") <= 1
        and _norm(text) != _norm(question.prompt)
        and not _JUDGEMENT.search(text)
        and not _LEADING.search(text)
        and not (work.explanation.strip() and _REPEAT.search(text))
        and not leaks_answer(text, question)
    )


def choose_follow_up(
    question: QuestionSpec,
    work: StudentWork,
    hypotheses: tuple[HypothesisOut, ...],
    proposal: AIFollowUp | None = None,
) -> FollowUpPlan | None:
    targets = {(h.kind, h.misconception_id): h for h in hypotheses}
    if not targets:
        return None
    defaults = tuple(
        ExpectedEvidence(h.kind, h.misconception_id, h.would_confirm or _OBSERVATIONS[h.kind])
        for h in targets.values()
    )
    candidates: list[FollowUpPlan] = []
    if proposal:
        for candidate in [proposal, *proposal.alternatives]:
            text = candidate.question.strip()
            if not _safe(text, question, work):
                continue
            if candidate.expected_evidence:
                expected = tuple(
                    ExpectedEvidence(e.kind, e.misconception_id, e.observation.strip())
                    for e in candidate.expected_evidence
                )
                keys = [(e.kind, e.misconception_id) for e in expected]
                if any(not e.observation for e in expected):
                    continue
                if len(set(keys)) != len(keys) or set(keys) != set(targets):
                    continue
                if len({_norm(e.observation) for e in expected}) != len(expected):
                    continue
            else:
                # Older model output remains usable; these are explicitly proposed signals,
                # derived from the existing hypotheses, not fabricated student observations.
                expected = defaults
            rationale = candidate.rationale.strip() or (
                "A proposed check of the competing stories; expected signals come from their confirmation hints."
            )
            candidates.append(FollowUpPlan(text, rationale, expected))
    if candidates:
        return min(candidates, key=lambda c: len(c.question.split()))

    kinds = {h.kind for h in hypotheses}
    if "misread" in kinds:
        text = "In your own words, what was the question asking you to find?"
    elif {"misconception", "slip"} <= kinds:
        text = "Which rule did you use, and what would you check in your working?"
    elif {"understood", "guessed"} <= kinds:
        text = "What makes your method work on another example?"
    elif "out_of_time" in kinds:
        text = "Without a timer, what would your next step have been?"
    elif not work.explanation.strip():
        text = "What was your first step, and why?"
    else:
        return None  # No useful safe template: preserve uncertainty for the teacher.
    if not _safe(text, question, work):
        return None
    return FollowUpPlan(
        text, "Rule-based check of the competing stories, without repeating the original task. Teacher review is still needed.",
        defaults,
    )
