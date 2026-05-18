from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class NotificationConnection:
    websocket: WebSocket
    user_id: int
    company_scope_id: int | None


class NotificationHub:
    def __init__(self) -> None:
        self._connections: dict[int, list[NotificationConnection]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, *, user_id: int, company_scope_id: int | None) -> None:
        await websocket.accept()
        conn = NotificationConnection(websocket=websocket, user_id=user_id, company_scope_id=company_scope_id)
        async with self._lock:
            self._connections.setdefault(user_id, []).append(conn)

    async def disconnect(self, websocket: WebSocket, *, user_id: int) -> None:
        async with self._lock:
            rows = self._connections.get(user_id, [])
            if not rows:
                return
            self._connections[user_id] = [row for row in rows if row.websocket is not websocket]
            if not self._connections[user_id]:
                self._connections.pop(user_id, None)

    async def emit_notification_created(
        self,
        *,
        user_id: int,
        company_id: int | None,
        item: dict[str, Any],
        unread_count: int | None,
    ) -> None:
        payload = {"type": "notification.created", "item": item, "unread_count": unread_count}
        async with self._lock:
            rows = list(self._connections.get(user_id, []))
        if not rows:
            return
        stale: list[NotificationConnection] = []
        for row in rows:
            if company_id is not None and row.company_scope_id is not None and row.company_scope_id != company_id:
                continue
            try:
                await row.websocket.send_json(payload)
            except Exception as exc:  # pragma: no cover
                logger.warning("notification websocket send failed for user %s: %r", user_id, exc)
                stale.append(row)
        if stale:
            async with self._lock:
                current = self._connections.get(user_id, [])
                self._connections[user_id] = [row for row in current if row not in stale]
                if not self._connections[user_id]:
                    self._connections.pop(user_id, None)


notification_hub = NotificationHub()
