import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_UNITS = {"second": 1, "minute": 60, "hour": 3600}


class RateLimiter:
    """Sliding-window limit per client IP, in memory. Enough for one instance; protects the AI quota."""

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


def rate_limited(request: Request) -> None:
    limiter: RateLimiter = request.app.state.rate_limiter
    key = request.client.host if request.client else "unknown"
    if not limiter.allow(key):
        raise HTTPException(status_code=429, detail="Too many requests — wait a minute and try again.")
