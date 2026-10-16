"""Plain data types shared by the rule matcher, AI layer, guardrails, pipeline and eval runner.

No database or web imports here, so everything that uses these can run and be tested in isolation.
"""
from dataclasses import dataclass
from typing import Literal

AnswerType = Literal["number", "text", "choice"]
Confidence = Literal["sure", "unsure", "guessed"]
Label = Literal["understood", "misread", "misconception", "guessed", "slip", "not_sure"]
HypothesisKind = Literal["understood", "misread", "misconception", "guessed", "slip"]
Source = Literal["rule", "ai", "both", "teacher"]
Status = Literal["open", "settled", "not_sure"]
HypStatus = Literal["open", "supported", "ruled_out"]


@dataclass(frozen=True)
class MisconceptionSpec:
    id: int
    label: str
    trigger_answers: tuple[str, ...]
    signal_text: str = ""
    remedy_hint: str = ""


@dataclass(frozen=True)
class QuestionSpec:
    prompt: str
    correct_answer: str
    answer_type: AnswerType
    key_idea: str
    misconceptions: tuple[MisconceptionSpec, ...] = ()


@dataclass(frozen=True)
class StudentWork:
    answer: str
    explanation: str
    self_confidence: Confidence
    follow_up_question: str | None = None
    follow_up_reply: str | None = None


@dataclass(frozen=True)
class RuleResult:
    is_correct: bool
    label: Label
    misconception_id: int | None
    reason: str


@dataclass(frozen=True)
class HypothesisOut:
    kind: HypothesisKind
    misconception_id: int | None
    evidence_for: str
    evidence_against: str
    likelihood: float
    status: HypStatus = "open"


@dataclass(frozen=True)
class TraceStep:
    step: str
    source: str
    ok: bool
    latency_ms: int
    model: str | None = None
    prompt_version: str | None = None
    detail: str | None = None
