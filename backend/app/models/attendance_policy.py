from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"

    # singleton row (id=1)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)

    shift_start: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")  # HH:MM
    late_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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

