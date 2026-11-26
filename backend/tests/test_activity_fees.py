"""Activity fee live registry: upsert, assign, collect, idempotency, campus isolation."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-activity-fees"

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
                    "id": "STU-ACT-1",
                    "name": "Activity Student",
                    "admissionNo": "ADM-ACT-1",
                    "className": "Grade 3",
                    "academicYear": "2026-27",
                }
            ],
            "installments": [],
            "transactions": [],
            "receipts": [],
            "activityFees": [],
            "feeCategories": [],
            "feeStructures": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    saved = client.put("/api/v1/finance/state", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text


def test_activity_fee_upsert_assign_collect_idempotent():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed_finance(client, head)

        created = client.post(
            "/api/v1/finance/actions/upsert-activity-fee",
            headers=head,
            json={
                "activityType": "Rifle",
                "insiderAmount": 500,
                "outsiderAmount": 800,
                "academicYear": "2026-27",
                "attendanceRequired": "yes",
                "concessionApplicable": "no",
            },
        )
        assert created.status_code == 200, created.text
        fee_id = created.json()["fee"]["id"]

        assigned = client.post(
            "/api/v1/finance/actions/assign-activity-fee",
            headers=head,
            json={
                "feeId": fee_id,
                "participantType": "Insider",
                "studentId": "STU-ACT-1",
                "participantName": "Activity Student",
            },
        )
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["skipped"] is False
        assignment_id = assigned.json()["assignment"]["id"]
        installment_id = assigned.json()["installmentId"]

        again = client.post(
            "/api/v1/finance/actions/assign-activity-fee",
            headers=head,
            json={
                "feeId": fee_id,
                "participantType": "Insider",
                "studentId": "STU-ACT-1",
            },
        )
        assert again.status_code == 200, again.text
        assert again.json()["skipped"] is True
        assert again.json()["reason"] == "already_assigned"

        listed = client.get("/api/v1/finance/actions/activity-fees", headers=head)
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert body["feeCount"] == 1
        assert body["assignmentCount"] == 1
        assert body["assignments"][0]["paymentStatus"] == "Unpaid"

        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        inst = next(row for row in state["installments"] if row["id"] == installment_id)
        assert inst["source"] == "activity-enrollment"
        assert float(inst["balanceAmount"]) == 500

        collected = client.post(
            "/api/v1/finance/actions/collect-activity-fee",
            headers=head,
            json={"assignmentId": assignment_id, "paymentMode": "CASH"},
        )
        assert collected.status_code == 200, collected.text
        assert collected.json()["assignment"]["paymentStatus"] == "Paid"
        assert collected.json()["receipt"]["receiptNo"]

        collected_again = client.post(
            "/api/v1/finance/actions/collect-activity-fee",
            headers=head,
            json={"assignmentId": assignment_id},
        )
        assert collected_again.status_code == 200
        assert collected_again.json().get("skipped") is True

        listed2 = client.get("/api/v1/finance/actions/activity-fees", headers=head).json()
        assert listed2["assignments"][0]["paymentStatus"] == "Paid"

        # Only one activity installment for this assignment
        state2 = client.get("/api/v1/finance/state", headers=head).json()["data"]
        matches = [row for row in state2["installments"] if row.get("activityAssignmentId") == assignment_id]
        assert len(matches) == 1

        db = SessionLocal()
        try:
            audits = db.scalars(select(AuditLog).where(AuditLog.action.like("finance.activity_fee.%"))).all()
            assert len(audits) >= 2
            assert all(row.campus_id is not None for row in audits)
        finally:
            db.close()


def test_activity_fee_campus_isolation_and_rbac():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        _seed_finance(client, head)

        created = client.post(
            "/api/v1/finance/actions/upsert-activity-fee",
            headers=head,
            json={
                "activityType": "ASA",
                "insiderAmount": 300,
                "outsiderAmount": 400,
                "academicYear": "2026-27",
            },
        )
        assert created.status_code == 200
        fee_id = created.json()["fee"]["id"]
        assert (
            client.post(
                "/api/v1/finance/actions/assign-activity-fee",
                headers=head,
                json={"feeId": fee_id, "participantType": "Insider", "studentId": "STU-ACT-1"},
            ).status_code
            == 200
        )

        denied = client.post(
            "/api/v1/finance/actions/upsert-activity-fee",
            headers=teacher,
            json={"activityType": "Rifle", "insiderAmount": 1, "outsiderAmount": 1},
        )
        assert denied.status_code == 403

        db = SessionLocal()
        try:
            role = db.scalars(select(Role).where(Role.code == "accounthead")).one()
            campus_b = Campus(
                id=uuid4(),
                code=f"ACT-{uuid4().hex[:6].upper()}",
                name="Activity Iso",
                city="Test",
            )
            db.add(campus_b)
            db.flush()
            user_b = User(
                id=uuid4(),
                email=f"head.act.{uuid4().hex[:6]}@qmis.edu",
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
        listed_b = client.get("/api/v1/finance/actions/activity-fees", headers=head_b)
        assert listed_b.status_code == 200
        assert listed_b.json()["feeCount"] == 0
        assert listed_b.json()["assignmentCount"] == 0
