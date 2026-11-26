"""Wave A5: chart of accounts, journal vouchers, bank reconciliation, financial statements."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-accounting"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed(client, headers):
    payload = {
        "data": {
            "students": [],
            "installments": [],
            "transactions": [],
            "receipts": [],
            "concessions": [],
            "feeCategories": [],
            "feeStructures": [],
            "fineRules": [],
            "glEntries": [
                {
                    "id": "GL-SEED-1",
                    "dateIso": "2026-06-10",
                    "ledgerAccount": "Bank — SBI Current A/c",
                    "debit": "₹10,000",
                    "credit": "—",
                    "sourceTransactionId": "SEED-1",
                    "sourceModule": "FEES",
                    "department": "Fees",
                    "status": "Posted",
                },
                {
                    "id": "GL-SEED-2",
                    "dateIso": "2026-06-10",
                    "ledgerAccount": "Fee Income — Tuition",
                    "debit": "—",
                    "credit": "₹10,000",
                    "sourceTransactionId": "SEED-1",
                    "sourceModule": "FEES",
                    "department": "Fees",
                    "status": "Posted",
                },
            ],
            "bankBookEntries": [
                {
                    "id": "BB-SEED-1",
                    "dateIso": "2026-06-10",
                    "account": "SBI Current A/c",
                    "voucher": "RV-0001",
                    "deposit": "₹10,000",
                    "withdrawal": "—",
                    "description": "Fee receipt",
                }
            ],
            "chartOfAccounts": [],
            "journalVouchers": [],
            "reconciliationItems": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    assert client.put("/api/v1/finance/state", json=payload, headers=headers).status_code == 200


A = "/api/v1/finance/actions"


def test_coa_jv_statements_and_reconciliation_flow():
    suffix = uuid4().hex[:5].upper()
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)

        # Chart of accounts: upsert + idempotent update + name conflict.
        created = client.post(
            f"{A}/upsert-account",
            headers=head,
            json={
                "accountCode": f"5{suffix}",
                "accountName": "Stationery Expense",
                "accountType": "expense",
                "openingBalance": 0,
            },
        )
        assert created.status_code == 200, created.text
        assert created.json()["created"] is True
        again = client.post(
            f"{A}/upsert-account",
            headers=head,
            json={"accountCode": f"5{suffix}", "accountName": "Stationery Expense", "accountType": "Expense", "status": "Active"},
        )
        assert again.json()["created"] is False
        clash = client.post(
            f"{A}/upsert-account",
            headers=head,
            json={"accountCode": f"6{suffix}", "accountName": "stationery  expense", "accountType": "Expense"},
        )
        assert clash.status_code == 409
        bad_type = client.post(
            f"{A}/upsert-account",
            headers=head,
            json={"accountCode": "X1", "accountName": "Weird", "accountType": "Nonsense"},
        )
        assert bad_type.status_code == 400

        coa = client.get(f"{A}/chart-of-accounts", headers=head).json()
        names = {row["accountName"]: row for row in coa["accounts"]}
        assert names["Stationery Expense"]["derived"] is False
        assert names["Bank — SBI Current A/c"]["derived"] is True
        assert names["Bank — SBI Current A/c"]["balanceAmount"] == 10000
        assert names["Fee Income — Tuition"]["accountType"] == "Income"

        # Journal voucher: unbalanced rejected, balanced draft, idempotent by voucherNo, post once.
        unbalanced = client.post(
            f"{A}/create-journal-voucher",
            headers=head,
            json={
                "description": "bad",
                "lines": [
                    {"account": "Stationery Expense", "debit": 500},
                    {"account": "Cash in Hand", "credit": 400},
                ],
            },
        )
        assert unbalanced.status_code == 400
        voucher_no = f"JV-TEST-{suffix}"
        jv = client.post(
            f"{A}/create-journal-voucher",
            headers=head,
            json={
                "voucherNo": voucher_no,
                "dateIso": "2026-06-15",
                "description": "Stationery purchase in cash",
                "debitAccount": "Stationery Expense",
                "creditAccount": "Cash in Hand",
                "amount": 1250.5,
            },
        )
        assert jv.status_code == 200, jv.text
        assert jv.json()["voucher"]["status"] == "Draft"
        voucher_id = jv.json()["voucher"]["id"]
        dup = client.post(
            f"{A}/create-journal-voucher",
            headers=head,
            json={"voucherNo": voucher_no, "description": "dup", "debitAccount": "A", "creditAccount": "B", "amount": 1},
        )
        assert dup.json()["skipped"] is True

        posted = client.post(f"{A}/post-journal-voucher", headers=head, json={"voucherId": voucher_id})
        assert posted.status_code == 200, posted.text
        assert posted.json()["skipped"] is False
        assert posted.json()["glBalanced"] is True
        again_post = client.post(f"{A}/post-journal-voucher", headers=head, json={"voucherId": voucher_id})
        assert again_post.json()["skipped"] is True
        missing = client.post(f"{A}/post-journal-voucher", headers=head, json={"voucherId": "JV-NOPE"})
        assert missing.status_code == 404

        listed = client.get(f"{A}/journal-vouchers", headers=head).json()
        assert listed["counts"]["posted"] == 1

        # Statements: trial balance balances, P&L reflects the journal expense, date filter works.
        stmt = client.get(f"{A}/financial-statements", headers=head)
        assert stmt.status_code == 200, stmt.text
        body = stmt.json()
        assert body["trialBalance"]["balanced"] is True
        assert body["profitLoss"]["totalIncome"] == 10000
        assert body["profitLoss"]["totalExpense"] == 1250.5
        assert body["balanceSheet"]["balanced"] is True
        early = client.get(f"{A}/financial-statements?dateFrom=2026-06-01&dateTo=2026-06-12", headers=head).json()
        assert early["profitLoss"]["totalExpense"] == 0
        bad_range = client.get(f"{A}/financial-statements?dateFrom=2026-07-01&dateTo=2026-06-01", headers=head)
        assert bad_range.status_code == 400

        # Reconciliation: derived from bank book, evidence required, mismatch stays pending, then matched.
        recon = client.get(f"{A}/bank-reconciliation", headers=head).json()
        assert recon["counts"]["unmatched"] == 1
        item = recon["items"][0]
        assert item["entryId"] == "BB-SEED-1" and item["status"] == "Unmatched"
        no_ref = client.post(f"{A}/reconcile-bank-entry", headers=head, json={"entryId": item["id"], "bankAmount": 10000})
        assert no_ref.status_code == 400
        short = client.post(
            f"{A}/reconcile-bank-entry",
            headers=head,
            json={"entryId": item["id"], "bankAmount": 9900, "statementRef": "UTR123"},
        )
        assert short.status_code == 200, short.text
        assert short.json()["status"] == "Pending Reconciliation"
        assert short.json()["difference"] == 100
        full = client.post(
            f"{A}/reconcile-bank-entry",
            headers=head,
            json={"entryId": item["id"], "bankAmount": 10000, "statementRef": "UTR123"},
        )
        assert full.json()["status"] == "Matched"
        repeat = client.post(
            f"{A}/reconcile-bank-entry",
            headers=head,
            json={"entryId": item["id"], "bankAmount": 10000, "statementRef": "UTR123"},
        )
        assert repeat.json()["skipped"] is True

        db = SessionLocal()
        try:
            actions = {
                row.action
                for row in db.scalars(select(AuditLog).where(AuditLog.action.like("finance.%"))).all()
            }
            assert {
                "finance.coa.upsert",
                "finance.journal_voucher.create",
                "finance.journal_voucher.post",
                "finance.bank_reconciliation.match",
            } <= actions
        finally:
            db.close()


def test_accounting_rbac_teacher_forbidden():
    with TestClient(app) as client:
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        for path, body in (
            ("upsert-account", {"accountCode": "1", "accountName": "X", "accountType": "Asset"}),
            ("create-journal-voucher", {"description": "x", "debitAccount": "A", "creditAccount": "B", "amount": 1}),
            ("post-journal-voucher", {"voucherId": "JV-1"}),
            ("reconcile-bank-entry", {"entryId": "1", "bankAmount": 1, "statementRef": "r"}),
        ):
            assert client.post(f"{A}/{path}", headers=teacher, json=body).status_code == 403, path
