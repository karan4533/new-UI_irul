"""Transport fee live registry: upsert, assign, collect, idempotency, campus isolation."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-transport-fees"

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
                    "id": "STU-TRN-1",
                    "name": "Transport Student",
                    "admissionNo": "ADM-TRN-1",
                    "className": "Grade 5",
                    "academicYear": "2026-27",
                }
            ],
            "installments": [],
            "transactions": [],
            "receipts": [],
            "transportFees": [],
            "feeCategories": [],
            "feeStructures": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    saved = client.put("/api/v1/finance/state", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text


def test_transport_fee_upsert_assign_collect_idempotent():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed_finance(client, head)

        created = client.post(
            "/api/v1/finance/actions/upsert-transport-fee",
            headers=head,
            json={
                "routeId": "RT-TEST-1",
                "routeName": "Route North Test",
                "billingCycle": "Yearly",
                "amount": 18000,
                "academicYear": "2026-27",
            },
        )
        assert created.status_code == 200, created.text
        fee_id = created.json()["fee"]["id"]

        assigned = client.post(
            "/api/v1/finance/actions/assign-transport-fee",
            headers=head,
            json={
                "feeId": fee_id,
                "studentId": "STU-TRN-1",
                "studentName": "Transport Student",
                "routeId": "RT-TEST-1",
                "stopName": "Stop A",
            },
        )
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["skipped"] is False
        assignment_id = assigned.json()["assignment"]["id"]
        installment_id = assigned.json()["installmentId"]

        again = client.post(
            "/api/v1/finance/actions/assign-transport-fee",
            headers=head,
            json={"feeId": fee_id, "studentId": "STU-TRN-1", "routeId": "RT-TEST-1"},
        )
        assert again.status_code == 200
        assert again.json()["skipped"] is True
        assert again.json()["reason"] == "already_assigned"

        listed = client.get("/api/v1/finance/actions/transport-fees", headers=head)
        assert listed.status_code == 200, listed.text
        assert listed.json()["feeCount"] == 1
        assert listed.json()["assignmentCount"] == 1
        assert listed.json()["assignments"][0]["paymentStatus"] == "Unpaid"

        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        inst = next(row for row in state["installments"] if row["id"] == installment_id)
        assert inst["source"] == "transport-enrollment"
        assert float(inst["balanceAmount"]) == 18000

        collected = client.post(
            "/api/v1/finance/actions/collect-transport-fee",
            headers=head,
            json={"assignmentId": assignment_id, "paymentMode": "CASH"},
        )
        assert collected.status_code == 200, collected.text
        assert collected.json()["assignment"]["paymentStatus"] == "Paid"
        assert collected.json()["receipt"]["receiptNo"]

        collected_again = client.post(
            "/api/v1/finance/actions/collect-transport-fee",
            headers=head,
            json={"assignmentId": assignment_id},
        )
        assert collected_again.status_code == 200
        assert collected_again.json().get("skipped") is True

        listed2 = client.get("/api/v1/finance/actions/transport-fees", headers=head).json()
        assert listed2["assignments"][0]["paymentStatus"] == "Paid"
        matches = [
            row
            for row in client.get("/api/v1/finance/state", headers=head).json()["data"]["installments"]
            if row.get("transportAssignmentId") == assignment_id
        ]
        assert len(matches) == 1

        db = SessionLocal()
        try:
            audits = db.scalars(select(AuditLog).where(AuditLog.action.like("finance.transport_fee.%"))).all()
            assert len(audits) >= 2
            assert all(row.campus_id is not None for row in audits)
        finally:
            db.close()


def test_transport_fee_campus_isolation_and_rbac():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        _seed_finance(client, head)

        created = client.post(
            "/api/v1/finance/actions/upsert-transport-fee",
            headers=head,
            json={"routeId": "RT-ISO", "routeName": "Iso Route", "amount": 9000, "billingCycle": "Yearly"},
        )
        assert created.status_code == 200
        assert (
            client.post(
                "/api/v1/finance/actions/assign-transport-fee",
                headers=head,
                json={
                    "feeId": created.json()["fee"]["id"],
                    "studentId": "STU-TRN-1",
                    "routeId": "RT-ISO",
                },
            ).status_code
            == 200
        )

        denied = client.post(
            "/api/v1/finance/actions/upsert-transport-fee",
            headers=teacher,
            json={"routeId": "RT-X", "routeName": "X", "amount": 1},
        )
        assert denied.status_code == 403

        db = SessionLocal()
        try:
            role = db.scalars(select(Role).where(Role.code == "accounthead")).one()
            campus_b = Campus(
                id=uuid4(),
                code=f"TRN-{uuid4().hex[:6].upper()}",
                name="Transport Iso",
                city="Test",
            )
            db.add(campus_b)
            db.flush()
            user_b = User(
                id=uuid4(),
                email=f"head.trn.{uuid4().hex[:6]}@qmis.edu",
                password_hash=hash_password("accounts123"),
                role_id=role.id,
                campus_id=campus_b.id,
                is_active=True,
                must_change_password=False,
            )
            db.add(user_b)
            db.commit()
            email_b = user_b.email
        finally:
            db.close()

        head_b = _login(client, email_b, "accounts123")
        _seed_finance(client, head_b)
        listed_b = client.get("/api/v1/finance/actions/transport-fees", headers=head_b)
        assert listed_b.status_code == 200
        assert listed_b.json()["feeCount"] == 0
        assert listed_b.json()["assignmentCount"] == 0


def test_transport_fee_assign_with_long_uuid_student_id():
    """UUID student ids must not blow audit_logs.entity_id varchar(64)."""
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed_finance(client, head)
        student_id = str(uuid4())
        created = client.post(
            "/api/v1/finance/actions/upsert-transport-fee",
            headers=head,
            json={
                "routeId": "RT-UUID-LONG",
                "routeName": "UUID Route Long Name",
                "billingCycle": "Yearly",
                "amount": 7500,
            },
        )
        assert created.status_code == 200, created.text
        fee_id = created.json()["fee"]["id"]
        assigned = client.post(
            "/api/v1/finance/actions/assign-transport-fee",
            headers=head,
            json={
                "feeId": fee_id,
                "studentId": student_id,
                "studentName": "UUID Transport Student",
                "routeId": "RT-UUID-LONG",
            },
        )
        assert assigned.status_code == 200, assigned.text
        assignment_id = assigned.json()["assignment"]["id"]
        assert len(assignment_id) <= 48
        assert assigned.json()["skipped"] is False
        again = client.post(
            "/api/v1/finance/actions/assign-transport-fee",
            headers=head,
            json={"feeId": fee_id, "studentId": student_id, "routeId": "RT-UUID-LONG"},
        )
        assert again.status_code == 200
        assert again.json()["skipped"] is True
        assert again.json()["assignment"]["id"] == assignment_id
