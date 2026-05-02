from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.clients.ml_client import MlClient
from app.repositories.face_embeddings import FaceEmbeddingRepository
from app.repositories.users import UserRepository


class UserService:
    def __init__(self) -> None:
        self._users = UserRepository()
        self._embeddings = FaceEmbeddingRepository()
        self._ml = MlClient()

    def enroll(self, db: Session, *, name: str, image_bytes: bytes) -> int:
        user = self._users.create(db, name=name)
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
        db.commit()

    def list_users(self, db: Session, *, limit: int = 100, offset: int = 0, q: str | None = None):
        return self._users.list(db, limit=limit, offset=offset, q=q)

    def get_user(self, db: Session, *, user_id: int):
        user = self._users.get(db, user_id=user_id)
        if user is None:
            raise ValueError("User not found")
        return user

    def create_user(
        self,
        db: Session,
        *,
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
            user = self._users.create(
                db,
                name=name,
                code=code,
                email=email,
                role=role,
                status=status,
                department_id=department_id,
            )
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            raise ValueError("Duplicate code/email")

    def update_user(
        self,
        db: Session,
        *,
        user_id: int,
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

    def delete_user(self, db: Session, *, user_id: int) -> None:
        ok = self._users.delete(db, user_id=user_id)
        if not ok:
            raise ValueError("User not found")
        db.commit()
