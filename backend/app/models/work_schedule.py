from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active", index=True)

    shift_start: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    shift_end: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    late_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    early_leave_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    break_start: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    break_end: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    break_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="60")
    break_threshold_hours: Mapped[float] = mapped_column(Float, nullable=False, server_default="6.0")

    auto_checkout_time: Mapped[str] = mapped_column(String(5), nullable=False, server_default="23:59")

    # Index4-style applicability/limits
    department_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    max_registrations: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")  # 0 = unlimited
    days_of_week_mask: Mapped[int] = mapped_column(Integer, nullable=False, server_default="127")  # Mon..Sun bits
    date_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
