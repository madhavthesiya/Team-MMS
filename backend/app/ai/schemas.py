"""Shapes the model must return. Enforced twice: as the Gemini response schema, then by Pydantic."""
from pydantic import BaseModel, Field

from app.domain import HypothesisKind, Label


class AIHypothesis(BaseModel):
    kind: HypothesisKind
    misconception_id: int | None = None
    evidence_quote: str = Field(default="", max_length=600)
    evidence_against: str = Field(default="", max_length=600)
    likelihood: float = Field(ge=0, le=1)


class AIAnalysis(BaseModel):
    hypotheses: list[AIHypothesis] = Field(default_factory=list, max_length=6)
    label: Label
    certainty: float = Field(ge=0, le=1)
    misconception_id: int | None = None


class AIFollowUp(BaseModel):
    question: str = Field(min_length=1, max_length=400)
