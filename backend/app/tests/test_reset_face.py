from __future__ import annotations

import unittest

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.user import User
from app.services.users import UserService


class TestResetFace(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        # NOTE: FaceEmbedding model uses MySQL LONGTEXT which SQLite can't compile.
        # This test focuses on `face_enrolled_at` clearing + ensuring the repository delete is invoked.
        Base.metadata.create_all(self.engine, tables=[User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_reset_face_clears_embedding_and_timestamp(self) -> None:
        with self.SessionLocal() as db:
            u = User(company_id=1, name="U1")
            setattr(u, "face_enrolled_at", datetime(2026, 5, 1, 10, 0, 0))
            db.add(u)
            db.commit()
            db.refresh(u)

            deleted: list[int] = []

            svc = UserService()
            svc._embeddings.delete_by_user = lambda _db, *, user_id: deleted.append(int(user_id))  # type: ignore[method-assign]
            svc.reset_face(db, user_id=int(u.id))

            got = db.get(User, int(u.id))
            self.assertIsNotNone(got)
            self.assertIsNone(getattr(got, "face_enrolled_at", None))
            self.assertEqual(deleted, [int(u.id)])
