from __future__ import annotations

import io
import unittest
from unittest.mock import patch

from fastapi.security import HTTPAuthorizationCredentials
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from starlette.datastructures import UploadFile

from app.api.deps import get_current_user
from app.core.errors import AUTH_ACCOUNT_DISABLED, AppException
from app.core.security import create_access_token, hash_password, validate_password_strength, validate_runtime_security
from app.core.settings import settings
from app.core.throttling import FailedAttemptLimiter
from app.core.uploads import read_validated_audio_upload, read_validated_image_upload
from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.services.auth import AuthService


class TestSecurityHardening(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__, User.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_validate_password_strength_rejects_weak_password(self) -> None:
        with self.assertRaises(ValueError):
            validate_password_strength("abcdefg", username="tester")
        with self.assertRaises(ValueError):
            validate_password_strength("12345678", username="tester")
        validate_password_strength("strongpass1", username="tester")

    def test_validate_runtime_security_rejects_weak_jwt_secret_in_production(self) -> None:
        with patch.object(settings, "ENV", "production"), patch.object(settings, "JWT_SECRET", "change_me"):
            with self.assertRaises(RuntimeError):
                validate_runtime_security()

    def test_login_rejects_inactive_user(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="Company 1")
            db.add(company)
            db.flush()
            user = User(
                company_id=int(company.id),
                name="Inactive User",
                username="inactive_user",
                password_hash=hash_password("inactivepass1"),
                auth_status="active",
                status="inactive",
            )
            db.add(user)
            db.commit()

            with self.assertRaises(AppException) as ctx:
                AuthService().login(db, identifier="inactive_user", password="inactivepass1")
            self.assertEqual(ctx.exception.error.code, AUTH_ACCOUNT_DISABLED.code)

    def test_current_user_rejects_inactive_status_even_with_valid_token(self) -> None:
        with self.SessionLocal() as db:
            company = Company(code="c1", name="Company 1")
            db.add(company)
            db.flush()
            user = User(
                company_id=int(company.id),
                name="Inactive User",
                username="inactive_user",
                password_hash=hash_password("inactivepass1"),
                auth_status="active",
                status="inactive",
            )
            db.add(user)
            db.commit()

            token = create_access_token(subject=str(int(user.id)))
            creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            with self.assertRaises(AppException) as ctx:
                get_current_user(creds=creds, db=db)
            self.assertEqual(ctx.exception.error.code, AUTH_ACCOUNT_DISABLED.code)

    def test_failed_attempt_limiter_blocks_after_threshold(self) -> None:
        limiter = FailedAttemptLimiter()
        limiter.ensure_allowed(
            scope="login",
            key="127.0.0.1:test",
            max_failures=2,
            window_seconds=60,
            block_seconds=120,
            detail="too many",
        )
        limiter.record_failure(scope="login", key="127.0.0.1:test", max_failures=2, window_seconds=60, block_seconds=120)
        limiter.record_failure(scope="login", key="127.0.0.1:test", max_failures=2, window_seconds=60, block_seconds=120)
        with self.assertRaises(AppException):
            limiter.ensure_allowed(
                scope="login",
                key="127.0.0.1:test",
                max_failures=2,
                window_seconds=60,
                block_seconds=120,
                detail="too many",
            )


class TestUploadValidation(unittest.IsolatedAsyncioTestCase):
    async def test_read_validated_image_upload_rejects_non_image(self) -> None:
        upload = UploadFile(filename="x.txt", file=io.BytesIO(b"not-an-image"), headers={"content-type": "image/png"})
        with self.assertRaises(ValueError):
            await read_validated_image_upload(upload, max_bytes=1024, field_label="Ảnh")

    async def test_read_validated_image_upload_accepts_small_png(self) -> None:
        buf = io.BytesIO()
        Image.new("RGB", (4, 4), color=(255, 0, 0)).save(buf, format="PNG")
        buf.seek(0)
        upload = UploadFile(filename="face.png", file=buf, headers={"content-type": "image/png"})
        payload, content_type = await read_validated_image_upload(upload, max_bytes=1024 * 1024, field_label="Ảnh")
        self.assertGreater(len(payload), 0)
        self.assertEqual(content_type, "image/png")

    async def test_read_validated_audio_upload_rejects_invalid_mime(self) -> None:
        upload = UploadFile(filename="x.txt", file=io.BytesIO(b"not-audio"), headers={"content-type": "text/plain"})
        with self.assertRaises(ValueError):
            await read_validated_audio_upload(upload, max_bytes=1024, field_label="Âm thanh")

    async def test_read_validated_audio_upload_accepts_small_mp3(self) -> None:
        upload = UploadFile(filename="ok.mp3", file=io.BytesIO(b"ID3test-audio"), headers={"content-type": "audio/mpeg"})
        payload, content_type = await read_validated_audio_upload(upload, max_bytes=1024 * 1024, field_label="Âm thanh")
        self.assertEqual(payload, b"ID3test-audio")
        self.assertEqual(content_type, "audio/mpeg")
