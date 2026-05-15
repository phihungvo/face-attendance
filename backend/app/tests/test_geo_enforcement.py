from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.services.attendance import AttendanceService


class TestGeoEnforcement(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_radius_zero_disables_geo_fence(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=0.0, require_gps_on_attendance=True)
            db.add(c)
            db.commit()

            svc = AttendanceService()
            geo = svc._enforce_geo(db, user_company_id=int(c.id), latitude=10.0, longitude=106.0)
            self.assertTrue(bool(geo.get("geo_ok")))
            self.assertIsNone(geo.get("distance_meters"))

    def test_require_gps_off_skips_geo_enforcement_even_with_radius(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=250.0)
            db.add(c)
            db.commit()

            svc = AttendanceService()
            geo = svc._enforce_geo(db, user_company_id=int(c.id), latitude=None, longitude=None)
            self.assertTrue(bool(geo.get("geo_ok")))
            self.assertIsNone(geo.get("distance_meters"))

    def test_require_gps_enforces_client_location_even_without_radius(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=0.0, require_gps_on_attendance=True)
            db.add(c)
            db.commit()

            svc = AttendanceService()
            with self.assertRaises(ValueError) as ctx:
                svc._enforce_geo(db, user_company_id=int(c.id), latitude=None, longitude=None)
            self.assertIn("Thiếu vị trí GPS", str(ctx.exception))

    def test_require_gps_on_enforces_radius_when_configured(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=250.0, require_gps_on_attendance=True)
            db.add(c)
            db.commit()

            svc = AttendanceService()
            with self.assertRaises(ValueError) as ctx:
                svc._enforce_geo(db, user_company_id=int(c.id), latitude=11.0, longitude=107.0)
            self.assertIn("Ngoài phạm vi chấm công", str(ctx.exception))
