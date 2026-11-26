"""HR Payroll → Finance Payment Voucher: txn integrity, GL, idempotency, reverse, RBAC, campus."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-payroll-vouchers"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import AuditLog, Campus, HrRecord, Role, User


def _client():
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed_finance(client, headers):
    payload = {
        "data": {
            "students": [],
            "installments": [],
            "transactions": [],
            "receipts": [],
            "cheques": [],
            "paymentLinks": [],
            "approvals": [],
            "concessions": [],
            "auditLog": [],
            "glEntries": [],
            "dayBookEntries": [],
            "cashBookEntries": [],
            "bankBookEntries": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    saved = client.put("/api/v1/finance/state", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text


def _month(pid: str, *, status="Paid", amount=55000, emp="EMP-PV-1", name="Payroll Staff"):
    return {
        "id": pid,
        "employeeId": emp,
        "employeeName": name,
        "month": "July",
        "year": 2026,
        "paymentStatus": status,
        "netSalary": amount,
        "paymentMode": "BANK_TRANSFER",
    }


def _money(value) -> float:
    if isinstance(value, (int, float)):
        return float(value or 0)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def _gl_totals(data: dict, txn_id: str) -> tuple[float, float]:
    debit = credit = 0.0
    for row in data.get("glEntries") or []:
        if str(row.get("sourceTransactionId") or "") != str(txn_id):
            continue
        debit += _money(row.get("debit"))
        credit += _money(row.get("credit"))
    return debit, credit


def test_payroll_paid_posts_balanced_voucher_with_audit():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        _seed_finance(client, head)

        res = client.put("/api/v1/hr/payroll-months", headers=hr, json=[_month("PAY-PV-1")])
        assert res.status_code == 200, res.text

        listed = client.get("/api/v1/finance/payroll-vouchers", headers=head)
        assert listed.status_code == 200, listed.text
        assert listed.json()["count"] >= 1
        voucher = next(v for v in listed.json()["vouchers"] if v["linkedPayrollMonthId"] == "PAY-PV-1")
        assert voucher["sourceModule"] == "PAYROLL"
        assert voucher["direction"] == "OUT"
        assert voucher["amount"] == 55000
        assert voucher["voucherNo"].startswith("PV-")
        assert voucher["status"] == "POSTED"
        assert voucher["voucherStatus"] == "Issued"

        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        debit, credit = _gl_totals(state, voucher["id"])
        assert abs(debit - credit) < 0.01
        assert abs(debit - 55000) < 0.01

        db = SessionLocal()
        try:
            audits = db.scalars(
                select(AuditLog).where(AuditLog.action == "finance.payroll_voucher.post")
            ).all()
            assert any(a.entity_id == voucher["id"] for a in audits)
            assert all(a.campus_id is not None for a in audits if a.entity_id == voucher["id"])
        finally:
            db.close()


def test_duplicate_paid_month_is_idempotent():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        _seed_finance(client, head)
        payload = [_month("PAY-PV-DUP")]
        assert client.put("/api/v1/hr/payroll-months", headers=hr, json=payload).status_code == 200
        assert client.put("/api/v1/hr/payroll-months", headers=hr, json=payload).status_code == 200

        direct = client.post(
            "/api/v1/finance/actions/post-payroll-voucher",
            headers=head,
            json=_month("PAY-PV-DUP"),
        )
        assert direct.status_code == 200, direct.text
        assert direct.json().get("skipped") is True
        assert direct.json().get("reason") == "already_posted"

        txns = client.get("/api/v1/finance/state", headers=head).json()["data"]["transactions"]
        ids = [t["id"] for t in txns if t.get("linkedPayrollMonthId") == "PAY-PV-DUP"]
        assert len(ids) == 1


def test_invalid_amount_fails_without_persisting_paid_payroll():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        _seed_finance(client, head)

        bad = client.put(
            "/api/v1/hr/payroll-months",
            headers=hr,
            json=[_month("PAY-PV-ZERO", amount=0)],
        )
        assert bad.status_code == 400, bad.text

        months = client.get("/api/v1/hr/payroll-months", headers=hr)
        assert months.status_code == 200
        assert not any(m.get("id") == "PAY-PV-ZERO" for m in months.json())

        txns = client.get("/api/v1/finance/state", headers=head).json()["data"]["transactions"]
        assert not any("PAY-PV-ZERO" in str(t.get("id") or "") for t in txns)


def test_reverse_payroll_voucher_balances_and_is_idempotent():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        _seed_finance(client, head)
        assert client.put("/api/v1/hr/payroll-months", headers=hr, json=[_month("PAY-PV-REV")]).status_code == 200
        voucher_id = f"PAYROLL-PAY-PV-REV-July-2026"

        rev = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=head,
            json={"transactionId": voucher_id, "remarks": "Correction"},
        )
        assert rev.status_code == 200, rev.text
        assert rev.json()["glBalanced"] is True
        assert rev.json()["transaction"]["status"] == "REVERSED"

        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        rev_id = rev.json()["reversal"]["id"]
        debit, credit = _gl_totals(state, rev_id)
        assert abs(debit - credit) < 0.01

        again = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=head,
            json={"transactionId": voucher_id},
        )
        assert again.status_code == 200
        assert again.json().get("skipped") is True
        assert again.json().get("reason") == "already_reversed"

        third = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=head,
            json={"transactionId": voucher_id},
        )
        assert third.status_code == 200
        assert third.json().get("reason") == "already_reversed"

        listed = client.get("/api/v1/finance/payroll-vouchers", headers=head)
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert body["paymentCount"] == len(body["payments"])
        assert body["reversalCount"] == len(body["reversals"])
        assert all(not str(v.get("voucherNo") or "").startswith("RV-") for v in body["payments"])
        assert all(
            str(v.get("voucherType") or "").lower() == "reversal"
            or str(v.get("id") or "").startswith("REV-")
            for v in body["reversals"]
        )
        assert len([v for v in body["reversals"] if v.get("reversesTransactionId") == voucher_id]) == 1
        assert voucher_id in {v.get("id") for v in body["payments"]}
        assert body["vouchers"] == body["payments"]

        # Cannot reverse the REV row itself
        bad_rev = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=head,
            json={"transactionId": rev_id},
        )
        assert bad_rev.status_code == 400

        db = SessionLocal()
        try:
            audits = db.scalars(
                select(AuditLog).where(AuditLog.action == "finance.payroll_voucher.reverse")
            ).all()
            assert any(a.entity_id == voucher_id for a in audits)
        finally:
            db.close()


def test_role_permissions_for_post_list_reverse():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        asst = _login(client, "finance.assistant@qmis.edu", "finance123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        _seed_finance(client, head)

        assert client.put("/api/v1/hr/payroll-months", headers=hr, json=[_month("PAY-PV-RBAC")]).status_code == 200
        voucher_id = "PAYROLL-PAY-PV-RBAC-July-2026"

        # Assistant can list / read payroll vouchers
        listed = client.get("/api/v1/finance/payroll-vouchers", headers=asst)
        assert listed.status_code == 200, listed.text

        # Assistant cannot reverse (no finance.write / approve)
        denied = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=asst,
            json={"transactionId": voucher_id},
        )
        assert denied.status_code == 403

        # Teacher cannot post or reverse
        assert (
            client.post(
                "/api/v1/finance/actions/post-payroll-voucher",
                headers=teacher,
                json=_month("PAY-PV-TCH"),
            ).status_code
            == 403
        )
        assert (
            client.post(
                "/api/v1/finance/actions/reverse-payroll-voucher",
                headers=teacher,
                json={"transactionId": voucher_id},
            ).status_code
            == 403
        )

        # Teacher cannot mark payroll paid
        assert client.put("/api/v1/hr/payroll-months", headers=teacher, json=[_month("PAY-PV-TCH")]).status_code == 403


def test_campus_isolation_for_payroll_vouchers():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        hr = _login(client, "hr@qmis.edu", "hr12345")
        _seed_finance(client, head)
        assert client.put("/api/v1/hr/payroll-months", headers=hr, json=[_month("PAY-PV-ISO")]).status_code == 200
        voucher_id = "PAYROLL-PAY-PV-ISO-July-2026"

        db = SessionLocal()
        try:
            role = db.scalars(select(Role).where(Role.code == "accounthead")).one()
            campus_b = Campus(
                id=uuid4(),
                code=f"PV-{uuid4().hex[:6].upper()}",
                name="Payroll Iso Campus",
                city="Test",
            )
            db.add(campus_b)
            db.flush()
            user_b = User(
                id=uuid4(),
                email=f"head.pv.{uuid4().hex[:6]}@qmis.edu",
                password_hash=hash_password("accounts123"),
                role_id=role.id,
                campus_id=campus_b.id,
                is_active=True,
                must_change_password=False,
            )
            db.add(user_b)
            db.commit()
            email_b = user_b.email
            campus_b_id = campus_b.id
        finally:
            db.close()

        head_b = _login(client, email_b, "accounts123")
        _seed_finance(client, head_b)

        listed_b = client.get("/api/v1/finance/payroll-vouchers", headers=head_b)
        assert listed_b.status_code == 200
        assert listed_b.json()["count"] == 0
        assert not any(v.get("id") == voucher_id for v in listed_b.json()["vouchers"])

        # Cannot reverse another campus voucher via empty campus snapshot
        missing = client.post(
            "/api/v1/finance/actions/reverse-payroll-voucher",
            headers=head_b,
            json={"transactionId": voucher_id},
        )
        assert missing.status_code == 404

        # Campus A still has the voucher
        listed_a = client.get("/api/v1/finance/payroll-vouchers", headers=head)
        assert any(v.get("id") == voucher_id for v in listed_a.json()["vouchers"])

        # HR months also campus-scoped
        db = SessionLocal()
        try:
            rows = db.scalars(
                select(HrRecord).where(
                    HrRecord.collection == "payroll-months",
                    HrRecord.public_id == "PAY-PV-ISO",
                )
            ).all()
            assert len(rows) == 1
            assert rows[0].campus_id != campus_b_id
        finally:
            db.close()


def test_direct_post_endpoint_and_not_paid_skip():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed_finance(client, head)
        skipped = client.post(
            "/api/v1/finance/actions/post-payroll-voucher",
            headers=head,
            json=_month("PAY-PV-DRAFT", status="Draft", amount=1000),
        )
        assert skipped.status_code == 200
        assert skipped.json().get("skipped") is True
        assert skipped.json().get("reason") == "not_paid"

        posted = client.post(
            "/api/v1/finance/actions/post-payroll-voucher",
            headers=head,
            json=_month("PAY-PV-DIRECT", amount=12000),
        )
        assert posted.status_code == 200, posted.text
        assert posted.json()["glBalanced"] is True
        assert posted.json()["voucherNo"].startswith("PV-")
