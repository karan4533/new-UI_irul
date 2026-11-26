"""Wave A academic fees: structures, concessions, unpaid/defaulters."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-academic-fees"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import AuditLog, Campus, Role, User


def _client():
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed_finance(client, headers):
    payload = {
        "data": {
            "students": [
                {
                    "id": "STU-ACAD-1",
                    "name": "Academic Student",
                    "admissionNo": "ADM-ACAD-1",
                    "className": "Grade 6",
                    "section": "A",
                    "academicYear": "2026-27",
                }
            ],
            "installments": [
                {
                    "id": "INST-ACAD-1",
                    "studentId": "STU-ACAD-1",
                    "feeCategoryId": "CAT-TUITION",
                    "feeHead": "Tuition Fee",
                    "feeAmount": 10000,
                    "concessionAmount": 0,
                    "fineAmount": 0,
                    "netAmount": 10000,
                    "paidAmount": 0,
                    "balanceAmount": 10000,
                    "status": "UNPAID",
                    "dueDate": "2026-01-01",
                    "academicYear": "2026-27",
                }
            ],
            "transactions": [],
            "receipts": [],
            "concessions": [],
            "feeCategories": [{"id": "CAT-TUITION", "name": "Tuition"}],
            "feeStructures": [],
            "fineRules": [],
            "activityFees": [{"id": "AFE-KEEP", "recordType": "fee"}],
            "transportFees": [{"id": "TFE-KEEP", "recordType": "fee"}],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    saved = client.put("/api/v1/finance/state", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text


def test_fee_structure_upsert_list_and_concession_unpaid():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed_finance(client, head)

        created = client.post(
            "/api/v1/finance/actions/upsert-fee-structure",
            headers=head,
            json={
                "academicYear": "2026-27",
                "className": "Grade 6",
                "feeCategoryId": "CAT-TUITION",
                "feeHead": "Tuition Fee",
                "frequency": "YEARLY",
                "amount": 12000,
                "dueDayOfMonth": 10,
                "mandatory": True,
                "status": "ACTIVE",
            },
        )
        assert created.status_code == 200, created.text
        fee_id = created.json()["structure"]["id"]
        assert created.json()["structure"]["amount"] == 12000

        listed = client.get("/api/v1/finance/actions/fee-structures", headers=head)
        assert listed.status_code == 200, listed.text
        assert listed.json()["structureCount"] >= 1
        assert any(row["id"] == fee_id for row in listed.json()["structures"])

        # Activity/transport registries must survive structure upsert.
        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        assert any(row.get("id") == "AFE-KEEP" for row in (state.get("activityFees") or []))
        assert any(row.get("id") == "TFE-KEEP" for row in (state.get("transportFees") or []))

        concession = client.post(
            "/api/v1/finance/actions/create-concession",
            headers=head,
            json={
                "studentId": "STU-ACAD-1",
                "feeCategoryId": "CAT-TUITION",
                "type": "Sibling",
                "amount": 10,
                "amountType": "PERCENT",
                "academicYear": "2026-27",
            },
        )
        assert concession.status_code == 200, concession.text
        assert concession.json()["skipped"] is False
        assert concession.json()["installmentsUpdated"] >= 1

        again = client.post(
            "/api/v1/finance/actions/create-concession",
            headers=head,
            json={"id": concession.json()["concession"]["id"], "studentId": "STU-ACAD-1", "amount": 10},
        )
        assert again.status_code == 200
        assert again.json().get("skipped") is True

        unpaid = client.get("/api/v1/finance/actions/unpaid-installments", headers=head)
        assert unpaid.status_code == 200, unpaid.text
        body = unpaid.json()
        assert body["defaulterCount"] >= 1
        assert body["totalOutstanding"] > 0
        assert body["defaulters"][0]["studentId"] == "STU-ACAD-1"

        db = SessionLocal()
        try:
            audits = db.scalars(
                select(AuditLog).where(AuditLog.action.like("finance.fee_structure.%"))
            ).all()
            assert len(audits) >= 1
        finally:
            db.close()


def test_academic_fee_rbac_teacher_forbidden():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        _seed_finance(client, head)
        denied = client.post(
            "/api/v1/finance/actions/upsert-fee-structure",
            headers=teacher,
            json={
                "academicYear": "2026-27",
                "className": "Grade 1",
                "feeHead": "X",
                "amount": 1,
            },
        )
        assert denied.status_code == 403
