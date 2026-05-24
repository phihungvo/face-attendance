from __future__ import annotations

import asyncio
from functools import partial
from datetime import datetime, timezone

from anyio import from_thread
from sqlalchemy.orm import Session

from app.repositories.notifications import NotificationRepository
from app.services.notification_catalog import CATEGORY_PREFERENCE_FIELD, COMPANY_POLICY_EVENT_FIELD, EVENT_SPECS
from app.services.notification_hub import notification_hub


class NotificationService:
    def __init__(self) -> None:
        self._repo = NotificationRepository()

    def _to_item(self, recipient, notification) -> dict[str, object]:
        return {
            "id": recipient.id,
            "notification_id": notification.id,
            "company_id": notification.company_id,
            "type": notification.type,
            "category": notification.category,
            "severity": notification.severity,
            "title": notification.title,
            "body": notification.body,
            "entity_type": notification.entity_type,
            "entity_id": notification.entity_id,
            "action_url": notification.action_url,
            "is_read": bool(recipient.is_read),
            "read_at": recipient.read_at,
            "is_archived": recipient.archived_at is not None,
            "archived_at": recipient.archived_at,
            "created_at": notification.created_at,
        }

    def list_for_user(
            self,
            db: Session,
            *,
            user_id: int,
            company_id: int | None = None,
            unread_only: bool = False,
            category: str | None = None,
            severity: str | None = None,
            include_archived: bool = False,
            archived_only: bool = False,
            limit: int = 20,
            offset: int = 0,
    ) -> dict[str, object]:
        total = self._repo.count_for_user(
            db,
            user_id=user_id,
            company_id=company_id,
            unread_only=unread_only,
            category=category,
            severity=severity,
            include_archived=include_archived,
            archived_only=archived_only,
        )
        rows = self._repo.list_for_user(
            db,
            user_id=user_id,
            company_id=company_id,
            unread_only=unread_only,
            category=category,
            severity=severity,
            include_archived=include_archived,
            archived_only=archived_only,
            limit=limit,
            offset=offset,
        )
        return {"items": [self._to_item(recipient, notification) for recipient, notification in rows], "total": total}

    def get_for_user(self, db: Session, *, recipient_id: int, user_id: int) -> dict[str, object]:
        row = self._repo.get_notification_for_user(db, recipient_id=recipient_id, user_id=user_id)
        if row is None:
            raise ValueError("Notification not found")
        recipient, notification = row
        return self._to_item(recipient, notification)

    def unread_count(self, db: Session, *, user_id: int, company_id: int | None = None) -> int:
        return self._repo.count_for_user(db, user_id=user_id, company_id=company_id, unread_only=True)

    def mark_read(self, db: Session, *, recipient_id: int, user_id: int) -> dict[str, object]:
        row = self._repo.mark_read(db, recipient_id=recipient_id, user_id=user_id,
                                   now=datetime.now(timezone.utc).replace(tzinfo=None))
        if row is None:
            raise ValueError("Notification not found")
        db.commit()
        return {"read": True, "id": recipient_id}

    def mark_all_read(self, db: Session, *, user_id: int, company_id: int | None = None) -> dict[str, object]:
        count = self._repo.mark_all_read(db, user_id=user_id, company_id=company_id,
                                         now=datetime.now(timezone.utc).replace(tzinfo=None))
        db.commit()
        return {"read_all": True, "updated": int(count)}

    def archive(self, db: Session, *, recipient_id: int, user_id: int) -> dict[str, object]:
        row = self._repo.archive(db, recipient_id=recipient_id, user_id=user_id,
                                 now=datetime.now(timezone.utc).replace(tzinfo=None))
        if row is None:
            raise ValueError("Notification not found")
        db.commit()
        return {"archived": True, "id": recipient_id}

    def delete_for_user(self, db: Session, *, recipient_id: int, user_id: int) -> dict[str, object]:
        ok = self._repo.delete_recipient(db, recipient_id=recipient_id, user_id=user_id)
        if not ok:
            raise ValueError("Notification not found")
        db.commit()
        return {"deleted": True, "id": recipient_id}

    def get_preferences(self, db: Session, *, user_id: int):
        row, created = self._repo.get_or_create_preferences(db, user_id=user_id)
        if created:
            db.commit()
            db.refresh(row)
        return row

    def update_preferences(self, db: Session, *, user_id: int, data: dict[str, object]):
        row = self._repo.update_preferences(db, user_id=user_id, data=data)
        db.commit()
        db.refresh(row)
        return row

    def get_company_policy(self, db: Session, *, company_id: int):
        row, created = self._repo.get_or_create_company_policy(db, company_id=company_id)
        if created:
            db.commit()
            db.refresh(row)
        return row

    def update_company_policy(self, db: Session, *, company_id: int, data: dict[str, object]):
        row = self._repo.update_company_policy(db, company_id=company_id, data=data)
        db.commit()
        db.refresh(row)
        return row

    def _normalize_event(self, *, type: str, category: str, severity: str) -> tuple[str, str]:
        spec = EVENT_SPECS.get(type)
        if spec is None:
            return category, severity
        return spec.category, spec.severity

    def _company_policy_allows(self, db: Session, *, company_id: int | None, type: str) -> bool:
        if company_id is None:
            return True
        field = COMPANY_POLICY_EVENT_FIELD.get(type)
        if not field:
            return True
        policy, _created = self._repo.get_or_create_company_policy(db, company_id=company_id)
        return bool(getattr(policy, field, True))

    def _filter_user_ids_by_preferences(self, db: Session, *, category: str, user_ids: list[int]) -> list[int]:
        field = CATEGORY_PREFERENCE_FIELD.get(category)
        if not field or not user_ids:
            return user_ids
        disabled = self._repo.list_disabled_preference_user_ids(db, user_ids=user_ids, preference_field=field)
        return [user_id for user_id in user_ids if user_id not in disabled]

    # def _dispatch_new_items(self, db: Session, *, recipient_ids: list[int], user_ids: list[int]) -> None:
    #     for recipient_id, user_id in zip(recipient_ids, user_ids, strict=False):
    #         row = self._repo.get_notification_for_user(db, recipient_id=recipient_id, user_id=user_id)
    #         if row is None:
    #             continue
    #         recipient, notification = row
    #         item = self._to_item(recipient, notification)
    #         try:
    #             loop = asyncio.get_running_loop()
    #         except RuntimeError:
    #             try:
    #                 from_thread.run(
    #                     partial(
    #                         notification_hub.emit_notification_created,
    #                         user_id=int(user_id),
    #                         company_id=notification.company_id,
    #                         item=item,
    #                         unread_count=None,
    #                     ),
    #                 )
    #             except RuntimeError:
    #                 continue
    #         else:
    #             loop.create_task(
    #                 notification_hub.emit_notification_created(
    #                     user_id=int(user_id),
    #                     company_id=notification.company_id,
    #                     item=item,
    #                     unread_count=None,
    #                 )
    #             )

    def _dispatch_new_items(self, db: Session, *, recipient_ids: list[int], user_ids: list[int]) -> None:
        items_to_emit: list[tuple[int, int | None, dict]] = []
        for recipient_id, user_id in zip(recipient_ids, user_ids, strict=False):
            row = self._repo.get_notification_for_user(db, recipient_id=recipient_id, user_id=user_id)
            if row is None:
                continue
            recipient, notification = row
            item = self._to_item(recipient, notification)
            items_to_emit.append((int(user_id), notification.company_id, item))

        if not items_to_emit:
            return

        async def _emit_all() -> None:
            for user_id, company_id, item in items_to_emit:
                await notification_hub.emit_notification_created(
                    user_id=user_id,
                    company_id=company_id,
                    item=item,
                    unread_count=None,
                )

        # Case 1: đang trong async context (FastAPI async endpoint)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_emit_all())
            return
        except RuntimeError:
            pass

        # Case 2: sync context inside an AnyIO worker thread.
        try:
            from_thread.run(_emit_all)
            return
        except RuntimeError:
            pass

        # Case 3: sync context (Celery, scheduler, background thread)
        # Lấy event loop của FastAPI app để submit task an toàn
        try:
            import asyncio as _asyncio
            # Tìm loop đang chạy của main thread (uvicorn)
            loop = _asyncio.get_event_loop_policy().get_event_loop()
            if loop.is_running():
                import concurrent.futures
                future = concurrent.futures.Future()

                async def _run_and_resolve():
                    try:
                        await _emit_all()
                        future.set_result(None)
                    except Exception as e:
                        future.set_exception(e)

                asyncio.run_coroutine_threadsafe(_run_and_resolve(), loop)
                return
        except Exception:
            pass

        # Case 4: fallback — chạy loop mới (không có WS connections nào đang live)
        try:
            asyncio.run(_emit_all())
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("notification dispatch failed: %r", exc)

    def create_for_users(
            self,
            db: Session,
            *,
            company_id: int | None,
            type: str,
            category: str,
            severity: str,
            title: str,
            body: str | None,
            entity_type: str | None,
            entity_id: int | None,
            action_url: str | None,
            created_by_user_id: int | None,
            user_ids: list[int],
    ) -> int:
        category, severity = self._normalize_event(type=type, category=category, severity=severity)
        recipient_ids = sorted({int(x) for x in user_ids if int(x) > 0})
        if not recipient_ids or not self._company_policy_allows(db, company_id=company_id, type=type):
            return 0
        recipient_ids = self._filter_user_ids_by_preferences(db, category=category, user_ids=recipient_ids)
        if not recipient_ids:
            return 0
        notification = self._repo.create_notification(
            db,
            company_id=company_id,
            type=type,
            category=category,
            severity=severity,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
            created_by_user_id=created_by_user_id,
        )
        created_rows = self._repo.create_recipients(db, notification_id=int(notification.id), user_ids=recipient_ids)
        created_recipient_ids = [int(row.id) for row in created_rows]
        db.commit()
        self._dispatch_new_items(db, recipient_ids=created_recipient_ids, user_ids=recipient_ids)
        return int(notification.id)

    def create_for_permission(
            self,
            db: Session,
            *,
            company_id: int,
            permission_key: str,
            type: str,
            category: str,
            severity: str,
            title: str,
            body: str | None,
            entity_type: str | None,
            entity_id: int | None,
            action_url: str | None,
            created_by_user_id: int | None,
            exclude_user_ids: list[int] | None = None,
    ) -> int:
        user_ids = self._repo.list_user_ids_for_permission(
            db,
            company_id=company_id,
            permission_key=permission_key,
            exclude_user_ids=exclude_user_ids,
        )
        return self.create_for_users(
            db,
            company_id=company_id,
            type=type,
            category=category,
            severity=severity,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
            created_by_user_id=created_by_user_id,
            user_ids=user_ids,
        )
