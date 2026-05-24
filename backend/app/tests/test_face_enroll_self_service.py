from __future__ import annotations

import unittest

from datetime import datetime
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.user import User
from app.services.users import UserService


class TestFaceEnrollSelfService(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_self_enroll_can_update_face_multiple_times_without_monthly_limit(self) -> None:
        with self.SessionLocal() as db:
            user = User(company_id=1, name="U1")
            setattr(user, "face_enrolled_at", datetime(2026, 5, 1, 10, 0, 0))
            db.add(user)
            db.commit()
            db.refresh(user)

            svc = UserService()
            deleted: list[int] = []
            created: list[tuple[int, str]] = []

            svc._ml.extract_embedding = lambda image_bytes: [0.1, 0.2, 0.3]  # type: ignore[method-assign]
            svc._embeddings.delete_by_user = lambda _db, *, user_id: deleted.append(int(user_id))  # type: ignore[method-assign]
            svc._embeddings.create = (  # type: ignore[method-assign]
                lambda _db, *, user_id, embedding_json: created.append((int(user_id), embedding_json))
            )
            svc._policy.get_or_create = (  # type: ignore[method-assign]
                lambda _db, *, company_id=None: SimpleNamespace(timezone="Asia/Ho_Chi_Minh")
            )

            first = svc.enroll_face_self(db, user_id=int(user.id), image_bytes=b"img-1")
            second = svc.enroll_face_self(db, user_id=int(user.id), image_bytes=b"img-2")

            db.refresh(user)

            self.assertTrue(first["enrolled"])
            self.assertTrue(second["enrolled"])
            self.assertEqual(deleted, [int(user.id), int(user.id)])
            self.assertEqual(len(created), 2)
            self.assertIsInstance(first["face_enrolled_at"], datetime)
            self.assertIsInstance(second["face_enrolled_at"], datetime)
            self.assertIsNotNone(getattr(user, "face_enrolled_at", None))

    def test_face_status_never_returns_next_allowed_timestamp(self) -> None:
        with self.SessionLocal() as db:
            enrolled_at = datetime(2026, 5, 23, 9, 30, 0)
            user = User(company_id=1, name="U1")
            setattr(user, "face_enrolled_at", enrolled_at)
            db.add(user)
            db.commit()
            db.refresh(user)

            svc = UserService()
            status = svc.get_face_enroll_status(db, user_id=int(user.id))

            self.assertEqual(status["last_enrolled_at"], enrolled_at)
            self.assertIsNone(status["next_allowed_at"])
