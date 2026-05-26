from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AttendanceEvidenceSetting(Base):
    __tablename__ = "attendance_evidence_settings"

    company_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        primary_key=True,
        autoincrement=False,
    )
    enable_evidence_image: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    image_quality: Mapped[int] = mapped_column(Integer, nullable=False, default=65, server_default="65")
    image_max_width: Mapped[int] = mapped_column(Integer, nullable=False, default=720, server_default="720")
    image_format: Mapped[str] = mapped_column(String(16), nullable=False, default="webp", server_default="webp")
    image_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

