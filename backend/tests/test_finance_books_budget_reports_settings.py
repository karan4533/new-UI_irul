"""Waves A7–A10: book fee breakup, annual budget vs GL actuals, finance report pack, FY / tax settings."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-a7-a10"

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


def _gl(row_id, iso, account, debit, credit, department):
    return {
        "id": row_id,
        "dateIso": iso,
        "ledgerAccount": account,
        "debit": str(debit) if debit else "—",
        "credit": str(credit) if credit else "—",
        "department": department,
        "status": "Posted",
    }


def _seed(client, headers):
    payload = {
        "data": {
            "students": [{"id": "S1", "name": "Book Kid", "className": "Grade 5"}],
            "installments": [
                {"id": "I1", "studentId": "S1", "academicYear": "2026-27", "feeAmount": 10000, "concessionAmount": 1000, "paidAmount": 6000, "status": "PARTIALLY_PAID", "dueDate": "2026-06-01"},
                {"id": "I0", "studentId": "S1", "academicYear": "2025-2026", "feeAmount": 8000, "concessionAmount": 0, "paidAmount": 8000, "status": "PAID", "dueDate": "2025-06-01"},
            ],
            "glEntries": [
                _gl("G1", "2026-06-10", "Fuel Expense", 1000, 0, "Transport"),
                _gl("G2", "2026-06-10", "Cash in Hand", 0, 1000, "Transport"),
                _gl("G3", "2026-06-12", "Tuition Fee Income", 0, 5000, "Fees"),
                _gl("G4", "2026-06-12", "Cash in Hand", 5000, 0, "Fees"),
                _gl("G5", "2025-07-01", "Tuition Fee Income", 0, 4000, "Fees"),
                _gl("G6", "2025-07-01", "Cash in Hand", 4000, 0, "Fees"),
            ],
            "annualBudget": [],
            "bookFeeBreakup": [],
            "financeSettings": [],
            "transactions": [],
            "receipts": [],
            "fineRules": [],
            "sequence": {"pay": 1, "rec": 1, "txn": 1, "voucher": 1, "link": 1},
            "meta": {"seeded": True},
        }
    }
    assert client.put("/api/v1/finance/state", json=payload, headers=headers).status_code == 200


def _audit_actions(prefix: str) -> set[str]:
    db = SessionLocal()
    try:
        return {r.action for r in db.scalars(select(AuditLog).where(AuditLog.action.like(f"{prefix}%"))).all()}
    finally:
        db.close()


def test_book_fee_breakup_flow():
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)
        base = {"studentId": "S1", "academicYear": "2026-27", "vendor": "Scholastic", "book": "Grade 5 pack", "quantity": 1, "unitCost": 4200, "assignedFee": 4800}

        first = client.post(f"{A}/upsert-book-fee", headers=head, json=base)
        assert first.status_code == 200, first.text
        line_id = first.json()["line"]["id"]
        assert first.json()["line"]["total"] == 4200
        assert client.post(f"{A}/upsert-book-fee", headers=head, json=base).json()["skipped"] is True

        listed = client.get(f"{A}/book-fees", headers=head).json()
        assert listed["summaries"][0]["status"] == "Under-allocated"
        assert listed["summaries"][0]["difference"] == 600

        notebooks = {**base, "vendor": "Campus Notebooks", "book": "Notebook set", "quantity": 8, "unitCost": 75, "assignedFee": None}
        assert client.post(f"{A}/upsert-book-fee", headers=head, json=notebooks).status_code == 200
        summary = client.get(f"{A}/book-fees", headers=head).json()["summaries"][0]
        assert summary["lineTotal"] == 4800 and summary["status"] == "Matched" and summary["assignedFee"] == 4800

        assert client.post(f"{A}/upsert-book-fee", headers=head, json={**base, "book": "x", "quantity": 1.5}).status_code == 400
        assert client.post(f"{A}/upsert-book-fee", headers=head, json={**base, "book": "x", "unitCost": -1}).status_code == 400
        assert client.post(f"{A}/upsert-book-fee", headers=head, json={**base, "book": "x", "studentId": "NOPE"}).status_code == 404
        assert client.post(f"{A}/upsert-book-fee", headers=head, json={**base, "book": "x", "academicYear": "2026"}).status_code == 400

        updated = client.post(f"{A}/upsert-book-fee", headers=head, json={**base, "id": line_id, "quantity": 2})
        assert updated.json()["created"] is False and updated.json()["line"]["total"] == 8400
        assert client.get(f"{A}/book-fees", headers=head).json()["summaries"][0]["status"] == "Over-allocated"

        assert client.post(f"{A}/delete-book-fee", headers=head, json={"id": line_id}).json()["deleted"] == line_id
        assert client.post(f"{A}/delete-book-fee", headers=head, json={"id": line_id}).json()["skipped"] is True
        assert client.get(f"{A}/book-fees", headers=head).json()["totals"]["lineCount"] == 1
        assert {"finance.book_fee.upsert", "finance.book_fee.delete"} <= _audit_actions("finance.book_fee.")


def test_budget_actuals_come_from_posted_gl():
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)

        created = client.post(f"{A}/upsert-budget-line", headers=head, json={"department": "Transport", "category": "Fuel", "budget": 5000})
        assert created.status_code == 200, created.text
        assert created.json()["line"]["financialYear"] == "2026-27"
        again = client.post(f"{A}/upsert-budget-line", headers=head, json={"department": "Transport", "category": "Fuel", "budget": 5000})
        assert again.json()["skipped"] is True
        over = client.post(f"{A}/upsert-budget-line", headers=head, json={"department": "General", "category": "Fuel audit", "budget": 100, "ledgerAccounts": ["Fuel Expense"]})
        assert over.status_code == 200
        assert client.post(f"{A}/upsert-budget-line", headers=head, json={"department": "X", "category": "Y", "budget": -5}).status_code == 400
        assert client.post(f"{A}/upsert-budget-line", headers=head, json={"department": "X", "category": "Y", "budget": 5, "financialYear": "2026-28"}).status_code == 400

        listed = client.get(f"{A}/annual-budget", headers=head).json()
        rows = {r["department"]: r for r in listed["rows"]}
        assert rows["Transport"]["actual"] == 1000 and rows["Transport"]["utilization"] == 20.0
        assert rows["General"]["actual"] == 1000 and rows["General"]["overBudget"] is True
        assert listed["totals"]["overBudgetCount"] == 1
        assert client.get(f"{A}/annual-budget?financialYear=2025-26", headers=head).json()["rows"] == []
        assert client.get(f"{A}/annual-budget?financialYear=bad", headers=head).status_code == 400

        assistant = _login(client, "finance.assistant@qmis.edu", "finance123")
        assert client.post(f"{A}/upsert-budget-line", headers=assistant, json={"department": "A", "category": "B", "budget": 1}).status_code == 403
        assert "finance.budget.upsert" in _audit_actions("finance.budget.")


def test_report_pack_from_live_collections():
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)
        pack = client.get(f"{A}/report-pack", headers=head)
        assert pack.status_code == 200, pack.text
        body = pack.json()
        assert body["financialYear"] == "2026-27" and body["previousFinancialYear"] == "2025-26"
        assert body["overview"]["totalIncome"] == 5000
        assert body["overview"]["totalExpense"] == 1000
        assert body["overview"]["netSurplus"] == 4000
        assert body["overview"]["collectionEfficiency"] == 66.7
        assert body["overview"]["trend"]["income"][2] == 5000
        assert body["income"]["breakdown"][0]["category"] == "Tuition Fee Income"
        assert body["expenditure"]["breakdown"][0]["percentValue"] == 100.0
        fees = body["feeComparison"]
        assert fees["current"]["netDemand"] == 9000 and fees["current"]["outstanding"] == 3000 and fees["current"]["defaulters"] == 1
        assert fees["previous"]["collected"] == 8000 and fees["previous"]["outstanding"] == 0
        yoy = {r["label"]: r["amount"] for r in body["trends"]["yearOnYear"]}
        assert yoy["Income — 2025-26"] == "₹4,000"
        assert client.get(f"{A}/report-pack?financialYear=2026", headers=head).status_code == 400


def test_finance_settings_fy_and_tax():
    with TestClient(app) as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        _seed(client, head)
        got = client.get(f"{A}/finance-settings", headers=head).json()
        assert got["settings"]["financialYearStart"] == "April"
        assert got["currentFinancialYear"] == "2026-27"
        assert any(fy["aprilToMarch"] for fy in got["financialYears"])

        assert client.post(f"{A}/update-finance-settings", headers=head, json={"financialYearStart": "January"}).status_code == 400
        assert client.post(f"{A}/update-finance-settings", headers=head, json={"gstin": "BAD"}).status_code == 400
        assert client.post(f"{A}/update-finance-settings", headers=head, json={"gstin": "33ABCDE1234F1Z5", "pan": "ZZZZZ1234Z"}).status_code == 400
        assert client.post(f"{A}/update-finance-settings", headers=head, json={"tdsRatePercent": 120}).status_code == 400
        assert client.post(f"{A}/update-finance-settings", headers=head, json={"booksClosure": {"nope": True}}).status_code == 400
        assert client.post(f"{A}/update-finance-settings", headers=head, json={"dateFormat": "YYYY"}).status_code == 400

        body = {"institutionName": "QMIS", "gstin": "33abcde1234f1z5", "pan": "ABCDE1234F", "tdsRatePercent": 10, "booksClosure": {"lock-posted": True}}
        saved = client.post(f"{A}/update-finance-settings", headers=head, json=body)
        assert saved.status_code == 200, saved.text
        assert saved.json()["settings"]["gstin"] == "33ABCDE1234F1Z5"
        assert set(saved.json()["changed"]) >= {"institutionName", "gstin", "pan", "tdsRatePercent", "booksClosure"}
        assert client.post(f"{A}/update-finance-settings", headers=head, json=body).json()["skipped"] is True

        state = client.get("/api/v1/finance/state", headers=head).json()["data"]
        assert state["financeSettings"][0]["tdsRatePercent"] == 10
        again = client.get(f"{A}/finance-settings", headers=head).json()
        assert again["settings"]["booksClosure"]["lock-posted"] is True and again["updatedBy"] == "accounthead@qmis.edu"
        assert "finance.settings.update" in _audit_actions("finance.settings.")


def test_a7_a10_rbac_teacher_forbidden():
    with TestClient(app) as client:
        teacher = _login(client, "teacher@qmis.edu", "teacher123")
        for path, body in (
            ("upsert-book-fee", {"studentId": "S1"}),
            ("delete-book-fee", {"id": "BF-0001"}),
            ("upsert-budget-line", {"department": "A", "category": "B", "budget": 1}),
            ("update-finance-settings", {"tdsRatePercent": 1}),
        ):
            assert client.post(f"{A}/{path}", headers=teacher, json=body).status_code == 403, path
