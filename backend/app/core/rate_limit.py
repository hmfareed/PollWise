"""In-memory sliding window rate limiter for security-sensitive endpoints.

Protects against brute force and denial of service attacks:
- Authentication endpoints (login, password reset requests): 10 req/min
- Ballot box submission endpoints: 30 req/min
"""

import asyncio
import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request

from app.core.config import settings
from app.core.errors import AppException, ErrorCode


class SlidingWindowRateLimiter:
    """Thread-safe, in-memory sliding window rate limiter."""

    def __init__(self) -> None:
        self._records: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_allowed(
        self, key: str, max_requests: int, window_seconds: int = 60
    ) -> tuple[bool, int]:
        """Check if request is allowed under rate limit.

        Returns (is_allowed, retry_after_seconds).
        """
        now = time.monotonic()
        cutoff = now - window_seconds

        async with self._lock:
            # Purge entries outside current window
            valid_timestamps = [t for t in self._records[key] if t > cutoff]
            self._records[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                # Calculate remaining wait time based on oldest timestamp in window
                oldest = valid_timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return False, retry_after

            # Record this hit
            valid_timestamps.append(now)
            self._records[key] = valid_timestamps
            return True, 0

    async def reset(self) -> None:
        """Clear all rate limit state (useful in testing)."""
        async with self._lock:
            self._records.clear()


# Global rate limiter instance
limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Safely extract client IP from request, taking proxy headers into account."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # First IP in comma-separated list is the client IP
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def create_rate_limit_dependency(
    prefix: str,
    max_requests: int,
    window_seconds: int = 60,
) -> Callable[[Request], ...]:
    """Dependency factory for rate limiting routes."""

    async def rate_limit_checker(request: Request) -> None:
        if settings.is_testing:
            # Bypass during automated test suite execution
            return

        ip = get_client_ip(request)
        key = f"{prefix}:{ip}"

        allowed, retry_after = await limiter.is_allowed(
            key=key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

        if not allowed:
            raise AppException(
                code=ErrorCode.RATE_LIMITED,
                message=f"Too many requests. Please try again after {retry_after} seconds.",
                details={"retry_after": retry_after},
            )

    return rate_limit_checker


# Pre-configured rate limiting dependencies
rate_limit_login = create_rate_limit_dependency(
    prefix="login",
    max_requests=settings.RATE_LIMIT_LOGIN_PER_MIN,
    window_seconds=60,
)

rate_limit_ballot_box = create_rate_limit_dependency(
    prefix="ballot_box",
    max_requests=30,
    window_seconds=60,
)
