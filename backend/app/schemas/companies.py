from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CompanyListOut(BaseModel):
    id: int
    code: str
    name: str
    status: str
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geo_radius_meters: float | None = None
    require_gps_on_attendance: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyOut(CompanyListOut):
    logo_data_url: str | None = None


class CompanyCreateRequest(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    status: str | None = Field(default="active", max_length=16)
    address: str | None = Field(default=None, max_length=255)
    latitude: float | None = None
    longitude: float | None = None
    geo_radius_meters: float | None = None
    require_gps_on_attendance: bool = False


class CompanyUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=64)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = Field(default=None, max_length=16)
    address: str | None = Field(default=None, max_length=255)
    latitude: float | None = None
    longitude: float | None = None
    geo_radius_meters: float | None = None
    require_gps_on_attendance: bool | None = None
