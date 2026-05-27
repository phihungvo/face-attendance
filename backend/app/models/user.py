from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("company_id", "email", name="uq_users_company_email"),
        UniqueConstraint("company_id", "code", name="uq_users_company_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    # Auth fields (IAM). Nullable so employee records don't necessarily have login access.
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    invite_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invite_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invite_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    citizen_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    citizen_id_place: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    face_enrolled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    company = relationship("Company", back_populates="users")
    department = relationship("Department", back_populates="users")
    face_embeddings = relationship("FaceEmbedding", back_populates="user", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="user", cascade="all, delete-orphan")
    attendance_history = relationship("AttendanceHistory", cascade="all, delete-orphan")

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    permissions = relationship("Permission", secondary="user_permissions", back_populates="users")
