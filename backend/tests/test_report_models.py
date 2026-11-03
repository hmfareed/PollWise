import uuid
from datetime import UTC, datetime

import pytest

from app.models.election import Election, ReportExport


def test_report_export_model_attributes():
    election_id = uuid.uuid4()
    user_id = uuid.uuid4()
    export_id = uuid.uuid4()
    now = datetime.now(UTC)

    report = ReportExport(
        id=export_id,
        election_id=election_id,
        report_type="certified_results",
        file_format="csv",
        file_name="certified_results.csv",
        checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        generated_by=user_id,
        created_at=now,
    )

    assert report.id == export_id
    assert report.election_id == election_id
    assert report.report_type == "certified_results"
    assert report.file_format == "csv"
    assert report.file_name == "certified_results.csv"
    assert report.generated_by == user_id
    assert report.created_at == now
    assert report.__tablename__ == "report_exports"
