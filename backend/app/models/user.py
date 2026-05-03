from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Auth fields (IAM). Nullable so employee records don't necessarily have login access.
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    department = relationship("Department", back_populates="users")
    face_embeddings = relationship("FaceEmbedding", back_populates="user", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="user", cascade="all, delete-orphan")

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    permissions = relationship("Permission", secondary="user_permissions", back_populates="users")
