"""Shapes the model must return. Enforced twice: as the Gemini response schema, then by Pydantic."""
from pydantic import BaseModel, Field

from app.domain import HypothesisKind, Label


class AIHypothesis(BaseModel):
    kind: HypothesisKind
    misconception_id: int | None = None
    evidence_quote: str = Field(default="", max_length=600)
    evidence_against: str = Field(default="", max_length=600)
    likelihood: float = Field(ge=0, le=1)
    would_confirm: str = Field(default="", max_length=300)


class AIRuledOut(BaseModel):
    """A story the model weighed and rejected, with the reason it does not fit."""

    kind: HypothesisKind
    misconception_id: int | None = None
    reason: str = Field(min_length=1, max_length=400)


class AIAnalysis(BaseModel):
    hypotheses: list[AIHypothesis] = Field(default_factory=list, max_length=6)
    alternatives_ruled_out: list[AIRuledOut] = Field(default_factory=list, max_length=8)
    label: Label
    certainty: float = Field(ge=0, le=1)
    misconception_id: int | None = None


class AIFollowUp(BaseModel):
    question: str = Field(min_length=1, max_length=400)


class AIRawScriptTurn(BaseModel):
    teacher_prompt: str
    anticipated_student_thinking: str


class AIRawIntervention(BaseModel):
    misconception_breakdown: str
    one_on_one_script: list[AIRawScriptTurn] = Field(default_factory=list, min_length=1, max_length=5)
    concrete_counterexample: str
    check_for_understanding_question: str


class AIRawMisconception(BaseModel):
    label: str
    trigger_answers: list[str] = Field(default_factory=list)
    signal_text: str = ""
    remedy_hint: str = ""


class AIRawQuestion(BaseModel):
    prompt: str
    correct_answer: str
    answer_type: str = "number"  # "number" | "text" | "choice"
    key_idea: str
    choices: list[str] = Field(default_factory=list)
    misconceptions: list[AIRawMisconception] = Field(default_factory=list, min_length=2, max_length=5)
    time_limit_seconds: int = 90


class AIRawGroup(BaseModel):
    group_name: str
    focus_story: str
    student_count: int
    student_nicknames: list[str] = Field(default_factory=list)
    suggested_action: str


class AIRawClassSummary(BaseModel):
    executive_summary: str
    dominant_misconception: str
    undercover_guessers_warning: str
    ten_minute_reteach_plan: list[str] = Field(default_factory=list, min_length=2, max_length=5)
    differentiated_groups: list[AIRawGroup] = Field(default_factory=list)

