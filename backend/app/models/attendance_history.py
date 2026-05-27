from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AttendanceHistory(Base):
    __tablename__ = "attendance_history"
    __table_args__ = (
        UniqueConstraint("attendance_log_id", name="uq_attendance_history_log_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_log_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_logs.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    check_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_format: Mapped[str | None] = mapped_column(String(16), nullable=True)
    upload_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    employee = relationship("User", back_populates="attendance_history")
    attendance_log = relationship("AttendanceLog")
