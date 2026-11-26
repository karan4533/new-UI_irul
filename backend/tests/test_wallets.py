"""Wave A6: school wallet ledger (open, recharge, spend, freeze) on the campus finance snapshot."""

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-wallets"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog

A = "/api/v1/finance/actions"


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
            "glEntries": [],
            "wallets": [],
            "walletRecharges": [],
            "walletSpends": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    assert client.put("/api/v1/finance/state", json=payload, headers=headers).status_code == 200


def test_wallet_open_recharge_spend_freeze_flow():
    key = uuid4().hex[:6]
    email = f"wallet.{key}@student.school.com"
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)

        opened = client.post(f"{A}/open-wallet", headers=head, json={"name": "Wallet Kid", "email": email, "role": "Student"})
        assert opened.status_code == 200, opened.text
        wallet_id = opened.json()["wallet"]["walletId"]
        assert opened.json()["wallet"]["status"] == "Zero Balance"
        assert client.post(f"{A}/open-wallet", headers=head, json={"name": "Wallet Kid", "email": email, "role": "Student"}).json()["skipped"] is True
        assert client.post(f"{A}/open-wallet", headers=head, json={"name": "X", "email": "bad", "role": "Student"}).status_code == 400

        # Gateway recharge blocked, evidence required, offline recharge posts once.
        gateway = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": 100, "mode": "UPI", "reference": "g1"})
        assert gateway.status_code == 409
        no_ref = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": 100})
        assert no_ref.status_code == 400
        bad_amt = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": -5, "reference": "b1"})
        assert bad_amt.status_code == 400
        recharge = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": 500, "mode": "CASH", "reference": f"REC-{key}"})
        assert recharge.status_code == 200, recharge.text
        assert recharge.json()["skipped"] is False
        assert recharge.json()["glBalanced"] is True
        assert recharge.json()["wallet"]["balanceAmount"] == 500
        repeat = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": 500, "mode": "CASH", "reference": f"REC-{key}"})
        assert repeat.json()["skipped"] is True
        assert repeat.json()["wallet"]["balanceAmount"] == 500
        missing = client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": "WLT-NOPE", "amount": 5, "reference": "m1"})
        assert missing.status_code == 404

        # Spend: overdraft blocked, valid spend once, repeat skipped.
        over = client.post(f"{A}/spend-wallet", headers=head, json={"walletId": wallet_id, "amount": 900, "vendor": "Canteen — Lunch", "category": "Canteen", "reference": "s-over"})
        assert over.status_code == 409
        spend = client.post(f"{A}/spend-wallet", headers=head, json={"walletId": wallet_id, "amount": 85, "vendor": "Canteen — Lunch", "category": "Canteen", "reference": f"BILL-{key}"})
        assert spend.status_code == 200, spend.text
        assert spend.json()["wallet"]["balanceAmount"] == 415
        spend_again = client.post(f"{A}/spend-wallet", headers=head, json={"walletId": wallet_id, "amount": 85, "vendor": "Canteen — Lunch", "category": "Canteen", "reference": f"BILL-{key}"})
        assert spend_again.json()["skipped"] is True
        bad_cat = client.post(f"{A}/spend-wallet", headers=head, json={"walletId": wallet_id, "amount": 1, "vendor": "x", "category": "Casino", "reference": "c1"})
        assert bad_cat.status_code == 400

        # Freeze blocks spend and recharge; reason required; unfreeze restores.
        assert client.post(f"{A}/set-wallet-status", headers=head, json={"walletId": wallet_id, "status": "Frozen"}).status_code == 400
        frozen = client.post(f"{A}/set-wallet-status", headers=head, json={"walletId": wallet_id, "status": "Frozen", "reason": "Lost card"})
        assert frozen.status_code == 200 and frozen.json()["wallet"]["status"] == "Frozen"
        assert client.post(f"{A}/spend-wallet", headers=head, json={"walletId": wallet_id, "amount": 5, "vendor": "x", "category": "Other", "reference": "fz1"}).status_code == 409
        assert client.post(f"{A}/recharge-wallet", headers=head, json={"walletId": wallet_id, "amount": 5, "reference": "fz2"}).status_code == 409
        assert client.post(f"{A}/set-wallet-status", headers=head, json={"walletId": wallet_id, "status": "Active"}).json()["wallet"]["status"] == "Active"

        listed = client.get(f"{A}/wallets", headers=head).json()
        summary = listed["summary"]
        assert summary["totalHeld"] == 415
        assert summary["walletCount"] == 1
        assert summary["rechargesTodayAmount"] == 500
        assert summary["spentTodayAmount"] == 85
        assert summary["ledgerDrift"] == []
        assert len(listed["recharges"]) == 1 and len(listed["spends"]) == 1
        assert listed["spends"][0]["amount"].startswith("−")

        # Accounting integration: wallet liability holds the net balance, trial balance balances.
        stmt = client.get(f"{A}/financial-statements", headers=head).json()
        assert stmt["trialBalance"]["balanced"] is True
        assert stmt["profitLoss"]["totalIncome"] == 85
        bs = {row["label"]: row["amount"] for row in stmt["balanceSheet"]["rows"] if row["type"] == "item"}
        assert bs["Wallet Balances Payable (User Wallets)"] == "415"
        assert stmt["balanceSheet"]["balanced"] is True

        # Snapshot PUT carrying the registries keeps them (no wipe).
        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        assert len(state["wallets"]) == 1 and len(state["walletSpends"]) == 1

        db = SessionLocal()
        try:
            actions = {r.action for r in db.scalars(select(AuditLog).where(AuditLog.action.like("finance.wallet.%"))).all()}
            assert {"finance.wallet.open", "finance.wallet.recharge", "finance.wallet.spend", "finance.wallet.status"} <= actions
        finally:
            db.close()


def test_wallet_rbac_teacher_forbidden():
    with TestClient(app) as client:
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        for path, body in (
            ("open-wallet", {"name": "A", "email": "a@b.co", "role": "Student"}),
            ("recharge-wallet", {"walletId": "W", "amount": 1, "reference": "r"}),
            ("spend-wallet", {"walletId": "W", "amount": 1, "vendor": "v", "reference": "r"}),
            ("set-wallet-status", {"walletId": "W", "status": "Frozen", "reason": "x"}),
        ):
            assert client.post(f"{A}/{path}", headers=teacher, json=body).status_code == 403, path
