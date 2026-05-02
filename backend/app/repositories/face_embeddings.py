from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.face_embedding import FaceEmbedding


class FaceEmbeddingRepository:
    def create(self, db: Session, *, user_id: int, embedding_json: str) -> FaceEmbedding:
        record = FaceEmbedding(user_id=user_id, embedding=embedding_json)
        db.add(record)
        return record

    def list_all(self, db: Session) -> list[FaceEmbedding]:
        stmt = select(FaceEmbedding).order_by(FaceEmbedding.id.asc())
        return list(db.execute(stmt).scalars().all())

    def list_by_user(self, db: Session, user_id: int) -> list[FaceEmbedding]:
        stmt = select(FaceEmbedding).where(FaceEmbedding.user_id == user_id).order_by(FaceEmbedding.id.desc())
        return list(db.execute(stmt).scalars().all())

    def delete_by_user(self, db: Session, user_id: int) -> int:
        records = self.list_by_user(db, user_id=user_id)
        for r in records:
            db.delete(r)
        db.flush()
        return len(records)
