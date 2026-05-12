from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WorkScheduleRegistrationRequest(Base):
    __tablename__ = "work_schedule_registration_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("work_schedules.id"), nullable=False, index=True)

    date_from: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    date_to: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    days_of_week_mask: Mapped[int] = mapped_column(Integer, nullable=False, server_default="127")  # Mon..Sun bits

    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="pending", index=True)  # pending|approved|rejected|cancelled
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    response_note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])
    schedule = relationship("WorkSchedule")

