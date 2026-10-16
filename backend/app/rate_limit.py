"""In-memory sliding-window rate limits. Enough for one instance; protects the AI quota.

Two separate limits, because a whole class usually shares one school Wi-Fi IP:
- public: anonymous endpoints (create class, join), keyed by client IP, generous.
- student: answer/reply endpoints, keyed by the student's own token, so classmates don't share a quota.
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.security import hash_token

_UNITS = {"second": 1, "minute": 60, "hour": 3600}


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    @classmethod
    def from_string(cls, spec: str) -> "RateLimiter":
        count, _, unit = spec.partition("/")
        return cls(int(count), _UNITS[unit.strip()])

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window_seconds:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _enforce(request: Request, limiter_name: str, key: str) -> None:
    limiter: RateLimiter = request.app.state.rate_limiters[limiter_name]
    if not limiter.allow(key):
        raise HTTPException(status_code=429, detail="Too many requests — wait a minute and try again.")


def limit_public(request: Request) -> None:
    _enforce(request, "public", f"ip:{_client_ip(request)}")


def limit_student(request: Request) -> None:
    token = request.headers.get("x-student-token")
    key = f"student:{hash_token(token)}" if token else f"ip:{_client_ip(request)}"
    _enforce(request, "student", key)
