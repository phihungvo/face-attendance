from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CompanyAttendancePolicy(Base):
    __tablename__ = "company_attendance_policies"

    # One policy row per company (company_id is PK).
    company_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        primary_key=True,
        autoincrement=False,
    )

    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Ho_Chi_Minh")

    face_match_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)

    shift_start: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")  # HH:MM
    shift_end: Mapped[str] = mapped_column(String(5), nullable=False, default="18:00")  # HH:MM
    late_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    early_leave_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    break_start: Mapped[str] = mapped_column(String(5), nullable=False, default="12:00")  # HH:MM
    break_end: Mapped[str] = mapped_column(String(5), nullable=False, default="13:00")  # HH:MM
    break_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    break_threshold_hours: Mapped[float] = mapped_column(Float, nullable=False, default=6.0)

    auto_checkout_time: Mapped[str] = mapped_column(String(5), nullable=False, default="23:59")  # HH:MM

    checkin_from: Mapped[str] = mapped_column(String(5), nullable=False, default="06:00")
    checkin_to: Mapped[str] = mapped_column(String(5), nullable=False, default="12:00")

    checkout_from: Mapped[str] = mapped_column(String(5), nullable=False, default="12:00")
    checkout_to: Mapped[str] = mapped_column(String(5), nullable=False, default="23:00")

    min_minutes_between_same_type: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

