import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GenerateReportRequest(BaseModel):
    report_type: Literal["certified_results", "turnout", "summary", "audit_trail"]
    file_format: Literal["csv", "json"] = "csv"


class ReportExportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    report_type: str
    file_format: str
    file_name: str
    checksum: str | None = None
    generated_by: uuid.UUID
    created_at: datetime


class ReportExportListResponse(BaseModel):
    items: list[ReportExportItem]
    total_count: int


class GenerateReportResponse(BaseModel):
    report: ReportExportItem
    download_url: str
    content_preview: str | None = None
