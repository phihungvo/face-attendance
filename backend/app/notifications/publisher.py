from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.core.settings import settings


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def publish_notification_event(event: dict[str, Any]) -> None:
    """
    Best-effort Redis Pub/Sub publisher.

    - No-op if Redis is unavailable.
    - Never raises (to avoid breaking core business flows).
    """
    try:
        import redis  # type: ignore

        payload = {**event, "ts": event.get("ts") or _now_iso()}
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.publish(settings.NOTIF_REDIS_CHANNEL, json.dumps(payload, ensure_ascii=False))
    except Exception:
        # Intentionally swallow: notifications must not break attendance/leaves flows.
        return

