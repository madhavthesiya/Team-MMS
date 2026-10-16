"""Gemini access. The only module that talks to the model.

Any failure becomes AIUnavailable, so callers can fall back to rules instead of crashing
or inventing an AI result.
"""
from typing import Any, Protocol

import httpx
from fastapi import Request
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.config import Settings


class AIUnavailable(Exception):
    """The model gave no usable answer. kind: not_configured | timeout | rate_limited | api_error | empty."""

    def __init__(self, kind: str):
        super().__init__(kind)
        self.kind = kind


class AIClient(Protocol):
    model: str

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str: ...


def gemini_schema(schema: type[BaseModel]) -> dict[str, Any]:
    """Pydantic JSON schema without cosmetic keys ('title', 'default') the API does not need."""

    def clean(node: Any, in_properties: bool = False) -> Any:
        if isinstance(node, dict):
            return {
                k: clean(v, in_properties=(k == "properties"))
                for k, v in node.items()
                if in_properties or k not in ("title", "default")
            }
        if isinstance(node, list):
            return [clean(v) for v in node]
        return node

    return clean(schema.model_json_schema())


class GeminiClient:
    def __init__(self, api_key: str, model: str, timeout_seconds: float):
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = genai.Client(api_key=api_key)

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        """timeout_seconds: what's left of the caller's budget; the call never waits longer than that."""
        timeout = min(self.timeout_seconds, timeout_seconds) if timeout_seconds is not None else self.timeout_seconds
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=gemini_schema(schema),
            temperature=0.2,
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        )
        try:
            response = self._client.models.generate_content(model=self.model, contents=prompt, config=config)
        except errors.APIError as exc:
            raise AIUnavailable("rate_limited" if exc.code == 429 else "api_error") from exc
        except httpx.TimeoutException as exc:
            raise AIUnavailable("timeout") from exc
        except Exception as exc:  # network or SDK failure: degrade to rules, never crash the request
            raise AIUnavailable("api_error") from exc
        if not response.text:
            raise AIUnavailable("empty")
        return response.text


class NullAIClient:
    """Used when GEMINI_API_KEY is not set: every call reports not_configured, so the app runs on rules."""

    model = "none"

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        raise AIUnavailable("not_configured")


def build_ai_client(settings: Settings) -> AIClient:
    if not settings.gemini_api_key:
        return NullAIClient()
    return GeminiClient(settings.gemini_api_key, settings.gemini_model, settings.ai_timeout_seconds)


def get_ai_client(request: Request) -> AIClient:
    return request.app.state.ai_client
