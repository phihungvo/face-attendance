from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import CompanyNotificationPolicy, Notification, NotificationPreference, NotificationRecipient
from app.models.rbac import Permission, RolePermission, UserPermission, UserRole
from app.models.user import User


class NotificationRepository:
    def create_notification(
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
    ) -> Notification:
        row = Notification(
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
        db.add(row)
        db.flush()
        return row

    def create_recipients(self, db: Session, *, notification_id: int, user_ids: list[int]) -> list[NotificationRecipient]:
        rows: list[NotificationRecipient] = []
        for user_id in user_ids:
            row = NotificationRecipient(notification_id=notification_id, user_id=int(user_id), is_read=False)
            db.add(row)
            rows.append(row)
        db.flush()
        return rows

    def count_for_user(
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
    ) -> int:
        stmt = (
            select(func.count(NotificationRecipient.id))
            .select_from(NotificationRecipient)
            .join(Notification, Notification.id == NotificationRecipient.notification_id)
            .where(NotificationRecipient.user_id == user_id)
        )
        if company_id is not None:
            stmt = stmt.where(Notification.company_id == company_id)
        if unread_only:
            stmt = stmt.where(NotificationRecipient.is_read.is_(False))
        if category:
            stmt = stmt.where(Notification.category == category)
        if severity:
            stmt = stmt.where(Notification.severity == severity)
        if archived_only:
            stmt = stmt.where(NotificationRecipient.archived_at.is_not(None))
        elif not include_archived:
            stmt = stmt.where(NotificationRecipient.archived_at.is_(None))
        return int(db.execute(stmt).scalar_one() or 0)

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
    ) -> list[tuple[NotificationRecipient, Notification]]:
        stmt = (
            select(NotificationRecipient, Notification)
            .join(Notification, Notification.id == NotificationRecipient.notification_id)
            .where(NotificationRecipient.user_id == user_id)
        )
        if company_id is not None:
            stmt = stmt.where(Notification.company_id == company_id)
        if unread_only:
            stmt = stmt.where(NotificationRecipient.is_read.is_(False))
        if category:
            stmt = stmt.where(Notification.category == category)
        if severity:
            stmt = stmt.where(Notification.severity == severity)
        if archived_only:
            stmt = stmt.where(NotificationRecipient.archived_at.is_not(None))
        elif not include_archived:
            stmt = stmt.where(NotificationRecipient.archived_at.is_(None))
        stmt = stmt.order_by(Notification.created_at.desc(), NotificationRecipient.id.desc()).limit(limit).offset(offset)
        return list(db.execute(stmt).all())

    def get_notification_for_user(self, db: Session, *, recipient_id: int, user_id: int) -> tuple[NotificationRecipient, Notification] | None:
        stmt = (
            select(NotificationRecipient, Notification)
            .join(Notification, Notification.id == NotificationRecipient.notification_id)
            .where(NotificationRecipient.id == recipient_id, NotificationRecipient.user_id == user_id)
            .limit(1)
        )
        return db.execute(stmt).first()

    def get_recipient(self, db: Session, *, recipient_id: int, user_id: int) -> NotificationRecipient | None:
        stmt = select(NotificationRecipient).where(NotificationRecipient.id == recipient_id, NotificationRecipient.user_id == user_id).limit(1)
        return db.execute(stmt).scalars().first()

    def mark_read(self, db: Session, *, recipient_id: int, user_id: int, now: datetime) -> NotificationRecipient | None:
        row = self.get_recipient(db, recipient_id=recipient_id, user_id=user_id)
        if row is None:
            return None
        if not row.is_read:
            row.is_read = True
            row.read_at = now
            db.add(row)
            db.flush()
        return row

    def mark_all_read(self, db: Session, *, user_id: int, company_id: int | None, now: datetime) -> int:
        rows = self.list_for_user(db, user_id=user_id, company_id=company_id, unread_only=True, include_archived=False, limit=5000, offset=0)
        changed = 0
        for recipient, _notification in rows:
            if recipient.is_read:
                continue
            recipient.is_read = True
            recipient.read_at = now
            db.add(recipient)
            changed += 1
        if changed:
            db.flush()
        return changed

    def archive(self, db: Session, *, recipient_id: int, user_id: int, now: datetime) -> NotificationRecipient | None:
        row = self.get_recipient(db, recipient_id=recipient_id, user_id=user_id)
        if row is None:
            return None
        if row.archived_at is None:
            row.archived_at = now
            db.add(row)
            db.flush()
        return row

    def delete_recipient(self, db: Session, *, recipient_id: int, user_id: int) -> bool:
        row = self.get_recipient(db, recipient_id=recipient_id, user_id=user_id)
        if row is None:
            return False
        db.delete(row)
        db.flush()
        return True

    def list_user_ids_for_permission(
        self,
        db: Session,
        *,
        company_id: int,
        permission_key: str,
        exclude_user_ids: list[int] | None = None,
    ) -> list[int]:
        exclude = {int(x) for x in (exclude_user_ids or [])}

        role_stmt = (
            select(User.id)
            .join(UserRole, UserRole.user_id == User.id)
            .join(RolePermission, RolePermission.role_id == UserRole.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(User.company_id == company_id, Permission.key == permission_key, User.status == "active")
        )
        direct_stmt = (
            select(User.id)
            .join(UserPermission, UserPermission.user_id == User.id)
            .join(Permission, Permission.id == UserPermission.permission_id)
            .where(User.company_id == company_id, Permission.key == permission_key, User.status == "active")
        )
        ids = {int(x) for x in db.execute(role_stmt).scalars().all()}
        ids.update(int(x) for x in db.execute(direct_stmt).scalars().all())
        return [x for x in sorted(ids) if x not in exclude]

    def list_disabled_preference_user_ids(self, db: Session, *, user_ids: list[int], preference_field: str) -> set[int]:
        if not user_ids:
            return set()
        column = getattr(NotificationPreference, preference_field)
        stmt = select(NotificationPreference.user_id).where(NotificationPreference.user_id.in_(user_ids), column.is_(False))
        return {int(x) for x in db.execute(stmt).scalars().all()}

    def get_or_create_preferences(self, db: Session, *, user_id: int) -> tuple[NotificationPreference, bool]:
        stmt = select(NotificationPreference).where(NotificationPreference.user_id == user_id).limit(1)
        row = db.execute(stmt).scalars().first()
        if row is not None:
            return row, False
        row = NotificationPreference(user_id=user_id)
        db.add(row)
        db.flush()
        return row, True

    def update_preferences(self, db: Session, *, user_id: int, data: dict[str, object]) -> NotificationPreference:
        row, _created = self.get_or_create_preferences(db, user_id=user_id)
        for key, value in data.items():
            setattr(row, key, value)
        db.add(row)
        db.flush()
        return row

    def get_or_create_company_policy(self, db: Session, *, company_id: int) -> tuple[CompanyNotificationPolicy, bool]:
        stmt = select(CompanyNotificationPolicy).where(CompanyNotificationPolicy.company_id == company_id).limit(1)
        row = db.execute(stmt).scalars().first()
        if row is not None:
            return row, False
        row = CompanyNotificationPolicy(company_id=company_id)
        db.add(row)
        db.flush()
        return row, True

    def update_company_policy(self, db: Session, *, company_id: int, data: dict[str, object]) -> CompanyNotificationPolicy:
        row, _created = self.get_or_create_company_policy(db, company_id=company_id)
        for key, value in data.items():
            setattr(row, key, value)
        db.add(row)
        db.flush()
        return row
