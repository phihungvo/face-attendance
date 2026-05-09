from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.clients.ml_client import MlClient
from app.repositories.attendance_policy import AttendancePolicyRepository
from app.repositories.face_embeddings import FaceEmbeddingRepository
from app.repositories.rbac import RbacRepository
from app.repositories.users import UserRepository
from app.repositories.iam_users import IamUserRepository
from app.services.auth import AuthService
from zoneinfo import ZoneInfo
from datetime import datetime


class UserService:
    def __init__(self) -> None:
        self._users = UserRepository()
        self._iam = IamUserRepository()
        self._auth = AuthService()
        self._rbac = RbacRepository()
        self._embeddings = FaceEmbeddingRepository()
        self._ml = MlClient()
        self._policy = AttendancePolicyRepository()

    def enroll(self, db: Session, *, company_id: int | None = None, name: str, image_bytes: bytes) -> int:
        user = self._users.create(db, company_id=company_id, name=name)
        emb = self._ml.extract_embedding(image_bytes=image_bytes)
        # store JSON string
        import json

        emb_json = json.dumps(emb, ensure_ascii=False)
        self._embeddings.create(db, user_id=user.id, embedding_json=emb_json)
        db.commit()
        return user.id

    def enroll_face(self, db: Session, *, user_id: int, image_bytes: bytes) -> None:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        emb = self._ml.extract_embedding(image_bytes=image_bytes)
        import json

        emb_json = json.dumps(emb, ensure_ascii=False)
        # replace old embeddings for simplicity
        self._embeddings.delete_by_user(db, user_id=user_id)
        self._embeddings.create(db, user_id=user_id, embedding_json=emb_json)
        setattr(user, "face_enrolled_at", datetime.now(ZoneInfo(self._policy.get_or_create(db).timezone)).replace(tzinfo=None))
        db.commit()

    def enroll_face_self(self, db: Session, *, user_id: int, image_bytes: bytes) -> dict[str, object]:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        policy = self._policy.get_or_create(db)
        now = datetime.now(ZoneInfo(policy.timezone)).replace(tzinfo=None)

        last = getattr(user, "face_enrolled_at", None)
        if isinstance(last, datetime) and (last.year == now.year and last.month == now.month):
            # next allowed: first day of next month 00:00
            if now.month == 12:
                next_allowed = datetime(now.year + 1, 1, 1, 0, 0, 0)
            else:
                next_allowed = datetime(now.year, now.month + 1, 1, 0, 0, 0)
            raise ValueError(f"Bạn đã đăng ký khuôn mặt trong tháng này. Vui lòng thử lại sau {next_allowed.isoformat(sep=' ', timespec='minutes')}")

        emb = self._ml.extract_embedding(image_bytes=image_bytes)
        import json

        emb_json = json.dumps(emb, ensure_ascii=False)
        self._embeddings.delete_by_user(db, user_id=user_id)
        self._embeddings.create(db, user_id=user_id, embedding_json=emb_json)
        setattr(user, "face_enrolled_at", now)
        db.commit()
        return {"enrolled": True, "face_enrolled_at": now}

    def get_face_enroll_status(self, db: Session, *, user_id: int) -> dict[str, object]:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        policy = self._policy.get_or_create(db)
        now = datetime.now(ZoneInfo(policy.timezone)).replace(tzinfo=None)
        last = getattr(user, "face_enrolled_at", None)
        next_allowed: datetime | None = None
        if isinstance(last, datetime) and (last.year == now.year and last.month == now.month):
            if now.month == 12:
                next_allowed = datetime(now.year + 1, 1, 1, 0, 0, 0)
            else:
                next_allowed = datetime(now.year, now.month + 1, 1, 0, 0, 0)
        return {"last_enrolled_at": last, "next_allowed_at": next_allowed}

    def list_users(self, db: Session, *, company_id: int | None = None, limit: int = 100, offset: int = 0, q: str | None = None):
        return self._users.list(db, company_id=company_id, limit=limit, offset=offset, q=q)

    def get_user(self, db: Session, *, user_id: int, company_id: int | None = None):
        user = self._users.get(db, user_id=user_id, company_id=company_id)
        if user is None:
            raise ValueError("User not found")
        return user

    def create_user(
        self,
        db: Session,
        *,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
        create_login: bool = True,
    ):
        name = name.strip()
        if not name:
            raise ValueError("name is required")
        code = code.strip() if code else None
        email = email.strip() if email else None
        role = role.strip() if role else None
        status = status.strip() if status else None
        if create_login and not email:
            raise ValueError("email là bắt buộc để gửi link kích hoạt")

        def _suggest_username() -> str | None:
            # Prefer employee code as username; fallback to email local-part.
            if code:
                return code
            if email and "@" in email:
                return email.split("@", 1)[0]
            return None

        def _unique_username(base: str) -> str:
            base = base.strip()
            if not base:
                base = "user"
            cand = base[:64]
            if self._iam.get_by_username(db, cand) is None:
                return cand
            for i in range(2, 1000):
                suffix = str(i)
                cand = (base[: max(1, 64 - len(suffix))] + suffix)[:64]
                if self._iam.get_by_username(db, cand) is None:
                    return cand
            raise ValueError("Không thể sinh username duy nhất")
        try:
            user = self._users.create(
                db,
                company_id=company_id,
                name=name,
                code=code,
                email=email,
                role=role,
                status=status,
                department_id=department_id,
            )
            if create_login:
                uname_base = _suggest_username()
                user.username = _unique_username(uname_base or "user")
                user.auth_status = "pending"
                user.password_hash = None
                # Default RBAC role for portal access.
                emp_role = self._rbac.get_role_by_key(db, "employee")
                if emp_role is not None:
                    user.roles = [emp_role]
            db.commit()
            db.refresh(user)
            if create_login:
                # send invite email (may raise ValueError if SMTP not configured)
                self._auth.invite_pending_user(db, user_id=int(user.id))
            return user
        except IntegrityError:
            db.rollback()
            raise ValueError("Duplicate code/email")

    def update_user(
        self,
        db: Session,
        *,
        user_id: int,
        company_id: int | None = None,
        name: str,
        code: str | None = None,
        email: str | None = None,
        role: str | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ):
        name = name.strip()
        if not name:
            raise ValueError("name is required")
        code = code.strip() if code else None
        email = email.strip() if email else None
        role = role.strip() if role else None
        status = status.strip() if status else None
        try:
            user = self._users.update_fields(
                db,
                user_id=user_id,
                company_id=company_id,
                name=name,
                code=code,
                email=email,
                role=role,
                status=status,
                department_id=department_id,
            )
            if user is None:
                raise ValueError("User not found")
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            raise ValueError("Duplicate code/email")

    def delete_user(self, db: Session, *, user_id: int, company_id: int | None = None) -> None:
        ok = self._users.delete(db, user_id=user_id, company_id=company_id)
        if not ok:
            raise ValueError("User not found")
        db.commit()
