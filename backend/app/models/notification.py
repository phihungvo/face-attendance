from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, server_default="info", index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)

    company = relationship("Company")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    recipients = relationship("NotificationRecipient", back_populates="notification", cascade="all, delete-orphan")


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"
    __table_args__ = (UniqueConstraint("notification_id", "user_id", name="uq_notification_recipient_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0", index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    notification = relationship("Notification", back_populates="recipients")
    user = relationship("User")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_notification_preferences_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    realtime_toast_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    attendance_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    leave_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    schedule_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    settings_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    iam_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    system_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class CompanyNotificationPolicy(Base):
    __tablename__ = "company_notification_policies"
    __table_args__ = (UniqueConstraint("company_id", name="uq_company_notification_policies_company"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    late_attendance_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    absent_attendance_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    new_leave_request_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    daily_report_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    overtime_request_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    attendance_policy_change_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    gps_policy_change_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
