"""Opt-in check against the REAL Gemini API (skipped by default; CI never needs a key).

Run: RUN_LIVE_AI=1 python -m pytest tests/test_gemini_live.py   (GEMINI_API_KEY in .env)
"""
import os

import pytest

from app.ai.client import build_ai_client
from app.ai.prompts import build_analysis_prompt, build_followup_prompt
from app.ai.schemas import AIAnalysis, AIFollowUp
from app.config import Settings
from app.domain import HypothesisOut, MisconceptionSpec, QuestionSpec, StudentWork
from app.services.pipeline import run_diagnosis

pytestmark = pytest.mark.skipif(not os.environ.get("RUN_LIVE_AI"), reason="set RUN_LIVE_AI=1 to call the real model")

Q = QuestionSpec(
    prompt="What is 1/2 + 1/4?",
    correct_answer="3/4",
    answer_type="number",
    key_idea="Fractions need a common denominator before adding: 1/2 = 2/4.",
    misconceptions=(MisconceptionSpec(id=1, label="Adds tops and bottoms", trigger_answers=("2/6",)),),
)


@pytest.fixture(scope="module")
def ai():
    settings = Settings()
    assert settings.gemini_api_key, "GEMINI_API_KEY missing from .env"
    return build_ai_client(settings)


def test_analysis_output_matches_schema(ai):
    work = StudentWork(answer="2/6", explanation="I added the tops 1+1 and the bottoms 2+4", self_confidence="sure")
    AIAnalysis.model_validate_json(ai.generate_json(build_analysis_prompt(Q, work, False), AIAnalysis))


def test_follow_up_output_matches_schema(ai):
    work = StudentWork(answer="3/4", explanation="it looked right", self_confidence="sure")
    hyps = [HypothesisOut("guessed", None, "it looked right", "", 0.7), HypothesisOut("understood", None, "Correct answer", "", 0.5)]
    AIFollowUp.model_validate_json(ai.generate_json(build_followup_prompt(Q, work, hyps), AIFollowUp))


def test_full_pipeline_reads_a_clear_misconception(ai):
    work = StudentWork(answer="2/6", explanation="I added the tops 1+1=2 and the bottoms 2+4=6", self_confidence="sure")
    out = run_diagnosis(Q, work, ai, threshold=0.7, allow_follow_up=True)
    assert out.ai_available, [t.detail for t in out.trace]
    assert out.label in ("misconception", "not_sure")
