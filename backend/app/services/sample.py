"""The sample quiz behind "Try the sample class".

It is SAMPLE INPUT only — questions and teacher-style misconceptions, validated by the same
schema as a teacher's quiz. It never contains student responses or results; those are always
produced live.
"""
import json
from pathlib import Path

from app.schemas import QuizIn

SAMPLE_QUIZ_PATH = Path(__file__).resolve().parents[1] / "sample" / "fractions_quiz.json"
SAMPLE_CLASS_NAME = "Sample class — Fractions"


def load_sample_quiz() -> QuizIn:
    return QuizIn.model_validate(json.loads(SAMPLE_QUIZ_PATH.read_text(encoding="utf-8")))
