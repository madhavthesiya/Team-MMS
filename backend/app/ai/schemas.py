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


class AIExpectedEvidence(BaseModel):
    kind: HypothesisKind
    misconception_id: int | None = None
    observation: str = Field(min_length=1, max_length=300)


class AIFollowUpCandidate(BaseModel):
    question: str = Field(min_length=1, max_length=400)
    rationale: str = Field(default="", max_length=500)
    expected_evidence: list[AIExpectedEvidence] = Field(default_factory=list, max_length=2)


class AIFollowUp(AIFollowUpCandidate):
    alternatives: list[AIFollowUpCandidate] = Field(default_factory=list, max_length=2)
