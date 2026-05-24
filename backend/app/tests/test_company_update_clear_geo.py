from __future__ import annotations

import base64
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.services.companies import CompanyService


class TestCompanyUpdateClearGeo(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine, tables=[Company.__table__])
        self.SessionLocal = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_update_can_clear_lat_lng_and_radius(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=250.0, require_gps_on_attendance=True)
            db.add(c)
            db.commit()

            svc = CompanyService()
            updated = svc.update_company(
                db,
                company_id=int(c.id),
                latitude=None,
                longitude=None,
                geo_radius_meters=0.0,
                require_gps_on_attendance=False,
            )
            self.assertIsNone(updated.latitude)
            self.assertIsNone(updated.longitude)
            self.assertEqual(float(updated.geo_radius_meters or 0), 0.0)
            self.assertFalse(bool(updated.require_gps_on_attendance))

    def test_update_does_not_clear_geo_when_unset(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1", latitude=10.0, longitude=106.0, geo_radius_meters=250.0)
            db.add(c)
            db.commit()

            svc = CompanyService()
            updated = svc.update_company(db, company_id=int(c.id), name="C1-new")
            self.assertEqual(updated.name, "C1-new")
            self.assertEqual(updated.latitude, 10.0)
            self.assertEqual(updated.longitude, 106.0)
            self.assertEqual(updated.geo_radius_meters, 250.0)

    def test_update_company_logo_persists_blob_and_data_url(self) -> None:
        with self.SessionLocal() as db:
            c = Company(code="c1", name="C1")
            db.add(c)
            db.commit()

            svc = CompanyService()
            payload = b"\x89PNG\r\n\x1a\nlogo"
            updated = svc.update_company_logo(db, company_id=int(c.id), logo_bytes=payload, content_type="image/png")

            self.assertEqual(updated.logo_blob, payload)
            self.assertEqual(updated.logo_mime_type, "image/png")
            self.assertEqual(updated.logo_data_url, f"data:image/png;base64,{base64.b64encode(payload).decode('ascii')}")
