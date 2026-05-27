from __future__ import annotations

import base64
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, LargeBinary, String, func
from sqlalchemy.dialects.mysql import MEDIUMBLOB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_radius_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    require_gps_on_attendance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    logo_blob: Mapped[bytes | None] = mapped_column(LargeBinary().with_variant(MEDIUMBLOB(), "mysql"), nullable=True)
    logo_mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attendance_success_sound_source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="default")
    attendance_success_sound_sample_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attendance_success_sound_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    attendance_success_sound_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    attendance_success_sound_blob: Mapped[bytes | None] = mapped_column(LargeBinary().with_variant(MEDIUMBLOB(), "mysql"), nullable=True)
    attendance_success_sound_mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attendance_failure_sound_source: Mapped[str] = mapped_column(String(16), nullable=False, server_default="default")
    attendance_failure_sound_sample_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attendance_failure_sound_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    attendance_failure_sound_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    attendance_failure_sound_blob: Mapped[bytes | None] = mapped_column(LargeBinary().with_variant(MEDIUMBLOB(), "mysql"), nullable=True)
    attendance_failure_sound_mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    departments = relationship("Department", back_populates="company")
    users = relationship("User", back_populates="company")

    @property
    def logo_data_url(self) -> str | None:
        if not self.logo_blob or not self.logo_mime_type:
            return None
        encoded = base64.b64encode(self.logo_blob).decode("ascii")
        return f"data:{self.logo_mime_type};base64,{encoded}"

    @property
    def attendance_success_sound_data_url(self) -> str | None:
        if not self.attendance_success_sound_blob or not self.attendance_success_sound_mime_type:
            return None
        encoded = base64.b64encode(self.attendance_success_sound_blob).decode("ascii")
        return f"data:{self.attendance_success_sound_mime_type};base64,{encoded}"

    @property
    def attendance_failure_sound_data_url(self) -> str | None:
        if not self.attendance_failure_sound_blob or not self.attendance_failure_sound_mime_type:
            return None
        encoded = base64.b64encode(self.attendance_failure_sound_blob).decode("ascii")
        return f"data:{self.attendance_failure_sound_mime_type};base64,{encoded}"
