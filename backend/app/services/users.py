from __future__ import annotations

from sqlalchemy.orm import Session

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

    def list_users(self, db: Session, *, limit: int = 100, offset: int = 0):
        return self._users.list(db, limit=limit, offset=offset)
