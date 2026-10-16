"""Gemini and Groq access with rotation pools and automatic failover.

Any failure becomes AIUnavailable, so callers can fall back to rules instead of crashing
or inventing an AI result.
"""
from typing import Any, Protocol
import json
import logging
import httpx
from fastapi import Request
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.config import Settings

logger = logging.getLogger(__name__)


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


def strip_json_fences(text: str) -> str:
    """Strips markdown code fences (```json ... ```) from model outputs."""
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


class GeminiClient:
    def __init__(self, api_keys: str | list[str], model: str, timeout_seconds: float):
        self.keys = [api_keys] if isinstance(api_keys, str) else [k for k in api_keys if k]
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._key_index = 0
        self._clients: dict[str, genai.Client] = {}
        if self.keys:
            self._client = self._get_client(self.keys[0])
        else:
            self._client = None

    def _get_client(self, key: str) -> genai.Client:
        if key not in self._clients:
            self._clients[key] = genai.Client(api_key=key)
        return self._clients[key]

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        """timeout_seconds: what's left of the caller's budget; the call never waits longer than that."""
        if not self.keys:
            raise AIUnavailable("not_configured")

        timeout = min(self.timeout_seconds, timeout_seconds) if timeout_seconds is not None else self.timeout_seconds
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=gemini_schema(schema),
            temperature=0.2,
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        )

        attempts = min(len(self.keys), 3)
        last_error_kind = "api_error"

        for _ in range(attempts):
            current_key = self.keys[self._key_index]
            client = self._client if len(self.keys) == 1 else self._get_client(current_key)
            try:
                response = client.models.generate_content(model=self.model, contents=prompt, config=config)
                if not response.text:
                    raise AIUnavailable("empty")
                return strip_json_fences(response.text)
            except errors.APIError as exc:
                last_error_kind = "rate_limited" if exc.code in (429, 503) else "api_error"
                self._key_index = (self._key_index + 1) % len(self.keys)
                if len(self.keys) == 1:
                    raise AIUnavailable(last_error_kind) from exc
            except httpx.TimeoutException as exc:
                raise AIUnavailable("timeout") from exc
            except AIUnavailable:
                raise
            except Exception as exc:
                last_error_kind = "api_error"
                self._key_index = (self._key_index + 1) % len(self.keys)
                if len(self.keys) == 1:
                    raise AIUnavailable("api_error") from exc

        raise AIUnavailable(last_error_kind)


class GroqClient:
    def __init__(self, api_keys: str | list[str], model: str, timeout_seconds: float):
        self.keys = [api_keys] if isinstance(api_keys, str) else [k for k in api_keys if k]
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._key_index = 0

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        if not self.keys:
            raise AIUnavailable("not_configured")

        timeout = min(self.timeout_seconds, timeout_seconds) if timeout_seconds is not None else self.timeout_seconds
        attempts = min(len(self.keys), 3)

        schema_json = json.dumps(schema.model_json_schema())
        system_msg = (
            f"You are BehindTheMark AI. Analyze student reasoning and educational content.\n"
            f"You MUST return valid JSON matching this schema:\n{schema_json}\n"
            f"Output JSON only, no explanatory markdown."
        )

        last_error_kind = "api_error"

        for _ in range(attempts):
            key = self.keys[self._key_index]
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 1500,
            }
            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        cleaned = strip_json_fences(content)
                        if not cleaned:
                            raise AIUnavailable("empty")
                        return cleaned
                    elif resp.status_code in (429, 503):
                        last_error_kind = "rate_limited"
                        self._key_index = (self._key_index + 1) % len(self.keys)
                    else:
                        last_error_kind = "api_error"
                        self._key_index = (self._key_index + 1) % len(self.keys)
            except httpx.TimeoutException as exc:
                raise AIUnavailable("timeout") from exc
            except AIUnavailable:
                raise
            except Exception:
                last_error_kind = "api_error"
                self._key_index = (self._key_index + 1) % len(self.keys)

        raise AIUnavailable(last_error_kind)


class CompositeAIClient:
    """Tries primary Gemini client with key rotation; falls over to Groq client if Gemini is rate limited or unavailable."""

    def __init__(self, primary: AIClient | None, fallback: AIClient | None):
        self.primary = primary
        self.fallback = fallback
        self.model = primary.model if primary else (fallback.model if fallback else "none")

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        if self.primary:
            try:
                return self.primary.generate_json(prompt, schema, timeout_seconds=timeout_seconds)
            except AIUnavailable:
                if not self.fallback:
                    raise
        if self.fallback:
            return self.fallback.generate_json(prompt, schema, timeout_seconds=timeout_seconds)
        raise AIUnavailable("not_configured")


class NullAIClient:
    """Used when no AI keys are configured: every call reports not_configured, so the app runs on rules."""

    model = "none"

    def generate_json(self, prompt: str, schema: type[BaseModel], timeout_seconds: float | None = None) -> str:
        raise AIUnavailable("not_configured")


def build_ai_client(settings: Settings) -> AIClient:
    gemini_keys = settings.get_gemini_keys()
    groq_keys = settings.get_groq_keys()

    if not gemini_keys and not groq_keys:
        return NullAIClient()

    primary: AIClient | None = None
    if gemini_keys:
        primary = GeminiClient(gemini_keys, settings.gemini_model, settings.ai_timeout_seconds)

    fallback: AIClient | None = None
    if groq_keys:
        fallback = GroqClient(groq_keys, settings.groq_model, settings.ai_timeout_seconds)

    if primary and fallback:
        return CompositeAIClient(primary=primary, fallback=fallback)
    return primary or fallback or NullAIClient()


def get_ai_client(request: Request) -> AIClient:
    return request.app.state.ai_client
