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
        cid = int(getattr(user, "company_id", 0) or 0) or None
        policy = self._policy.get_or_create(db, company_id=cid)
        setattr(user, "face_enrolled_at", datetime.now(ZoneInfo(policy.timezone)).replace(tzinfo=None))
        db.commit()

    def enroll_face_self(self, db: Session, *, user_id: int, image_bytes: bytes) -> dict[str, object]:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        cid = int(getattr(user, "company_id", 0) or 0) or None
        policy = self._policy.get_or_create(db, company_id=cid)
        now = datetime.now(ZoneInfo(policy.timezone)).replace(tzinfo=None)

        emb = self._ml.extract_embedding(image_bytes=image_bytes)
        import json

        emb_json = json.dumps(emb, ensure_ascii=False)
        self._embeddings.delete_by_user(db, user_id=user_id)
        self._embeddings.create(db, user_id=user_id, embedding_json=emb_json)
        setattr(user, "face_enrolled_at", now)
        db.commit()
        return {"enrolled": True, "face_enrolled_at": now}

    def reset_face(self, db: Session, *, user_id: int) -> None:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        self._embeddings.delete_by_user(db, user_id=user_id)
        setattr(user, "face_enrolled_at", None)
        db.commit()

    def get_face_enroll_status(self, db: Session, *, user_id: int) -> dict[str, object]:
        user = self._users.get(db, user_id)
        if user is None:
            raise ValueError("User not found")

        last = getattr(user, "face_enrolled_at", None)
        return {"last_enrolled_at": last, "next_allowed_at": None}

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
        portal_role_key: str | None = None,
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
        if code:
            existed_code = self._users.get_by_code(db, company_id=company_id, code=code)
            if existed_code is not None:
                raise ValueError("Mã nhân viên đã tồn tại trong công ty")
        if email:
            existed = self._users.get_by_email(db, company_id=company_id, email=email)
            if existed is not None:
                raise ValueError("Email đã tồn tại trong công ty")

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
                key = (portal_role_key or "employee").strip() if portal_role_key else "employee"
                if key not in {"employee", "manager"}:
                    raise ValueError("portal_role_key không hợp lệ (chỉ hỗ trợ employee/manager)")
                r = self._rbac.get_role_by_key(db, key) or self._rbac.get_role_by_key(db, "employee")
                if r is not None:
                    user.roles = [r]
            db.commit()
            db.refresh(user)
            if create_login:
                # send invite email (may raise ValueError if SMTP not configured)
                self._auth.invite_pending_user(db, user_id=int(user.id))
            return user
        except IntegrityError:
            db.rollback()
            # Keep a deterministic error message even if DB constraint differs across environments.
            if code and (self._users.get_by_code(db, company_id=company_id, code=code) is not None):
                raise ValueError("Mã nhân viên đã tồn tại trong công ty")
            if email and (self._users.get_by_email(db, company_id=company_id, email=email) is not None):
                raise ValueError("Email đã tồn tại trong công ty")
            raise ValueError("Trùng mã nhân viên hoặc email")

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
        if code:
            existed_code = self._users.get_by_code(db, company_id=company_id, code=code)
            if existed_code is not None and int(existed_code.id) != int(user_id):
                raise ValueError("Mã nhân viên đã tồn tại trong công ty")
        if email:
            existed = self._users.get_by_email(db, company_id=company_id, email=email)
            if existed is not None and int(existed.id) != int(user_id):
                raise ValueError("Email đã tồn tại trong công ty")
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
            if code:
                existed_code = self._users.get_by_code(db, company_id=company_id, code=code)
                if existed_code is not None and int(existed_code.id) != int(user_id):
                    raise ValueError("Mã nhân viên đã tồn tại trong công ty")
            if email:
                existed = self._users.get_by_email(db, company_id=company_id, email=email)
                if existed is not None and int(existed.id) != int(user_id):
                    raise ValueError("Email đã tồn tại trong công ty")
            raise ValueError("Trùng mã nhân viên hoặc email")

    def delete_user(self, db: Session, *, user_id: int, company_id: int | None = None) -> None:
        ok = self._users.delete(db, user_id=user_id, company_id=company_id)
        if not ok:
            raise ValueError("User not found")
        db.commit()
