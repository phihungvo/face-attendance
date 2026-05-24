from __future__ import annotations

import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field

from fastapi import Request

from app.core.errors import TOO_MANY_REQUESTS, AppException


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    client = getattr(request, "client", None)
    host = getattr(client, "host", None)
    return str(host or "unknown")


def _too_many_requests(detail: str, *, retry_after: int) -> AppException:
    return AppException(
        TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(max(1, retry_after))},
    )


@dataclass
class _WindowState:
    timestamps: deque[float] = field(default_factory=deque)
    blocked_until: float = 0.0


class RequestRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._states: dict[str, _WindowState] = {}

    def hit(
        self,
        *,
        scope: str,
        key: str,
        limit: int,
        window_seconds: int,
        block_seconds: int,
        detail: str,
    ) -> None:
        now = time.monotonic()
        state_key = f"{scope}:{key}"
        with self._lock:
            state = self._states.setdefault(state_key, _WindowState())
            self._prune(state, now=now, window_seconds=window_seconds)
            if state.blocked_until > now:
                raise _too_many_requests(detail, retry_after=math.ceil(state.blocked_until - now))
            state.timestamps.append(now)
            if len(state.timestamps) > limit:
                state.blocked_until = now + max(1, block_seconds)
                raise _too_many_requests(detail, retry_after=int(block_seconds))

    @staticmethod
    def _prune(state: _WindowState, *, now: float, window_seconds: int) -> None:
        threshold = now - max(1, window_seconds)
        while state.timestamps and state.timestamps[0] <= threshold:
            state.timestamps.popleft()
        if not state.timestamps and state.blocked_until <= now:
            state.blocked_until = 0.0


class FailedAttemptLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._states: dict[str, _WindowState] = {}

    def ensure_allowed(
        self,
        *,
        scope: str,
        key: str,
        max_failures: int,
        window_seconds: int,
        block_seconds: int,
        detail: str,
    ) -> None:
        now = time.monotonic()
        state_key = f"{scope}:{key}"
        with self._lock:
            state = self._states.setdefault(state_key, _WindowState())
            self._prune(state, now=now, window_seconds=window_seconds)
            if state.blocked_until > now:
                raise _too_many_requests(detail, retry_after=math.ceil(state.blocked_until - now))
            if len(state.timestamps) >= max_failures:
                state.blocked_until = now + max(1, block_seconds)
                raise _too_many_requests(detail, retry_after=int(block_seconds))

    def record_failure(
        self,
        *,
        scope: str,
        key: str,
        max_failures: int,
        window_seconds: int,
        block_seconds: int,
    ) -> None:
        now = time.monotonic()
        state_key = f"{scope}:{key}"
        with self._lock:
            state = self._states.setdefault(state_key, _WindowState())
            self._prune(state, now=now, window_seconds=window_seconds)
            state.timestamps.append(now)
            if len(state.timestamps) >= max_failures:
                state.blocked_until = now + max(1, block_seconds)

    def reset(self, *, scope: str, key: str) -> None:
        state_key = f"{scope}:{key}"
        with self._lock:
            self._states.pop(state_key, None)

    @staticmethod
    def _prune(state: _WindowState, *, now: float, window_seconds: int) -> None:
        threshold = now - max(1, window_seconds)
        while state.timestamps and state.timestamps[0] <= threshold:
            state.timestamps.popleft()
        if not state.timestamps and state.blocked_until <= now:
            state.blocked_until = 0.0


request_rate_limiter = RequestRateLimiter()
failed_attempt_limiter = FailedAttemptLimiter()
