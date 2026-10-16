"""TEST DOUBLE ONLY — a scripted stand-in for the Gemini client, used by pytest.

The running app never imports this module. Each test pushes the exact model output it wants
to exercise, so the tests check our code's handling of model output, not the model itself.
"""
import json

from pydantic import BaseModel

from app.ai.client import AIUnavailable


def hyp(kind: str, quote: str, likelihood: float, misconception_id: int | None = None, against: str = "") -> dict:
    return {
        "kind": kind,
        "misconception_id": misconception_id,
        "evidence_quote": quote,
        "evidence_against": against,
        "likelihood": likelihood,
    }


def analysis(label: str, certainty: float, *hypotheses: dict, misconception_id: int | None = None) -> str:
    return json.dumps(
        {"label": label, "certainty": certainty, "misconception_id": misconception_id, "hypotheses": list(hypotheses)}
    )


def follow_up(question: str) -> str:
    return json.dumps({"question": question})


class FakeAIClient:
    model = "fake-test-model"

    def __init__(self) -> None:
        self.queue: list[str | Exception] = []
        self.prompts: list[str] = []

    def push(self, *items: str | Exception) -> None:
        self.queue.extend(items)

    def generate_json(self, prompt: str, schema: type[BaseModel]) -> str:
        self.prompts.append(prompt)
        if not self.queue:
            raise AIUnavailable("not_configured")
        item = self.queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item
