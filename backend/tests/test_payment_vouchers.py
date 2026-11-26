"""Wave A4: unified payment voucher register + vendor liability payment."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-payment-vouchers"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog, FinanceRecord, User


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed(client, headers, liability_id: str):
    payload = {
        "data": {
            "students": [{"id": "STU-PV-1", "name": "Voucher Student", "admissionNo": "ADM-PV-1"}],
            "installments": [],
            "transactions": [
                {
                    "id": "TXN-FEE-1",
                    "transactionNo": "TXN-0001",
                    "direction": "IN",
                    "sourceModule": "FEE",
                    "studentId": "STU-PV-1",
                    "amount": 500,
                    "voucherNo": "RV-0001",
                    "status": "POSTED",
                }
            ],
            "receipts": [],
            "concessions": [],
            "feeCategories": [],
            "feeStructures": [],
            "fineRules": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 5, "voucher": 5, "link": 1},
            "meta": {"seeded": True},
        }
    }
    assert client.put("/api/v1/finance/state", json=payload, headers=headers).status_code == 200
    db = SessionLocal()
    try:
        user = db.scalars(select(User).where(User.email == "accounthead@qmis.edu")).first()
        db.add(
            FinanceRecord(
                id=uuid4(),
                campus_id=user.campus_id,
                collection="purchase_liabilities",
                public_id=liability_id,
                body={
                    "id": liability_id,
                    "poId": "PO-PV-1",
                    "poNumber": "PO-0001",
                    "vendorId": "V-1",
                    "vendorName": "Acme Stationers",
                    "amount": 2500,
                    "status": "Open",
                },
            )
        )
        db.commit()
    finally:
        db.close()


def test_voucher_register_and_vendor_payment_idempotent():
    liability_id = f"LIAB-PO-PV-{uuid4().hex[:6]}"
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head, liability_id)

        listed = client.get("/api/v1/finance/actions/payment-vouchers", headers=head)
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert body["counts"]["fees"] == 1
        assert body["fees"][0]["payee"] == "Voucher Student"
        mine = next(r for r in body["vendorLiabilities"] if r["id"] == liability_id)
        assert mine["payee"] == "Acme Stationers"
        assert mine["amount"] == 2500
        assert mine["status"] == "Pending Payment"
        open_before = body["counts"]["vendorOpen"]

        paid = client.post(
            "/api/v1/finance/actions/pay-vendor-liability",
            headers=head,
            json={"liabilityId": liability_id, "paymentMode": "BANK_TRANSFER"},
        )
        assert paid.status_code == 200, paid.text
        assert paid.json()["skipped"] is False
        assert paid.json()["glBalanced"] is True
        assert paid.json()["liability"]["status"] == "Paid"

        again = client.post(
            "/api/v1/finance/actions/pay-vendor-liability",
            headers=head,
            json={"liabilityId": liability_id},
        )
        assert again.status_code == 200
        assert again.json()["skipped"] is True

        after = client.get("/api/v1/finance/actions/payment-vouchers", headers=head).json()
        assert after["counts"]["vendorOpen"] == open_before - 1
        assert [r["id"] for r in after["vendorPayments"]] == [f"VPAY-{liability_id}"]
        assert next(r for r in after["vendorLiabilities"] if r["id"] == liability_id)["status"] == "Paid"
        assert after["counts"]["fees"] == 1

        db = SessionLocal()
        try:
            audits = db.scalars(
                select(AuditLog).where(
                    AuditLog.action == "finance.vendor_payment.post",
                    AuditLog.entity_id == f"VPAY-{liability_id}"[:64],
                )
            ).all()
            assert len(audits) == 1
        finally:
            db.close()


def test_vendor_payment_forbidden_for_teacher_and_missing_liability():
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        denied = client.post(
            "/api/v1/finance/actions/pay-vendor-liability",
            headers=teacher,
            json={"liabilityId": "LIAB-X"},
        )
        assert denied.status_code == 403
        missing = client.post(
            "/api/v1/finance/actions/pay-vendor-liability",
            headers=head,
            json={"liabilityId": "LIAB-DOES-NOT-EXIST"},
        )
        assert missing.status_code == 404
